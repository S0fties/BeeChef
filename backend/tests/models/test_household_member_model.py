"""Tests for the HouseholdMember model."""

from sqlalchemy import text

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