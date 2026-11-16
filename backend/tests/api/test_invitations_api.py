"""API tests for the invitee side of invitations (/api/v1/invitations)."""

import pytest

from app.models.invitation import InvitationStatus
from tests.helpers import add_household, add_invitation, register_and_login

INVITATIONS_URL = "/api/v1/invitations"


def test_list_my_invitations_returns_pending_invitation_details(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, maya_headers = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id, name="Softies House")
    invitation = add_invitation(db_session, household.id, owner_id, "maya@example.com")

    response = client.get(INVITATIONS_URL, headers=maya_headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    item = body[0]
    assert item["id"] == invitation.id
    assert item["household_id"] == household.id
    assert item["household_name"] == "Softies House"
    assert item["invited_by_user_name"] == "owner"
    assert item["status"] == "pending"
    assert item["created_at"] is not None


def test_list_my_invitations_excludes_other_peoples_invitations(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, maya_headers = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    add_invitation(db_session, household.id, owner_id, "carol@example.com")

    response = client.get(INVITATIONS_URL, headers=maya_headers)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    "closed_status", [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED]
)
def test_list_my_invitations_excludes_closed_invitations(
    client, db_session, closed_status
):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, maya_headers = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    add_invitation(
        db_session, household.id, owner_id, "maya@example.com", status=closed_status
    )

    response = client.get(INVITATIONS_URL, headers=maya_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_my_invitations_returns_newest_first(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, maya_headers = register_and_login(client, email="maya@example.com")
    first_house = add_household(db_session, owner_id, name="First House")
    second_house = add_household(db_session, owner_id, name="Second House")
    first = add_invitation(db_session, first_house.id, owner_id, "maya@example.com")
    second = add_invitation(db_session, second_house.id, owner_id, "maya@example.com")

    response = client.get(INVITATIONS_URL, headers=maya_headers)

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second.id, first.id]


def test_list_my_invitations_is_empty_without_invitations(client):
    _, headers = register_and_login(client)

    response = client.get(INVITATIONS_URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_my_invitations_without_token_returns_401(client):
    response = client.get(INVITATIONS_URL)

    assert response.status_code == 401