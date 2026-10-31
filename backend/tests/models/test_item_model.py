"""Tests for the Item (shared catalog) model."""

import csv
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models import Item, ItemType

CATALOG_CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "items_catalog.csv"


def test_item_can_be_created(db_session):
    """A catalog item can be inserted into the database and receives an id and timestamp."""
    item = Item(
        name="Domates",
        item_type=ItemType.INGREDIENT,
        category="VEGETABLE",
        subcategory="FRUITING_VEGETABLES",
        default_unit="kg",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    assert item.id is not None
    assert item.created_at is not None


def test_item_can_be_read(db_session):
    """A saved catalog item with a 5-digit hierarchical id can be read back."""
    item = Item(
        id=71001,
        name="Dana Kıyma",
        item_type=ItemType.INGREDIENT,
        category="MEAT",
        subcategory="BEEF",
        default_unit="g",
    )
    db_session.add(item)
    db_session.commit()

    saved_item = db_session.get(Item, item.id)
    assert saved_item.name == item.name
    assert saved_item.item_type == item.item_type
    assert saved_item.category == item.category
    assert saved_item.subcategory == item.subcategory
    assert saved_item.default_unit == item.default_unit


def test_appliance_item_has_null_default_unit(db_session):
    """Appliances and kitchenware are tracked by availability only and have no unit."""
    appliance = Item(
        id=81001,
        name="Air Fryer",
        item_type=ItemType.APPLIANCE,
        category="COOKING_APPLIANCE",
        subcategory="ELECTRIC_COOKER",
        default_unit=None,
    )
    db_session.add(appliance)
    db_session.commit()

    saved_appliance = db_session.get(Item, appliance.id)
    assert saved_appliance.item_type == ItemType.APPLIANCE
    assert saved_appliance.default_unit is None


def test_item_type_is_stored_as_lowercase_value(db_session):
    """The database must store 'ingredient' / 'appliance', not the uppercase name."""
    item = Item(
        id=11001,
        name="Limon",
        item_type=ItemType.INGREDIENT,
        category="FRUIT",
        subcategory="CITRUS",
        default_unit="piece",
    )
    db_session.add(item)
    db_session.commit()

    stored = db_session.execute(
        text("SELECT item_type FROM items WHERE id = :id"),
        {"id": item.id},
    ).scalar_one()
    assert stored == "ingredient"


def test_item_type_defaults_to_ingredient(db_session):
    """An item created without an explicit item_type defaults to INGREDIENT."""
    item = Item(
        name="Patates",
        category="VEGETABLE",
        subcategory="ROOT_VEGETABLES",
        default_unit="kg",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    assert item.item_type == ItemType.INGREDIENT


def test_item_name_must_be_unique(db_session):
    """Two catalog items must never share the same name."""
    db_session.add(
        Item(
            id=23001,
            name="Domates",
            category="VEGETABLE",
            subcategory="FRUITING_VEGETABLES",
            default_unit="kg",
        )
    )
    db_session.commit()

    db_session.add(
        Item(
            id=23099,
            name="Domates",
            category="VEGETABLE",
            subcategory="FRUITING_VEGETABLES",
            default_unit="kg",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_items_catalog_csv_can_be_seeded_cleanly(db_session):
    """Every row in backend/data/items_catalog.csv must be valid and insertable."""
    assert CATALOG_CSV_PATH.exists()

    with CATALOG_CSV_PATH.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    assert len(rows) > 0

    for row in rows:
        item_id = int(row["id"])
        assert 10000 <= item_id <= 99999
        item_type = ItemType(row["item_type"].lower())
        default_unit = row["default_unit"] or None

        if item_type == ItemType.APPLIANCE:
            assert default_unit is None
        else:
            assert default_unit is not None

        db_session.add(
            Item(
                id=item_id,
                name=row["name"],
                item_type=item_type,
                category=row["category"],
                subcategory=row["subcategory"],
                default_unit=default_unit,
            )
        )

    db_session.commit()

    count = db_session.execute(text("SELECT COUNT(*) FROM items")).scalar_one()
    assert count == len(rows)
