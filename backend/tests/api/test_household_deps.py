"""Unit tests for the household authorization dependencies."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.household_deps import require_owner
from app.models.household_member import HouseholdRole


def test_require_owner_returns_membership_for_owner():
    membership = SimpleNamespace(role=HouseholdRole.OWNER)

    assert require_owner(membership) is membership


def test_require_owner_rejects_member_with_403():
    membership = SimpleNamespace(role=HouseholdRole.MEMBER)

    with pytest.raises(HTTPException) as exc_info:
        require_owner(membership)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Insufficient permissions in this household"