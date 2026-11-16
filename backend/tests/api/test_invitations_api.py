"""API tests for the invitee side of invitations (/api/v1/invitations)."""

from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.invitation import InvitationStatus
from tests.helpers import (
    add_household,
    add_invitation,
    add_member,
    count_rows,
    register_and_login,
)

HOUSEHOLDS_URL = "/api/v1/households"
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


# ---------- accept / decline ----------

def accept_url(invitation_id: int) -> str:
    return f"{INVITATIONS_URL}/{invitation_id}/accept"


def decline_url(invitation_id: int) -> str:
    return f"{INVITATIONS_URL}/{invitation_id}/decline"


def membership_count(db_session, user_id, household_id) -> int:
    return count_rows(
        db_session,
        HouseholdMember,
        HouseholdMember.user_id == user_id,
        HouseholdMember.household_id == household_id,
    )


@pytest.fixture
def scenario(client, db_session):
    owner_id, owner_headers = register_and_login(client, email="owner@example.com")
    maya_id, maya_headers = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id, name="Softies House")
    invitation = add_invitation(db_session, household.id, owner_id, "maya@example.com")
    return SimpleNamespace(
        household=household,
        invitation=invitation,
        owner_id=owner_id,
        owner_headers=owner_headers,
        maya_id=maya_id,
        maya_headers=maya_headers,
    )


def test_accept_invitation_adds_member_and_closes_invitation(
    client, db_session, scenario
):
    response = client.post(
        accept_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == scenario.household.id
    assert body["name"] == "Softies House"
    assert body["role"] == "member"

    membership = db_session.scalar(
        select(HouseholdMember).where(
            HouseholdMember.user_id == scenario.maya_id,
            HouseholdMember.household_id == scenario.household.id,
        )
    )
    assert membership is not None
    assert membership.role == HouseholdRole.MEMBER
    db_session.refresh(scenario.invitation)
    assert scenario.invitation.status == InvitationStatus.ACCEPTED
    assert client.get(INVITATIONS_URL, headers=scenario.maya_headers).json() == []


def test_accepted_member_can_view_but_not_update_household(client, scenario):
    household_url = f"{HOUSEHOLDS_URL}/{scenario.household.id}"

    accept = client.post(
        accept_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert accept.status_code == 200
    assert client.get(household_url, headers=scenario.maya_headers).status_code == 200
    update = client.patch(
        household_url, json={"name": "Hijacked"}, headers=scenario.maya_headers
    )
    assert update.status_code == 403


def test_cannot_accept_someone_elses_invitation(client, db_session, scenario):
    carol_id, carol_headers = register_and_login(client, email="carol@example.com")

    other = client.post(accept_url(scenario.invitation.id), headers=carol_headers)
    missing = client.post(
        accept_url(scenario.invitation.id + 1000), headers=carol_headers
    )

    assert other.status_code == 404
    assert other.json() == {"detail": "Invitation not found"}
    assert missing.status_code == 404
    assert missing.json() == other.json()
    db_session.refresh(scenario.invitation)
    assert scenario.invitation.status == InvitationStatus.PENDING
    assert membership_count(db_session, carol_id, scenario.household.id) == 0


@pytest.mark.parametrize(
    "closed_status", [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED]
)
def test_cannot_accept_closed_invitation(client, db_session, scenario, closed_status):
    scenario.invitation.status = closed_status
    db_session.commit()

    response = client.post(
        accept_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Invitation is no longer pending"}
    assert membership_count(db_session, scenario.maya_id, scenario.household.id) == 0


def test_accepting_twice_does_not_duplicate_membership(client, db_session, scenario):
    url = accept_url(scenario.invitation.id)

    first = client.post(url, headers=scenario.maya_headers)
    second = client.post(url, headers=scenario.maya_headers)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json() == {"detail": "Invitation is no longer pending"}
    assert membership_count(db_session, scenario.maya_id, scenario.household.id) == 1


def test_cannot_accept_when_already_a_member(client, db_session, scenario):
    add_member(db_session, scenario.maya_id, scenario.household.id)

    response = client.post(
        accept_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "User is already a member of this household"}
    assert membership_count(db_session, scenario.maya_id, scenario.household.id) == 1
    db_session.refresh(scenario.invitation)
    assert scenario.invitation.status == InvitationStatus.PENDING


def test_accept_without_token_returns_401(client, scenario):
    response = client.post(accept_url(scenario.invitation.id))

    assert response.status_code == 401


def test_accept_with_non_integer_id_returns_400(client, scenario):
    response = client.post(
        f"{INVITATIONS_URL}/abc/accept", headers=scenario.maya_headers
    )

    assert response.status_code == 400


def test_decline_invitation_closes_it_without_adding_member(
    client, db_session, scenario
):
    response = client.post(
        decline_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert response.status_code == 204
    assert response.content == b""
    db_session.refresh(scenario.invitation)
    assert scenario.invitation.status == InvitationStatus.DECLINED
    assert membership_count(db_session, scenario.maya_id, scenario.household.id) == 0
    assert client.get(INVITATIONS_URL, headers=scenario.maya_headers).json() == []


def test_cannot_decline_someone_elses_invitation(client, db_session, scenario):
    _, carol_headers = register_and_login(client, email="carol@example.com")

    response = client.post(decline_url(scenario.invitation.id), headers=carol_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Invitation not found"}
    db_session.refresh(scenario.invitation)
    assert scenario.invitation.status == InvitationStatus.PENDING


@pytest.mark.parametrize(
    "closed_status", [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED]
)
def test_cannot_decline_closed_invitation(client, db_session, scenario, closed_status):
    scenario.invitation.status = closed_status
    db_session.commit()

    response = client.post(
        decline_url(scenario.invitation.id), headers=scenario.maya_headers
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Invitation is no longer pending"}


def test_decline_without_token_returns_401(client, scenario):
    response = client.post(decline_url(scenario.invitation.id))

    assert response.status_code == 401