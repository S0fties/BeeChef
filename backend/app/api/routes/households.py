"""FastAPI router for households (/api/v1/households)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.household import HouseholdCreate, HouseholdRead
from app.services import household_service

router = APIRouter(prefix="/api/v1/households", tags=["households"])


@router.post("", response_model=HouseholdRead, status_code=status.HTTP_201_CREATED)
def create_household(
    payload: HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return household_service.create_household(db, current_user, payload)