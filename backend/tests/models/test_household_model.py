"""Tests for the Household model."""

from app.models import Household


def test_household_can_be_saved_and_read_back(db_session):
    """A saved household can be loaded again from the database with its name."""
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.commit()

    saved = db_session.get(Household, household.id)
    assert saved.name == "Softies House"