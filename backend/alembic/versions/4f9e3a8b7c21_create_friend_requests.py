"""create friend requests

Revision ID: 4f9e3a8b7c21
Revises: 202cec0e6fdc
Create Date: 2026-11-17 22:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4f9e3a8b7c21"
down_revision: Union[str, Sequence[str], None] = "202cec0e6fdc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friend_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column("recipient_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "accepted", "declined", name="friend_request_status"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "requester_user_id != recipient_user_id",
            name="ck_friend_requests_distinct_users",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["requester_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_friend_requests_recipient_user_id"),
        "friend_requests",
        ["recipient_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_friend_requests_requester_user_id"),
        "friend_requests",
        ["requester_user_id"],
        unique=False,
    )
    op.create_index(
        "uq_friend_requests_pending_pair",
        "friend_requests",
        [
            sa.text("LEAST(requester_user_id, recipient_user_id)"),
            sa.text("GREATEST(requester_user_id, recipient_user_id)"),
        ],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_friend_requests_pending_pair",
        table_name="friend_requests",
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.drop_index(
        op.f("ix_friend_requests_requester_user_id"), table_name="friend_requests"
    )
    op.drop_index(
        op.f("ix_friend_requests_recipient_user_id"), table_name="friend_requests"
    )
    op.drop_table("friend_requests")
    op.execute("DROP TYPE friend_request_status")
