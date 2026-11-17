"""Unit tests for the invitation schemas."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.models.invitation import InvitationStatus
from app.schemas.invitation import InvitationCreate, InvitationRead


def first_error(exc_info):
    return exc_info.value.errors()[0]


def make_invitation_row(**overrides):
    values = {
        "id": 1,
        "household_id": 2,
        "invitee_user_id": 3,
        "status": InvitationStatus.PENDING,
        "created_at": datetime(2026, 11, 17, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_create_accepts_a_positive_friend_user_id():
    assert InvitationCreate(friend_user_id=5).friend_user_id == 5


def test_create_requires_friend_user_id():
    with pytest.raises(ValidationError) as exc_info:
        InvitationCreate.model_validate({})

    error = first_error(exc_info)
    assert error["loc"] == ("friend_user_id",)
    assert error["type"] == "missing"


def test_create_rejects_the_old_email_payload():
    with pytest.raises(ValidationError) as exc_info:
        InvitationCreate.model_validate({"email": "maya@example.com"})

    assert first_error(exc_info)["loc"] == ("friend_user_id",)


@pytest.mark.parametrize("bad_id", [0, -1])
def test_create_rejects_non_positive_ids(bad_id):
    with pytest.raises(ValidationError) as exc_info:
        InvitationCreate(friend_user_id=bad_id)

    assert first_error(exc_info)["loc"] == ("friend_user_id",)


@pytest.mark.parametrize("bad_id", [None, "abc", 1.5])
def test_create_rejects_non_integer_ids(bad_id):
    with pytest.raises(ValidationError) as exc_info:
        InvitationCreate.model_validate({"friend_user_id": bad_id})

    assert first_error(exc_info)["loc"] == ("friend_user_id",)


def test_read_is_built_from_an_orm_like_object():
    read = InvitationRead.model_validate(make_invitation_row())

    assert (read.id, read.household_id, read.invitee_user_id) == (1, 2, 3)
    assert read.status is InvitationStatus.PENDING


def test_read_exposes_invitee_user_id_instead_of_email():
    data = InvitationRead.model_validate(make_invitation_row()).model_dump()

    assert data["invitee_user_id"] == 3
    assert "invitee_email" not in data


def test_read_serialises_status_as_lowercase_value():
    read = InvitationRead.model_validate(make_invitation_row())

    assert read.model_dump(mode="json")["status"] == "pending"