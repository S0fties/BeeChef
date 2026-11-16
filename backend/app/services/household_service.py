"""Service layer for household operations."""

from sqlalchemy.orm import Session

from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.user import User
from app.schemas.household import HouseholdCreate, HouseholdRead


def _to_read(household: Household, role: HouseholdRole) -> HouseholdRead:
    return HouseholdRead(
        id=household.id,
        name=household.name,
        created_at=household.created_at,
        role=role,
    )


def create_household(
    db: Session, user: User, payload: HouseholdCreate
) -> HouseholdRead:
    """Create a household and register its creator as owner in one transaction."""
    household = Household(name=payload.name)
    db.add(household)
    db.flush()

    db.add(
        HouseholdMember(
            user_id=user.id,
            household_id=household.id,
            role=HouseholdRole.OWNER,
        )
    )
    db.commit()
    db.refresh(household)
    return _to_read(household, HouseholdRole.OWNER)