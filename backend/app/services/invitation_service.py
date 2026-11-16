"""Service layer for household invitations."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.household_member import HouseholdMember
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User
from app.schemas.invitation import InvitationCreate, ReceivedInvitationRead
from app.models.household import Household

_ALREADY_MEMBER_DETAIL = "User is already a member of this household"
_ALREADY_PENDING_DETAIL = "A pending invitation already exists for this email"


def create_invitation(
    db: Session, membership: HouseholdMember, payload: InvitationCreate
) -> Invitation:
    """Create a pending invitation to the owner's household for the given email."""
    household_id = membership.household_id
    email = payload.email

    already_member = db.scalar(
        select(HouseholdMember.id)
        .join(User, User.id == HouseholdMember.user_id)
        .where(
            HouseholdMember.household_id == household_id,
            func.lower(User.email) == email,
        )
        .limit(1)
    )
    if already_member is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, _ALREADY_MEMBER_DETAIL)

    already_pending = db.scalar(
        select(Invitation.id)
        .where(
            Invitation.household_id == household_id,
            Invitation.invitee_email == email,
            Invitation.status == InvitationStatus.PENDING,
        )
        .limit(1)
    )
    if already_pending is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, _ALREADY_PENDING_DETAIL)

    invitation = Invitation(
        household_id=household_id,
        invited_by_user_id=membership.user_id,
        invitee_email=email,
    )
    db.add(invitation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _ALREADY_PENDING_DETAIL)
    db.refresh(invitation)
    return invitation


def list_received_invitations(
    db: Session, user: User
) -> list[ReceivedInvitationRead]:
    """Return pending invitations addressed to the user's email, newest first."""
    rows = db.execute(
        select(Invitation, Household.name, User.user_name)
        .join(Household, Household.id == Invitation.household_id)
        .join(User, User.id == Invitation.invited_by_user_id)
        .where(
            Invitation.invitee_email == user.email.lower(),
            Invitation.status == InvitationStatus.PENDING,
        )
        .order_by(Invitation.created_at.desc(), Invitation.id.desc())
    ).all()
    return [
        ReceivedInvitationRead(
            id=invitation.id,
            household_id=invitation.household_id,
            household_name=household_name,
            invited_by_user_name=inviter_user_name,
            status=invitation.status,
            created_at=invitation.created_at,
        )
        for invitation, household_name, inviter_user_name in rows
    ]