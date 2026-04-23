"""
backend/app/models/job.py

Extended Job model for web UI with multi-provider support.

Adds fields for:
  - Provider identification (Indeed, Glassdoor, ZipRecruiter, etc.)
  - Raw API response storage
  - Salary information
  - Job type and remote work classification
  - Provider-specific job IDs
"""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ApplicationStatus(str, Enum):
    """Job application status lifecycle — full pipeline"""
    DISCOVERED  = "DISCOVERED"   # found via search, not yet reviewed
    BOOKMARKED  = "BOOKMARKED"   # user marked as interesting
    APPLIED     = "APPLIED"      # user applied manually
    SCREENING   = "SCREENING"    # initial screening / phone screen
    INTERVIEW   = "INTERVIEW"    # interview scheduled or in progress
    OFFERED     = "OFFERED"      # received an offer
    HIRED       = "HIRED"        # accepted offer / won
    REJECTED    = "REJECTED"     # got rejected at any stage
    CLOSED      = "CLOSED"       # user decided not to pursue
    SKIPPED     = "SKIPPED"      # decided not to apply


class Job(Base):
    """
    Job listing record with multi-provider support.

    Stores job details from various platforms (Indeed, Glassdoor, ZipRecruiter)
    fetched via RapidAPI, along with application status and metadata.
    """
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint('url', 'user_id', name='uq_jobs_url_user'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Owner — which user fetched/owns this job
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Which saved search found this job (NULL = manually fetched)
    saved_search_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("saved_searches.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Discovery Data ────────────────────────────────────────────────────────
    url: Mapped[str] = mapped_column(String, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # ── Provider Information (NEW) ────────────────────────────────────────────
    provider: Mapped[str] = mapped_column(
        String(50),
        default="glassdoor",
        index=True,
        nullable=False
    )
    source_job_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True
    )  # Provider's internal job ID (e.g., Indeed job key)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[ApplicationStatus] = mapped_column(
        String, default=ApplicationStatus.DISCOVERED, index=True
    )

    # ── Extraction Data ───────────────────────────────────────────────────────
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    easy_apply: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Salary Information (NEW) ──────────────────────────────────────────────
    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str] = mapped_column(
        String(10),
        default="USD",
        nullable=False
    )

    # ── Job Classification (NEW) ──────────────────────────────────────────────
    job_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )  # 'full-time', 'part-time', 'contract', 'temporary', etc.

    remote_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )  # 'remote', 'hybrid', 'on-site'

    posted_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # ── Raw Provider Data (NEW) ───────────────────────────────────────────────
    raw_data: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True
    )  # Store complete API response for debugging/future use

    # ── Application Outcome ───────────────────────────────────────────────────
    resume_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return (
            f"<Job id={self.id} "
            f"title='{self.title}' "
            f"company='{self.company}' "
            f"provider={self.provider} "
            f"status={self.status}>"
        )
