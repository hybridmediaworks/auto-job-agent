"""
backend/app/schemas/job.py

Pydantic schemas for job-related requests and responses.
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.job import ApplicationStatus


class JobBase(BaseModel):
    """Base job schema with common fields"""
    title: str
    company: str
    location: Optional[str] = None
    url: str
    provider: str = "glassdoor"
    description: Optional[str] = None


class JobCreate(JobBase):
    """Schema for creating a new job"""
    source_job_id: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    job_type: Optional[str] = None
    remote_type: Optional[str] = None
    posted_date: Optional[date] = None
    easy_apply: bool = False


class JobUpdate(BaseModel):
    """Schema for updating job details"""
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    job_type: Optional[str] = None
    remote_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    easy_apply: Optional[bool] = None


class JobResponse(JobBase):
    """Schema for job response"""
    id: int
    source_job_id: Optional[str] = None
    status: ApplicationStatus
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    job_type: Optional[str] = None
    remote_type: Optional[str] = None
    posted_date: Optional[date] = None
    easy_apply: bool
    resume_path: Optional[str] = None
    error_message: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    applied_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Schema for paginated job list response"""
    total: int
    page: int
    page_size: int
    jobs: List[JobResponse]


class JobSearchParams(BaseModel):
    """Schema for job search parameters"""
    query: Optional[str] = None
    provider: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    remote_type: Optional[str] = None
    location: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
