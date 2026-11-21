"""validate and store the receipt, extract candidates, add confirmed items.

Every receipt line is matched to an existing catalog ingredient (singular/plural-insensitive;
original items win over duplicates). Appliances are never matched. Lines with no catalog
match are not added, and receipts never create catalog items.
"""

import difflib
import re
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.inventory_entry import InventoryEntry
from app.models.item import Item, ItemType
from app.schemas.receipt import (
    ReceiptCandidate,
    ReceiptConfirmItem,
    ReceiptConfirmResponse,
    ReceiptScanResponse,
    ReceiptUploadResponse,
)
from app.services.inventory_service import _serialize_inventory_entry
from app.services.receipt_scanner import (
    ExtractedLine,
    NotAReceiptError,
    ReceiptScanError,
    ReceiptScanner,
)
from app.services.receipt_storage import ReceiptStorage

UNIT_FACTORS = {("kg", "g"): 1000, ("g", "kg"): 0.001, ("l", "ml"): 1000, ("ml", "l"): 0.001}
# Receipt units the inventory does not use, converted to readable metric units.
IMPERIAL_TO_METRIC = {
    "gal": (3.75, "l"),
    "qt": (0.95, "l"),
    "pt": (0.5, "l"),
    "fl_oz": (30, "ml"),
    "lb": (0.45, "kg"),
    "oz": (28, "g"),
    "dozen": (12, "piece"),
}
COUNT_UNITS = {"piece", "pack"}
# Words that show a receipt line really was bought as packs (EN + TR).
PACK_WORDS = {"pk", "pck", "pkt", "pack", "packs", "paket", "pkg", "multipack", "box", "kutu"}
FUZZY_CUTOFF = 0.85  # last-resort name match; "Lemon" -> "Melon" does not pass


# ---------- Step 1 / E1: image validation ----------

def _sniff_image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def read_and_validate_image(file: UploadFile) -> tuple[bytes, str]:
    """Return (bytes, real media type) or raise 400/413. Trusts file content, not the header."""
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Unsupported file type. Upload a JPEG, PNG or WebP image of the receipt.",
        )
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Receipt image exceeds the {settings.MAX_FILE_SIZE_MB} MB limit.",
        )
    media_type = _sniff_image_type(data)
    if media_type is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The file is not a valid JPEG, PNG or WebP image and cannot be processed.",
        )
    return data, media_type


def upload_receipt(
    storage: ReceiptStorage, household_id: int, file: UploadFile
) -> ReceiptUploadResponse:
    """Validate the image, then keep it until the scan flow ends."""
    data, media_type = read_and_validate_image(file)  # invalid images are never stored
    storage.purge_expired()
    receipt_id = storage.save(household_id, data, media_type)
    return ReceiptUploadResponse(receipt_id=receipt_id, expires_in_seconds=storage.ttl_seconds)


# ---------- Catalog matching ----------

def _singular(word: str) -> str:
    """Very small English singularizer, used only for comparing names."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"  # berries -> berry
    if len(word) > 4 and word.endswith(("oes", "ches", "shes", "xes")):
        return word[:-2]  # tomatoes -> tomato, peaches -> peach
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]  # bananas -> banana, eggs -> egg
    return word


def _words(text: str) -> list[str]:
    return [_singular(w) for w in text.lower().replace("-", " ").split()]


def name_key(text: str) -> str:
    """Comparison key: case-, spacing- and plural-insensitive ("Bananas" == "banana")."""
    return " ".join(_words(text))


class CatalogIndex:
    """The catalog with duplicates collapsed: for each name key, the original (lowest-id) item."""

    def __init__(self, items: list[Item]) -> None:
        self.by_key: dict[str, Item] = {}
        for item in sorted(items, key=lambda i: i.id):
            self.by_key.setdefault(name_key(item.name), item)
        self.items = sorted(self.by_key.values(), key=lambda i: i.id)
        self.by_id = {item.id: item for item in items}

    def canonical(self, item: Item) -> Item:
        """Map a duplicate (e.g. 99001 "Bananas") to the original (13001 "Banana")."""
        return self.by_key.get(name_key(item.name), item)

    def find_by_name(self, name: str, *, fuzzy: bool = True) -> Item | None:
        key = name_key(name)
        if key in self.by_key:
            return self.by_key[key]
        if not fuzzy:
            return None
        close = difflib.get_close_matches(key, self.by_key.keys(), n=1, cutoff=FUZZY_CUTOFF)
        return self.by_key[close[0]] if close else None

    def listing(self) -> str:
        """Catalog as '<id>: <name> [<unit>]' lines, sent to the scanning service."""
        return "\n".join(
            f"{item.id}: {item.name} [{item.default_unit or 'availability only'}]"
            for item in self.items
        )


def _load_catalog(db: Session) -> CatalogIndex:
    """Receipts only add groceries, so only ingredient items can be matched or confirmed."""
    return CatalogIndex(list(db.scalars(select(Item).where(Item.item_type == ItemType.INGREDIENT))))


def _names_agree(extracted: str, catalog_name: str) -> bool:
    """Sanity check that the service's chosen id fits the product name it read.

    Guards against the model returning a wrong id (e.g. reading "Whole Milk" but
    linking it to Honey). "Organic Milk" -> "Milk" and "Coffee" -> "Ground Coffee"
    pass because they share a word.
    """
    if set(_words(extracted)) & set(_words(catalog_name)):
        return True
    # Spelling variants only ("Yoghurt"/"Yogurt" ~0.92); "Lemon"/"Melon" (0.6) must not pass.
    ratio = difflib.SequenceMatcher(None, extracted.lower(), catalog_name.lower()).ratio()
    return ratio >= 0.8


def _match_line(line: ExtractedLine, catalog: CatalogIndex) -> Item | None:
    """1) the service's id if it exists and fits the name, 2) the name itself, else None."""
    chosen = catalog.by_id.get(line.catalog_item_id) if line.catalog_item_id is not None else None
    if chosen is not None and _names_agree(line.name, chosen.name):
        return catalog.canonical(chosen)
    return catalog.find_by_name(line.name)


def _mentions_pack(raw_text: str) -> bool:
    tokens = re.split(r"[^a-z]+", raw_text.lower())
    return any(token in PACK_WORDS for token in tokens)


def normalize_amount(
    item: Item | None, quantity: float | None, unit: str | None, raw_text: str = ""
) -> tuple[float | None, str | None]:
    """Turn a printed receipt amount into an inventory amount.

    - Imperial units and dozens are converted with fixed factors (1 gal -> 3.785 l,
      1 lb -> 0.454 kg, 1 dozen -> 12 piece); metric units are kept as printed.
    - "pack" for an item counted in pieces becomes "piece" unless the receipt line really
      says pack ("3x ORGANIC BANANAS" -> 3 piece, but "EGGS 2 PK" stays 2 pack).
    - A number printed without a unit is only given the catalog unit when that unit is
      a count (piece/pack). For weights/volumes it stays unit-less so the user picks the
      unit, instead of silently becoming e.g. "1 ml" of milk.
    """
    if quantity is None:
        return None, None
    if unit in IMPERIAL_TO_METRIC:
        factor, unit = IMPERIAL_TO_METRIC[unit]
        quantity = quantity * factor
    if (
        unit == "pack"
        and item is not None
        and item.default_unit == "piece"
        and not _mentions_pack(raw_text)
    ):
        unit = "piece"
    if unit is None and item is not None and item.default_unit in COUNT_UNITS:
        unit = item.default_unit
    return round(quantity, 3), unit


# ---------- Steps 2-4 / E1 / E2: scan ----------

def scan_receipt(
    db: Session,
    scanner: ReceiptScanner,
    storage: ReceiptStorage,
    household_id: int,
    receipt_id: UUID,
) -> ReceiptScanResponse:
    """Extract candidates from a stored receipt and match them to catalog items.

    Performs no database writes. The image is kept on success (the user is still
    reviewing) and on a service failure (so the scan can be retried without re-uploading).
    """
    image_bytes, media_type = storage.load(household_id, receipt_id)
    catalog = _load_catalog(db)
    try:
        lines = scanner.extract(image_bytes, media_type, catalog.listing())
    except NotAReceiptError:
        storage.delete(household_id, receipt_id)  # the flow ends here
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This image does not look like a readable receipt. Please upload a clearer photo.",
        )
    except ReceiptScanError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Receipt extraction could not be completed: {exc} Your inventory was not changed.",
        )

    candidates = []
    for index, line in enumerate(lines):
        item = _match_line(line, catalog)
        quantity, unit = normalize_amount(item, line.quantity, line.unit, line.raw_text)
        candidates.append(
            ReceiptCandidate(
                candidate_id=index,
                raw_text=line.raw_text,
                extracted_name=line.name,
                quantity=quantity,
                unit=unit,
                matched_item_id=item.id if item else None,
                matched_item_name=item.name if item else None,
            )
        )
    return ReceiptScanResponse(candidates=candidates)


# ---------- Step 6 / A2 / E3: confirm ----------

def _resolve_item(catalog: CatalogIndex, c: ReceiptConfirmItem) -> Item:
    """Only existing catalog ingredients can be added; duplicates resolve to the original item."""
    item = catalog.by_id.get(c.item_id)
    if item is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Item {c.item_id} is not an ingredient in the catalog. Only catalog ingredients "
            "can be added from a receipt. No receipt items were added.",
        )
    return catalog.canonical(item)


def _conversion_factor(from_unit: str | None, to_unit: str | None) -> float | None:
    if from_unit is None or to_unit is None or from_unit == to_unit:
        return 1
    return UNIT_FACTORS.get((from_unit, to_unit))


def _apply_purchase(entry: InventoryEntry, item: Item, c: ReceiptConfirmItem) -> None:
    entry.is_available = True
    if c.location and not entry.location:
        entry.location = c.location
    if item.item_type == ItemType.APPLIANCE:
        entry.quantity, entry.unit = None, None
        return
    if c.quantity is None:
        return  # availability-only purchase
    if c.unit is None and item.default_unit not in COUNT_UNITS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Choose a unit for the {c.quantity:g} of '{item.name}'. No receipt items were added.",
        )
    unit = c.unit or item.default_unit
    if entry.quantity is None:
        entry.quantity, entry.unit = c.quantity, unit
        return
    factor = _conversion_factor(unit, entry.unit)
    if factor is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"'{item.name}' is stored in '{entry.unit}' but the receipt line uses '{unit}'. "
            "Change the unit and confirm again. No receipt items were added.",
        )
    entry.quantity = round(entry.quantity + c.quantity * factor, 3)


def confirm_receipt_items(
    db: Session,
    storage: ReceiptStorage,
    household_id: int,
    receipt_id: UUID,
    items: list[ReceiptConfirmItem],
) -> ReceiptConfirmResponse:
    """Add only the confirmed catalog items, atomically (all or none), then delete the receipt.

    On failure (E3) the transaction is rolled back and the receipt is kept so the user
    can fix the problem and confirm again.
    """
    if not items:  # A2: nothing confirmed -> inventory untouched, flow ends
        storage.delete(household_id, receipt_id)
        return ReceiptConfirmResponse(added_count=0, entries=[])

    catalog = _load_catalog(db)
    touched: dict[int, tuple[InventoryEntry, Item]] = {}
    try:
        for c in items:
            item = _resolve_item(catalog, c)
            if item.id in touched:  # duplicate receipt lines (autoflush is off)
                entry = touched[item.id][0]
            else:
                entry = db.scalar(
                    select(InventoryEntry).where(
                        InventoryEntry.household_id == household_id,
                        InventoryEntry.item_id == item.id,
                    )
                )
                if entry is None:
                    entry = InventoryEntry(
                        household_id=household_id,
                        item_id=item.id,
                        is_available=True,
                        location=c.location,
                    )
                    db.add(entry)
                touched[item.id] = (entry, item)
            _apply_purchase(entry, item, c)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Inventory update failed. No receipt items were added; please try again.",
        )

    storage.delete(household_id, receipt_id)  # flow finished successfully

    for entry, _ in touched.values():
        db.refresh(entry)
    return ReceiptConfirmResponse(
        added_count=len(items),
        entries=[_serialize_inventory_entry(entry, item) for entry, item in touched.values()],
    )


def discard_receipt(storage: ReceiptStorage, household_id: int, receipt_id: UUID) -> None:
    """Cancel the flow and delete the stored image. Idempotent."""
    storage.delete(household_id, receipt_id)
