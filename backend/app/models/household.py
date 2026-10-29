"""Household ORM model."""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Household(Base):
    """A shared home (family, student flat, ...) that has one kitchen inventory.

    People belong to a household through the ``household_members`` table,
    which will be added in a later step. That table also stores each
    member's role (owner or member).
    """

    # Name of the table that will be created in PostgreSQL.
    __tablename__ = "households"

    # Primary key generated automatically by PostgreSQL (1, 2, 3, ...).
    id: Mapped[int] = mapped_column(primary_key=True)

    # Display name chosen by the user, for example "Softies House".
    name: Mapped[str] = mapped_column(String(100))

    # Moment the household was created.
    # server_default=func.now() means PostgreSQL itself fills this column with
    # its current time when the row is inserted, so application code never has
    # to remember to set it. timezone=True stores the time zone together with
    # the time, which avoids confusion when users live in different zones.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )