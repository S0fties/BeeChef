"""HouseholdMember ORM model: the link between users and households."""

import enum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, UniqueConstraint
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

    # Rules that involve more than one column are declared at table level.
    # This UniqueConstraint says: the PAIR (user_id, household_id) may appear
    # only once, so a user cannot be added to the same household twice.
    # The same user can still join other households, and the same household
    # can still have other users. The explicit name makes database error
    # messages and future migrations easier to read.
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "household_id",
            name="uq_household_members_user_household",
        ),
    )

    # Primary key generated automatically by PostgreSQL (1, 2, 3, ...).
    id: Mapped[int] = mapped_column(primary_key=True)

    # Foreign key: the id of a row in the "users" table.
    # PostgreSQL rejects a value that does not exist there.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Foreign key: the id of a row in the "households" table.
    # ondelete="CASCADE": when a household is deleted, PostgreSQL itself deletes
    # every membership row that points to it. Without this, the database would
    # refuse to delete a household that still has members, and a leftover
    # membership would point to a household that no longer exists.
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE")
    )

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