from typing import Protocol


class FriendService(Protocol):
    def are_friends(self, user_id: int, other_user_id: int) -> bool: ...


class MockFriendService:
    """Stand-in until the friends feature exists: any two distinct users are friends."""

    def are_friends(self, user_id: int, other_user_id: int) -> bool:
        return user_id != other_user_id