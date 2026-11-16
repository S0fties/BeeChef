"""Service layer for household operations."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.user import User
from app.schemas.household import HouseholdCreate, HouseholdRead, HouseholdUpdate


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


def list_user_households(db: Session, user: User) -> list[HouseholdRead]:
    """Return every household the user belongs to, with the user's role."""
    rows = db.execute(
        select(Household, HouseholdMember.role)
        .join(HouseholdMember, HouseholdMember.household_id == Household.id)
        .where(HouseholdMember.user_id == user.id)
        .order_by(Household.id.asc())
    ).all()
    return [_to_read(household, role) for household, role in rows]


def get_membership_or_404(
    db: Session, user: User, household_id: int
) -> HouseholdMember:
    """Return the user's membership or 404, hiding whether the household exists."""
    membership = db.scalar(
        select(HouseholdMember).where(
            HouseholdMember.user_id == user.id,
            HouseholdMember.household_id == household_id,
        )
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Household not found")
    return membership


def get_household(db: Session, membership: HouseholdMember) -> HouseholdRead:
    """Return the household referenced by an already authorized membership."""
    household = db.get(Household, membership.household_id)
    return _to_read(household, membership.role)

def update_household(
    db: Session, membership: HouseholdMember, payload: HouseholdUpdate
) -> HouseholdRead:
    """Apply the provided fields to the household of an authorized owner."""
    household = db.get(Household, membership.household_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        household.name = updates["name"]

    role = membership.role
    db.commit()
    db.refresh(household)
    return _to_read(household, role)