"""Tests for the Invitation model."""

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Household, Invitation, InvitationStatus, User


def make_user(db_session, email, user_name) -> User:
    user = User(
        email=email,
        hashed_password="hash",
        name="Bee",
        surname="Chef",
        user_name=user_name,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def household(db_session):
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.flush()
    return household


@pytest.fixture
def inviter(db_session):
    return make_user(db_session, "owner@example.com", "owner")


@pytest.fixture
def invitee(db_session):
    return make_user(db_session, "maya@example.com", "maya")


def make_invitation(household, inviter, invitee, **extra):
    return Invitation(
        household_id=household.id,
        invited_by_user_id=inviter.id,
        invitee_user_id=invitee.id,
        **extra,
    )


def count_invitations(db_session, household_id) -> int:
    return db_session.scalar(
        select(func.count())
        .select_from(Invitation)
        .where(Invitation.household_id == household_id)
    )


def test_invitation_can_be_saved_and_read_back(
    db_session, household, inviter, invitee
):
    invitation = make_invitation(household, inviter, invitee)
    db_session.add(invitation)
    db_session.commit()

    saved = db_session.get(Invitation, invitation.id)
    assert saved.household_id == household.id
    assert saved.invited_by_user_id == inviter.id
    assert saved.invitee_user_id == invitee.id


def test_status_defaults_to_pending_and_created_at_is_filled(
    db_session, household, inviter, invitee
):
    invitation = make_invitation(household, inviter, invitee)
    db_session.add(invitation)
    db_session.commit()

    db_session.refresh(invitation)
    assert invitation.status == InvitationStatus.PENDING
    assert invitation.created_at is not None


def test_status_is_stored_as_lowercase_value(
    db_session, household, inviter, invitee
):
    invitation = make_invitation(household, inviter, invitee)
    db_session.add(invitation)
    db_session.commit()

    stored = db_session.execute(
        text("SELECT status::text FROM invitations WHERE id = :id"),
        {"id": invitation.id},
    ).scalar_one()
    assert stored == "pending"


def test_invitee_must_be_an_existing_user(db_session, household, inviter):
    db_session.add(
        Invitation(
            household_id=household.id,
            invited_by_user_id=inviter.id,
            invitee_user_id=999_999,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_duplicate_pending_invitation_is_rejected(
    db_session, household, inviter, invitee
):
    db_session.add(make_invitation(household, inviter, invitee))
    db_session.commit()

    db_session.add(make_invitation(household, inviter, invitee))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_different_invitees_can_be_pending_in_the_same_household(
    db_session, household, inviter, invitee
):
    other_invitee = make_user(db_session, "ali@example.com", "ali")

    db_session.add_all(
        [
            make_invitation(household, inviter, invitee),
            make_invitation(household, inviter, other_invitee),
        ]
    )
    db_session.commit()

    assert count_invitations(db_session, household.id) == 2


@pytest.mark.parametrize(
    "closed_status", [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED]
)
def test_new_pending_invitation_is_allowed_after_previous_one_closed(
    db_session, household, inviter, invitee, closed_status
):
    db_session.add(
        make_invitation(household, inviter, invitee, status=closed_status)
    )
    db_session.commit()

    db_session.add(make_invitation(household, inviter, invitee))
    db_session.commit()

    assert count_invitations(db_session, household.id) == 2


def test_same_invitee_can_be_invited_to_different_households(
    db_session, household, inviter, invitee
):
    other_household = Household(name="Parents House")
    db_session.add(other_household)
    db_session.flush()

    db_session.add_all(
        [
            make_invitation(household, inviter, invitee),
            make_invitation(other_household, inviter, invitee),
        ]
    )
    db_session.commit()

    assert count_invitations(db_session, household.id) == 1
    assert count_invitations(db_session, other_household.id) == 1


def test_deleting_household_deletes_its_invitations(
    db_session, household, inviter, invitee
):
    db_session.add(make_invitation(household, inviter, invitee))
    db_session.commit()
    household_id = household.id

    db_session.delete(household)
    db_session.commit()

    assert count_invitations(db_session, household_id) == 0


def test_deleting_invitee_deletes_invitations_sent_to_them(
    db_session, household, inviter, invitee
):
    db_session.add(make_invitation(household, inviter, invitee))
    db_session.commit()
    household_id = household.id

    db_session.delete(invitee)
    db_session.commit()

    assert count_invitations(db_session, household_id) == 0