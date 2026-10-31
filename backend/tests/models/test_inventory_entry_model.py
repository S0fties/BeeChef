"""Tests for the InventoryEntry model."""

import csv
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models import Household, InventoryEntry, Item, ItemType

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
CATALOG_CSV_PATH = DATA_DIR / "items_catalog.csv"
INVENTORY_SAMPLE_CSV_PATH = DATA_DIR / "inventory_sample.csv"


def _create_household_and_items(db_session):
    """Insert one household, one ingredient, and one appliance for inventory tests."""
    household = Household(name="Softies House")
    ingredient = Item(
        id=71001,
        name="Dana Kıyma",
        item_type=ItemType.INGREDIENT,
        category="MEAT",
        subcategory="BEEF",
        default_unit="g",
    )
    appliance = Item(
        id=81001,
        name="Air Fryer",
        item_type=ItemType.APPLIANCE,
        category="COOKING_APPLIANCE",
        subcategory="ELECTRIC_COOKER",
        default_unit=None,
    )
    db_session.add_all([household, ingredient, appliance])
    db_session.commit()
    return household, ingredient, appliance


def test_inventory_entry_can_be_created(db_session):
    """An inventory entry can be inserted into the database and receives an id and timestamps."""
    household, ingredient, _ = _create_household_and_items(db_session)

    entry = InventoryEntry(
        household_id=household.id,
        item_id=ingredient.id,
        quantity=600.0,
        unit="g",
        location="freezer",
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    assert entry.id is not None
    assert entry.is_available is True
    assert entry.created_at is not None
    assert entry.updated_at is not None


def test_inventory_entry_can_be_read(db_session):
    """A saved quantity-based inventory entry can be read back with all fields."""
    household, ingredient, _ = _create_household_and_items(db_session)

    entry = InventoryEntry(
        household_id=household.id,
        item_id=ingredient.id,
        is_available=True,
        quantity=600.0,
        unit="g",
        location="freezer",
    )
    db_session.add(entry)
    db_session.commit()

    saved_entry = db_session.get(InventoryEntry, entry.id)
    assert saved_entry.household_id == entry.household_id
    assert saved_entry.item_id == entry.item_id
    assert saved_entry.is_available == entry.is_available
    assert saved_entry.quantity == entry.quantity
    assert saved_entry.unit == entry.unit
    assert saved_entry.location == entry.location


def test_binary_availability_inventory_entry_can_be_read(db_session):
    """Appliances and quick-entry items can be tracked via is_available with null quantity."""
    household, _, appliance = _create_household_and_items(db_session)

    entry = InventoryEntry(
        household_id=household.id,
        item_id=appliance.id,
        is_available=True,
        quantity=None,
        unit=None,
        location="counter",
    )
    db_session.add(entry)
    db_session.commit()

    saved_entry = db_session.get(InventoryEntry, entry.id)
    assert saved_entry.is_available is True
    assert saved_entry.quantity is None
    assert saved_entry.unit is None
    assert saved_entry.location == "counter"


def test_household_cannot_have_duplicate_entry_for_same_item(db_session):
    """The pair (household_id, item_id) must be unique; other households may have the item."""
    household, ingredient, _ = _create_household_and_items(db_session)
    other_household = Household(name="Neighbor House")
    db_session.add(other_household)
    db_session.commit()

    db_session.add(
        InventoryEntry(
            household_id=household.id,
            item_id=ingredient.id,
            quantity=500.0,
            unit="g",
        )
    )
    db_session.commit()

    # Another household can still track the same item.
    db_session.add(
        InventoryEntry(
            household_id=other_household.id,
            item_id=ingredient.id,
            quantity=250.0,
            unit="g",
        )
    )
    db_session.commit()

    # Same household + same item again must be rejected.
    db_session.add(
        InventoryEntry(
            household_id=household.id,
            item_id=ingredient.id,
            quantity=100.0,
            unit="g",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_inventory_entry_requires_existing_household(db_session):
    """Foreign key must reject an inventory entry pointing to a non-existent household."""
    _, ingredient, _ = _create_household_and_items(db_session)

    db_session.add(
        InventoryEntry(
            household_id=999_999,
            item_id=ingredient.id,
            quantity=100.0,
            unit="g",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_inventory_entry_requires_existing_item(db_session):
    """Foreign key must reject an inventory entry pointing to a non-existent catalog item."""
    household, _, _ = _create_household_and_items(db_session)

    db_session.add(
        InventoryEntry(
            household_id=household.id,
            item_id=999_999,
            quantity=100.0,
            unit="g",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_deleting_household_cascades_to_inventory_entries_but_keeps_items(db_session):
    """Deleting a household removes its inventory entries; the shared catalog item stays."""
    household, ingredient, _ = _create_household_and_items(db_session)
    db_session.add(
        InventoryEntry(
            household_id=household.id,
            item_id=ingredient.id,
            quantity=400.0,
            unit="g",
        )
    )
    db_session.commit()
    household_id = household.id

    db_session.delete(household)
    db_session.commit()

    remaining = db_session.execute(
        text("SELECT COUNT(*) FROM inventory_entries WHERE household_id = :id"),
        {"id": household_id},
    ).scalar_one()
    assert remaining == 0
    assert db_session.get(Item, ingredient.id) is not None


def test_deleting_catalog_item_in_use_is_restricted(db_session):
    """A shared catalog item cannot be deleted while referenced by a household inventory."""
    household, ingredient, _ = _create_household_and_items(db_session)
    db_session.add(
        InventoryEntry(
            household_id=household.id,
            item_id=ingredient.id,
            quantity=400.0,
            unit="g",
        )
    )
    db_session.commit()

    db_session.delete(ingredient)
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_inventory_sample_csv_links_cleanly_with_catalog_csv(db_session):
    """Every entry in inventory_sample.csv must link to a valid item in items_catalog.csv."""
    with CATALOG_CSV_PATH.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            db_session.add(
                Item(
                    id=int(row["id"]),
                    name=row["name"],
                    item_type=ItemType(row["item_type"].lower()),
                    category=row["category"],
                    subcategory=row["subcategory"],
                    default_unit=row["default_unit"] or None,
                )
            )
    household = Household(id=1, name="Sample Household")
    db_session.add(household)
    db_session.commit()

    with INVENTORY_SAMPLE_CSV_PATH.open(encoding="utf-8") as f:
        sample_rows = list(csv.DictReader(f))

    assert len(sample_rows) > 0

    for row in sample_rows:
        db_session.add(
            InventoryEntry(
                id=int(row["id"]),
                household_id=int(row["household_id"]),
                item_id=int(row["item_id"]),
                is_available=row["is_available"].lower() == "true",
                quantity=float(row["quantity"]) if row["quantity"] else None,
                unit=row["unit"] or None,
                location=row["location"] or None,
            )
        )
    db_session.commit()

    count = db_session.execute(
        text("SELECT COUNT(*) FROM inventory_entries WHERE household_id = 1")
    ).scalar_one()
    assert count == len(sample_rows)
