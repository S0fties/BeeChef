"""Initial smoke test suite for the BeeChef backend API.

This test file serves as a baseline sanity check to verify that the FastAPI
application initializes correctly and to support the CI pipeline workflow
before feature-specific test suites are introduced.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "BeeChef Backend API System!"}
