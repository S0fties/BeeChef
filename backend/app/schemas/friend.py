"""Pydantic schemas for friend search and friendship requests."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.friend_request import FriendRequestStatus


class FriendSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_name: str
    name: str
    surname: str


class FriendRequestCreate(BaseModel):
    friend_user_id: int = Field(gt=0)


class FriendRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requester_user_id: int
    recipient_user_id: int
    status: FriendRequestStatus
    created_at: datetime


class FriendRequestReceivedRead(BaseModel):
    id: int
    user_id: int
    user_name: str
    name: str
    surname: str
    status: FriendRequestStatus
    created_at: datetime
