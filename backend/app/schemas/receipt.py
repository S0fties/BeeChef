"""Pydantic schemas for receipt scanning (UC-13)."""

from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.inventory import InventoryEntryRead


class ReceiptUploadResponse(BaseModel):
    """Returned after a receipt image is validated and stored temporarily."""

    receipt_id: UUID
    expires_in_seconds: int


class ReceiptCandidate(BaseModel):
    """One extracted receipt line shown for review. Nothing is persisted yet.

    ``matched_item_id`` is the catalog item this line was matched to. When it is
    ``None`` no catalog item fits, and the line will not be added unless the user
    links it to an existing catalog item. Receipts never create catalog items.
    """

    candidate_id: int
    raw_text: str
    extracted_name: str
    quantity: float | None
    unit: str | None
    matched_item_id: int | None
    matched_item_name: str | None


class ReceiptScanResponse(BaseModel):
    candidates: list[ReceiptCandidate]


class ReceiptConfirmItem(BaseModel):
    """A reviewed candidate, linked to an existing catalog item, that the user chose to add."""

    item_id: int
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=50)

    @field_validator("unit", "location")
    @classmethod
    def strip_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ReceiptConfirmRequest(BaseModel):
    household_id: int | None = None
    items: list[ReceiptConfirmItem] = Field(default_factory=list, max_length=100)


class ReceiptConfirmResponse(BaseModel):
    added_count: int
    entries: list[InventoryEntryRead]
