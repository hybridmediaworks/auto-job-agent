"""
backend/app/utils/api_keys.py

Helper to resolve API keys — DB first, .env fallback.

Usage:
    from app.utils.api_keys import get_api_key

    rapidapi_key = get_api_key("RAPIDAPI_KEY", db)
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings as env_settings
from app.models.setting import AppSetting


def get_api_key(key: str, db: Session) -> Optional[str]:
    """
    Return the value for `key` — DB (Settings page) takes priority over .env.

    Settings UI values always win. .env is only used as a fallback when no
    DB record exists (e.g. fresh install before any keys have been configured
    via the UI). On production, leave API key fields empty in .env and manage
    everything through the Settings page.

    Returns None if not configured anywhere.
    """
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and row.value:
        return row.value
    env_value = getattr(env_settings, key, None)
    if env_value:
        return env_value
    return None
