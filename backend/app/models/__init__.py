"""Entry point of the models package.

Every model must be imported here. Importing a model registers its table
on ``Base.metadata``, which is the list of tables that Alembic (migrations)
and the tests use. A model that is not imported here is invisible to them.
"""

from app.models.household import Household
from app.models.user import User

__all__ = ["Household", "User"]