"""Pydantic schemas for the Household API."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints, model_validator

from app.models.household_member import HouseholdRole

HouseholdName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class HouseholdCreate(BaseModel):
    """Payload for creating a household."""

    name: HouseholdName


class HouseholdUpdate(BaseModel):
    """Partial update payload; only the provided fields are changed."""

    name: HouseholdName | None = None

    @model_validator(mode="after")
    def validate_provided_fields(self) -> "HouseholdUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name must not be null")
        return self


class HouseholdRead(BaseModel):
    """A household as seen by the current user, including their role in it."""

    id: int
    name: str
    created_at: datetime
    role: HouseholdRole