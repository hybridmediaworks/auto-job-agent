"""
backend/app/models/saved_search_run.py

Execution history for saved searches. One row per run attempt.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime

from .base import Base


class SavedSearchRun(Base):
    __tablename__ = "saved_search_runs"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    saved_search_id   = Column(Integer, ForeignKey("saved_searches.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at        = Column(DateTime, nullable=False)
    completed_at      = Column(DateTime, nullable=True)
    new_jobs          = Column(Integer, default=0)
    total_fetched     = Column(Integer, default=0)
    status            = Column(String(20), nullable=False)  # "running" | "success" | "error" | "skipped"
    error             = Column(Text, nullable=True)
