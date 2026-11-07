"""FastAPI router for household inventory entries (/inventory)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.item import ItemType
from app.models.user import User
from app.schemas.inventory import (
    InventoryEntryCreate,
    InventoryEntryRead,
    InventoryEntryUpdate,
)
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryEntryRead])
def list_inventory(
    household_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    item_type: ItemType | None = Query(default=None),
    category: str | None = Query(default=None),
    location: str | None = Query(default=None),
    is_available: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_household_id = inventory_service.resolve_user_household_id(
        db, current_user, household_id=household_id
    )
    return inventory_service.list_inventory_entries(
        db,
        resolved_household_id,
        search=search,
        item_type=item_type,
        category=category,
        location=location,
        is_available=is_available,
    )


@router.get("/{entry_id}", response_model=InventoryEntryRead)
def get_inventory_entry(
    entry_id: int,
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_household_id = inventory_service.resolve_user_household_id(
        db, current_user, household_id=household_id
    )
    return inventory_service.get_inventory_entry(db, entry_id, resolved_household_id)


@router.post("", response_model=InventoryEntryRead, status_code=status.HTTP_201_CREATED)
def create_inventory_entry(
    payload: InventoryEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_household_id = inventory_service.resolve_user_household_id(
        db, current_user, household_id=payload.household_id
    )
    return inventory_service.create_inventory_entry(
        db, resolved_household_id, payload
    )


@router.patch("/{entry_id}", response_model=InventoryEntryRead)
def update_inventory_entry(
    entry_id: int,
    payload: InventoryEntryUpdate,
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_household_id = inventory_service.resolve_user_household_id(
        db, current_user, household_id=household_id
    )
    return inventory_service.update_inventory_entry(
        db, entry_id, resolved_household_id, payload
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_entry(
    entry_id: int,
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_household_id = inventory_service.resolve_user_household_id(
        db, current_user, household_id=household_id
    )
    inventory_service.delete_inventory_entry(db, entry_id, resolved_household_id)

