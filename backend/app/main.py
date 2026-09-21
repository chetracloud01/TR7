from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.routes import auth, chat, health, preferences, providers, routing
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models.user import User, UserPreference
from app.db.session import SessionLocal

settings = get_settings()


def _bootstrap_admin_user() -> None:
    """Personal app, no public registration — create the one user from
    ADMIN_EMAIL/ADMIN_PASSWORD the first time the app starts against an
    empty users table."""
    db = SessionLocal()
    try:
        if db.scalar(select(User)) is not None:
            return
        user = User(email=settings.admin_email, hashed_password=hash_password(settings.admin_password))
        db.add(user)
        db.flush()
        db.add(UserPreference(user_id=user.id))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_admin_user()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(providers.router, prefix="/api", tags=["providers"])
app.include_router(preferences.router, prefix="/api", tags=["preferences"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(routing.router, prefix="/api", tags=["routing"])
