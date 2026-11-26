"""Preferences ORM model."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PrefLevel(str, enum.Enum):
    """Neutral = no row. Only non-default levels are stored."""
    PREFERRED = "preferred"
    RESTRICTED = "restricted"


class UserItemPreference(Base):
    """A user's preferred or restricted ingredient (one row per user+item)."""

    __tablename__ = "user_item_preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    pref: Mapped[PrefLevel] = mapped_column(
        Enum(PrefLevel, name="pref_level", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )


class UserAllergyItem(Base):
    """An ingredient (item) the user is allergic to."""

    __tablename__ = "user_allergy_items"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )


class UserAllergyLabel(Base):
    """A text allergy the user selected in the UI (e.g. 'tree nuts').

    Sent as-is to the LLM; not linked to the items table.
    """

    __tablename__ = "user_allergy_labels"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    label: Mapped[str] = mapped_column(String(100), primary_key=True)