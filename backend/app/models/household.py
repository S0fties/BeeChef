"""Household ORM model."""

from sqlalchemy import String
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