"""API tests for shared catalog items (/api/v1/items) endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.inventory_entry import InventoryEntry
from app.models.item import Item, ItemType

PASSWORD = "correct-horse-battery"
ITEMS_URL = "/api/v1/items"


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def register_and_login(client, email="chef@example.com"):
    user_res = client.post(
        "/auth/register",
        json={"email": email, "password": PASSWORD, "name": "bee", "surname": "chef", "user_name": "beechef"},
    )
    user_id = user_res.json()["id"]
    token = client.post(
        "/auth/login", json={"email": email, "password": PASSWORD}
    ).json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def get_auth_headers(client, email="chef@example.com"):
    _, headers = register_and_login(client, email=email)
    return headers


def seed_sample_catalog(db_session):
    items = [
        Item(
            id=11001,
            name="Lemon",
            item_type=ItemType.INGREDIENT,
            category="FRUIT",
            subcategory="CITRUS",
            default_unit="piece",
        ),
        Item(
            id=23001,
            name="Tomatoes",
            item_type=ItemType.INGREDIENT,
            category="VEGETABLE",
            subcategory="FRUITING_VEGETABLES",
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
    return items


def test_list_items_returns_catalog_sorted_and_filtered(client, db_session):
    seed_sample_catalog(db_session)

    # List all
    res = client.get(ITEMS_URL)
    assert res.status_code == 200
    names = [item["name"] for item in res.json()]
    assert names == ["Air Fryer", "Lemon", "Tomatoes"]

    # Search filter (case-insensitive)
    res_search = client.get(ITEMS_URL, params={"search": "tom"})
    assert res_search.status_code == 200
    assert [i["name"] for i in res_search.json()] == ["Tomatoes"]

    # Category filter
    res_cat = client.get(ITEMS_URL, params={"category": "fruit"})
    assert res_cat.status_code == 200
    assert [i["name"] for i in res_cat.json()] == ["Lemon"]

    # Item type filter
    res_type = client.get(ITEMS_URL, params={"item_type": "appliance"})
    assert res_type.status_code == 200
    assert [i["name"] for i in res_type.json()] == ["Air Fryer"]


def test_get_single_item_and_404(client, db_session):
    seed_sample_catalog(db_session)

    res = client.get(f"{ITEMS_URL}/11001")
    assert res.status_code == 200
    assert res.json()["name"] == "Lemon"

    res_missing = client.get(f"{ITEMS_URL}/999999")
    assert res_missing.status_code == 404
    assert res_missing.json()["detail"] == "Catalog item not found"


def test_create_catalog_item_requires_auth_and_returns_409_on_duplicate(client, db_session):
    payload = {
        "name": "Dragon Fruit",
        "item_type": "ingredient",
        "category": "fruit",
        "subcategory": "tropical",
        "default_unit": "piece",
    }

    # Unauthenticated -> 401
    unauth = client.post(ITEMS_URL, json=payload)
    assert unauth.status_code == 401

    headers = get_auth_headers(client)
    res = client.post(ITEMS_URL, json=payload, headers=headers)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Dragon Fruit"
    assert body["category"] == "FRUIT"
    assert body["subcategory"] == "TROPICAL"
    assert body["default_unit"] == "piece"

    # Duplicate name -> 409 Conflict
    dup = client.post(ITEMS_URL, json=payload, headers=headers)
    assert dup.status_code == 409
    assert dup.json()["detail"] == "Catalog item with this name already exists"


def test_create_appliance_forces_default_unit_none(client):
    headers = get_auth_headers(client)
    res = client.post(
        ITEMS_URL,
        json={
            "name": "Waffle Maker",
            "item_type": "appliance",
            "category": "COOKING_APPLIANCE",
            "subcategory": "ELECTRIC_COOKER",
            "default_unit": "piece",
        },
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["default_unit"] is None


def test_update_and_delete_catalog_item_with_owner_role_matrix(client, db_session):
    seed_sample_catalog(db_session)
    owner_id, owner_headers = register_and_login(client, email="owner@example.com")
    member_id, member_headers = register_and_login(client, email="member@example.com")

    household = Household(name="Test House")
    db_session.add(household)
    db_session.flush()
    db_session.add_all(
        [
            HouseholdMember(
                user_id=owner_id,
                household_id=household.id,
                role=HouseholdRole.OWNER,
            ),
            HouseholdMember(
                user_id=member_id,
                household_id=household.id,
                role=HouseholdRole.MEMBER,
            ),
        ]
    )
    db_session.commit()

    # Update item
    patch_res = client.patch(
        f"{ITEMS_URL}/11001",
        json={"name": "Meyer Lemon", "default_unit": "kg"},
        headers=owner_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Meyer Lemon"
    assert patch_res.json()["default_unit"] == "kg"

    # Duplicate name on update -> 409 Conflict
    patch_dup = client.patch(
        f"{ITEMS_URL}/11001",
        json={"name": "Tomatoes"},
        headers=owner_headers,
    )
    assert patch_dup.status_code == 409

    # Non-owner (member) cannot delete a catalog item -> 403 Forbidden
    del_forbidden = client.delete(f"{ITEMS_URL}/23001", headers=member_headers)
    assert del_forbidden.status_code == 403
    assert del_forbidden.json()["detail"] == "Only household owners can delete catalog items"

    # Cannot delete an item referenced by a household inventory entry -> 400 Bad Request
    entry = InventoryEntry(
        household_id=household.id,
        item_id=11001,
        is_available=True,
        quantity=2.0,
        unit="kg",
    )
    db_session.add(entry)
    db_session.commit()

    del_in_use = client.delete(f"{ITEMS_URL}/11001", headers=owner_headers)
    assert del_in_use.status_code == 400
    assert "used in household inventories" in del_in_use.json()["detail"]

    # Owner can delete unused catalog item -> 204 No Content
    del_unused = client.delete(f"{ITEMS_URL}/23001", headers=owner_headers)
    assert del_unused.status_code == 204
    assert client.get(f"{ITEMS_URL}/23001").status_code == 404


