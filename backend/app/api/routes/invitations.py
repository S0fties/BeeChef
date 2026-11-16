"""FastAPI router for the invitee side of invitations (/api/v1/invitations)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.invitation import ReceivedInvitationRead
from app.services import invitation_service

router = APIRouter(prefix="/api/v1/invitations", tags=["invitations"])


@router.get("", response_model=list[ReceivedInvitationRead])
def list_my_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invitation_service.list_received_invitations(db, current_user)