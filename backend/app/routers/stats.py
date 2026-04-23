"""
backend/app/routers/stats.py

Statistics and dashboard endpoints.
"""

from typing import Dict, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job, ApplicationStatus
from app.models.user import User
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/stats", tags=["statistics"])


@router.get("/dashboard")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard statistics.

    Returns:
    - Total jobs count
    - Jobs by status
    - Jobs by provider
    - Jobs fetched today
    - Recent activity
    """
    uid = current_user.id

    # Total jobs
    total_jobs = db.query(Job).filter(Job.user_id == uid).count()

    # Jobs by status
    status_counts = (
        db.query(Job.status, func.count(Job.id))
        .filter(Job.user_id == uid)
        .group_by(Job.status)
        .all()
    )
    jobs_by_status = {status: count for status, count in status_counts}

    # Jobs by provider
    provider_counts = (
        db.query(Job.provider, func.count(Job.id))
        .filter(Job.user_id == uid)
        .group_by(Job.provider)
        .all()
    )
    jobs_by_provider = {provider: count for provider, count in provider_counts}

    # Jobs fetched today
    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, datetime.min.time())
    jobs_today = (
        db.query(Job)
        .filter(Job.user_id == uid, Job.created_at >= today_start)
        .count()
    )

    # Recent jobs (last 10)
    recent_jobs = (
        db.query(Job)
        .filter(Job.user_id == uid)
        .order_by(Job.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_jobs": total_jobs,
        "jobs_by_status": jobs_by_status,
        "jobs_by_provider": jobs_by_provider,
        "jobs_fetched_today": jobs_today,
        "recent_jobs": [
            {
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "provider": job.provider,
                "status": job.status,
                "location": job.location,
                "description": job.description,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "salary_currency": getattr(job, "salary_currency", "USD"),
                "job_type": job.job_type,
                "remote_type": job.remote_type,
                "posted_date": job.posted_date,
                "easy_apply": job.easy_apply,
                "url": job.url,
                "created_at": job.created_at,
            }
            for job in recent_jobs
        ]
    }


@router.get("/trends")
async def get_trends(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get job trends over time.

    Args:
        days: Number of days to look back (default: 30)

    Returns:
        Daily job counts for the specified period
    """
    start_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

    # Jobs by day
    daily_counts = (
        db.query(
            func.date(Job.created_at).label("date"),
            func.count(Job.id).label("count")
        )
        .filter(Job.user_id == current_user.id, Job.created_at >= start_date)
        .group_by(func.date(Job.created_at))
        .order_by(func.date(Job.created_at))
        .all()
    )

    return {
        "period_days": days,
        "start_date": start_date.date(),
        "end_date": datetime.now(timezone.utc).date(),
        "daily_counts": [
            {
                "date": str(date),
                "count": count
            }
            for date, count in daily_counts
        ]
    }


@router.get("/summary")
async def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get quick summary statistics.

    Useful for displaying overview cards in the UI.
    """
    uid = current_user.id
    base = db.query(Job).filter(Job.user_id == uid)

    total = base.count()
    discovered = base.filter(Job.status == ApplicationStatus.DISCOVERED).count()
    applied = base.filter(Job.status == ApplicationStatus.APPLIED).count()
    interview = base.filter(Job.status == ApplicationStatus.INTERVIEW).count()
    offered = base.filter(Job.status == ApplicationStatus.OFFERED).count()
    hired = base.filter(Job.status == ApplicationStatus.HIRED).count()
    skipped = base.filter(Job.status == ApplicationStatus.SKIPPED).count()

    # Remote jobs count
    remote_jobs = db.query(Job).filter(Job.user_id == uid, Job.remote_type == "remote").count()

    # Average salary (where available)
    avg_salary_min = db.query(func.avg(Job.salary_min)).filter(Job.user_id == uid, Job.salary_min.isnot(None)).scalar()
    avg_salary_max = db.query(func.avg(Job.salary_max)).filter(Job.user_id == uid, Job.salary_max.isnot(None)).scalar()

    return {
        "total_jobs": total,
        "discovered": discovered,
        "applied": applied,
        "interview": interview,
        "offered": offered,
        "hired": hired,
        "skipped": skipped,
        "remote_jobs": remote_jobs,
        "remote_percentage": round((remote_jobs / total * 100) if total > 0 else 0, 1),
        "avg_salary_min": round(avg_salary_min) if avg_salary_min else None,
        "avg_salary_max": round(avg_salary_max) if avg_salary_max else None,
    }
