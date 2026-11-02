"""InventoryEntry ORM model: household-specific stock of catalog items."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class InventoryEntry(Base):
    """One inventory record linking a household to a shared catalog item.

    Supports dual inventory tracking:
    1. Binary availability (``is_available=True/False``, ``quantity=None``) for
       appliances, kitchenware, and quick-entry staples like spices.
    2. Quantity-based tracking (``quantity`` + ``unit``) for ingredients whose
       stock is automatically deducted when AI recipes are approved.

    Note: Expiration date tracking is intentionally omitted as it is out of
    project scope per the Project Charter.
    """

    __tablename__ = "inventory_entries"

    __table_args__ = (
        UniqueConstraint(
            "household_id",
            "item_id",
            name="uq_inventory_entries_household_item",
        ),
    )

    # Primary key generated automatically by PostgreSQL.
    id: Mapped[int] = mapped_column(primary_key=True)

    # Foreign key to the owning household.
    # ondelete="CASCADE": deleting a household removes all of its inventory entries.
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        index=True,
    )

    # Foreign key to the shared catalog item.
    # ondelete="RESTRICT": prevents deleting a catalog item that is still in use.
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="RESTRICT"),
        index=True,
    )

    # Whether the item is currently available in the household.
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
    )

    # Numeric amount in stock (e.g. 500.0). Nullable for binary-only items.
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Measurement unit for the quantity (e.g. "g", "kg", "ml", "piece").
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Optional storage location inside the home (e.g. "fridge", "pantry", "freezer").
    location: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Creation and last-update timestamps.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

