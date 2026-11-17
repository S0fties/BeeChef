"""Pydantic schemas for the Invitation API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.invitation import InvitationStatus


class InvitationCreate(BaseModel):
    """Payload for inviting a friend to a household."""

    # User id of the friend being invited.
    friend_user_id: int = Field(gt=0)


class InvitationRead(BaseModel):
    """An invitation as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    household_id: int
    invitee_user_id: int
    status: InvitationStatus
    created_at: datetime


class ReceivedInvitationRead(BaseModel):
    """An invitation addressed to the current user, with household context."""

    id: int
    household_id: int
    household_name: str
    invited_by_user_name: str
    status: InvitationStatus
    created_at: datetime