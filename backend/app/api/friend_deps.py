from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.friend_service import DatabaseFriendService, FriendService


def get_friend_service(db: Session = Depends(get_db)) -> FriendService:
    return DatabaseFriendService(db)