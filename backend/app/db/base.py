"""Import this module (not base_class directly) wherever Base.metadata
needs every model registered — Alembic's env.py in particular."""

from app.db.base_class import Base
from app.db.models import *  # noqa: F401,F403
