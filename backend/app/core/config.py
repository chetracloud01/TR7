from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, read from environment variables / .env.

    See docs/MASTER_PLAN.md section 3 for the reasoning behind each piece
    (Postgres for relational integrity, app-level encryption for provider
    keys rather than plaintext, etc).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TR7"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://tr7:tr7@localhost:5432/tr7"

    # Fernet key used to encrypt LLM provider API keys at rest (app.core.security).
    # Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    secret_encryption_key: str = "changeme-generate-a-real-fernet-key-for-local-dev"

    cors_origins: list[str] = ["http://localhost:3000"]

    # Session cookie signing secret — distinct from secret_encryption_key so
    # rotating one never invalidates the other. Generate for real deployments with:
    # python -c "import secrets; print(secrets.token_urlsafe(32))"
    session_secret: str = "changeme-generate-a-real-session-secret-for-local-dev"
    session_cookie_name: str = "tr7_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 30  # 30 days — personal app, not a shared login

    # On first startup, if no user exists yet, one is created from these —
    # there is no public registration endpoint (personal app, single user).
    admin_email: str = "you@example.com"
    admin_password: str = "changeme"

    daily_exposure_cap_pct: float = 10.0
    calibration_default_discount: float = 0.87


@lru_cache
def get_settings() -> Settings:
    return Settings()


# The exact defaults above — checked verbatim, not just "looks like a
# placeholder" — so a deployment that generated real secrets can never
# trip this by coincidence.
_PLACEHOLDER_SECRETS = {
    "secret_encryption_key": "changeme-generate-a-real-fernet-key-for-local-dev",
    "session_secret": "changeme-generate-a-real-session-secret-for-local-dev",
    "admin_password": "changeme",
}


def assert_production_secrets(settings: Settings) -> None:
    """Refuses to start in production with any secret still at its
    local-dev placeholder (docs/MASTER_PLAN.md §9, "key encryption
    audit") — those defaults exist so a fresh clone runs immediately
    without setup, not so a real deployment silently encrypts provider
    keys with a value that's sitting in plaintext in this repo's own
    .env.example."""
    if settings.environment != "production":
        return
    leaked = [name for name, placeholder in _PLACEHOLDER_SECRETS.items() if getattr(settings, name) == placeholder]
    if leaked:
        raise RuntimeError(
            f"Refusing to start with ENVIRONMENT=production while these are still their .env.example placeholder: {', '.join(leaked)}. "
            "Generate real values for each (see the comment above each field in this file) before deploying."
        )
