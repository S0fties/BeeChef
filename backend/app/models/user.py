"""User ORM model.

A *model* is a Python class that describes one database table:
the class is the table, every ``mapped_column`` is a column,
and every instance of the class is one row.
"""

from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    """A person who has an account in BeeChef.

    Later, a user will be linked to one or more households through
    the ``household_members`` table.
    """

    __tablename__ = "users"

    # Primary key: auto-incrementing integer (PostgreSQL SERIAL / IDENTITY)
    id: Mapped[int] = mapped_column(primary_key=True)

    # Unique login email
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Password hash (bcrypt / argon2)
    hashed_password: Mapped[str] = mapped_column(String(255))

    # Display name and surname
    name: Mapped[str] = mapped_column(String(50))
    surname: Mapped[str] = mapped_column(String(50))

    # Social media handle / username
    user_name: Mapped[str] = mapped_column(String(30), unique=True, index=True)

    __table_args__ = (
        # Optional: DB-level case-insensitive uniqueness guarantees
        Index("uq_users_email_lower", func.lower(email), unique=True),
        Index("uq_users_user_name_lower", func.lower(user_name), unique=True),
    )