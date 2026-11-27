"""FastAPI router for receipt scanning (/api/v1/receipts) — UC-13."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.receipt import (
    ReceiptConfirmRequest,
    ReceiptConfirmResponse,
    ReceiptScanResponse,
    ReceiptUploadResponse,
)
from app.services import inventory_service, receipt_service
from app.services.receipt_scanner import ReceiptScanner, get_receipt_scanner
from app.services.receipt_storage import ReceiptStorage, get_receipt_storage

router = APIRouter(prefix="/api/v1/receipts", tags=["receipts"])


def _household(db: Session, user: User, household_id: int | None) -> int:
    return inventory_service.resolve_user_household_id(db, user, household_id=household_id)


@router.post("", response_model=ReceiptUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_receipt(
    file: UploadFile = File(..., description="Receipt image (JPEG, PNG or WebP)"),
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: ReceiptStorage = Depends(get_receipt_storage),
):
    """Step 1: validate the receipt image and store it until the flow ends."""
    hid = _household(db, current_user, household_id)
    return receipt_service.upload_receipt(storage, hid, file)


@router.post("/{receipt_id}/scan", response_model=ReceiptScanResponse)
def scan_receipt(
    receipt_id: UUID,
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: ReceiptStorage = Depends(get_receipt_storage),
    scanner: ReceiptScanner = Depends(get_receipt_scanner),
):
    """Steps 2-4: extract candidates. Can be retried after a service failure."""
    hid = _household(db, current_user, household_id)
    return receipt_service.scan_receipt(db, scanner, storage, hid, receipt_id)


@router.post("/{receipt_id}/confirm", response_model=ReceiptConfirmResponse)
def confirm_receipt(
    receipt_id: UUID,
    payload: ReceiptConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: ReceiptStorage = Depends(get_receipt_storage),
):
    """Step 6: add only the confirmed items, then delete the receipt."""
    hid = _household(db, current_user, payload.household_id)
    return receipt_service.confirm_receipt_items(db, storage, hid, receipt_id, payload.items)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_receipt(
    receipt_id: UUID,
    household_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: ReceiptStorage = Depends(get_receipt_storage),
):
    """Cancel the flow and delete the stored receipt."""
    hid = _household(db, current_user, household_id)
    receipt_service.discard_receipt(storage, hid, receipt_id)
