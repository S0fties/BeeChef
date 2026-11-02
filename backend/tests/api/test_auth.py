"""API tests for register, login and current-user endpoints.

The `client` fixture overrides `get_db` so requests use the same rolled-back
test session as `db_session` (see conftest.py).
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.user import User

PASSWORD = "correct-horse-battery"


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------- helpers ----------

def register(client, email="chef@example.com", password=PASSWORD, full_name="Bee Chef"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )


def login(client, email="chef@example.com", password=PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_token(sub="1", *, expires_in=timedelta(minutes=5), key=None, token_type="access"):
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "iat": now, "exp": now + expires_in, "type": token_type}
    return jwt.encode(
        payload, key or settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


# ---------- register ----------

def test_register_creates_user(client, db_session):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "chef@example.com"
    assert body["full_name"] == "Bee Chef"
    assert isinstance(body["id"], int)

    saved = db_session.scalar(select(User).where(User.email == "chef@example.com"))
    assert saved is not None
    assert saved.id == body["id"]


def test_register_never_returns_password_data(client):
    body = register(client).json()

    assert "password" not in body
    assert "hashed_password" not in body


def test_register_stores_hashed_password(client, db_session):
    register(client)

    saved = db_session.scalar(select(User).where(User.email == "chef@example.com"))
    assert saved.hashed_password != PASSWORD
    assert saved.hashed_password.startswith("$2")  # bcrypt


def test_register_normalizes_email_to_lowercase(client, db_session):
    response = register(client, email="Chef@Example.COM")

    assert response.status_code == 201
    assert response.json()["email"] == "chef@example.com"


def test_register_duplicate_email_returns_400(client):
    assert register(client).status_code == 201

    response = register(client)

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_register_duplicate_email_is_case_insensitive(client):
    assert register(client, email="chef@example.com").status_code == 201

    response = register(client, email="CHEF@example.com")

    assert response.status_code == 400


@pytest.mark.parametrize(
    "bad_email",
    ["plainaddress", "user@", "@example.com", "user@@example.com", ""],
)
def test_register_invalid_email_returns_400(client, bad_email):
    response = register(client, email=bad_email)

    assert response.status_code == 400


def test_register_password_over_72_bytes_returns_400(client):
    response = register(client, password="a" * 73)

    assert response.status_code == 400


@pytest.mark.parametrize("full_name", ["", "   "])
def test_register_blank_full_name_returns_400(client, full_name):
    response = register(client, full_name=full_name)

    assert response.status_code == 400


def test_register_missing_fields_returns_400(client):
    response = client.post("/auth/register", json={"email": "chef@example.com"})

    assert response.status_code == 400


# ---------- login ----------

def test_login_returns_valid_access_token(client):
    user_id = register(client).json()["id"]

    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"

    payload = jwt.decode(
        body["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"
    assert payload["exp"] > datetime.now(timezone.utc).timestamp()


def test_login_email_is_case_insensitive(client):
    register(client)

    response = login(client, email="CHEF@example.com")

    assert response.status_code == 200


def test_login_wrong_password_returns_401(client):
    register(client)

    response = login(client, password="wrong-password")

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_unknown_email_returns_401(client):
    response = login(client, email="nobody@example.com")

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_malformed_email_returns_401(client):
    response = login(client, email="not-an-email")

    assert response.status_code == 401


def test_login_errors_do_not_reveal_which_field_was_wrong(client):
    register(client)

    wrong_password = login(client, password="wrong-password")
    unknown_email = login(client, email="nobody@example.com")

    assert wrong_password.json() == unknown_email.json()


# ---------- current user (/auth/me) ----------

def test_me_returns_current_user_with_valid_token(client):
    user_id = register(client).json()["id"]
    token = login(client).json()["access_token"]

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {
        "id": user_id,
        "email": "chef@example.com",
        "full_name": "Bee Chef",
    }


def test_me_returns_the_token_owner_not_another_user(client):
    register(client, email="first@example.com", full_name="First")
    register(client, email="second@example.com", full_name="Second")
    token = login(client, email="second@example.com").json()["access_token"]

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.json()["email"] == "second@example.com"


def test_me_without_token_returns_401(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_garbage_token_returns_401(client):
    response = client.get("/auth/me", headers=auth_header("not.a.jwt"))

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_with_expired_token_returns_401(client):
    user_id = register(client).json()["id"]
    token = make_token(str(user_id), expires_in=timedelta(minutes=-1))

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_me_with_token_signed_by_wrong_key_returns_401(client):
    user_id = register(client).json()["id"]
    token = make_token(str(user_id), key="x" * 64)

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_me_with_non_access_token_type_returns_401(client):
    user_id = register(client).json()["id"]
    token = make_token(str(user_id), token_type="refresh")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_me_with_non_numeric_subject_returns_401(client):
    token = make_token("not-a-number")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_me_for_deleted_user_returns_401(client, db_session):
    user_id = register(client).json()["id"]
    token = login(client).json()["access_token"]
    db_session.delete(db_session.get(User, user_id))
    db_session.commit()

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401