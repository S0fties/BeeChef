"""Service layer for friend search and friendship requests."""

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.friend_request import FriendRequest, FriendRequestStatus
from app.models.user import User
from app.schemas.friend import FriendRequestReceivedRead

_USER_NOT_FOUND_DETAIL = "User not found"
_REQUEST_NOT_FOUND_DETAIL = "Friend request not found"
_REQUEST_NOT_PENDING_DETAIL = "Friend request is no longer pending"
_PENDING_REQUEST_DETAIL = "A pending friend request already exists"
_ALREADY_FRIENDS_DETAIL = "You're already friends."


def search_users(
    db: Session,
    current_user: User,
    username: str,
    limit: int = 20,
    offset: int = 0,
) -> list[User]:
    """Find users by a case-insensitive username substring, excluding yourself."""
    query = username.strip()
    if not query:
        return []
    return list(
        db.scalars(
            select(User)
            .where(
                User.id != current_user.id,
                User.user_name.ilike(f"%{query}%"),
            )
            .order_by(User.user_name)
            .limit(limit)
            .offset(offset)
        ).all()
    )


def create_friend_request(
    db: Session, requester: User, friend_user_id: int
) -> FriendRequest:
    if friend_user_id == requester.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot add yourself")
    if db.get(User, friend_user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _USER_NOT_FOUND_DETAIL)

    pair_filter = or_(
        and_(
            FriendRequest.requester_user_id == requester.id,
            FriendRequest.recipient_user_id == friend_user_id,
        ),
        and_(
            FriendRequest.requester_user_id == friend_user_id,
            FriendRequest.recipient_user_id == requester.id,
        ),
    )
    existing = db.scalars(
        select(FriendRequest).where(
            pair_filter,
            FriendRequest.status.in_(
                [FriendRequestStatus.PENDING, FriendRequestStatus.ACCEPTED]
            ),
        )
    ).first()
    if existing is not None:
        detail = (
            _ALREADY_FRIENDS_DETAIL
            if existing.status == FriendRequestStatus.ACCEPTED
            else _PENDING_REQUEST_DETAIL
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail)

    request = FriendRequest(
        requester_user_id=requester.id,
        recipient_user_id=friend_user_id,
    )
    db.add(request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _PENDING_REQUEST_DETAIL)
    db.refresh(request)
    return request


def list_received_requests(
    db: Session, recipient: User
) -> list[FriendRequestReceivedRead]:
    rows = db.execute(
        select(FriendRequest, User)
        .join(User, User.id == FriendRequest.requester_user_id)
        .where(
            FriendRequest.recipient_user_id == recipient.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .order_by(FriendRequest.created_at.desc(), FriendRequest.id.desc())
    ).all()
    return [
        FriendRequestReceivedRead(
            id=request.id,
            user_id=sender.id,
            user_name=sender.user_name,
            name=sender.name,
            surname=sender.surname,
            status=request.status,
            created_at=request.created_at,
        )
        for request, sender in rows
    ]


def list_friends(db: Session, user: User) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(
                FriendRequest,
                or_(
                    and_(
                        FriendRequest.requester_user_id == user.id,
                        FriendRequest.recipient_user_id == User.id,
                    ),
                    and_(
                        FriendRequest.recipient_user_id == user.id,
                        FriendRequest.requester_user_id == User.id,
                    ),
                ),
            )
            .where(FriendRequest.status == FriendRequestStatus.ACCEPTED)
            .order_by(User.user_name)
        ).all()
    )


def _get_recipient_request(
    db: Session, recipient: User, request_id: int
) -> FriendRequest:
    request = db.scalar(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.recipient_user_id == recipient.id,
        )
    )
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _REQUEST_NOT_FOUND_DETAIL)
    if request.status != FriendRequestStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, _REQUEST_NOT_PENDING_DETAIL)
    return request


def accept_friend_request(
    db: Session, recipient: User, request_id: int
) -> FriendRequest:
    request = _get_recipient_request(db, recipient, request_id)
    request.status = FriendRequestStatus.ACCEPTED
    db.commit()
    db.refresh(request)
    return request


def decline_friend_request(db: Session, recipient: User, request_id: int) -> None:
    request = _get_recipient_request(db, recipient, request_id)
    request.status = FriendRequestStatus.DECLINED
    db.commit()
