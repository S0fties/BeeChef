"""Preferences schemas."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.preferences import PrefLevel
from app.models.item import ItemType

# Predetermined allergy labels shown in the UI. Adjust to your list.
ALLERGY_LABELS: frozenset[str] = frozenset(
    {
        "tree nuts",
        "peanuts",
        "dairy",
        "gluten",
        "shellfish",
        "eggs",
        "soy",
        "fish",
        "sesame",
    }
)

# 5-digit catalog IDs (e.g. 71001)
ItemId = int  # validated below with Field constraints
ITEM_ID_FIELD = Field(ge=10000, le=99999)


def _dedupe(values: list) -> list:
    """Remove duplicates while keeping order."""
    return list(dict.fromkeys(values))


# ---------- Preferred / restricted items ----------

class ItemPreferenceIn(BaseModel):
    item_id: int = ITEM_ID_FIELD
    pref: PrefLevel


class ItemPreferenceAdd(BaseModel):
    """Add or update preferences. An existing row for the same item is overwritten."""

    preferences: list[ItemPreferenceIn] = Field(min_length=1, max_length=700)

    @field_validator("preferences")
    @classmethod
    def no_duplicate_items(cls, v: list[ItemPreferenceIn]):
        ids = [p.item_id for p in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate item_id in request")
        return v


class ItemPreferenceDelete(BaseModel):
    """Remove items back to neutral (deletes the rows)."""

    item_ids: list[int] = Field(min_length=1, max_length=700)

    @field_validator("item_ids")
    @classmethod
    def validate_ids(cls, v: list[int]):
        if any(not (10000 <= i <= 99999) for i in v):
            raise ValueError("item_id must be a 5-digit ID")
        return _dedupe(v)


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    item_type: ItemType
    category: str


# ---------- Allergy items ----------

class AllergyItemAdd(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=700)

    @field_validator("item_ids")
    @classmethod
    def validate_ids(cls, v: list[int]):
        if any(not (10000 <= i <= 99999) for i in v):
            raise ValueError("item_id must be a 5-digit ID")
        return _dedupe(v)


class AllergyItemDelete(AllergyItemAdd):
    """Same shape as add."""


class AllergyItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int


# ---------- Allergy labels (text, sent to the LLM) ----------

def _normalize_labels(v: list[str]) -> list[str]:
    unknown = [s for s in v if s not in ALLERGY_LABELS]
    if unknown:
        raise ValueError(f"Unknown allergy label(s): {', '.join(unknown)}")
    return _dedupe(v)


class AllergyLabelAdd(BaseModel):
    labels: list[str] = Field(min_length=1, max_length=len(ALLERGY_LABELS))

    @field_validator("labels")
    @classmethod
    def validate_labels(cls, v: list[str]):
        return _normalize_labels(v)


class AllergyLabelDelete(AllergyLabelAdd):
    """Same shape as add."""


class AllergyLabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str


# ---------- Combined read ----------

class UserPreferencesOut(BaseModel):
    preferred: list[ItemOut]
    restricted: list[ItemOut]
    allergy_items: list[ItemOut]
    allergy_labels: list[str]