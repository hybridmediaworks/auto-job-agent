"""
backend/app/models/profile.py

Named applicant profiles — stores resume data and personal info in DB
so they can be managed through the web UI instead of static JSON files.

Supports multiple profiles (e.g. "WordPress Dev", "Shopify Dev") for
targeting different job types with different resume emphasis.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Profile(Base):
    """Named applicant profile containing resume + personal info."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Owner — which user this profile belongs to
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Default"
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Mirrors client_data/profile.json
    # Keys: personal, work_authorization, experience, education, salary,
    #       availability, screening_defaults
    profile_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Mirrors client_data/resume_data.json
    # Keys: name, title, email, phone, location, linkedin, github, portfolio,
    #       summary, experience[], education[], skills{}
    resume_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Profile id={self.id} name={self.name!r} default={self.is_default}>"
