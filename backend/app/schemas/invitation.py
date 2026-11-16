"""Pydantic schemas for the Invitation API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.invitation import InvitationStatus


class InvitationCreate(BaseModel):
    """Payload for inviting a person to a household by email."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


class InvitationRead(BaseModel):
    """An invitation as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    invitee_email: str
    status: InvitationStatus
    created_at: datetime