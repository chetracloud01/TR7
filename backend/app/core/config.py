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

    daily_exposure_cap_pct: float = 10.0
    calibration_default_discount: float = 0.87


@lru_cache
def get_settings() -> Settings:
    return Settings()
