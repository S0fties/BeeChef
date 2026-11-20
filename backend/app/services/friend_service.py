from typing import Protocol

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.friend_request import FriendRequest, FriendRequestStatus


class FriendService(Protocol):
    def are_friends(self, user_id: int, other_user_id: int) -> bool: ...


class DatabaseFriendService:
    """Friend service backed by accepted friendship requests."""

    def __init__(self, db: Session):
        self.db = db

    def are_friends(self, user_id: int, other_user_id: int) -> bool:
        if user_id == other_user_id:
            return False
        return (
            self.db.scalar(
                select(FriendRequest.id)
                .where(
                    FriendRequest.status == FriendRequestStatus.ACCEPTED,
                    or_(
                        and_(
                            FriendRequest.requester_user_id == user_id,
                            FriendRequest.recipient_user_id == other_user_id,
                        ),
                        and_(
                            FriendRequest.requester_user_id == other_user_id,
                            FriendRequest.recipient_user_id == user_id,
                        ),
                    ),
                )
                .limit(1)
            )
            is not None
        )