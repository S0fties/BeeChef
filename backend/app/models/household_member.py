"""HouseholdMember ORM model: the link between users and households."""

import enum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class HouseholdRole(str, enum.Enum):
    """The role a member has inside one household.

    Using an Enum instead of plain strings prevents typos such as "Owner"
    or "admin": only the values listed here are accepted.
    """

    OWNER = "owner"
    MEMBER = "member"


class HouseholdMember(Base):
    """One membership: a user belongs to a household with a given role.

    A user can belong to many households and a household can have many
    users, so this table sits between ``users`` and ``households``.
    The role lives here (not on the user) because the same person can be
    the owner of one household and a regular member of another.
    """

    # Name of the table that will be created in PostgreSQL.
    __tablename__ = "household_members"

    # Primary key generated automatically by PostgreSQL (1, 2, 3, ...).
    id: Mapped[int] = mapped_column(primary_key=True)

    # Foreign key: the id of a row in the "users" table.
    # PostgreSQL rejects a value that does not exist there.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Foreign key: the id of a row in the "households" table.
    household_id: Mapped[int] = mapped_column(ForeignKey("households.id"))

    # The member's role in this household (owner or member).
    role: Mapped[HouseholdRole] = mapped_column(
        SAEnum(
            HouseholdRole,
            name="household_role",
            # By default SQLAlchemy stores the Python constant NAME ("OWNER").
            # values_callable makes it store the VALUE ("owner") instead, which
            # is what the rest of the system expects. It receives the Enum class
            # and returns the list of strings that the database should accept.
            values_callable=lambda enum_class: [role.value for role in enum_class],
        ),
        # Python-side default: when code creates a membership without a role,
        # SQLAlchemy fills in "member" before the INSERT. We default to the
        # least privileged role so a forgotten value never grants ownership.
        default=HouseholdRole.MEMBER,
    )