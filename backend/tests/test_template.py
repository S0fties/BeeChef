"""Copyable examples for adding API endpoint tests.

Replace the example paths, request data, model, and fields with those for the
feature being tested, then remove the skip marker.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.skip(reason="Template: copy and adapt this test for a GET endpoint.")
def test_get_endpoint_template():
    response = client.get("/your-endpoint")

    assert response.status_code == 200
    assert response.json() == {"message": "Replace with the expected response"}


@pytest.mark.skip(reason="Template: copy and adapt this test for a POST endpoint.")
def test_post_endpoint_template():
    payload = {"name": "Example"}

    response = client.post("/your-endpoint", json=payload)

    assert response.status_code == 201
    assert response.json() == {"name": "Example"}


@pytest.mark.skip(reason="Template: copy and adapt this test to verify a database insert.")
def test_database_record_can_be_created(db_session):
    your_data = YourModel(your_field="example")
    db_session.add(your_data)
    db_session.commit()
    db_session.refresh(your_data)

    assert your_data.id is not None


@pytest.mark.skip(reason="Template: copy and adapt this test to verify a database read.")
def test_database_record_can_be_read(db_session):
    your_data = YourModel(your_field="example")
    db_session.add(your_data)
    db_session.commit()

    saved_data = db_session.get(YourModel, your_data.id)
    assert saved_data.your_field == your_data.your_field