"""Tests for the Invitation model."""

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Household, Invitation, InvitationStatus, User


@pytest.fixture
def household(db_session):
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.flush()
    return household


@pytest.fixture
def inviter(db_session):
    user = User(
        email="owner@example.com",
        hashed_password="hash",
        name="Bee",
        surname="Chef",
        user_name="owner",
    )
    db_session.add(user)
    db_session.flush()
    return user


def make_invitation(household, inviter, email="maya@example.com", **extra):
    return Invitation(
        household_id=household.id,
        invited_by_user_id=inviter.id,
        invitee_email=email,
        **extra,
    )


def count_invitations(db_session, household_id) -> int:
    return db_session.scalar(
        select(func.count())
        .select_from(Invitation)
        .where(Invitation.household_id == household_id)
    )


def test_invitation_can_be_saved_and_read_back(db_session, household, inviter):
    invitation = make_invitation(household, inviter)
    db_session.add(invitation)
    db_session.commit()

    saved = db_session.get(Invitation, invitation.id)
    assert saved.household_id == household.id
    assert saved.invited_by_user_id == inviter.id
    assert saved.invitee_email == "maya@example.com"


def test_status_defaults_to_pending_and_created_at_is_filled(
    db_session, household, inviter
):
    invitation = make_invitation(household, inviter)
    db_session.add(invitation)
    db_session.commit()

    db_session.refresh(invitation)
    assert invitation.status == InvitationStatus.PENDING
    assert invitation.created_at is not None


def test_status_is_stored_as_lowercase_value(db_session, household, inviter):
    invitation = make_invitation(household, inviter)
    db_session.add(invitation)
    db_session.commit()

    stored = db_session.execute(
        text("SELECT status::text FROM invitations WHERE id = :id"),
        {"id": invitation.id},
    ).scalar_one()
    assert stored == "pending"


def test_duplicate_pending_invitation_is_rejected(db_session, household, inviter):
    db_session.add(make_invitation(household, inviter))
    db_session.commit()

    db_session.add(make_invitation(household, inviter))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "closed_status", [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED]
)
def test_new_pending_invitation_is_allowed_after_previous_one_closed(
    db_session, household, inviter, closed_status
):
    db_session.add(make_invitation(household, inviter, status=closed_status))
    db_session.commit()

    db_session.add(make_invitation(household, inviter))
    db_session.commit()

    assert count_invitations(db_session, household.id) == 2


def test_same_email_can_be_invited_to_different_households(
    db_session, household, inviter
):
    other_household = Household(name="Parents House")
    db_session.add(other_household)
    db_session.flush()

    db_session.add_all(
        [
            make_invitation(household, inviter),
            make_invitation(other_household, inviter),
        ]
    )
    db_session.commit()

    assert count_invitations(db_session, household.id) == 1
    assert count_invitations(db_session, other_household.id) == 1


def test_deleting_household_deletes_its_invitations(db_session, household, inviter):
    db_session.add(make_invitation(household, inviter))
    db_session.commit()
    household_id = household.id

    db_session.delete(household)
    db_session.commit()

    assert count_invitations(db_session, household_id) == 0