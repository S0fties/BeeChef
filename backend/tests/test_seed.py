"""Tests for the database seeding utility (app.db.seed)."""

from app.db.seed import seed_all, seed_items_catalog
from app.models import Item


def test_seed_items_catalog_can_be_created_and_read(db_session):
    """Running seed_items_catalog populates catalog items that can be read back."""
    seeded_count = seed_items_catalog(db_session)

    saved_item = db_session.get(Item, 71001)
    assert seeded_count > 0
    assert saved_item is not None
    assert saved_item.name == "Dana Kıyma"


def test_seed_items_catalog_is_idempotent(db_session):
    """Running seed_items_catalog twice safely updates without duplicating rows."""
    first_count = seed_items_catalog(db_session)
    second_count = seed_items_catalog(db_session)

    assert first_count == second_count


def test_seed_all_runs_without_errors(db_session):
    """seed_all master runner completes cleanly and populates items."""
    seed_all(session=db_session)

    saved_item = db_session.get(Item, 11001)
    assert saved_item is not None
    assert saved_item.name == "Limon"
