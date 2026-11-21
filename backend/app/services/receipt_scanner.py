"""Receipt-scanning client (UT-06 Receipt API), backed by Google Gemini (free tier)."""

import logging
from functools import lru_cache
from typing import Literal, Protocol

from fastapi import HTTPException, status
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Units as printed on receipts. Imperial units and "dozen" are converted by the backend
# (receipt_service.normalize_amount) with fixed factors, so the model never does the maths.
Unit = Literal[
    "g", "kg", "ml", "l", "piece", "pack", "dozen",
    "lb", "oz", "gal", "qt", "pt", "fl_oz",
    "tbsp", "tsp", "cup",
]


class ReceiptScanError(Exception):
    """The scanning service could not produce candidates (UC-13 E2). Retryable."""


class NotAReceiptError(Exception):
    """The image was processed but is not a readable receipt (UC-13 E1)."""


class ExtractedLine(BaseModel):
    raw_text: str
    name: str
    catalog_item_id: int | None
    quantity: float | None
    unit: Unit | None


class ExtractionResult(BaseModel):
    is_receipt: bool
    items: list[ExtractedLine]


class ReceiptScanner(Protocol):
    def extract(
        self, image_bytes: bytes, media_type: str, catalog_listing: str
    ) -> list[ExtractedLine]:
        """Extract receipt lines, matching each to an ID from ``catalog_listing``."""
        ...


SYSTEM_PROMPT = """You read photos of grocery receipts for a household kitchen-inventory app.
The household will review every item you return before anything is saved, so report what the
receipt shows rather than guessing.

You are also given the app's item catalog as lines of "<id>: <name> [<unit>]", where <unit> is
the unit the household tracks that item in. Every receipt product must be linked to that catalog.

For each purchased product line return:
- raw_text: the line exactly as printed.
- name: a short, generic English name for the product ("Tomato", "Whole Milk"), translated from
  the receipt's language, without brand names, pack sizes or store codes.
- catalog_item_id: the id of the catalog item that is the same product.
  - Ignore words that describe quality, origin, size or style rather than a different product:
    organic, fresh, natural, large, grade A, free-range, premium, local, brand names, roast
    level, and similar. "ORGANIC MILK" is Milk; "LARGE BROWN EGGS" is Eggs; "FRESH BANANAS" is
    Bananas; "FRENCH ROAST COFFEE" or "ESPRESSO BEANS" is the catalog's coffee item.
  - When the catalog has both a general item and a more specific one, pick the specific one only
    if the receipt names that variant ("TAM YAGLI SUT" / "WHOLE MILK" -> Whole Milk; plain
    "MILK" or "ORGANIC MILK" -> Milk).
  - Singular and plural are the same item ("BANANAS" is Banana).
  - Use only ids that appear in the catalog. Use null if no catalog item is the same kind of
    product; never pick an unrelated item just to fill the field. Products with no catalog
    match are not added to the inventory, so a wrong id is worse than null.
- quantity and unit: the total amount bought, in the unit PRINTED on the receipt. Do not
  convert between units; the app converts. Map the printed unit to the allowed values:
  KG -> kg, G/GR -> g, L/LT/LTR -> l, ML -> ml, GAL/GL/GALLON -> gal, QT/QUART -> qt,
  PT/PINT -> pt, FL OZ -> fl_oz, OZ -> oz, LB/LBS -> lb, DOZEN/DZ -> dozen,
  ADET/PCS/CT/LU/count -> piece.
  - Fractions and words: "1/2 GAL" or "HALF GALLON" is 0.5 gal; "TWO" is 2.
  - Multiply by the number of packs bought: "2 X SUT 1L" is 2 l; "2 x DOZEN EGGS" is 2 dozen;
    "YUMURTA 10LU" is 10 piece; "3 X YUMURTA 10LU" is 30 piece.
  - Prefer a size printed on the line over a pack count: "MILK 1 GAL" is 1 gal, not 1 pack.
  - A multiplier with no size counts single items: "3x ORGANIC BANANAS", "AVOCADO X2" and
    "LEMON 4 @ 0.50" are 3, 2 and 4 piece. Use the catalog item's unit for that count when it
    is [piece].
  - Use "pack" only when the line itself says pack (PK, PACK, PKT, PAKET, MULTIPACK, BOX) and
    shows no count per pack, or when the catalog item is tracked in [pack].
  - The unit must belong to the quantity: never return a number without its unit when a unit is
    printed. If a number is printed but no unit at all, return the number with unit null.
  - Use null for both when no amount is printed.

Skip lines that are not products: totals, subtotals, tax, discounts, deposits, payment, change,
loyalty points and store details. Return repeated products as separate lines; the app combines them.

If the image is not a shopping receipt, or is too blurry to read, set is_receipt to false and
return no items."""


class GeminiReceiptScanner:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=90_000),  # milliseconds
        )
        self._model = model

    def extract(
        self, image_bytes: bytes, media_type: str, catalog_listing: str
    ) -> list[ExtractedLine]:
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=[
                    f"Item catalog:\n{catalog_listing}",
                    types.Part.from_bytes(data=image_bytes, mime_type=media_type),
                    "Extract the purchased items from this receipt and link each to the catalog.",
                ],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=ExtractionResult,
                    temperature=0,
                ),
            )
        except errors.APIError as exc:
            logger.warning("Gemini receipt scan failed: %s %s", exc.code, exc.message)
            if exc.code == 429:
                raise ReceiptScanError(
                    "The free scanning quota is used up for now. Try again later."
                ) from exc
            raise ReceiptScanError("The receipt-scanning service returned an error.") from exc
        except Exception as exc:  # timeouts / network errors from the HTTP layer
            logger.warning("Gemini receipt scan unreachable: %s", exc)
            raise ReceiptScanError("The receipt-scanning service could not be reached.") from exc

        result = response.parsed
        if not isinstance(result, ExtractionResult):  # blocked or unparsed response
            try:
                result = ExtractionResult.model_validate_json(response.text or "")
            except ValidationError as exc:
                logger.warning("Gemini receipt scan returned unparseable output: %s", exc)
                raise ReceiptScanError(
                    "The receipt-scanning service returned an invalid response."
                ) from exc

        if not result.is_receipt:
            raise NotAReceiptError()
        return result.items[: settings.RECEIPT_MAX_CANDIDATES]


@lru_cache
def _build_scanner(api_key: str, model: str) -> GeminiReceiptScanner:
    return GeminiReceiptScanner(api_key, model)


def get_receipt_scanner() -> ReceiptScanner:
    """FastAPI dependency; tests override it with a fake scanner."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Receipt scanning is not configured on this server.",
        )
    return _build_scanner(settings.GEMINI_API_KEY, settings.RECEIPT_MODEL)
