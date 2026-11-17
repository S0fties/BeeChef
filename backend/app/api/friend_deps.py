from app.services.friend_service import FriendService, MockFriendService


def get_friend_service() -> FriendService:
    return MockFriendService()