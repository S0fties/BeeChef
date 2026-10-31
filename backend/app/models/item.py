"""Item ORM model for the shared catalog."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ItemType(str, enum.Enum):
    """Broad classification of a shared catalog item.

    Ingredients are consumable food items that may be tracked either by
    quantity or by binary availability; appliances (cooking devices and
    kitchenware) are durable equipment tracked only by availability.
    """

    INGREDIENT = "ingredient"
    APPLIANCE = "appliance"


class Item(Base):
    """A catalog item shared across all households (ingredient or appliance).

    Items follow a structured 5-digit hierarchical ID convention when seeded
    from the catalog CSV (``[Category 1-digit][Subcategory 1-digit][Index 3-digits]``),
    while also supporting standard database-assigned IDs for admin-created items.
    """

    __tablename__ = "items"

    # Primary key. Supports both explicit 5-digit catalog IDs (e.g. 71001)
    # and auto-generated serial IDs.
    id: Mapped[int] = mapped_column(primary_key=True)

    # Unique display name of the item (e.g. "Domates", "Dana Kıyma", "Air Fryer").
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    # High-level item type ("ingredient" or "appliance").
    item_type: Mapped[ItemType] = mapped_column(
        SAEnum(
            ItemType,
            name="item_type",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=ItemType.INGREDIENT,
    )

    # Top-level category (e.g. "FRUIT", "VEGETABLE", "MEAT", "COOKING_APPLIANCE").
    category: Mapped[str] = mapped_column(String(50), index=True)

    # Subcategory within the main category (e.g. "BEEF", "LAMB", "LEAFY_GREENS").
    subcategory: Mapped[str] = mapped_column(String(50), index=True)

    # Default measurement unit for consumable ingredients (e.g. "g", "kg", "ml", "piece").
    # Nullable because appliances and kitchenware are tracked only by availability (var/yok).
    default_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Timestamp when the catalog item was created.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

