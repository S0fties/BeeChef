"""Unit tests for invitation service transaction behaviour."""

import pytest
from fastapi import HTTPException

from app.models.household_member import HouseholdMember
from app.models.invitation import InvitationStatus
from app.models.user import User
from app.services import invitation_service
from tests.helpers import add_household, add_invitation, add_user, count_rows


def test_failed_membership_insert_leaves_invitation_pending(db_session):
    owner = add_user(db_session, "owner@example.com", "owner")
    household = add_household(db_session, owner.id)
    invitation = add_invitation(db_session, household.id, owner.id, "ghost@example.com")
    ghost = User(
        id=999_999,
        email="ghost@example.com",
        hashed_password="hash",
        name="Ghost",
        surname="User",
        user_name="ghost",
    )

    with pytest.raises(HTTPException):
        invitation_service.accept_invitation(db_session, ghost, invitation.id)

    db_session.refresh(invitation)
    assert invitation.status == InvitationStatus.PENDING
    assert count_rows(db_session, HouseholdMember, HouseholdMember.user_id == 999_999) == 0