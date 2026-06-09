"""
backend/app/models/tailoring.py

Stores AI-generated tailored resumes and cover letters per job+profile pair.
Results are saved so refreshing the job detail page restores the last generation.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class TailoredApplication(Base):
    """AI-generated tailored resume + cover letter for a specific job."""

    __tablename__ = "tailored_applications"
    __table_args__ = (
        # One tailored result per job+profile pair — upserts replace, never duplicate.
        UniqueConstraint("job_id", "profile_id", name="uq_tailored_job_profile"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )

    # Plain-text formatted resume ready for copy-paste
    tailored_resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Full cover letter text
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Claude's assessment
    fit_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    keywords_matched: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    keywords_missing: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # The tailored resume data (JSON) — used internally; text version above is for UI
    tailored_resume_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Which resume template was used (1=Classic, 2=Two-Column, 3=Creative)
    template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )

    def __repr__(self) -> str:
        return f"<TailoredApplication job={self.job_id} profile={self.profile_id} fit={self.fit_score}>"
