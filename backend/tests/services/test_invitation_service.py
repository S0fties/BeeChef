"""Unit tests for the invitation service."""

from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import event, select
from sqlalchemy.exc import IntegrityError

from app.models.household_member import HouseholdMember
from app.models.invitation import Invitation, InvitationStatus
from app.schemas.invitation import InvitationCreate
from app.services import invitation_service
from app.services.friend_service import MockFriendService
from tests.helpers import (
    FakeFriends,
    add_household,
    add_invitation,
    add_member,
    add_user,
    count_rows,
)


@contextmanager
def failing_membership_insert():
    def fail(mapper, connection, target):
        raise IntegrityError("INSERT INTO household_members", {}, Exception("boom"))

    event.listen(HouseholdMember, "before_insert", fail)
    try:
        yield
    finally:
        event.remove(HouseholdMember, "before_insert", fail)


@pytest.fixture
def scenario(db_session):
    owner = add_user(db_session, "owner@example.com", "owner")
    friend = add_user(db_session, "maya@example.com", "maya")
    household = add_household(db_session, owner.id)
    membership = db_session.scalar(
        select(HouseholdMember).where(
            HouseholdMember.household_id == household.id,
            HouseholdMember.user_id == owner.id,
        )
    )
    return SimpleNamespace(
        owner=owner, friend=friend, household=household, membership=membership
    )


def invite(db_session, scenario, friend_id, friends=None):
    return invitation_service.create_invitation(
        db_session,
        scenario.membership,
        InvitationCreate(friend_user_id=friend_id),
        friends if friends is not None else MockFriendService(),
    )


def test_create_invitation_stores_the_friend_as_invitee(db_session, scenario):
    invitation = invite(db_session, scenario, scenario.friend.id)

    assert invitation.invitee_user_id == scenario.friend.id
    assert invitation.invited_by_user_id == scenario.owner.id
    assert invitation.household_id == scenario.household.id
    assert invitation.status == InvitationStatus.PENDING


def test_create_invitation_rejects_a_user_who_is_not_a_friend(db_session, scenario):
    with pytest.raises(HTTPException) as exc_info:
        invite(db_session, scenario, scenario.friend.id, friends=FakeFriends())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Friend not found"
    assert count_rows(db_session, Invitation) == 0


def test_create_invitation_rejects_an_unknown_user_with_the_same_error(
    db_session, scenario
):
    with pytest.raises(HTTPException) as exc_info:
        invite(db_session, scenario, 999_999)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Friend not found"
    assert count_rows(db_session, Invitation) == 0


def test_create_invitation_rejects_an_existing_member(db_session, scenario):
    add_member(db_session, scenario.friend.id, scenario.household.id)

    with pytest.raises(HTTPException) as exc_info:
        invite(db_session, scenario, scenario.friend.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "User is already a member of this household"


def test_create_invitation_rejects_a_second_pending_invitation(db_session, scenario):
    add_invitation(
        db_session, scenario.household.id, scenario.owner.id, scenario.friend.id
    )

    with pytest.raises(HTTPException) as exc_info:
        invite(db_session, scenario, scenario.friend.id)

    assert exc_info.value.status_code == 409
    assert (
        exc_info.value.detail == "A pending invitation already exists for this user"
    )


def test_friend_check_runs_before_membership_check(db_session, scenario):
    add_member(db_session, scenario.friend.id, scenario.household.id)

    with pytest.raises(HTTPException) as exc_info:
        invite(db_session, scenario, scenario.friend.id, friends=FakeFriends())

    assert exc_info.value.status_code == 404


def test_list_received_invitations_returns_only_my_pending_ones(db_session, scenario):
    other_user = add_user(db_session, "ali@example.com", "ali")
    other_household = add_household(db_session, scenario.owner.id, name="Old House")
    mine = add_invitation(
        db_session, scenario.household.id, scenario.owner.id, scenario.friend.id
    )
    add_invitation(
        db_session, scenario.household.id, scenario.owner.id, other_user.id
    )
    add_invitation(
        db_session,
        other_household.id,
        scenario.owner.id,
        scenario.friend.id,
        status=InvitationStatus.DECLINED,
    )

    received = invitation_service.list_received_invitations(
        db_session, scenario.friend
    )

    assert [item.id for item in received] == [mine.id]


def test_failed_membership_insert_leaves_invitation_pending(db_session, scenario):
    invitation = add_invitation(
        db_session, scenario.household.id, scenario.owner.id, scenario.friend.id
    )

    with failing_membership_insert():
        with pytest.raises(HTTPException) as exc_info:
            invitation_service.accept_invitation(
                db_session, scenario.friend, invitation.id
            )

    assert exc_info.value.status_code == 409
    db_session.refresh(invitation)
    assert invitation.status == InvitationStatus.PENDING
    assert (
        count_rows(
            db_session, HouseholdMember, HouseholdMember.user_id == scenario.friend.id
        )
        == 0
    )