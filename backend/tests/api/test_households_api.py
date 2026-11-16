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