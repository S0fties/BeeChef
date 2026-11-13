"""Pydantic schemas for shared catalog items."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.item import ItemType


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    item_type: ItemType = ItemType.INGREDIENT
    category: str = Field(min_length=1, max_length=50)
    subcategory: str = Field(min_length=1, max_length=50)
    default_unit: str | None = Field(default=None, max_length=20)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Item name must not be blank")
        return v

    @field_validator("category", "subcategory")
    @classmethod
    def normalize_taxonomy(cls, v: str) -> str:
        v = v.strip().upper().replace(" ", "_")
        if not v:
            raise ValueError("Category/subcategory must not be blank")
        return v

    @field_validator("default_unit")
    @classmethod
    def strip_unit(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def enforce_appliance_unit_null(self) -> "ItemCreate":
        if self.item_type == ItemType.APPLIANCE:
            self.default_unit = None
        return self


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    item_type: ItemType | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    subcategory: str | None = Field(default=None, min_length=1, max_length=50)
    default_unit: str | None = Field(default=None, max_length=20)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Item name must not be blank")
        return v

    @field_validator("category", "subcategory")
    @classmethod
    def normalize_taxonomy(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper().replace(" ", "_")
        if not v:
            raise ValueError("Category/subcategory must not be blank")
        return v

    @field_validator("default_unit")
    @classmethod
    def strip_unit(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    item_type: ItemType
    category: str
    subcategory: str
    default_unit: str | None
    created_at: datetime

