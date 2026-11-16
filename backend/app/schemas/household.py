"""Pydantic schemas for the Household API."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.models.household_member import HouseholdRole

HouseholdName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class HouseholdCreate(BaseModel):
    """Payload for creating a household."""

    name: HouseholdName


class HouseholdRead(BaseModel):
    """A household as seen by the current user, including their role in it."""

    id: int
    name: str
    created_at: datetime
    role: HouseholdRole