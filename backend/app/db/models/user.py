from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class User(TimestampMixin, Base):
    """Single-user app for now (docs/MASTER_PLAN.md scope), modeled as a
    real table from the start so auth/multi-profile isn't a rewrite later.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))

    preference: Mapped["UserPreference | None"] = relationship(back_populates="user", uselist=False)


class UserPreference(Base):
    """Theme/appearance setting — see docs/MASTER_PLAN.md "Theming"."""

    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)

    theme_preset: Mapped[str] = mapped_column(String(32), default="warm")
    mode: Mapped[str] = mapped_column(String(8), default="dark")
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="preference")
