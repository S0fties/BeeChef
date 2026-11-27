"""API tests for UC-13 (Add Confirmed Items from a Receipt).

The Receipt API (Gemini) is replaced by a fake scanner and receipt images are stored
in a per-test temporary folder, so these tests need no network access or API key.
"""

import io

import pytest

from app.core.config import settings
from app.main import app
from app.models.inventory_entry import InventoryEntry
from app.models.item import Item, ItemType
from app.services.receipt_scanner import (
    ExtractedLine,
    NotAReceiptError,
    ReceiptScanError,
    get_receipt_scanner,
)
from app.services.receipt_storage import ReceiptStorage, get_receipt_storage
from tests.helpers import add_household, count_rows, register_and_login

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64

BANANA, MILK, HONEY, COFFEE_POT, BANANAS_DUPLICATE = 13001, 41001, 55001, 91004, 99001


# ---------- fakes & fixtures ----------

class FakeScanner:
    """Stands in for the Gemini scanner; records what it was sent."""

    def __init__(self, lines=None, error=None):
        self.lines = lines or []
        self.error = error
        self.calls = 0
        self.catalog_listing = ""

    def extract(self, image_bytes, media_type, catalog_listing):
        self.calls += 1
        self.catalog_listing = catalog_listing
        if self.error:
            raise self.error
        return self.lines


def line(raw_text, name, catalog_item_id=None, quantity=None, unit=None):
    return ExtractedLine(
        raw_text=raw_text, name=name, catalog_item_id=catalog_item_id,
        quantity=quantity, unit=unit,
    )


@pytest.fixture
def storage(tmp_path):
    store = ReceiptStorage(tmp_path / "receipts", ttl_minutes=60)
    app.dependency_overrides[get_receipt_storage] = lambda: store
    return store  # the client fixture clears dependency overrides on teardown


@pytest.fixture
def install_scanner():
    def _install(scanner):
        app.dependency_overrides[get_receipt_scanner] = lambda: scanner
        return scanner
    return _install


@pytest.fixture
def member(client, db_session):
    user_id, headers = register_and_login(client)
    household = add_household(db_session, user_id)
    return household, headers


@pytest.fixture
def catalog(db_session):
    """A small catalog: ingredients, one appliance and one duplicate name."""
    items = [
        Item(id=BANANA, name="Banana", item_type=ItemType.INGREDIENT,
             category="FRUIT", subcategory="TROPICAL", default_unit="piece"),
        Item(id=MILK, name="Milk", item_type=ItemType.INGREDIENT,
             category="DAIRY_BREAKFAST", subcategory="MILK_YOGURT", default_unit="ml"),
        Item(id=HONEY, name="Honey", item_type=ItemType.INGREDIENT,
             category="SPICE_SAUCE", subcategory="OIL_SAUCE", default_unit="g"),
        Item(id=COFFEE_POT, name="Turkish Coffee Pot", item_type=ItemType.APPLIANCE,
             category="KITCHENWARE", subcategory="COOKWARE", default_unit=None),
        Item(id=BANANAS_DUPLICATE, name="Bananas", item_type=ItemType.INGREDIENT,
             category="FRUIT", subcategory="TROPICAL", default_unit="piece"),
    ]
    db_session.add_all(items)
    db_session.commit()
    return {item.id: item for item in items}


def stored_files(store):
    return list(store.base_dir.glob("*/*")) if store.base_dir.exists() else []


def upload(client, headers, data=PNG, content_type="image/png", filename="receipt.png"):
    return client.post(
        "/api/v1/receipts",
        headers=headers,
        files={"file": (filename, io.BytesIO(data), content_type)},
    )


def upload_id(client, headers):
    response = upload(client, headers)
    assert response.status_code == 201
    return response.json()["receipt_id"]


def scan(client, headers, receipt_id):
    return client.post(f"/api/v1/receipts/{receipt_id}/scan", headers=headers)


def confirm(client, headers, receipt_id, items):
    return client.post(
        f"/api/v1/receipts/{receipt_id}/confirm", headers=headers, json={"items": items}
    )


def inventory_rows(db_session, household_id):
    return (
        db_session.query(InventoryEntry)
        .filter_by(household_id=household_id)
        .order_by(InventoryEntry.item_id)
        .all()
    )


# ---------- Step 1: upload / E1 ----------

def test_upload_stores_receipt_in_household_folder(client, member, storage):
    household, headers = member

    response = upload(client, headers)

    assert response.status_code == 201
    body = response.json()
    assert body["expires_in_seconds"] == 3600
    files = stored_files(storage)
    assert len(files) == 1
    assert files[0].parent.name == str(household.id)
    assert files[0].stem == body["receipt_id"].replace("-", "")


def test_upload_accepts_jpeg(client, member, storage):
    _, headers = member
    response = upload(client, headers, JPEG, "image/jpeg", "receipt.jpg")
    assert response.status_code == 201
    assert stored_files(storage)[0].suffix == ".jpg"


def test_upload_rejects_unsupported_type(client, member, storage):
    _, headers = member
    response = upload(client, headers, b"hello", "text/plain", "notes.txt")
    assert response.status_code == 400
    assert stored_files(storage) == []


def test_upload_rejects_file_that_is_not_really_an_image(client, member, storage):
    _, headers = member
    response = upload(client, headers, b"definitely not an image", "image/png")
    assert response.status_code == 400
    assert "cannot be processed" in response.json()["detail"]
    assert stored_files(storage) == []


def test_upload_rejects_empty_file(client, member, storage):
    _, headers = member
    assert upload(client, headers, b"", "image/png").status_code == 400
    assert stored_files(storage) == []


def test_upload_rejects_oversized_image(client, member, storage, monkeypatch):
    _, headers = member
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 1)
    response = upload(client, headers, PNG + b"\x00" * (1024 * 1024))
    assert response.status_code == 413
    assert stored_files(storage) == []


def test_upload_requires_authentication(client, storage):
    assert upload(client, {}).status_code == 401


def test_upload_requires_household_membership(client, storage):
    _, headers = register_and_login(client, email="nohouse@example.com")
    assert upload(client, headers).status_code == 404
    assert stored_files(storage) == []


# ---------- Steps 2-4: scan ----------

def test_scan_matches_lines_to_catalog_ingredients(
    client, db_session, member, storage, catalog, install_scanner
):
    household, headers = member
    scanner = install_scanner(FakeScanner([
        line("3x ORGANIC BANANAS", "Bananas", BANANAS_DUPLICATE, 3, "pack"),
        line("MILK 1 GAL", "Milk", MILK, 1, "gal"),
        line("KOMBUCHA 16 FL OZ", "Kombucha", None, 16, "fl_oz"),
    ]))
    receipt_id = upload_id(client, headers)

    response = scan(client, headers, receipt_id)

    assert response.status_code == 200
    banana, milk, kombucha = response.json()["candidates"]
    # Duplicate "Bananas" resolves to the original item; "pack" without a pack word -> piece.
    assert (banana["matched_item_id"], banana["quantity"], banana["unit"]) == (BANANA, 3, "piece")
    # Gallons are converted with the team's fixed factor (1 gal = 3.75 l).
    assert (milk["matched_item_id"], milk["quantity"], milk["unit"]) == (MILK, 3.75, "l")
    # Not in the catalog: shown, but not matched.
    assert kombucha["matched_item_id"] is None
    assert kombucha["extracted_name"] == "Kombucha"
    # Scanning writes nothing and keeps the image while the user reviews.
    assert inventory_rows(db_session, household.id) == []
    assert len(stored_files(storage)) == 1
    # Only ingredients, without duplicate names, are offered to the scanning service.
    assert f"{BANANA}: Banana [piece]" in scanner.catalog_listing
    assert "Turkish Coffee Pot" not in scanner.catalog_listing
    assert f"{BANANAS_DUPLICATE}:" not in scanner.catalog_listing


def test_scan_ignores_a_catalog_id_that_does_not_fit_the_name(
    client, member, storage, catalog, install_scanner
):
    _, headers = member
    install_scanner(FakeScanner([line("SUT 1L", "Milk", HONEY, 1, "l")]))
    receipt_id = upload_id(client, headers)

    candidate = scan(client, headers, receipt_id).json()["candidates"][0]

    assert candidate["matched_item_id"] == MILK


def test_scan_never_matches_appliances(client, member, storage, catalog, install_scanner):
    _, headers = member
    install_scanner(FakeScanner([line("COFFEE POT", "Turkish Coffee Pot", COFFEE_POT, 1, "piece")]))
    receipt_id = upload_id(client, headers)

    candidate = scan(client, headers, receipt_id).json()["candidates"][0]

    assert candidate["matched_item_id"] is None


def test_scan_leaves_unitless_weight_amount_for_the_user(
    client, member, storage, catalog, install_scanner
):
    _, headers = member
    install_scanner(FakeScanner([line("MILK 1", "Milk", MILK, 1, None)]))
    receipt_id = upload_id(client, headers)

    candidate = scan(client, headers, receipt_id).json()["candidates"][0]

    assert (candidate["quantity"], candidate["unit"]) == (1, None)  # never "1 ml"


# ---------- E1 / E2 during scan ----------

def test_scan_service_failure_keeps_receipt_for_retry(
    client, db_session, member, storage, catalog, install_scanner
):
    household, headers = member
    scanner = install_scanner(FakeScanner(error=ReceiptScanError("Service down.")))
    receipt_id = upload_id(client, headers)

    response = scan(client, headers, receipt_id)

    assert response.status_code == 502
    assert "could not be completed" in response.json()["detail"]
    assert len(stored_files(storage)) == 1
    assert inventory_rows(db_session, household.id) == []

    scanner.error = None
    scanner.lines = [line("BANANA", "Banana", BANANA, 2, "piece")]
    retry = scan(client, headers, receipt_id)

    assert retry.status_code == 200
    assert retry.json()["candidates"][0]["matched_item_id"] == BANANA
    assert scanner.calls == 2


def test_scan_not_a_receipt_deletes_the_image(client, member, storage, install_scanner):
    _, headers = member
    install_scanner(FakeScanner(error=NotAReceiptError()))
    receipt_id = upload_id(client, headers)

    response = scan(client, headers, receipt_id)

    assert response.status_code == 400
    assert "receipt" in response.json()["detail"]
    assert stored_files(storage) == []


def test_scan_without_api_key_returns_503_and_keeps_receipt(
    client, member, storage, monkeypatch
):
    _, headers = member
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    receipt_id = upload_id(client, headers)

    response = scan(client, headers, receipt_id)

    assert response.status_code == 503
    assert len(stored_files(storage)) == 1


def test_scan_unknown_receipt_returns_404(client, member, storage, install_scanner):
    _, headers = member
    install_scanner(FakeScanner())
    response = scan(client, headers, "0" * 32)
    assert response.status_code == 404


def test_other_household_cannot_scan_or_delete_receipt(
    client, db_session, member, storage, install_scanner
):
    _, owner_headers = member
    receipt_id = upload_id(client, owner_headers)
    other_id, other_headers = register_and_login(client, email="other@example.com")
    add_household(db_session, other_id, name="Other House")
    scanner = install_scanner(FakeScanner())

    assert scan(client, other_headers, receipt_id).status_code == 404
    client.delete(f"/api/v1/receipts/{receipt_id}", headers=other_headers)

    assert scanner.calls == 0
    assert len(stored_files(storage)) == 1  # the owner's receipt is untouched


# ---------- Step 6: confirm / A1 / A2 ----------

def test_confirm_adds_only_confirmed_items_and_deletes_receipt(
    client, db_session, member, storage, catalog
):
    household, headers = member
    receipt_id = upload_id(client, headers)

    # The user discarded the milk line and confirmed only the bananas (A1).
    response = confirm(client, headers, receipt_id, [
        {"item_id": BANANA, "quantity": 3, "unit": "piece", "location": "counter"},
    ])

    assert response.status_code == 200
    assert response.json()["added_count"] == 1
    rows = inventory_rows(db_session, household.id)
    assert [(r.item_id, r.quantity, r.unit, r.location) for r in rows] == [
        (BANANA, 3, "piece", "counter")
    ]
    assert stored_files(storage) == []


def test_confirm_with_no_items_leaves_inventory_and_deletes_receipt(
    client, db_session, member, storage
):
    household, headers = member
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [])  # A2

    assert response.status_code == 200
    assert response.json() == {"added_count": 0, "entries": []}
    assert inventory_rows(db_session, household.id) == []
    assert stored_files(storage) == []


def test_confirm_merges_into_existing_entry_with_unit_conversion(
    client, db_session, member, storage, catalog
):
    household, headers = member
    db_session.add(InventoryEntry(household_id=household.id, item_id=MILK, quantity=500, unit="ml"))
    db_session.commit()
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [
        {"item_id": MILK, "quantity": 1, "unit": "l"},
    ])

    assert response.status_code == 200
    assert response.json()["entries"][0]["quantity"] == 1500
    assert response.json()["entries"][0]["unit"] == "ml"


def test_confirm_combines_duplicate_lines(client, db_session, member, storage, catalog):
    household, headers = member
    receipt_id = upload_id(client, headers)
    bananas = {"item_id": BANANA, "quantity": 2, "unit": "piece"}

    response = confirm(client, headers, receipt_id, [bananas, bananas])

    assert response.status_code == 200
    rows = inventory_rows(db_session, household.id)
    assert len(rows) == 1 and rows[0].quantity == 4


def test_confirm_duplicate_catalog_id_is_saved_as_original_item(
    client, db_session, member, storage, catalog
):
    household, headers = member
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [
        {"item_id": BANANAS_DUPLICATE, "quantity": 3, "unit": "piece"},
    ])

    assert response.status_code == 200
    assert [r.item_id for r in inventory_rows(db_session, household.id)] == [BANANA]


def test_confirm_never_creates_catalog_items(client, db_session, member, storage, catalog):
    _, headers = member
    receipt_id = upload_id(client, headers)
    items_before = count_rows(db_session, Item)

    response = client.post(
        f"/api/v1/receipts/{receipt_id}/confirm",
        headers=headers,
        json={"items": [{"new_item_name": "Kombucha", "new_item_category": "DAIRY_BREAKFAST"}]},
    )

    assert response.status_code == 400
    assert count_rows(db_session, Item) == items_before


@pytest.mark.parametrize("item_id", [COFFEE_POT, 987654])
def test_confirm_rejects_appliances_and_unknown_items(
    client, db_session, member, storage, catalog, item_id
):
    household, headers = member
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [
        {"item_id": BANANA, "quantity": 1, "unit": "piece"},
        {"item_id": item_id},
    ])

    assert response.status_code == 400
    assert "No receipt items were added" in response.json()["detail"]
    assert inventory_rows(db_session, household.id) == []
    assert len(stored_files(storage)) == 1


def test_confirm_requires_unit_for_weight_or_volume(client, db_session, member, storage, catalog):
    household, headers = member
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [{"item_id": MILK, "quantity": 1}])

    assert response.status_code == 400
    assert "Choose a unit" in response.json()["detail"]
    assert inventory_rows(db_session, household.id) == []


def test_confirm_counted_item_without_unit_uses_catalog_unit(
    client, db_session, member, storage, catalog
):
    household, headers = member
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [{"item_id": BANANA, "quantity": 2}])

    assert response.status_code == 200
    assert inventory_rows(db_session, household.id)[0].unit == "piece"


# ---------- E3 ----------

def test_confirm_failure_rolls_back_every_item_and_keeps_receipt(
    client, db_session, member, storage, catalog
):
    household, headers = member
    db_session.add(InventoryEntry(household_id=household.id, item_id=MILK, quantity=1, unit="pack"))
    db_session.commit()
    receipt_id = upload_id(client, headers)

    response = confirm(client, headers, receipt_id, [
        {"item_id": BANANA, "quantity": 3, "unit": "piece"},
        {"item_id": MILK, "quantity": 1, "unit": "l"},  # stored in "pack": cannot convert
    ])

    assert response.status_code == 409
    assert "No receipt items were added" in response.json()["detail"]
    rows = inventory_rows(db_session, household.id)
    assert [(r.item_id, r.quantity, r.unit) for r in rows] == [(MILK, 1, "pack")]
    assert len(stored_files(storage)) == 1  # kept so the user can fix and retry


def test_confirm_into_foreign_household_returns_404(client, db_session, member, storage):
    _, headers = member
    receipt_id = upload_id(client, headers)
    other_id, _ = register_and_login(client, email="stranger@example.com")
    other = add_household(db_session, other_id, name="Other House")

    response = client.post(
        f"/api/v1/receipts/{receipt_id}/confirm",
        headers=headers,
        json={"household_id": other.id, "items": []},
    )

    assert response.status_code == 404


# ---------- cancel ----------

def test_discard_deletes_receipt_and_is_idempotent(client, member, storage):
    _, headers = member
    receipt_id = upload_id(client, headers)

    first = client.delete(f"/api/v1/receipts/{receipt_id}", headers=headers)
    second = client.delete(f"/api/v1/receipts/{receipt_id}", headers=headers)

    assert first.status_code == 204
    assert second.status_code == 204
    assert stored_files(storage) == []
