"""create invitations

Revision ID: 202cec0e6fdc
Revises: c191fcb8fac7
Create Date: 2026-11-17 01:19:57.592311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202cec0e6fdc'
down_revision: Union[str, Sequence[str], None] = 'c191fcb8fac7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("invitee_email", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "accepted", "declined", name="invitation_status"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invitations_household_id"), "invitations", ["household_id"], unique=False)
    op.create_index(op.f("ix_invitations_invitee_email"), "invitations", ["invitee_email"], unique=False)
    op.create_index(
        "uq_invitations_pending_household_email",
        "invitations",
        ["household_id", "invitee_email"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_invitations_pending_household_email",
        table_name="invitations",
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.drop_index(op.f("ix_invitations_invitee_email"), table_name="invitations")
    op.drop_index(op.f("ix_invitations_household_id"), table_name="invitations")
    op.drop_table("invitations")
    op.execute("DROP TYPE invitation_status")
