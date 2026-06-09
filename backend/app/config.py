"""
Application configuration and settings.

Loads configuration from environment variables using Pydantic Settings.
"""

from pathlib import Path
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env path absolutely so it works regardless of CWD.
# backend/app/config.py → parent = backend/app → parent.parent = backend → parent.parent.parent = project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = str(_PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "sqlite:///./database/jobs.db"

    # JWT Authentication
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 10080  # 7 days

    # API Keys
    RAPIDAPI_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SERP_API_KEY: Optional[str] = None

    # ── Provider fetch tuning (RapidAPI quota control) ──────────────────────────
    # How many extra raw jobs to request for high-drop providers (ZipRecruiter /
    # the Indeed→JSearch fallback) so survivors after filtering still meet the
    # user's limit. Lower = fewer API calls / less quota burn. Was hardcoded to 4.
    PROVIDER_RAW_FETCH_MULTIPLIER: int = 3
    # Hard cap on ZipRecruiter per-search /job-details enrichment calls (each job
    # missing a date/description costs up to 2 extra calls). Was unbounded.
    ZIPRECRUITER_MAX_ENRICH: int = 25
    # Allow the live-HTML date-scrape fallback for ZipRecruiter jobs whose date is
    # still unknown after /job-details. Set False to save quota/time (jobs with no
    # resolvable date are then dropped by the posted_date filter).
    ZIPRECRUITER_SCRAPE_DATES: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Application
    APP_NAME: str = "Auto Job Agent"
    DEBUG: bool = False

    # Slack (Optional)
    SLACK_WEBHOOK_URL: Optional[str] = None

    # SMTP Email (for email verification)
    # Gmail: use an App Password (not your account password)
    #   → Google Account → Security → 2-Step Verification → App passwords
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None      # e.g. you@gmail.com
    SMTP_PASSWORD: Optional[str] = None  # Gmail App Password
    FROM_EMAIL: Optional[str] = None     # defaults to SMTP_USER if not set
    FROM_NAME: str = "Hybrid Job Agent"

    # Frontend URL used in verification email links
    FRONTEND_URL: str = "http://localhost:5173"

    # Set to "production" to enable Secure flag on cookies (requires HTTPS)
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(v)


# Create a global settings instance
settings = Settings()
