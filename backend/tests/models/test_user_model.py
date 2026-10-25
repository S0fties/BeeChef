from app.models import User


def test_user_can_be_saved_and_read_back(db_session):
    user = User(email="ayse@mail.com", hashed_password="x", full_name="Ayşe")
    db_session.add(user)
    db_session.commit()

    saved = db_session.get(User, user.id)
    assert saved.email == "ayse@mail.com"