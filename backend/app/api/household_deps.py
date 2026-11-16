"""Authorization dependencies for household-scoped endpoints."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.services import household_service


def get_household_membership(
    household_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HouseholdMember:
    """Return the caller's membership in the path household or raise 404."""
    return household_service.get_membership_or_404(db, current_user, household_id)