from app.api.friend_deps import get_friend_service
from app.services.friend_service import MockFriendService


def test_provider_returns_mock_until_friends_feature_lands():
    assert isinstance(get_friend_service(), MockFriendService)