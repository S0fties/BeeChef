"""Shared pytest fixtures for the model tests.

Goal: every test runs against a real PostgreSQL database (the same engine
we use in production) but can never touch our development data.

How it works:
1. Tests use a separate database named ``<dev database name>_test``
   (for example ``beechef_db_test``).
2. Every test runs inside a database transaction that is rolled back at
   the end, so a test can never leave data behind for the next one.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (importing registers every model on Base.metadata)
from app.core.config import settings
from app.db.session import Base


@pytest.fixture(scope="session")
def engine():
    """Create the test database engine and the tables, once per test run."""
    dev_url = make_url(settings.DATABASE_URL)
    # beechef_db -> beechef_db_test: never run tests against the dev database.
    db_name = (
        dev_url.database 
        if dev_url.database.endswith("_test") 
        else f"{dev_url.database}_test"
    )
    test_url = dev_url.set(database=db_name)
    engine = create_engine(test_url)

    
    yield engine                       # all tests run at this point
    
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