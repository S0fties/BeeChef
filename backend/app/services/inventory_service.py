"""Service layer for catalog items and household inventory CRUD operations."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.inventory_entry import InventoryEntry
from app.models.item import Item, ItemType
from app.models.user import User
from app.schemas.inventory import (
    InventoryEntryCreate,
    InventoryEntryRead,
    InventoryEntryUpdate,
)
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate


# ---------- Catalog Item CRUD ----------

def list_catalog_items(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    item_type: ItemType | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Item]:
    """List catalog items with optional search and taxonomy filters."""
    stmt = select(Item)

    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(Item.name.ilike(q))

    if category and category.strip():
        stmt = stmt.where(func.upper(Item.category) == category.strip().upper())

    if subcategory and subcategory.strip():
        stmt = stmt.where(func.upper(Item.subcategory) == subcategory.strip().upper())

    if item_type is not None:
        stmt = stmt.where(Item.item_type == item_type)

    stmt = stmt.order_by(Item.name.asc(), Item.id.asc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def get_catalog_item(db: Session, item_id: int) -> Item:
    """Return a single catalog item by ID or raise 404."""
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalog item not found",
        )
    return item


def create_catalog_item(db: Session, payload: ItemCreate) -> Item:
    """Create a new shared catalog item."""
    existing = db.scalar(
        select(Item).where(func.lower(Item.name) == payload.name.lower())
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Catalog item with this name already exists",
        )

    # Assign a custom ID above the 5-digit seeded range if needed, or let PostgreSQL sequence/max+1 handle it.
    max_id = db.scalar(select(func.max(Item.id))) or 99000
    next_id = max(max_id + 1, 99001)

    item = Item(
        id=next_id,
        name=payload.name,
        item_type=payload.item_type,
        category=payload.category,
        subcategory=payload.subcategory,
        default_unit=None if payload.item_type == ItemType.APPLIANCE else payload.default_unit,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Catalog item with this name already exists",
        )
    db.refresh(item)
    return item


def update_catalog_item(db: Session, item_id: int, payload: ItemUpdate) -> Item:
    """Update an existing shared catalog item."""
    item = get_catalog_item(db, item_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"] is not None:
        conflict = db.scalar(
            select(Item).where(
                func.lower(Item.name) == updates["name"].lower(),
                Item.id != item_id,
            )
        )
        if conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Catalog item with this name already exists",
            )
        item.name = updates["name"]

    if "item_type" in updates and updates["item_type"] is not None:
        item.item_type = updates["item_type"]

    if "category" in updates and updates["category"] is not None:
        item.category = updates["category"]

    if "subcategory" in updates and updates["subcategory"] is not None:
        item.subcategory = updates["subcategory"]

    if "default_unit" in updates:
        item.default_unit = updates["default_unit"]

    if item.item_type == ItemType.APPLIANCE:
        item.default_unit = None

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Catalog item with this name already exists",
        )
    db.refresh(item)
    return item


def delete_catalog_item(db: Session, item_id: int) -> None:
    """Delete a catalog item if it is not referenced by any household inventory."""
    item = get_catalog_item(db, item_id)
    in_use = db.scalar(
        select(InventoryEntry.id).where(InventoryEntry.item_id == item_id).limit(1)
    )
    if in_use is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete catalog item because it is used in household inventories",
        )

    db.delete(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete catalog item because it is used in household inventories",
        )


# ---------- Household Resolution ----------

def resolve_user_household_id(
    db: Session,
    user: User,
    household_id: int | None = None,
    *,
    auto_create_if_none: bool = True,
) -> int:
    """Resolve and authorize a household ID for the authenticated user.

    If ``household_id`` is explicitly passed, verifies the user is a member of
    that household (raising 403 otherwise).
    If ``household_id`` is omitted, returns the user's first household membership;
    if the user has no household yet and ``auto_create_if_none`` is True, creates
    a default household so the inventory feature works seamlessly.
    """
    if household_id is not None:
        membership = db.scalar(
            select(HouseholdMember).where(
                HouseholdMember.user_id == user.id,
                HouseholdMember.household_id == household_id,
            )
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )
        return household_id

    membership = db.scalar(
        select(HouseholdMember)
        .where(HouseholdMember.user_id == user.id)
        .order_by(HouseholdMember.id.asc())
    )
    if membership is not None:
        return membership.household_id

    if not auto_create_if_none:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to any household",
        )

    household = Household(name=f"{user.full_name}'s Home")
    db.add(household)
    db.flush()

    member = HouseholdMember(
        user_id=user.id,
        household_id=household.id,
        role=HouseholdRole.OWNER,
    )
    db.add(member)
    db.commit()
    db.refresh(household)
    return household.id


# ---------- Household Inventory CRUD ----------

def _serialize_inventory_entry(entry: InventoryEntry, item: Item) -> InventoryEntryRead:
    return InventoryEntryRead(
        id=entry.id,
        household_id=entry.household_id,
        item_id=entry.item_id,
        is_available=entry.is_available,
        quantity=entry.quantity,
        unit=entry.unit,
        location=entry.location,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        item=ItemRead.model_validate(item),
    )


def list_inventory_entries(
    db: Session,
    household_id: int,
    *,
    search: str | None = None,
    item_type: ItemType | None = None,
    category: str | None = None,
    location: str | None = None,
    is_available: bool | None = None,
) -> list[InventoryEntryRead]:
    """List inventory entries for a household joined with their catalog Item."""
    stmt = (
        select(InventoryEntry, Item)
        .join(Item, InventoryEntry.item_id == Item.id)
        .where(InventoryEntry.household_id == household_id)
    )

    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(Item.name.ilike(q))

    if item_type is not None:
        stmt = stmt.where(Item.item_type == item_type)

    if category and category.strip():
        stmt = stmt.where(func.upper(Item.category) == category.strip().upper())

    if location and location.strip():
        stmt = stmt.where(func.lower(InventoryEntry.location) == location.strip().lower())

    if is_available is not None:
        stmt = stmt.where(InventoryEntry.is_available == is_available)

    stmt = stmt.order_by(Item.name.asc(), InventoryEntry.id.asc())
    rows = db.execute(stmt).all()
    return [_serialize_inventory_entry(entry, item) for entry, item in rows]


def get_inventory_entry(
    db: Session, entry_id: int, household_id: int
) -> InventoryEntryRead:
    """Return one inventory entry belonging to the household or raise 404."""
    row = db.execute(
        select(InventoryEntry, Item)
        .join(Item, InventoryEntry.item_id == Item.id)
        .where(
            InventoryEntry.id == entry_id,
            InventoryEntry.household_id == household_id,
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory entry not found",
        )
    entry, item = row
    return _serialize_inventory_entry(entry, item)


def create_inventory_entry(
    db: Session, household_id: int, payload: InventoryEntryCreate
) -> InventoryEntryRead:
    """Create a new household inventory entry."""
    item = get_catalog_item(db, payload.item_id)

    duplicate = db.scalar(
        select(InventoryEntry).where(
            InventoryEntry.household_id == household_id,
            InventoryEntry.item_id == payload.item_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item already exists in household inventory",
        )

    if item.item_type == ItemType.APPLIANCE:
        quantity = None
        unit = None
        is_available = payload.is_available
    else:
        quantity = payload.quantity
        unit = payload.unit if quantity is not None else None
        if quantity is not None and unit is None:
            unit = item.default_unit
        if quantity == 0:
            is_available = False
        else:
            is_available = payload.is_available

    entry = InventoryEntry(
        household_id=household_id,
        item_id=item.id,
        is_available=is_available,
        quantity=quantity,
        unit=unit,
        location=payload.location,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item already exists in household inventory",
        )
    db.refresh(entry)
    return _serialize_inventory_entry(entry, item)


def update_inventory_entry(
    db: Session,
    entry_id: int,
    household_id: int,
    payload: InventoryEntryUpdate,
) -> InventoryEntryRead:
    """Update an existing household inventory entry."""
    row = db.execute(
        select(InventoryEntry, Item)
        .join(Item, InventoryEntry.item_id == Item.id)
        .where(
            InventoryEntry.id == entry_id,
            InventoryEntry.household_id == household_id,
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory entry not found",
        )

    entry, item = row
    updates = payload.model_dump(exclude_unset=True)

    if "location" in updates:
        entry.location = updates["location"]

    if item.item_type == ItemType.APPLIANCE:
        entry.quantity = None
        entry.unit = None
        if "is_available" in updates and updates["is_available"] is not None:
            entry.is_available = updates["is_available"]
    else:
        if "quantity" in updates:
            entry.quantity = updates["quantity"]
            if entry.quantity is None:
                entry.unit = None
            elif "unit" not in updates and entry.unit is None:
                entry.unit = item.default_unit

        if "unit" in updates and entry.quantity is not None:
            entry.unit = updates["unit"] or item.default_unit

        if "is_available" in updates and updates["is_available"] is not None:
            entry.is_available = updates["is_available"]
        elif "quantity" in updates and entry.quantity is not None:
            entry.is_available = entry.quantity > 0

    db.commit()
    db.refresh(entry)
    return _serialize_inventory_entry(entry, item)


def delete_inventory_entry(db: Session, entry_id: int, household_id: int) -> None:
    """Delete an inventory entry belonging to the household."""
    entry = db.scalar(
        select(InventoryEntry).where(
            InventoryEntry.id == entry_id,
            InventoryEntry.household_id == household_id,
        )
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory entry not found",
        )
    db.delete(entry)
    db.commit()

