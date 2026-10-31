"""Database seeder module.

Reads reference CSV files from ``backend/data/`` and populates the database
in an idempotent manner (safe to run multiple times without duplicate errors).

Usage:
    cd backend
    python -m app.db.seed
"""

import csv
import logging
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.item import Item, ItemType

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
ITEMS_CATALOG_CSV = DEFAULT_DATA_DIR / "items_catalog.csv"


def seed_items_catalog(session: Session, csv_path: Path | None = None) -> int:
    """Seed or update the shared catalog from items_catalog.csv.

    Uses PostgreSQL's ON CONFLICT DO UPDATE so running this function again
    safely updates modified names/units and adds new items without failing.
    """
    path = csv_path or ITEMS_CATALOG_CSV
    if not path.exists():
        logger.warning("Catalog CSV not found at %s. Skipping.", path)
        return 0

    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return 0

    inserted_or_updated = 0
    for row in rows:
        stmt = insert(Item).values(
            id=int(row["id"]),
            name=row["name"],
            item_type=ItemType(row["item_type"].lower()),
            category=row["category"],
            subcategory=row["subcategory"],
            default_unit=row["default_unit"] or None,
        )
        # If an item with the same ID already exists, update its attributes.
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=[Item.id],
            set_={
                "name": stmt.excluded.name,
                "item_type": stmt.excluded.item_type,
                "category": stmt.excluded.category,
                "subcategory": stmt.excluded.subcategory,
                "default_unit": stmt.excluded.default_unit,
            },
        )
        session.execute(upsert_stmt)
        inserted_or_updated += 1

    session.commit()
    logger.info("Successfully seeded %d items from %s", inserted_or_updated, path.name)
    return inserted_or_updated


def seed_all(session: Session | None = None) -> None:
    """Master seed runner.

    Executes all seeders in logical order. When future models and CSVs are added
    (e.g. dietary preferences, sample recipes), register their seed function here.
    """
    owns_session = session is None
    db = session or SessionLocal()
    try:
        logger.info("Starting database seeding...")
        # 1. Shared items catalog
        seed_items_catalog(db)
        # (Future seeds can simply be called here, e.g. seed_preferences(db))
        logger.info("Database seeding completed successfully.")
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    seed_all()

