"""
backend/app/providers/__init__.py

Job provider implementations for multi-platform job fetching.

Provides abstraction layer for integrating with different job platforms
(Indeed, Glassdoor, ZipRecruiter, etc.) via RapidAPI.
"""

from .base import BaseJobProvider, JobData
from .factory import ProviderFactory
from .indeed import IndeedProvider
from .glassdoor import GlassdoorProvider
from .ziprecruiter import ZipRecruiterProvider
from .linkedin import LinkedInProvider
from .jsearch import JSearchProvider


# Auto-register all providers on import
ProviderFactory.register_provider("indeed", IndeedProvider)
ProviderFactory.register_provider("glassdoor", GlassdoorProvider)
ProviderFactory.register_provider("ziprecruiter", ZipRecruiterProvider)
ProviderFactory.register_provider("linkedin", LinkedInProvider)
ProviderFactory.register_provider("jsearch", JSearchProvider)


__all__ = [
    "BaseJobProvider",
    "JobData",
    "ProviderFactory",
    "IndeedProvider",
    "GlassdoorProvider",
    "ZipRecruiterProvider",
    "LinkedInProvider",
    "JSearchProvider",
]
