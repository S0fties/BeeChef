"""Friend search and friendship request endpoints."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.friend import (
    FriendRequestCreate,
    FriendRequestRead,
    FriendRequestReceivedRead,
    FriendSearchResult,
)
from app.services import friendship_service

router = APIRouter(prefix="/api/v1/friends", tags=["friends"])


@router.get("/search", response_model=list[FriendSearchResult])
def search_users(
    username: str = Query(min_length=1, max_length=30),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return friendship_service.search_users(db, current_user, username, limit, offset)


@router.post(
    "/requests",
    response_model=FriendRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def send_friend_request(
    payload: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return friendship_service.create_friend_request(
        db, current_user, payload.friend_user_id
    )


@router.get("/requests", response_model=list[FriendRequestReceivedRead])
def list_received_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return friendship_service.list_received_requests(db, current_user)


@router.post("/requests/{request_id}/accept", response_model=FriendRequestRead)
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return friendship_service.accept_friend_request(db, current_user, request_id)


@router.post("/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendship_service.decline_friend_request(db, current_user, request_id)


@router.get("", response_model=list[FriendSearchResult])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return friendship_service.list_friends(db, current_user)
