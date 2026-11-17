"""Unit tests for household service transaction behaviour."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.household import Household
from app.models.user import User
from app.schemas.household import HouseholdCreate
from app.services import household_service
from tests.helpers import count_rows


def test_create_household_leaves_no_household_when_membership_insert_fails(db_session):
    ghost = User(
        id=999_999,
        email="ghost@example.com",
        hashed_password="hash",
        name="Ghost",
        surname="User",
        user_name="ghost",
    )

    with pytest.raises(IntegrityError):
        household_service.create_household(
            db_session, ghost, HouseholdCreate(name="Ghost House")
        )
    db_session.rollback()

    assert count_rows(db_session, Household) == 0