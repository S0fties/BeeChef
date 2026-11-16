"""Service layer for household invitations."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User
from app.schemas.household import HouseholdRead
from app.schemas.invitation import InvitationCreate, ReceivedInvitationRead
from app.services import household_service

_ALREADY_MEMBER_DETAIL = "User is already a member of this household"
_ALREADY_PENDING_DETAIL = "A pending invitation already exists for this email"
_INVITATION_NOT_FOUND_DETAIL = "Invitation not found"
_NOT_PENDING_DETAIL = "Invitation is no longer pending"


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


def _get_pending_invitation_for_update(
    db: Session, user: User, invitation_id: int
) -> Invitation:
    """Lock and return the user's own pending invitation, else raise 404 or 409."""
    invitation = db.scalar(
        select(Invitation)
        .where(
            Invitation.id == invitation_id,
            Invitation.invitee_email == user.email.lower(),
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if invitation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _INVITATION_NOT_FOUND_DETAIL)
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, _NOT_PENDING_DETAIL)
    return invitation


def accept_invitation(db: Session, user: User, invitation_id: int) -> HouseholdRead:
    """Join the invitation's household as a member and close the invitation."""
    invitation = _get_pending_invitation_for_update(db, user, invitation_id)
    household_id = invitation.household_id

    already_member = db.scalar(
        select(HouseholdMember.id)
        .where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user.id,
        )
        .limit(1)
    )
    if already_member is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, _ALREADY_MEMBER_DETAIL)

    membership = HouseholdMember(
        user_id=user.id,
        household_id=household_id,
        role=HouseholdRole.MEMBER,
    )
    invitation.status = InvitationStatus.ACCEPTED
    db.add(membership)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _ALREADY_MEMBER_DETAIL)
    return household_service.get_household(db, membership)


def decline_invitation(db: Session, user: User, invitation_id: int) -> None:
    """Close the user's pending invitation without joining the household."""
    invitation = _get_pending_invitation_for_update(db, user, invitation_id)
    invitation.status = InvitationStatus.DECLINED
    db.commit()