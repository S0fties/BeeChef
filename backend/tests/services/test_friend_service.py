from app.services.friend_service import MockFriendService


def test_distinct_users_are_friends():
    assert MockFriendService().are_friends(1, 2) is True


def test_friendship_is_symmetric():
    service = MockFriendService()
    assert service.are_friends(1, 2) == service.are_friends(2, 1)


def test_user_is_not_their_own_friend():
    assert MockFriendService().are_friends(1, 1) is False