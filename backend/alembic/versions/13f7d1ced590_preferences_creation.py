"""preferences creation

Revision ID: 13f7d1ced590
Revises: 4f9e3a8b7c21
Create Date: 2026-11-22 15:36:31.202290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13f7d1ced590'
down_revision: Union[str, Sequence[str], None] = '4f9e3a8b7c21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
