"""Friendship request ORM model."""

import enum
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class FriendRequestStatus(str, enum.Enum):
    """Lifecycle state of a friendship request."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class FriendRequest(Base):
    """A directed request between two users; accepted rows represent friendships."""

    __tablename__ = "friend_requests"
    __table_args__ = (
        CheckConstraint(
            "requester_user_id != recipient_user_id",
            name="ck_friend_requests_distinct_users",
        ),
        Index(
            "uq_friend_requests_pending_pair",
            text("LEAST(requester_user_id, recipient_user_id)"),
            text("GREATEST(requester_user_id, recipient_user_id)"),
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    recipient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[FriendRequestStatus] = mapped_column(
        SAEnum(
            FriendRequestStatus,
            name="friend_request_status",
            values_callable=lambda enum_class: [status.value for status in enum_class],
        ),
        default=FriendRequestStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
