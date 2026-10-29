"""Tests for the Household model."""

from app.models import Household


def test_household_can_be_saved_and_read_back(db_session):
    """A saved household can be loaded again from the database with its name."""
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.commit()

    saved = db_session.get(Household, household.id)
    assert saved.name == "Softies House"


def test_created_at_is_filled_automatically(db_session):
    """The database must fill ``created_at`` when the household is inserted."""
    household = Household(name="Softies House")
    db_session.add(household)
    db_session.commit()

    # refresh() re-reads the row, so we see the value the database generated.
    db_session.refresh(household)
    assert household.created_at is not None