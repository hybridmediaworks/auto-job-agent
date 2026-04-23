"""
backend/app/providers/base.py

Abstract base class for job provider integrations.

Defines the interface that all job providers (Indeed, Glassdoor, ZipRecruiter)
must implement. This abstraction allows adding new providers by simply:
  1. Creating a new class that inherits from BaseJobProvider
  2. Implementing search_jobs() and map_fields()
  3. Registering it with ProviderFactory
"""

from abc import ABC, abstractmethod
from datetime import date
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field


class NoOpRateLimiter:
    """Rate limiter that does nothing — default when no limiter is set."""
    async def acquire(self):
        pass


class JobData(BaseModel):
    """
    Standardized job data model.

    All providers must map their API responses to this unified format.
    This ensures consistent data structure regardless of the source platform.
    """

    title: str = Field(..., description="Job title")
    company: str = Field(..., description="Company name")
    location: str = Field(..., description="Job location (city, state, or 'Remote')")
    description: str = Field(..., description="Full job description text")
    url: str = Field(..., description="Direct URL to job listing")
    source_job_id: str = Field(..., description="Provider's internal job ID")
    provider: str = Field(..., description="Provider name (indeed, glassdoor, etc.)")

    # Optional fields
    salary_min: Optional[int] = Field(None, description="Minimum salary (annual)")
    salary_max: Optional[int] = Field(None, description="Maximum salary (annual)")
    salary_currency: str = Field(default="USD", description="Salary currency code")
    job_type: Optional[str] = Field(None, description="full-time, part-time, contract, etc.")
    remote_type: Optional[str] = Field(None, description="remote, hybrid, on-site")
    posted_date: Optional[date] = Field(None, description="Date job was posted")

    # Raw provider data for debugging and future use
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="Original API response")

    class Config:
        """Pydantic configuration"""
        json_schema_extra = {
            "example": {
                "title": "Senior WordPress Developer",
                "company": "Acme Corp",
                "location": "Remote",
                "description": "We are seeking an experienced WordPress developer...",
                "url": "https://example.com/job/12345",
                "source_job_id": "12345",
                "provider": "indeed",
                "salary_min": 80000,
                "salary_max": 120000,
                "salary_currency": "USD",
                "job_type": "full-time",
                "remote_type": "remote",
                "posted_date": "2025-01-15"
            }
        }


class BaseJobProvider(ABC):
    """
    Abstract base class for all job provider implementations.

    To add a new provider:
      1. Inherit from this class
      2. Implement search_jobs() to call the provider's API
      3. Implement map_fields() to convert API response to JobData
      4. Register with ProviderFactory
    """

    def __init__(self, api_key: str, config: Dict[str, Any] = None):
        """
        Initialize the job provider.

        Args:
            api_key: API key for the provider (e.g., RapidAPI key)
            config: Optional provider-specific configuration
        """
        self.api_key = api_key
        self.config = config or {}
        self.rate_limiter = NoOpRateLimiter()

    @abstractmethod
    async def search_jobs(
        self,
        query: str,
        location: str = "Remote",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        """
        Search for jobs using provider's API.

        Args:
            query: Search query (job title, keywords)
            location: Job location (city, state, or "Remote")
            remote_only: Filter for remote jobs only
            limit: Maximum number of results to return
            **kwargs: Additional provider-specific parameters

        Returns:
            List of JobData objects (standardized format)

        Raises:
            Exception: If API call fails
        """
        pass

    @abstractmethod
    def map_fields(self, raw_data: Dict[str, Any]) -> JobData:
        """
        Map provider-specific API response to standardized JobData format.

        Each provider returns data in their own structure. This method
        translates provider fields to our unified JobData model.

        Args:
            raw_data: Single job record from provider's API response

        Returns:
            JobData object with standardized fields

        Example:
            # Indeed API response
            raw = {
                "title": "WordPress Developer",
                "company": {"name": "Acme"},
                "location": "Remote",
                ...
            }

            # Map to JobData
            return JobData(
                title=raw["title"],
                company=raw["company"]["name"],
                location=raw["location"],
                ...
            )
        """
        pass

    def get_provider_name(self) -> str:
        """
        Get the provider name (lowercase identifier).

        Override this if you want a custom provider name.

        Returns:
            Provider name string (e.g., "indeed", "glassdoor")
        """
        return self.__class__.__name__.replace("Provider", "").lower()
