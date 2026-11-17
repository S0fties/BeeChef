"""Invitation ORM model: an invitation for a user to join a household."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class InvitationStatus(str, enum.Enum):
    """Lifecycle state of an invitation."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class Invitation(Base):
    """An invitation for a registered user (a friend) to join a household as a member."""

    __tablename__ = "invitations"

    # At most one open invitation per (household, invitee); closed ones stay as history.
    __table_args__ = (
        Index(
            "uq_invitations_pending_household_invitee",
            "household_id",
            "invitee_user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # Deleting a household removes its invitations.
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        index=True,
    )

    # Deleting the inviter's account removes the invitations they sent.
    invited_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )

    # Deleting the invitee's account removes the invitations they received.
    invitee_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )

    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(
            InvitationStatus,
            name="invitation_status",
            values_callable=lambda enum_class: [status.value for status in enum_class],
        ),
        default=InvitationStatus.PENDING,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )