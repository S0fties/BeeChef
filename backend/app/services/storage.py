"""Storage service for handling file uploads, validation, and deletion."""

import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


class StorageService:
    def __init__(self, base_dir: Path = settings.UPLOAD_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_image(self, file: UploadFile) -> None:
        """Validate content type against allowed MIME types."""
        if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Unsupported media type: '{file.content_type}'. "
                    f"Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
                ),
            )

    async def save_image(self, file: UploadFile, folder: str) -> str:
        """
        Validate, stream to disk in chunks, and return the public URL path.
        
        Args:
            file: The uploaded file from FastAPI.
            folder: Sub-folder name (e.g. 'avatars', 'receipts', 'posts').
        Returns:
            Public static URL path (e.g. '/uploads/avatars/<uuid>.jpg').
        """
        self.validate_image(file)

        # Ensure destination directory exists
        target_dir = self.base_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)

        # Extract extension safely
        ext = Path(file.filename or "").suffix.lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"

        filename = f"{uuid.uuid4().hex}{ext}"
        destination_path = target_dir / filename

        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        bytes_read = 0

                # Stream file in 64KB chunks to protect RAM from huge payloads
        size_exceeded = False
        with destination_path.open("wb") as buffer:
            while chunk := await file.read(1024 * 64):
                bytes_read += len(chunk)
                if bytes_read > max_bytes:
                    size_exceeded = True
                    break
                buffer.write(chunk)

        # If file exceeded the limit, delete it after closing the file handle (Windows-safe)
        if size_exceeded:
            destination_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.",
            )

        # Reset cursor position in case the file object is reused downstream
        await file.seek(0)

        return f"/uploads/{folder}/{filename}"

    def delete_file_by_url(self, file_url: str | None) -> bool:
        """
        Delete a file from disk using its stored URL.
        Useful when updating avatars or removing deleted posts/receipts.
        """
        if not file_url or not file_url.startswith("/uploads/"):
            return False

        relative_path = file_url.replace("/uploads/", "", 1)
        target_file = self.base_dir / relative_path

        if target_file.exists() and target_file.is_file():
            target_file.unlink(missing_ok=True)
            return True
        return False


storage_service = StorageService()