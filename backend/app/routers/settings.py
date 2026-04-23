"""
backend/app/routers/settings.py

API key and configuration management via the web UI.

All settings are stored in the DB (app_settings table).
Falls back to .env values if not set in DB.

Sensitive values (API keys) are masked in GET responses.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.setting import AppSetting
from app.models.user import User
from app.utils.dependencies import get_current_user, require_admin
from app.config import settings as env_settings


router = APIRouter(prefix="/api/settings", tags=["settings"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SettingOut(BaseModel):
    key: str
    value: Optional[str]      # masked value shown to UI
    has_value: bool           # True if a value is stored (DB or .env)
    description: str
    source: str               # "database" | "env" | "not_set"

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str                # empty string means "clear / use .env fallback"


# ── Setting definitions ───────────────────────────────────────────────────────

SETTING_DEFS = [
    {
        "key":         "RAPIDAPI_KEY",
        "description": "RapidAPI key used for Indeed, Glassdoor, LinkedIn, and ZipRecruiter job fetching.",
        "env_attr":    "RAPIDAPI_KEY",
    },
    {
        "key":         "ANTHROPIC_API_KEY",
        "description": "Anthropic API key for AI-powered resume tailoring (future use).",
        "env_attr":    "ANTHROPIC_API_KEY",
    },
    {
        "key":         "SLACK_WEBHOOK_URL",
        "description": "Slack incoming webhook URL. When set, saved searches will send Slack notifications whenever new jobs are found.",
        "env_attr":    "SLACK_WEBHOOK_URL",
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mask(value: Optional[str]) -> Optional[str]:
    """Return masked version: show only last 4 chars."""
    if not value:
        return None
    if len(value) <= 8:
        return "••••" + value[-2:]
    return "••••••••" + value[-4:]


def _get_effective_value(key: str, db: Session) -> tuple[Optional[str], str]:
    """
    Return (raw_value, source) where source is 'database', 'env', or 'not_set'.
    DB value takes priority over .env.
    """
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and row.value:
        return row.value, "database"

    env_attr = next((d["env_attr"] for d in SETTING_DEFS if d["key"] == key), key)
    env_val = getattr(env_settings, env_attr, None)
    if env_val:
        return env_val, "env"

    return None, "not_set"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SettingOut])
async def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get all settings with masked values."""
    result = []
    for defn in SETTING_DEFS:
        raw_val, source = _get_effective_value(defn["key"], db)
        result.append(SettingOut(
            key=defn["key"],
            value=_mask(raw_val),
            has_value=bool(raw_val),
            description=defn["description"],
            source=source,
        ))
    return result


@router.put("/{key}", response_model=SettingOut)
async def update_setting(
    key: str,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Save a setting value to the database.
    Send empty string to clear the DB value (will fall back to .env).
    """
    # Validate key is a known setting
    defn = next((d for d in SETTING_DEFS if d["key"] == key), None)
    if not defn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown setting key: {key}"
        )

    # Upsert
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = body.value or None   # empty string → None (use .env)
    else:
        row = AppSetting(
            key=key,
            value=body.value or None,
            description=defn["description"],
        )
        db.add(row)
    db.commit()
    db.refresh(row)

    raw_val, source = _get_effective_value(key, db)
    return SettingOut(
        key=key,
        value=_mask(raw_val),
        has_value=bool(raw_val),
        description=defn["description"],
        source=source,
    )
