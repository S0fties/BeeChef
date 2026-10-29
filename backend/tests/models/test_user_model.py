"""Tests for the User model."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import User


def test_user_can_be_saved_and_read_back(db_session):
    """A saved user can be loaded again from the database with the same data."""
    user = User(email="ayse@mail.com", hashed_password="x", full_name="Ayse")
    db_session.add(user)
    db_session.commit()

    saved = db_session.get(User, user.id)
    assert saved.email == "ayse@mail.com"


def test_email_must_be_unique(db_session):
    """Two users must never share the same e-mail address."""
    db_session.add(User(email="ayse@mail.com", hashed_password="x", full_name="Ayse"))
    db_session.commit()

    # Same e-mail again: the database must reject this second row.
    db_session.add(User(email="ayse@mail.com", hashed_password="y", full_name="Another Ayse"))
    with pytest.raises(IntegrityError):
        db_session.commit()