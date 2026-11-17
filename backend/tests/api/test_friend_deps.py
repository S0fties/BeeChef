from app.api.friend_deps import get_friend_service
from app.services.friend_service import DatabaseFriendService


def test_provider_returns_database_friend_service(db_session):
    service = get_friend_service(db_session)

    assert isinstance(service, DatabaseFriendService)