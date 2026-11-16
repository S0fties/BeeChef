"""FastAPI router for households (/api/v1/households)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.household_deps import get_household_membership, require_owner
from app.db.session import get_db
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.household import HouseholdCreate, HouseholdRead, HouseholdUpdate
from app.services import household_service

router = APIRouter(prefix="/api/v1/households", tags=["households"])


@router.post("", response_model=HouseholdRead, status_code=status.HTTP_201_CREATED)
def create_household(
    payload: HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return household_service.create_household(db, current_user, payload)


@router.get("", response_model=list[HouseholdRead])
def list_households(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return household_service.list_user_households(db, current_user)


@router.get("/{household_id}", response_model=HouseholdRead)
def get_household(
    membership: HouseholdMember = Depends(get_household_membership),
    db: Session = Depends(get_db),
):
    return household_service.get_household(db, membership)

@router.patch("/{household_id}", response_model=HouseholdRead)
def update_household(
    payload: HouseholdUpdate,
    membership: HouseholdMember = Depends(require_owner),
    db: Session = Depends(get_db),
):
    return household_service.update_household(db, membership, payload)