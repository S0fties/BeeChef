"""Tests for the HouseholdMember model."""

from app.models import Household, HouseholdMember, HouseholdRole, User


def test_member_links_user_to_household_with_role(db_session):
    """A membership row connects one user to one household and stores a role."""
    user = User(email="ayse@mail.com", hashed_password="x", full_name="Ayse")
    household = Household(name="Softies House")
    db_session.add_all([user, household])
    db_session.commit()  # commit first so both rows receive their ids

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