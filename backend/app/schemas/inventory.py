"""Pydantic schemas for household inventory entries."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.item import ItemRead


class InventoryEntryCreate(BaseModel):
    item_id: int
    household_id: int | None = None
    is_available: bool = True
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=50)

    @field_validator("unit", "location")
    @classmethod
    def strip_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class InventoryEntryUpdate(BaseModel):
    is_available: bool | None = None
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=50)

    @field_validator("unit", "location")
    @classmethod
    def strip_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class InventoryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    item_id: int
    is_available: bool
    quantity: float | None
    unit: str | None
    location: str | None
    created_at: datetime
    updated_at: datetime
    item: ItemRead

