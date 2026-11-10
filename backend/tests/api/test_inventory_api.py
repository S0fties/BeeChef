"""API tests for household inventory (/api/v1/inventory) CRUD endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.item import Item, ItemType

PASSWORD = "correct-horse-battery"
INVENTORY_URL = "/api/v1/inventory"


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def register_and_login(client, email="chef@example.com", full_name="Bee Chef"):
    user_res = client.post(
        "/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": full_name},
    )
    user_id = user_res.json()["id"]
    token = client.post(
        "/auth/login", json={"email": email, "password": PASSWORD}
    ).json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def create_household_for_user(
    db_session,
    user_id: int,
    name: str = "BeeChef House",
    role: HouseholdRole = HouseholdRole.OWNER,
) -> Household:
    house = Household(name=name)
    db_session.add(house)
    db_session.flush()
    db_session.add(
        HouseholdMember(user_id=user_id, household_id=house.id, role=role)
    )
    db_session.commit()
    return house


def seed_catalog_items(db_session):
    items = [
        Item(
            id=23001,
            name="Tomatoes",
            item_type=ItemType.INGREDIENT,
            category="VEGETABLE",
            subcategory="FRUITING_VEGETABLES",
            default_unit="g",
        ),
        Item(
            id=51001,
            name="Salt",
            item_type=ItemType.INGREDIENT,
            category="SPICE_SAUCE",
            subcategory="DRY_SPICE",
            default_unit="g",
        ),
        Item(
            id=81001,
            name="Air Fryer",
            item_type=ItemType.APPLIANCE,
            category="COOKING_APPLIANCE",
            subcategory="ELECTRIC_COOKER",
            default_unit=None,
        ),
    ]
    db_session.add_all(items)
    db_session.commit()


def test_inventory_crud_lifecycle_and_default_unit(client, db_session):
    seed_catalog_items(db_session)
    user_id, headers = register_and_login(client)
    create_household_for_user(db_session, user_id)

    # 1. Create quantity-tracked ingredient (omitting unit -> inherits Item.default_unit "g")
    create_res = client.post(
        INVENTORY_URL,
        json={"item_id": 23001, "quantity": 500, "location": "fridge"},
        headers=headers,
    )
    assert create_res.status_code == 201
    entry = create_res.json()
    assert entry["item_id"] == 23001
    assert entry["quantity"] == 500.0
    assert entry["unit"] == "g"
    assert entry["location"] == "fridge"
    assert entry["is_available"] is True
    assert entry["item"]["name"] == "Tomatoes"

    # 2. Duplicate (household_id, item_id) returns 409 Conflict
    dup_res = client.post(
        INVENTORY_URL,
        json={"item_id": 23001, "quantity": 250},
        headers=headers,
    )
    assert dup_res.status_code == 409
    assert dup_res.json()["detail"] == "Item already exists in household inventory"

    # 3. Create appliance entry -> forces quantity & unit to None
    app_res = client.post(
        INVENTORY_URL,
        json={"item_id": 81001, "quantity": 1, "unit": "piece", "location": "counter"},
        headers=headers,
    )
    assert app_res.status_code == 201
    app_entry = app_res.json()
    assert app_entry["quantity"] is None
    assert app_entry["unit"] is None
    assert app_entry["is_available"] is True

    # 4. List inventory with filters
    list_all = client.get(INVENTORY_URL, headers=headers)
    assert list_all.status_code == 200
    assert len(list_all.json()) == 2

    list_ing = client.get(
        INVENTORY_URL, params={"item_type": "ingredient"}, headers=headers
    )
    assert len(list_ing.json()) == 1
    assert list_ing.json()[0]["item"]["name"] == "Tomatoes"

    list_loc = client.get(
        INVENTORY_URL, params={"location": "counter"}, headers=headers
    )
    assert len(list_loc.json()) == 1
    assert list_loc.json()[0]["item"]["name"] == "Air Fryer"

    # 5. Update inventory entry (quantity -> 0 automatically sets is_available=False)
    patch_res = client.patch(
        f"{INVENTORY_URL}/{entry['id']}",
        json={"quantity": 0, "location": "pantry"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["quantity"] == 0.0
    assert updated["is_available"] is False
    assert updated["location"] == "pantry"

    # 6. Delete inventory entry
    del_res = client.delete(f"{INVENTORY_URL}/{entry['id']}", headers=headers)
    assert del_res.status_code == 204

    get_deleted = client.get(f"{INVENTORY_URL}/{entry['id']}", headers=headers)
    assert get_deleted.status_code == 404


def test_user_without_household_gets_empty_list_and_404_on_write(client, db_session):
    seed_catalog_items(db_session)
    _, headers = register_and_login(client, email="nohouse@example.com")

    # Listing inventory when user has no household returns [] without creating one
    list_res = client.get(INVENTORY_URL, headers=headers)
    assert list_res.status_code == 200
    assert list_res.json() == []

    # Writing inventory when user has no household returns 404 Not Found
    post_res = client.post(
        INVENTORY_URL,
        json={"item_id": 23001, "quantity": 100},
        headers=headers,
    )
    assert post_res.status_code == 404
    assert post_res.json()["detail"] == "Household not found"


def test_household_isolation_and_membership_authorization(client, db_session):
    seed_catalog_items(db_session)
    user1_id, headers1 = register_and_login(client, email="user1@example.com")
    user2_id, headers2 = register_and_login(client, email="user2@example.com")
    member_id, member_headers = register_and_login(client, email="member@example.com")

    house1 = create_household_for_user(db_session, user1_id, name="House 1")
    create_household_for_user(db_session, user2_id, name="House 2")

    # Regular member of House 1 with MEMBER role
    db_session.add(
        HouseholdMember(
            user_id=member_id,
            household_id=house1.id,
            role=HouseholdRole.MEMBER,
        )
    )
    db_session.commit()

    # User 1 adds Tomatoes to House 1
    res1 = client.post(
        INVENTORY_URL,
        json={"item_id": 23001, "quantity": 300},
        headers=headers1,
    )
    assert res1.status_code == 201
    entry1_id = res1.json()["id"]

    # Member in House 1 can view and update House 1's inventory
    member_list = client.get(INVENTORY_URL, headers=member_headers)
    assert member_list.status_code == 200
    assert len(member_list.json()) == 1

    member_patch = client.patch(
        f"{INVENTORY_URL}/{entry1_id}",
        json={"quantity": 450},
        headers=member_headers,
    )
    assert member_patch.status_code == 200
    assert member_patch.json()["quantity"] == 450.0

    # User 2 lists their own inventory -> empty
    res2_list = client.get(INVENTORY_URL, headers=headers2)
    assert res2_list.status_code == 200
    assert res2_list.json() == []

    # User 2 querying non-member House 1 explicitly -> 404 Not Found (hides existence)
    res2_not_found = client.get(
        INVENTORY_URL, params={"household_id": house1.id}, headers=headers2
    )
    assert res2_not_found.status_code == 404
    assert res2_not_found.json()["detail"] == "Household not found"

    # User 2 cannot mutate User 1's entry -> 404 Not Found
    res2_patch = client.patch(
        f"{INVENTORY_URL}/{entry1_id}", json={"quantity": 999}, headers=headers2
    )
    assert res2_patch.status_code == 404


