"""Unit tests for the invitation schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.invitation import InvitationCreate


def test_invitation_create_normalizes_email_to_lowercase():
    assert InvitationCreate(email="Maya@Example.COM").email == "maya@example.com"


@pytest.mark.parametrize("email", ["", "plainaddress", "user@"])
def test_invitation_create_rejects_invalid_email(email):
    with pytest.raises(ValidationError):
        InvitationCreate(email=email)