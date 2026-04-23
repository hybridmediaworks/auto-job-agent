"""
backend/app/models/__init__.py

Exports all SQLAlchemy models for easy importing.
"""

from .base import Base
from .user import User
from .job import Job, ApplicationStatus
from .setting import AppSetting
from .profile import Profile
from .tailoring import TailoredApplication
from .saved_search import SavedSearch

__all__ = [
    "Base",
    "User",
    "Job",
    "ApplicationStatus",
    "AppSetting",
    "Profile",
    "TailoredApplication",
    "SavedSearch",
]
