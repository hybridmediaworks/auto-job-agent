"""
backend/app/models/saved_search.py

SavedSearch model — stores a reusable job search configuration that can be
run automatically by the cron scheduler.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey, Integer, String, Boolean, Float, DateTime, Text
from sqlalchemy.orm import validates

from .base import Base


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name            = Column(String(200), nullable=False)          # Display name e.g. "WP Dev - Pakistan"
    query           = Column(String(500), nullable=False)          # e.g. "WordPress Developer"
    location        = Column(String(200), default="Remote")
    locality        = Column(String(10), default="us")             # Indeed country code
    providers       = Column(Text, nullable=False)                 # JSON list e.g. '["indeed","glassdoor"]'
    remote_only     = Column(Boolean, default=False)
    limit           = Column(Integer, default=10)                  # jobs per provider per run

    is_active       = Column(Boolean, default=True)                # pause without deleting
    interval_hours  = Column(Float, default=24.0)                  # run every N hours
    max_age_days    = Column(Integer, nullable=True)               # only fetch jobs posted within N days (None = any time)
    is_running      = Column(Boolean, default=False)               # distributed lock flag

    last_run_at     = Column(DateTime, nullable=True)
    last_new_jobs   = Column(Integer, default=0)                   # new jobs found on last run
    last_error      = Column(Text, nullable=True)                  # error message from last run (None = ok)

    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    @property
    def providers_list(self) -> list:
        try:
            return json.loads(self.providers)
        except Exception:
            return []

    @providers_list.setter
    def providers_list(self, value: list):
        self.providers = json.dumps(value)
