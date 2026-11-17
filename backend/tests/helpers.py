"""Shared helpers for API tests."""

from sqlalchemy import func, select

from app.models.household import Household
from app.models.household_member import HouseholdMember, HouseholdRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User

PASSWORD = "correct-horse-battery"


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


def add_invitation(
    db_session,
    household_id,
    invited_by_user_id,
    email,
    status=InvitationStatus.PENDING,
) -> Invitation:
    invitation = Invitation(
        household_id=household_id,
        invited_by_user_id=invited_by_user_id,
        invitee_email=email,
        status=status,
    )
    db_session.add(invitation)
    db_session.commit()
    return invitation


def count_rows(db_session, model, *conditions) -> int:
    stmt = select(func.count()).select_from(model).where(*conditions)
    return db_session.scalar(stmt)


def add_user(db_session, email, user_name) -> User:
    user = User(
        email=email,
        hashed_password="hash",
        name="Bee",
        surname="Chef",
        user_name=user_name,
    )
    db_session.add(user)
    db_session.commit()
    return user