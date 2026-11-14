"""Generic Media Upload API Route."""

from typing import Literal
from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.api.deps import get_current_user
from app.models.user import User
from app.services.storage import storage_service

router = APIRouter(prefix="/media", tags=["media"])


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image to a designated folder",
)
async def upload_image(
    file: UploadFile = File(..., description="The image file to upload"),
    folder: Literal["avatars", "receipts", "posts"] = Query(
        "posts", description="Target folder category"
    ),
    current_user: User = Depends(get_current_user),
):
    """
    Generic upload endpoint requiring authentication.
    Returns the public URL to be attached to posts, receipts, or profile.
    """
    url = await storage_service.save_image(file=file, folder=folder)
    return {
        "url": url,
        "filename": file.filename,
        "content_type": file.content_type,
    }