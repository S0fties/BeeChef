"""Preferences router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.preferences import (
    AllergyItemAdd,
    AllergyItemDelete,
    AllergyLabelAdd,
    AllergyLabelDelete,
    ItemPreferenceAdd,
    ItemPreferenceDelete,
    UserPreferencesOut,
)
from app.services import preference_service as service

router = APIRouter(prefix="/api/v1/preferences", tags=["preferences"])


@router.get("", response_model=UserPreferencesOut)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_preferences(db, current_user.id)


# ---------- Preferred / restricted items ----------

@router.post("/items", response_model=UserPreferencesOut)
def add_item_preferences(
    body: ItemPreferenceAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add or update preferred/restricted items (upsert)."""
    return service.add_item_preferences(db, current_user.id, body)


@router.post("/items/delete", response_model=UserPreferencesOut)
def delete_item_preferences(
    body: ItemPreferenceDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set items back to neutral."""
    return service.delete_item_preferences(db, current_user.id, body)


# ---------- Allergy items ----------

@router.post("/allergies/items", response_model=UserPreferencesOut)
def add_allergy_items(
    body: AllergyItemAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.add_allergy_items(db, current_user.id, body)


@router.post("/allergies/items/delete", response_model=UserPreferencesOut)
def delete_allergy_items(
    body: AllergyItemDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.delete_allergy_items(db, current_user.id, body)


# ---------- Allergy labels ----------

@router.post("/allergies/labels", response_model=UserPreferencesOut)
def add_allergy_labels(
    body: AllergyLabelAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.add_allergy_labels(db, current_user.id, body)


@router.post("/allergies/labels/delete", response_model=UserPreferencesOut)
def delete_allergy_labels(
    body: AllergyLabelDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.delete_allergy_labels(db, current_user.id, body)