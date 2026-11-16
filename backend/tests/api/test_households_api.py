"""API tests for household creation (/api/v1/households)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db.session import get_db
from app.main import app
from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole

PASSWORD = "correct-horse-battery"
HOUSEHOLDS_URL = "/api/v1/households"


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def register_and_login(client, email="owner@example.com"):
    user_name = email.split("@")[0].replace(".", "_")
    user_id = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "name": "Bee",
            "surname": "Chef",
            "user_name": user_name,
        },
    ).json()["id"]
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    ).json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def add_household(
    db_session,
    user_id,
    name="Softies House",
    role=HouseholdRole.OWNER,
) -> Household:
    household = Household(name=name)
    db_session.add(household)
    db_session.flush()
    db_session.add(
        HouseholdMember(user_id=user_id, household_id=household.id, role=role)
    )
    db_session.commit()
    return household


def add_member(
    db_session, user_id, household_id, role=HouseholdRole.MEMBER
) -> None:
    db_session.add(
        HouseholdMember(user_id=user_id, household_id=household_id, role=role)
    )
    db_session.commit()


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