"""Unit tests for the household schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.household import HouseholdCreate, HouseholdUpdate


def test_create_strips_surrounding_whitespace():
    assert HouseholdCreate(name="  Softies House ").name == "Softies House"


@pytest.mark.parametrize("name", ["", "   ", "a" * 101])
def test_create_rejects_invalid_name(name):
    with pytest.raises(ValidationError):
        HouseholdCreate(name=name)


def test_update_requires_at_least_one_field():
    with pytest.raises(ValidationError):
        HouseholdUpdate()


def test_update_rejects_null_name():
    with pytest.raises(ValidationError):
        HouseholdUpdate(name=None)


def test_update_tracks_only_provided_fields():
    update = HouseholdUpdate(name="  New Name ")

    assert update.name == "New Name"
    assert update.model_dump(exclude_unset=True) == {"name": "New Name"}