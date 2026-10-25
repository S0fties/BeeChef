"""User ORM model.

A *model* is a Python class that describes one database table:
the class is the table, every ``mapped_column`` is a column,
and every instance of the class is one row.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    """A person who has an account in BeeChef.

    Later, a user will be linked to one or more households through
    the ``household_members`` table.
    """

    # Name of the table that will be created in PostgreSQL.
    __tablename__ = "users"

    # Primary key: a unique number that identifies each row.
    # PostgreSQL generates it automatically (1, 2, 3, ...).
    id: Mapped[int] = mapped_column(primary_key=True)

    # The e-mail address the user logs in with.
    # unique=True makes the database itself reject a second account with the
    # same e-mail, so the rule holds even if application code forgets to check.
    email: Mapped[str] = mapped_column(String(255), unique=True)

    # We never store the real password, only its irreversible hash.
    # The authentication feature will be responsible for creating it.
    hashed_password: Mapped[str] = mapped_column(String(255))

    # The name displayed in the application (max 100 characters).
    full_name: Mapped[str] = mapped_column(String(100))