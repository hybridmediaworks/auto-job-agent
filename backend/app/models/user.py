"""
User model for authentication.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Integer, String, DateTime
from .base import Base


class User(Base):
    """User model for admin authentication."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Email verification — required before first login
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(64), nullable=True, index=True)
    email_verification_expires = Column(DateTime, nullable=True)

    # Password reset — token-based, 1-hour expiry
    password_reset_token = Column(String(64), nullable=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)

    # Role & permissions
    is_admin = Column(Boolean, default=False, nullable=False)
    can_fetch_jobs = Column(Boolean, default=False, nullable=False)
    can_run_saved_search = Column(Boolean, default=False, nullable=False)
    can_create_resume = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"
