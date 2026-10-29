"""Shared pytest fixtures for the model tests.

How it works:
1. The test database is created if needed, and its model tables are reset at
   the start of each pytest run.
2. Every test runs inside a transaction that is rolled back at the end.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (importing registers every model on Base.metadata)
from app.core.config import settings
from app.db.session import Base


@pytest.fixture(scope="session")
def engine():
    """Create a clean, isolated test database schema for this pytest run."""
    if not settings.TEST_DATABASE_URL:
        raise RuntimeError("TEST_DATABASE_URL must be set to run the test suite.")

    test_url = make_url(settings.TEST_DATABASE_URL)
    db_name = test_url.database
    admin_engine = create_engine(
        test_url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
    )
    try:
        with admin_engine.connect() as connection:
            database_exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": db_name},
            ).scalar_one_or_none()
            if database_exists is None:
                quoted_db_name = admin_engine.dialect.identifier_preparer.quote(db_name)
                connection.exec_driver_sql(f"CREATE DATABASE {quoted_db_name}")
    finally:
        admin_engine.dispose()

    engine = create_engine(test_url)

    try:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db_session(engine):
    """Give one test its own database session that is undone afterwards."""
    connection = engine.connect()
    transaction = connection.begin()   # outer transaction: our "draft notebook"

    # "create_savepoint" lets a test call session.commit() freely:
    # a commit only releases a savepoint, the outer transaction stays open.
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield session                      # the test uses the session here

    session.close()
    transaction.rollback()             # throw the draft away: nothing is saved
    connection.close()