"""
backend/app/routers/jobs.py

Job management endpoints - CRUD, search, and filtering.
"""

from datetime import datetime, date, timedelta, timezone
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import or_, and_, nullslast
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job, ApplicationStatus
from app.models.user import User
from app.schemas.job import (
    JobResponse,
    JobListResponse,
    JobUpdate,
    JobSearchParams
)
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class DeleteJobsRequest(BaseModel):
    job_ids: List[int]


@router.get("", response_model=JobListResponse)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    provider: Optional[str] = Query(None),
    status: Optional[ApplicationStatus] = Query(None),
    remote_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    today_only: bool = Query(False),
    date_from: Optional[str] = Query(None, description="Filter jobs fetched on or after this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter jobs fetched on or before this date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated list of jobs with filtering.

    Filters:
    - provider: Filter by job provider (indeed, glassdoor, ziprecruiter)
    - status: Filter by application status
    - remote_type: Filter by remote type (remote, hybrid, on-site)
    - location: Filter by location (partial match)
    - search: Search in title, company, or description
    - today_only: Return only jobs added today (UTC)
    """
    query = db.query(Job).filter(Job.user_id == current_user.id)

    # Apply filters
    if provider:
        query = query.filter(Job.provider == provider)

    if status:
        query = query.filter(Job.status == status)

    if remote_type:
        query = query.filter(Job.remote_type == remote_type)

    if location:
        query = query.filter(Job.location.ilike(f"%{location}%"))

    if search:
        search_filter = or_(
            Job.title.ilike(f"%{search}%"),
            Job.company.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)

    if today_only:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        query = query.filter(Job.created_at >= today_start)

    if date_from:
        try:
            d = date.fromisoformat(date_from)
            query = query.filter(Job.created_at >= datetime(d.year, d.month, d.day))
        except ValueError:
            pass

    if date_to:
        try:
            d = date.fromisoformat(date_to)
            query = query.filter(Job.created_at < datetime(d.year, d.month, d.day) + timedelta(days=1))
        except ValueError:
            pass

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    jobs = query.order_by(Job.posted_date.desc().nullslast(), Job.created_at.desc()).offset(offset).limit(page_size).all()

    return JobListResponse(
        total=total,
        page=page,
        page_size=page_size,
        jobs=jobs
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get job details by ID"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found"
        )

    return job


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    job_update: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update job details (status, notes, etc.)"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found"
        )

    # Update fields that are provided
    update_data = job_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a job"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found"
        )

    db.delete(job)
    db.commit()

    return {"message": f"Job {job_id} deleted successfully"}


@router.delete("")
async def delete_multiple_jobs(
    body: DeleteJobsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple jobs by IDs"""
    deleted_count = db.query(Job).filter(Job.id.in_(body.job_ids), Job.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()

    return {"message": f"Deleted {deleted_count} jobs"}
