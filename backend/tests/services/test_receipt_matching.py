"""Unit tests for receipt catalog matching and amount normalization (UC-13).

These use in-memory Item objects and need no database.
"""

import pytest

from app.models.item import Item, ItemType
from app.services.receipt_scanner import ExtractedLine
from app.services.receipt_service import (
    CatalogIndex,
    _match_line,
    _names_agree,
    name_key,
    normalize_amount,
)


def ingredient(item_id, name, unit):
    return Item(
        id=item_id, name=name, item_type=ItemType.INGREDIENT,
        category="X", subcategory="Y", default_unit=unit,
    )


BANANA = ingredient(13001, "Banana", "piece")
TOMATOES = ingredient(23001, "Tomatoes", "kg")
MILK = ingredient(41001, "Milk", "ml")
WHOLE_MILK = ingredient(41005, "Whole Milk", "ml")
EGGS = ingredient(43001, "Eggs", "piece")
EGG = ingredient(43006, "Egg", "piece")
HONEY = ingredient(55001, "Honey", "g")
BANANAS_DUPLICATE = ingredient(99001, "Bananas", "piece")


@pytest.fixture
def catalog():
    return CatalogIndex([BANANA, TOMATOES, MILK, WHOLE_MILK, EGGS, EGG, HONEY, BANANAS_DUPLICATE])


def extracted(name, catalog_item_id=None):
    return ExtractedLine(raw_text=name.upper(), name=name, catalog_item_id=catalog_item_id,
                         quantity=None, unit=None)


# ---------- name_key ----------

@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("Bananas", "banana"),
        ("Tomatoes", "Tomato"),
        ("Berries", "berry"),
        ("Peaches", "Peach"),
        ("  Whole   Milk ", "whole milk"),
        ("Semi-skimmed Milk", "semi skimmed milk"),
    ],
)
def test_name_key_is_case_spacing_and_plural_insensitive(a, b):
    assert name_key(a) == name_key(b)


def test_name_key_keeps_double_s_words():
    assert name_key("Watercress") == "watercress"


# ---------- CatalogIndex ----------

def test_catalog_collapses_duplicates_to_the_original_item(catalog):
    assert catalog.find_by_name("Bananas") is BANANA
    assert catalog.canonical(BANANAS_DUPLICATE) is BANANA
    assert catalog.find_by_name("egg") is EGGS  # 43001 "Eggs" is older than 43006 "Egg"


def test_catalog_listing_shows_units_and_hides_duplicates(catalog):
    listing = catalog.listing()
    assert "13001: Banana [piece]" in listing
    assert "41001: Milk [ml]" in listing
    assert "99001" not in listing
    assert "43006" not in listing


def test_catalog_find_by_name_without_match_returns_none(catalog):
    assert catalog.find_by_name("Kombucha") is None


# ---------- _names_agree / _match_line ----------

@pytest.mark.parametrize(
    ("extracted_name", "catalog_name", "agree"),
    [
        ("Organic Milk", "Milk", True),
        ("Coffee", "Ground Coffee", True),
        ("Eggs", "Egg", True),
        ("Yoghurt", "Yogurt", True),
        ("Whole Milk", "Honey", False),
        ("Lemon", "Melon", False),
    ],
)
def test_names_agree(extracted_name, catalog_name, agree):
    assert _names_agree(extracted_name, catalog_name) is agree


def test_match_uses_the_services_catalog_id(catalog):
    assert _match_line(extracted("Whole Milk", WHOLE_MILK.id), catalog) is WHOLE_MILK


def test_match_maps_a_duplicate_id_to_the_original(catalog):
    assert _match_line(extracted("Bananas", BANANAS_DUPLICATE.id), catalog) is BANANA


def test_match_rejects_an_id_that_does_not_fit_the_name(catalog):
    assert _match_line(extracted("Whole Milk", HONEY.id), catalog) is WHOLE_MILK


def test_match_falls_back_to_the_name_when_no_id(catalog):
    assert _match_line(extracted("Tomato"), catalog) is TOMATOES


def test_match_ignores_unknown_ids(catalog):
    assert _match_line(extracted("Banana", 123456), catalog) is BANANA


def test_unmatched_product_returns_none(catalog):
    assert _match_line(extracted("Kombucha"), catalog) is None


# ---------- normalize_amount ----------

@pytest.mark.parametrize(
    ("item", "quantity", "unit", "raw_text", "expected"),
    [
        # Team-chosen rounded factors: gal 3.75 l, qt 0.95 l, pt 0.5 l, fl oz 30 ml,
        # lb 0.45 kg, oz 28 g (see IMPERIAL_TO_METRIC in receipt_service.py).
        (MILK, 1, "gal", "MILK 1 GAL", (3.75, "l")),
        (MILK, 0.5, "gal", "MILK HALF GALLON", (1.875, "l")),
        (MILK, 2, "qt", "MILK 2 QT", (1.9, "l")),
        (MILK, 2, "pt", "MILK 2 PT", (1.0, "l")),
        (MILK, 16, "fl_oz", "MILK 16 FL OZ", (480, "ml")),
        (BANANA, 2.3, "lb", "BANANAS 2.3 LB", (1.035, "kg")),
        (HONEY, 8, "oz", "HONEY 8 OZ", (224, "g")),
        (EGGS, 1, "dozen", "EGGS DOZEN", (12, "piece")),
        (MILK, 2, "l", "2 X SUT 1L", (2, "l")),
        (BANANA, 3, "pack", "3x ORGANIC BANANAS", (3, "piece")),
        (EGGS, 2, "pack", "EGGS 2 PK", (2, "pack")),
        (EGGS, 2, "pack", "YUMURTA 2 PAKET", (2, "pack")),
        (BANANA, 3, None, "BANANA 3", (3, "piece")),
        (MILK, 1, None, "MILK 1", (1, None)),
        (None, 5, None, "UNKNOWN 5", (5, None)),
        (MILK, None, "l", "MILK", (None, None)),
    ],
)
def test_normalize_amount(item, quantity, unit, raw_text, expected):
    assert normalize_amount(item, quantity, unit, raw_text) == expected
