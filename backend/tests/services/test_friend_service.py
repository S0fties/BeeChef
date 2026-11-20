from app.services.friend_service import DatabaseFriendService
from tests.helpers import add_friendship, add_user


def test_users_are_not_friends_without_an_accepted_request(db_session):
    first = add_user(db_session, "first@example.com", "first")
    second = add_user(db_session, "second@example.com", "second")
    friends = DatabaseFriendService(db_session)

    assert friends.are_friends(first.id, second.id) is False


def test_accepted_friendship_is_symmetric(db_session):
    first = add_user(db_session, "first@example.com", "first")
    second = add_user(db_session, "second@example.com", "second")
    add_friendship(db_session, first.id, second.id)
    friends = DatabaseFriendService(db_session)

    assert friends.are_friends(first.id, second.id) is True
    assert friends.are_friends(second.id, first.id) is True


def test_user_is_not_their_own_friend(db_session):
    user = add_user(db_session, "first@example.com", "first")

    assert DatabaseFriendService(db_session).are_friends(user.id, user.id) is False