"""API tests for household inventory (/inventory) CRUD endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.item import Item, ItemType

PASSWORD = "correct-horse-battery"


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
    _, headers = register_and_login(client)

    # 1. Create quantity-tracked ingredient (omitting unit -> inherits Item.default_unit "g")
    create_res = client.post(
        "/inventory",
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

    # 2. Duplicate (household_id, item_id) returns 400
    dup_res = client.post(
        "/inventory",
        json={"item_id": 23001, "quantity": 250},
        headers=headers,
    )
    assert dup_res.status_code == 400
    assert dup_res.json()["detail"] == "Item already exists in household inventory"

    # 3. Create appliance entry -> forces quantity & unit to None
    app_res = client.post(
        "/inventory",
        json={"item_id": 81001, "quantity": 1, "unit": "piece", "location": "counter"},
        headers=headers,
    )
    assert app_res.status_code == 201
    app_entry = app_res.json()
    assert app_entry["quantity"] is None
    assert app_entry["unit"] is None
    assert app_entry["is_available"] is True

    # 4. List inventory with filters
    list_all = client.get("/inventory", headers=headers)
    assert list_all.status_code == 200
    assert len(list_all.json()) == 2

    list_ing = client.get(
        "/inventory", params={"item_type": "ingredient"}, headers=headers
    )
    assert len(list_ing.json()) == 1
    assert list_ing.json()[0]["item"]["name"] == "Tomatoes"

    list_loc = client.get(
        "/inventory", params={"location": "counter"}, headers=headers
    )
    assert len(list_loc.json()) == 1
    assert list_loc.json()[0]["item"]["name"] == "Air Fryer"

    # 5. Update inventory entry (quantity -> 0 automatically sets is_available=False)
    patch_res = client.patch(
        f"/inventory/{entry['id']}",
        json={"quantity": 0, "location": "pantry"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["quantity"] == 0.0
    assert updated["is_available"] is False
    assert updated["location"] == "pantry"

    # 6. Delete inventory entry
    del_res = client.delete(f"/inventory/{entry['id']}", headers=headers)
    assert del_res.status_code == 204

    get_deleted = client.get(f"/inventory/{entry['id']}", headers=headers)
    assert get_deleted.status_code == 404


def test_household_isolation_and_membership_authorization(client, db_session):
    seed_catalog_items(db_session)
    user1_id, headers1 = register_and_login(client, email="user1@example.com")
    user2_id, headers2 = register_and_login(client, email="user2@example.com")

    house1 = Household(name="House 1")
    house2 = Household(name="House 2")
    db_session.add_all([house1, house2])
    db_session.flush()

    db_session.add_all(
        [
            HouseholdMember(
                user_id=user1_id, household_id=house1.id, role=HouseholdRole.OWNER
            ),
            HouseholdMember(
                user_id=user2_id, household_id=house2.id, role=HouseholdRole.OWNER
            ),
        ]
    )
    db_session.commit()

    # User 1 adds Tomatoes to House 1
    res1 = client.post(
        "/inventory",
        json={"item_id": 23001, "quantity": 300},
        headers=headers1,
    )
    assert res1.status_code == 201
    entry1_id = res1.json()["id"]

    # User 2 lists their own inventory -> empty
    res2_list = client.get("/inventory", headers=headers2)
    assert res2_list.status_code == 200
    assert res2_list.json() == []

    # User 2 cannot query House 1 explicitly -> 403 Forbidden
    res2_forbidden = client.get(
        "/inventory", params={"household_id": house1.id}, headers=headers2
    )
    assert res2_forbidden.status_code == 403

    # User 2 cannot mutate User 1's entry -> 404 Not Found in User 2's household
    res2_patch = client.patch(
        f"/inventory/{entry1_id}", json={"quantity": 999}, headers=headers2
    )
    assert res2_patch.status_code == 404

