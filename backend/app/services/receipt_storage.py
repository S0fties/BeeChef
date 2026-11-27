"""Temporary receipt storage: an image exists only while its UC-13 flow is in progress.

Lifecycle:
- stored after upload validation (invalid images are never stored),
- kept while the user reviews, and after a scanning-service failure so it can be retried,
- deleted when the flow ends (confirmed, nothing confirmed, cancelled, or not a receipt),
- purged automatically after RECEIPT_TTL_MINUTES if the flow is abandoned.
"""

import logging
import time
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MEDIA_TYPES = {ext: media for media, ext in EXTENSIONS.items()}


class ReceiptStorage:
    """Stores receipts in uploads/receipts/<household_id>/<random id>.<ext>.

    File names are random UUIDs and are never returned to clients, so a stored
    receipt cannot be found through the public /uploads mount by guessing.
    """

    def __init__(self, base_dir: Path, ttl_minutes: int) -> None:
        self.base_dir = base_dir
        self.ttl_seconds = ttl_minutes * 60

    def _path(self, household_id: int, receipt_id: UUID, ext: str) -> Path:
        return self.base_dir / str(household_id) / f"{receipt_id.hex}{ext}"

    def _find(self, household_id: int, receipt_id: UUID) -> Path | None:
        for ext in EXTENSIONS.values():
            path = self._path(household_id, receipt_id, ext)
            if path.is_file():
                return path
        return None

    def _is_expired(self, path: Path) -> bool:
        return time.time() - path.stat().st_mtime > self.ttl_seconds

    def save(self, household_id: int, data: bytes, media_type: str) -> UUID:
        receipt_id = uuid4()
        path = self._path(household_id, receipt_id, EXTENSIONS[media_type])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return receipt_id

    def load(self, household_id: int, receipt_id: UUID) -> tuple[bytes, str]:
        path = self._find(household_id, receipt_id)
        if path is not None and self._is_expired(path):
            path.unlink(missing_ok=True)
            path = None
        if path is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Receipt not found or expired. Please upload it again.",
            )
        return path.read_bytes(), MEDIA_TYPES[path.suffix]

    def delete(self, household_id: int, receipt_id: UUID) -> None:
        path = self._find(household_id, receipt_id)
        if path is not None:
            path.unlink(missing_ok=True)

    def purge_expired(self) -> int:
        """Delete receipts whose flow was abandoned (closed tab, lost connection)."""
        if not self.base_dir.exists():
            return 0
        removed = 0
        for path in self.base_dir.glob("*/*"):
            try:
                if path.is_file() and self._is_expired(path):
                    path.unlink(missing_ok=True)
                    removed += 1
            except OSError as exc:  # e.g. file deleted concurrently
                logger.debug("Could not purge %s: %s", path, exc)
        if removed:
            logger.info("Purged %d abandoned receipt image(s)", removed)
        return removed


receipt_storage = ReceiptStorage(settings.RECEIPT_DIR, settings.RECEIPT_TTL_MINUTES)


def get_receipt_storage() -> ReceiptStorage:
    """FastAPI dependency; tests can override it with a storage rooted in tmp_path."""
    return receipt_storage
