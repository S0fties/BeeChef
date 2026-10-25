"""Tests for the HouseholdMember model."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models import Household, HouseholdMember, HouseholdRole, User


def _create_user_and_household(db_session):
    """Insert one user and one household and return both (helper, not a test).

    Several tests need these two rows before they can create a membership,
    so the setup lives here once instead of being copy-pasted.
    """
    user = User(email="ayse@mail.com", hashed_password="x", full_name="Ayse")
    household = Household(name="Softies House")
    db_session.add_all([user, household])
    db_session.commit()  # commit first so both rows receive their ids
    return user, household


def test_member_links_user_to_household_with_role(db_session):
    """A membership row connects one user to one household and stores a role."""
    user, household = _create_user_and_household(db_session)

    membership = HouseholdMember(
        user_id=user.id,
        household_id=household.id,
        role=HouseholdRole.OWNER,
    )
    db_session.add(membership)
    db_session.commit()

    saved = db_session.get(HouseholdMember, membership.id)
    assert saved.user_id == user.id
    assert saved.household_id == household.id
    assert saved.role == HouseholdRole.OWNER


def test_role_is_stored_as_lowercase_value(db_session):
    """The database must contain 'owner', not the Python constant name 'OWNER'."""
    user, household = _create_user_and_household(db_session)
    membership = HouseholdMember(
        user_id=user.id,
        household_id=household.id,
        role=HouseholdRole.OWNER,
    )
    db_session.add(membership)
    db_session.commit()

    # Read the raw column with plain SQL, bypassing the ORM's conversion,
    # so we see exactly what PostgreSQL stores.
    stored = db_session.execute(
        text("SELECT role FROM household_members WHERE id = :id"),
        {"id": membership.id},
    ).scalar_one()
    assert stored == "owner"


def test_role_defaults_to_member(db_session):
    """A membership created without a role gets the least privileged role."""
    user, household = _create_user_and_household(db_session)

    # No role given on purpose.
    membership = HouseholdMember(user_id=user.id, household_id=household.id)
    db_session.add(membership)
    db_session.commit()

    db_session.refresh(membership)
    assert membership.role == HouseholdRole.MEMBER


def test_user_cannot_join_the_same_household_twice(db_session):
    """The pair (user, household) may exist only once in household_members."""
    user, household = _create_user_and_household(db_session)
    db_session.add(HouseholdMember(user_id=user.id, household_id=household.id))
    db_session.commit()

    # Exactly the same pair again: the database must reject it.
    db_session.add(HouseholdMember(user_id=user.id, household_id=household.id))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_membership_requires_an_existing_user(db_session):
    """A membership cannot point to a user id that does not exist.

    This protection already works thanks to the ForeignKey, so this test is
    expected to pass immediately. It guards the rule against future changes.
    """
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.commit()

    # 999_999 is far above any id the test database has generated so far.
    db_session.add(HouseholdMember(user_id=999_999, household_id=household.id))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_deleting_a_household_deletes_its_memberships_but_not_users(db_session):
    """Memberships die with their household; the users themselves stay."""
    user, household = _create_user_and_household(db_session)
    db_session.add(HouseholdMember(user_id=user.id, household_id=household.id))
    db_session.commit()
    household_id = household.id

    db_session.delete(household)
    db_session.commit()

    # Count the leftover membership rows with plain SQL (what is really stored).
    remaining = db_session.execute(
        text("SELECT COUNT(*) FROM household_members WHERE household_id = :id"),
        {"id": household_id},
    ).scalar_one()
    assert remaining == 0
    assert db_session.get(User, user.id) is not None