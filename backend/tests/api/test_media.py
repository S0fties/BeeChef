"""Automated tests for generic media upload and storage service."""

import io
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.services.storage import storage_service


@pytest.fixture
def client(db_session):
    """Test client overriding the database session."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    """Register, login, and return authorization Bearer header."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "media_tester@example.com",
            "password": "strong-password-123",
            "name": "Media",
            "surname": "Tester",
            "user_name": "Tester31",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "media_tester@example.com", "password": "strong-password-123"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------- TESTS ----------------


def test_upload_image_successfully(client: TestClient, auth_headers: dict):
    """Verify that a valid image uploads successfully and is accessible via static URL."""
    fake_jpeg_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    files = {"file": ("test_receipt.jpg", io.BytesIO(fake_jpeg_content), "image/jpeg")}

    response = client.post(
        "/media/upload?folder=receipts",
        headers=auth_headers,
        files=files,
    )

    assert response.status_code == 201
    data = response.json()
    assert "url" in data
    assert data["url"].startswith("/uploads/receipts/")
    assert data["url"].endswith(".jpg")

    # Verify the uploaded image can be fetched via static files mount
    static_response = client.get(data["url"])
    assert static_response.status_code == 200
    assert static_response.content == fake_jpeg_content

    # Clean up the created test file from disk
    storage_service.delete_file_by_url(data["url"])


def test_upload_image_requires_authentication(client: TestClient):
    """Uploading without a token must return 401 Unauthorized."""
    files = {"file": ("test.jpg", io.BytesIO(b"dummy image data"), "image/jpeg")}
    response = client.post("/media/upload", files=files)
    assert response.status_code == 401


def test_upload_rejects_unsupported_mime_type(client: TestClient, auth_headers: dict):
    """Uploading a text or non-image file must be rejected with 400 Bad Request."""
    files = {"file": ("script.txt", io.BytesIO(b"plain text content"), "text/plain")}
    response = client.post("/media/upload", headers=auth_headers, files=files)

    assert response.status_code == 400
    assert "Unsupported media type" in response.json()["detail"]


def test_upload_rejects_file_exceeding_max_size(client: TestClient, auth_headers: dict):
    """Uploading a file larger than MAX_FILE_SIZE_MB must return 413 Payload Too Large."""
    # Create a payload slightly larger than allowed limit
    oversized_bytes = b"0" * (settings.MAX_FILE_SIZE_MB * 1024 * 1024 + 1024)
    files = {"file": ("huge_image.png", io.BytesIO(oversized_bytes), "image/png")}

    response = client.post("/media/upload", headers=auth_headers, files=files)

    assert response.status_code == 413
    assert "exceeds maximum allowed size" in response.json()["detail"]


def test_storage_service_delete_file():
    """Verify delete_file_by_url properly removes file and returns correct boolean."""
    # Non-existent URL should return False safely
    assert storage_service.delete_file_by_url("/uploads/receipts/non_existent.jpg") is False
    assert storage_service.delete_file_by_url(None) is False