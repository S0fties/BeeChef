"""API tests for friend search and friendship requests."""

import pytest

from app.models.friend_request import FriendRequest, FriendRequestStatus
from tests.helpers import count_rows, register_and_login

FRIENDS_URL = "/api/v1/friends"


def send_request(client, headers, friend_user_id):
    return client.post(
        f"{FRIENDS_URL}/requests",
        json={"friend_user_id": friend_user_id},
        headers=headers,
    )


def test_search_users_matches_username_and_excludes_current_user(client):
    own_id, headers = register_and_login(client, email="maya@example.com")
    friend_id, _ = register_and_login(client, email="mayal@example.com")
    register_and_login(client, email="other@example.com")

    response = client.get(
        f"{FRIENDS_URL}/search", params={"username": "MAYA"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": friend_id,
            "user_name": "mayal",
            "name": "Bee",
            "surname": "Chef",
        }
    ]
    assert all(user["id"] != own_id for user in response.json())
    assert "email" not in response.json()[0]


def test_send_request_and_accept_adds_each_user_to_the_other_friends(
    client, db_session
):
    sender_id, sender_headers = register_and_login(client, email="sender@example.com")
    recipient_id, recipient_headers = register_and_login(
        client, email="recipient@example.com"
    )

    sent = send_request(client, sender_headers, recipient_id)

    assert sent.status_code == 201
    sent_body = sent.json()
    assert sent_body["recipient_user_id"] == recipient_id
    assert sent_body["status"] == "pending"

    received = client.get(f"{FRIENDS_URL}/requests", headers=recipient_headers)
    assert received.status_code == 200
    assert len(received.json()) == 1
    request = received.json()[0]
    assert request["id"] == sent_body["id"]
    assert request["user_name"] == "sender"

    accepted = client.post(
        f"{FRIENDS_URL}/requests/{request['id']}/accept",
        headers=recipient_headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert (
        client.get(FRIENDS_URL, headers=recipient_headers).json()[0]["id"] == sender_id
    )
    assert client.get(FRIENDS_URL, headers=sender_headers).json()[0]["id"] == recipient_id
    assert client.get(f"{FRIENDS_URL}/requests", headers=recipient_headers).json() == []
    assert count_rows(db_session, FriendRequest) == 1


def test_cannot_send_duplicate_or_reverse_pending_request(client, db_session):
    sender_id, sender_headers = register_and_login(client, email="sender@example.com")
    recipient_id, recipient_headers = register_and_login(
        client, email="recipient@example.com"
    )
    first = send_request(client, sender_headers, recipient_id)

    duplicate = send_request(client, sender_headers, recipient_id)
    reverse = send_request(client, recipient_headers, sender_id)

    assert first.status_code == 201
    assert duplicate.status_code == reverse.status_code == 409
    assert count_rows(db_session, FriendRequest) == 1


@pytest.mark.parametrize(
    ("friend_id", "expected_status", "expected_detail"),
    [
        (0, 400, None),
        (999_999, 404, "User not found"),
    ],
)
def test_send_request_validates_target(
    client, friend_id, expected_status, expected_detail
):
    _, headers = register_and_login(client)

    response = send_request(client, headers, friend_id)

    assert response.status_code == expected_status
    if expected_detail:
        assert response.json() == {"detail": expected_detail}


def test_cannot_send_request_to_yourself(client):
    user_id, headers = register_and_login(client)

    response = send_request(client, headers, user_id)

    assert response.status_code == 400
    assert response.json() == {"detail": "Cannot add yourself"}


def test_only_recipient_can_accept_request(client):
    _, sender_headers = register_and_login(client, email="sender@example.com")
    recipient_id, recipient_headers = register_and_login(
        client, email="recipient@example.com"
    )
    _, other_headers = register_and_login(client, email="other@example.com")
    sent = send_request(client, sender_headers, recipient_id)

    response = client.post(
        f"{FRIENDS_URL}/requests/{sent.json()['id']}/accept",
        headers=other_headers,
    )

    assert sent.status_code == 201
    assert response.status_code == 404
    assert client.get(f"{FRIENDS_URL}/requests", headers=recipient_headers).json()


def test_declined_request_can_be_sent_again(client, db_session):
    _, sender_headers = register_and_login(client, email="sender@example.com")
    recipient_id, recipient_headers = register_and_login(
        client, email="recipient@example.com"
    )
    first = send_request(client, sender_headers, recipient_id)
    declined = client.post(
        f"{FRIENDS_URL}/requests/{first.json()['id']}/decline",
        headers=recipient_headers,
    )
    second = send_request(client, sender_headers, recipient_id)

    assert declined.status_code == 204
    assert second.status_code == 201
    assert count_rows(db_session, FriendRequest) == 2
    assert count_rows(
        db_session, FriendRequest, FriendRequest.status == FriendRequestStatus.DECLINED
    ) == 1


def test_friend_endpoints_require_authentication(client):
    assert client.get(FRIENDS_URL).status_code == 401
    assert (
        client.get(f"{FRIENDS_URL}/search", params={"username": "maya"}).status_code
        == 401
    )
    assert client.get(f"{FRIENDS_URL}/requests").status_code == 401
    assert (
        client.post(
            f"{FRIENDS_URL}/requests", json={"friend_user_id": 1}
        ).status_code
        == 401
    )
