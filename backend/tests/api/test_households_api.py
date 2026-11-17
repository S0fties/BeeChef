"""API tests for households (/api/v1/households)."""

import pytest
from sqlalchemy import func, select

from app.api.friend_deps import get_friend_service
from app.main import app
from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.inventory_entry import InventoryEntry
from app.models.item import Item, ItemType
from tests.helpers import (
    FakeFriends,
    add_household,
    add_invitation,
    add_member,
    count_rows,
    register_and_login,
)

HOUSEHOLDS_URL = "/api/v1/households"


def count_rows(db_session, model, *conditions) -> int:
    stmt = select(func.count()).select_from(model).where(*conditions)
    return db_session.scalar(stmt)


def invitations_url(household_id: int) -> str:
    return f"{HOUSEHOLDS_URL}/{household_id}/invitations"


def test_create_household_returns_201_and_owner_role(client):
    _, headers = register_and_login(client)

    response = client.post(
        HOUSEHOLDS_URL, json={"name": "Softies House"}, headers=headers
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["name"] == "Softies House"
    assert body["role"] == "owner"
    assert body["created_at"] is not None


def test_create_household_stores_owner_membership(client, db_session):
    user_id, headers = register_and_login(client)

    response = client.post(
        HOUSEHOLDS_URL, json={"name": "Softies House"}, headers=headers
    )

    assert response.status_code == 201
    household_id = response.json()["id"]
    household = db_session.get(Household, household_id)
    assert household is not None
    assert household.name == "Softies House"

    membership = db_session.scalar(
        select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
        )
    )
    assert membership is not None
    assert membership.role == HouseholdRole.OWNER


def test_create_household_strips_surrounding_whitespace(client):
    _, headers = register_and_login(client)

    response = client.post(
        HOUSEHOLDS_URL, json={"name": "  Softies House  "}, headers=headers
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Softies House"


@pytest.mark.parametrize(
    "payload",
    [{}, {"name": ""}, {"name": "   "}, {"name": "a" * 101}],
    ids=["missing-name", "empty-name", "blank-name", "name-too-long"],
)
def test_create_household_invalid_payload_returns_400(client, db_session, payload):
    _, headers = register_and_login(client)

    response = client.post(HOUSEHOLDS_URL, json=payload, headers=headers)

    assert response.status_code == 400
    assert db_session.scalar(select(func.count()).select_from(Household)) == 0


def test_create_household_without_token_returns_401(client):
    response = client.post(HOUSEHOLDS_URL, json={"name": "Softies House"})

    assert response.status_code == 401


def test_user_can_create_multiple_households(client, db_session):
    user_id, headers = register_and_login(client)

    first = client.post(HOUSEHOLDS_URL, json={"name": "Flat"}, headers=headers)
    second = client.post(HOUSEHOLDS_URL, json={"name": "Parents House"}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    memberships = db_session.scalars(
        select(HouseholdMember).where(HouseholdMember.user_id == user_id)
    ).all()
    assert len(memberships) == 2

# ---------- list my households ----------

def test_list_households_returns_only_my_households_with_roles(client, db_session):
    user_id, headers = register_and_login(client, email="alice@example.com")
    other_id, _ = register_and_login(client, email="bob@example.com")
    third_id, _ = register_and_login(client, email="carol@example.com")
    own = add_household(db_session, user_id, name="Alice Flat")
    shared = add_household(db_session, other_id, name="Bob House")
    add_member(db_session, user_id, shared.id)
    add_household(db_session, third_id, name="Carol House")

    response = client.get(HOUSEHOLDS_URL, headers=headers)

    assert response.status_code == 200
    assert [(h["id"], h["name"], h["role"]) for h in response.json()] == [
        (own.id, "Alice Flat", "owner"),
        (shared.id, "Bob House", "member"),
    ]


def test_list_households_is_empty_without_membership(client):
    _, headers = register_and_login(client)

    response = client.get(HOUSEHOLDS_URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == []


def test_list_households_without_token_returns_401(client):
    response = client.get(HOUSEHOLDS_URL)

    assert response.status_code == 401


# ---------- get one household ----------

@pytest.mark.parametrize("role", [HouseholdRole.OWNER, HouseholdRole.MEMBER])
def test_get_household_is_allowed_for_every_member_role(client, db_session, role):
    user_id, headers = register_and_login(client)
    household = add_household(db_session, user_id, role=role)

    response = client.get(f"{HOUSEHOLDS_URL}/{household.id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == household.id
    assert body["name"] == "Softies House"
    assert body["role"] == role.value


def test_get_household_hides_existence_from_non_members(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, outsider_headers = register_and_login(client, email="outsider@example.com")
    household = add_household(db_session, owner_id)

    existing = client.get(f"{HOUSEHOLDS_URL}/{household.id}", headers=outsider_headers)
    missing = client.get(f"{HOUSEHOLDS_URL}/{household.id + 1000}", headers=outsider_headers)

    assert existing.status_code == 404
    assert existing.json() == {"detail": "Household not found"}
    assert missing.status_code == 404
    assert missing.json() == existing.json()


def test_get_household_without_token_returns_401(client, db_session):
    owner_id, _ = register_and_login(client)
    household = add_household(db_session, owner_id)

    response = client.get(f"{HOUSEHOLDS_URL}/{household.id}")

    assert response.status_code == 401


def test_get_household_with_non_integer_id_returns_400(client):
    _, headers = register_and_login(client)

    response = client.get(f"{HOUSEHOLDS_URL}/abc", headers=headers)

    assert response.status_code == 400

# ---------- update household ----------

def test_owner_can_rename_household(client, db_session):
    user_id, headers = register_and_login(client)
    household = add_household(db_session, user_id, name="Old Name")

    response = client.patch(
        f"{HOUSEHOLDS_URL}/{household.id}",
        json={"name": "  New Name  "},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == household.id
    assert body["name"] == "New Name"
    assert body["role"] == "owner"
    db_session.refresh(household)
    assert household.name == "New Name"


def test_member_cannot_update_household(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    member_id, member_headers = register_and_login(client, email="member@example.com")
    household = add_household(db_session, owner_id, name="Old Name")
    add_member(db_session, member_id, household.id)

    response = client.patch(
        f"{HOUSEHOLDS_URL}/{household.id}",
        json={"name": "Hijacked"},
        headers=member_headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Insufficient permissions in this household"}
    db_session.refresh(household)
    assert household.name == "Old Name"


def test_non_member_cannot_update_household(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, outsider_headers = register_and_login(client, email="outsider@example.com")
    household = add_household(db_session, owner_id, name="Old Name")

    response = client.patch(
        f"{HOUSEHOLDS_URL}/{household.id}",
        json={"name": "Hijacked"},
        headers=outsider_headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Household not found"}
    db_session.refresh(household)
    assert household.name == "Old Name"


def test_update_permission_depends_on_role_in_that_household(client, db_session):
    user_id, headers = register_and_login(client, email="alice@example.com")
    other_id, _ = register_and_login(client, email="bob@example.com")
    own = add_household(db_session, user_id, name="Alice Flat")
    shared = add_household(db_session, other_id, name="Bob House")
    add_member(db_session, user_id, shared.id)

    allowed = client.patch(
        f"{HOUSEHOLDS_URL}/{own.id}", json={"name": "Renamed Flat"}, headers=headers
    )
    denied = client.patch(
        f"{HOUSEHOLDS_URL}/{shared.id}", json={"name": "Renamed House"}, headers=headers
    )

    assert allowed.status_code == 200
    assert denied.status_code == 403


@pytest.mark.parametrize(
    "payload",
    [{}, {"name": None}, {"name": ""}, {"name": "   "}, {"name": "a" * 101}],
    ids=["empty-body", "null-name", "empty-name", "blank-name", "name-too-long"],
)
def test_update_household_invalid_payload_returns_400(client, db_session, payload):
    user_id, headers = register_and_login(client)
    household = add_household(db_session, user_id, name="Old Name")

    response = client.patch(
        f"{HOUSEHOLDS_URL}/{household.id}", json=payload, headers=headers
    )

    assert response.status_code == 400
    db_session.refresh(household)
    assert household.name == "Old Name"


def test_update_household_without_token_returns_401(client, db_session):
    owner_id, _ = register_and_login(client)
    household = add_household(db_session, owner_id)

    response = client.patch(
        f"{HOUSEHOLDS_URL}/{household.id}", json={"name": "New Name"}
    )

    assert response.status_code == 401


# ---------- delete household ----------

def test_owner_can_delete_household(client, db_session):
    user_id, headers = register_and_login(client)
    household_id = add_household(db_session, user_id).id

    response = client.delete(f"{HOUSEHOLDS_URL}/{household_id}", headers=headers)

    assert response.status_code == 204
    assert response.content == b""
    assert count_rows(db_session, Household, Household.id == household_id) == 0

    follow_up = client.get(f"{HOUSEHOLDS_URL}/{household_id}", headers=headers)
    assert follow_up.status_code == 404


def test_delete_household_cascades_to_memberships_and_inventory(client, db_session):
    owner_id, owner_headers = register_and_login(client, email="owner@example.com")
    member_id, _ = register_and_login(client, email="member@example.com")
    bystander_id, _ = register_and_login(client, email="bystander@example.com")
    doomed = add_household(db_session, owner_id, name="Doomed House")
    add_member(db_session, member_id, doomed.id)
    survivor = add_household(db_session, bystander_id, name="Safe House")
    db_session.add(
        Item(
            id=23001,
            name="Tomatoes",
            item_type=ItemType.INGREDIENT,
            category="VEGETABLE",
            subcategory="FRUITING_VEGETABLES",
            default_unit="g",
        )
    )
    db_session.flush()
    db_session.add_all(
        [
            InventoryEntry(household_id=doomed.id, item_id=23001, quantity=500, unit="g"),
            InventoryEntry(household_id=survivor.id, item_id=23001, quantity=100, unit="g"),
        ]
    )
    db_session.commit()
    doomed_id, survivor_id = doomed.id, survivor.id

    response = client.delete(f"{HOUSEHOLDS_URL}/{doomed_id}", headers=owner_headers)

    assert response.status_code == 204
    assert count_rows(db_session, HouseholdMember, HouseholdMember.household_id == doomed_id) == 0
    assert count_rows(db_session, InventoryEntry, InventoryEntry.household_id == doomed_id) == 0
    assert count_rows(db_session, HouseholdMember, HouseholdMember.household_id == survivor_id) == 1
    assert count_rows(db_session, InventoryEntry, InventoryEntry.household_id == survivor_id) == 1
    assert count_rows(db_session, Item) == 1


def test_member_cannot_delete_household(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    member_id, member_headers = register_and_login(client, email="member@example.com")
    household_id = add_household(db_session, owner_id).id
    add_member(db_session, member_id, household_id)

    response = client.delete(f"{HOUSEHOLDS_URL}/{household_id}", headers=member_headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "Insufficient permissions in this household"}
    assert count_rows(db_session, Household, Household.id == household_id) == 1


def test_non_member_cannot_delete_household(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, outsider_headers = register_and_login(client, email="outsider@example.com")
    household_id = add_household(db_session, owner_id).id

    response = client.delete(f"{HOUSEHOLDS_URL}/{household_id}", headers=outsider_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Household not found"}
    assert count_rows(db_session, Household, Household.id == household_id) == 1


def test_delete_household_without_token_returns_401(client, db_session):
    owner_id, _ = register_and_login(client)
    household_id = add_household(db_session, owner_id).id

    response = client.delete(f"{HOUSEHOLDS_URL}/{household_id}")

    assert response.status_code == 401
    assert count_rows(db_session, Household, Household.id == household_id) == 1


# ---------- create invitation ----------


@pytest.fixture
def no_friends():
    app.dependency_overrides[get_friend_service] = lambda: FakeFriends()
    yield
    app.dependency_overrides.pop(get_friend_service, None)


def test_owner_can_invite_a_friend(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["household_id"] == household.id
    assert body["invitee_user_id"] == maya_id
    assert "invitee_email" not in body
    assert body["status"] == "pending"
    assert body["created_at"] is not None

    saved = db_session.get(Invitation, body["id"])
    assert saved.invited_by_user_id == owner_id
    assert saved.status == InvitationStatus.PENDING


def test_cannot_invite_same_friend_twice_while_pending(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    url = invitations_url(household.id)

    first = client.post(url, json={"friend_user_id": maya_id}, headers=headers)
    second = client.post(url, json={"friend_user_id": maya_id}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json() == {
        "detail": "A pending invitation already exists for this user"
    }
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 1
    )


def test_can_invite_again_after_previous_invitation_was_declined(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    add_invitation(
        db_session, household.id, owner_id, maya_id, status=InvitationStatus.DECLINED
    )

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=headers,
    )

    assert response.status_code == 201
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 2
    )


def test_cannot_invite_existing_member(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    member_id, _ = register_and_login(client, email="member@example.com")
    household = add_household(db_session, owner_id)
    add_member(db_session, member_id, household.id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": member_id},
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "User is already a member of this household"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_cannot_invite_yourself(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": owner_id},
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Friend not found"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_can_invite_user_who_belongs_to_another_household(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    add_household(db_session, maya_id, name="Maya House")

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=headers,
    )

    assert response.status_code == 201


def test_cannot_invite_a_user_who_is_not_a_friend(client, db_session, no_friends):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Friend not found"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_cannot_invite_an_unknown_user(client, db_session):
    owner_id, headers = register_and_login(client, email="owner@example.com")
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": 999_999},
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Friend not found"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_member_cannot_invite(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    member_id, member_headers = register_and_login(client, email="member@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)
    add_member(db_session, member_id, household.id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=member_headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Insufficient permissions in this household"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_non_member_cannot_invite(client, db_session):
    owner_id, _ = register_and_login(client, email="owner@example.com")
    _, outsider_headers = register_and_login(client, email="outsider@example.com")
    maya_id, _ = register_and_login(client, email="maya@example.com")
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id),
        json={"friend_user_id": maya_id},
        headers=outsider_headers,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Household not found"}
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )


def test_invite_without_token_returns_401(client, db_session):
    owner_id, _ = register_and_login(client)
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id), json={"friend_user_id": 1}
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"friend_user_id": 0},
        {"friend_user_id": -1},
        {"friend_user_id": "abc"},
        {"friend_user_id": None},
        {"email": "maya@example.com"},
    ],
    ids=[
        "missing-id",
        "zero-id",
        "negative-id",
        "non-numeric-id",
        "null-id",
        "old-email-payload",
    ],
)
def test_invite_with_invalid_payload_returns_400(client, db_session, payload):
    owner_id, headers = register_and_login(client)
    household = add_household(db_session, owner_id)

    response = client.post(
        invitations_url(household.id), json=payload, headers=headers
    )

    assert response.status_code == 400
    assert (
        count_rows(db_session, Invitation, Invitation.household_id == household.id) == 0
    )