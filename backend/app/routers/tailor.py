"""
backend/app/routers/tailor.py

AI-powered resume tailoring and cover letter generation endpoints.

POST /api/jobs/{job_id}/tailor  — generate tailored resume + cover letter
GET  /api/jobs/{job_id}/tailor  — retrieve last saved tailoring for this job
"""

import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job, ApplicationStatus
from app.models.profile import Profile
from app.models.tailoring import TailoredApplication
from app.models.user import User
from app.services import tailor_service, research_service
from app.utils.api_keys import get_api_key
from app.utils.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/jobs", tags=["tailor"])
manual_router = APIRouter(prefix="/api/tailor", tags=["manual-tailor"])
applications_router = APIRouter(prefix="/api/applications", tags=["applications"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TailorRequest(BaseModel):
    profile_id: Optional[int] = None   # None → use default profile
    custom_prompt: Optional[str] = None # Optional user instructions for AI generation
    template_id: Optional[int] = None  # 1=Classic, 2=Two-Column, 3=Creative
    one_page: bool = False              # Inject strict 1-page brevity constraint


class TailorSaveRequest(BaseModel):
    profile_id: int
    tailored_resume_text: Optional[str] = None
    tailored_resume_data: Optional[dict] = None
    cover_letter: Optional[str] = None
    fit_score: Optional[float] = None
    keywords_matched: Optional[List[str]] = None
    keywords_missing: Optional[List[str]] = None
    template_id: Optional[int] = None


class TailoredApplicationOut(BaseModel):
    id: int
    job_id: int
    profile_id: int
    profile_name: str
    tailored_resume_text: Optional[str]
    tailored_resume_data: Optional[dict] = None
    cover_letter: Optional[str]
    fit_score: Optional[float]
    keywords_matched: Optional[List[str]]
    keywords_missing: Optional[List[str]]
    template_id: Optional[int] = None
    created_at: str
    updated_at: str


def _serialize(ta: TailoredApplication, profile_name: str) -> TailoredApplicationOut:
    return TailoredApplicationOut(
        id=ta.id,
        job_id=ta.job_id,
        profile_id=ta.profile_id,
        profile_name=profile_name,
        tailored_resume_text=ta.tailored_resume_text,
        tailored_resume_data=ta.tailored_resume_data,
        cover_letter=ta.cover_letter,
        fit_score=ta.fit_score,
        keywords_matched=ta.keywords_matched or [],
        keywords_missing=ta.keywords_missing or [],
        template_id=ta.template_id,
        created_at=ta.created_at.isoformat(),
        updated_at=ta.updated_at.isoformat(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{job_id}/tailor", response_model=TailoredApplicationOut)
async def tailor_job(
    job_id: int,
    body: TailorRequest,
    preview: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """
    Generate a tailored resume and cover letter for a specific job.

    Uses the specified profile (or default profile if none given).
    Saves result to DB — subsequent GET returns this cached result.
    """
    # ── Validate job ──────────────────────────────────────────────────────────
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.description or not job.description.strip():
        raise HTTPException(
            status_code=400,
            detail="This job has no description. Tailoring requires a job description."
        )

    # ── Resolve profile ───────────────────────────────────────────────────────
    if body.profile_id:
        profile = db.query(Profile).filter(Profile.id == body.profile_id, Profile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
    else:
        profile = db.query(Profile).filter(Profile.user_id == current_user.id, Profile.is_default == True).first()
        if not profile:
            profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(
                status_code=400,
                detail="No profiles found. Please create a profile first."
            )

    if not profile.resume_data:
        raise HTTPException(
            status_code=400,
            detail="Profile has no resume data. Please fill in your resume in the Profiles page."
        )

    # ── Resolve API key ───────────────────────────────────────────────────────
    anthropic_key = get_api_key("ANTHROPIC_API_KEY", db)
    if not anthropic_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY not configured. Please set it in the Settings page."
        )

    # ── Call tailor service ───────────────────────────────────────────────────
    job_dict = {
        "title":       job.title,
        "company":     job.company,
        "description": job.description,
    }

    try:
        result = await asyncio.to_thread(
            tailor_service.tailor_for_job,
            job=job_dict,
            profile_resume_data=profile.resume_data,
            profile_data=profile.profile_data,
            anthropic_api_key=anthropic_key,
            custom_prompt=body.custom_prompt,
            template_id=body.template_id,
            one_page=body.one_page,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Tailoring failed: {str(exc)}"
        )

    # ── Preview mode: return without saving ───────────────────────────────────
    if preview:
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        return TailoredApplicationOut(
            id=0,
            job_id=job_id,
            profile_id=profile.id,
            profile_name=profile.name,
            tailored_resume_text=result["tailored_resume_text"],
            tailored_resume_data=result["tailored_resume_data"],
            cover_letter=result["cover_letter"],
            fit_score=result["fit_score"],
            keywords_matched=result["keywords_matched"],
            keywords_missing=result["keywords_missing"],
            template_id=body.template_id,
            created_at=now,
            updated_at=now,
        )

    # ── Upsert result in DB ───────────────────────────────────────────────────
    existing = (
        db.query(TailoredApplication)
        .filter(
            TailoredApplication.job_id == job_id,
            TailoredApplication.profile_id == profile.id,
        )
        .first()
    )

    if existing:
        existing.tailored_resume_text  = result["tailored_resume_text"]
        existing.cover_letter          = result["cover_letter"]
        existing.fit_score             = result["fit_score"]
        existing.keywords_matched      = result["keywords_matched"]
        existing.keywords_missing      = result["keywords_missing"]
        existing.tailored_resume_data  = result["tailored_resume_data"]
        existing.template_id           = body.template_id
        db.commit()
        db.refresh(existing)
        ta = existing
    else:
        ta = TailoredApplication(
            job_id=job_id,
            profile_id=profile.id,
            tailored_resume_text  = result["tailored_resume_text"],
            cover_letter          = result["cover_letter"],
            fit_score             = result["fit_score"],
            keywords_matched      = result["keywords_matched"],
            keywords_missing      = result["keywords_missing"],
            tailored_resume_data  = result["tailored_resume_data"],
            template_id           = body.template_id,
        )
        db.add(ta)
        db.commit()
        db.refresh(ta)

    return _serialize(ta, profile.name)


@router.post("/{job_id}/tailor/save", response_model=TailoredApplicationOut)
def save_tailoring(
    job_id: int,
    body: TailorSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Save a previewed tailoring result to the database without re-running AI."""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(Profile).filter(Profile.id == body.profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    existing = (
        db.query(TailoredApplication)
        .filter(
            TailoredApplication.job_id == job_id,
            TailoredApplication.profile_id == body.profile_id,
        )
        .first()
    )

    if existing:
        existing.tailored_resume_text = body.tailored_resume_text
        existing.cover_letter         = body.cover_letter
        existing.fit_score            = body.fit_score
        existing.keywords_matched     = body.keywords_matched
        existing.keywords_missing     = body.keywords_missing
        existing.tailored_resume_data = body.tailored_resume_data
        existing.template_id          = body.template_id
        db.commit()
        db.refresh(existing)
        ta = existing
    else:
        ta = TailoredApplication(
            job_id=job_id,
            profile_id=body.profile_id,
            tailored_resume_text=body.tailored_resume_text,
            cover_letter=body.cover_letter,
            fit_score=body.fit_score,
            keywords_matched=body.keywords_matched,
            keywords_missing=body.keywords_missing,
            tailored_resume_data=body.tailored_resume_data,
            template_id=body.template_id,
        )
        db.add(ta)
        db.commit()
        db.refresh(ta)

    return _serialize(ta, profile.name)


@router.get("/{job_id}/tailor", response_model=Optional[TailoredApplicationOut])
def get_tailoring(
    job_id: int,
    profile_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the last saved tailoring for a job.

    If profile_id is given, returns tailoring for that profile.
    Otherwise returns the most recent tailoring for any profile.
    """
    # Verify the job belongs to this user
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    q = db.query(TailoredApplication).filter(TailoredApplication.job_id == job_id)

    if profile_id:
        q = q.filter(TailoredApplication.profile_id == profile_id)

    ta = q.order_by(TailoredApplication.updated_at.desc()).first()

    if not ta:
        return None

    profile = db.query(Profile).filter(Profile.id == ta.profile_id).first()
    profile_name = profile.name if profile else "Unknown"

    return _serialize(ta, profile_name)


# ── Application History ───────────────────────────────────────────────────────

class ApplicationHistoryItem(BaseModel):
    tailoring_id: int
    job_id: int
    job_title: str
    company: str
    provider: str
    profile_id: int
    profile_name: str
    tailored_at: str
    fit_score: Optional[float]
    template_id: Optional[int]
    keywords_matched: List[str]


@applications_router.get("/history", response_model=List[ApplicationHistoryItem])
def get_application_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all jobs that have a saved tailored application for the current user."""
    rows = (
        db.query(TailoredApplication, Job, Profile)
        .join(Job, TailoredApplication.job_id == Job.id)
        .outerjoin(Profile, TailoredApplication.profile_id == Profile.id)
        .filter(Job.user_id == current_user.id)
        .order_by(TailoredApplication.updated_at.desc())
        .all()
    )
    return [
        ApplicationHistoryItem(
            tailoring_id=ta.id,
            job_id=job.id,
            job_title=job.title or "Untitled",
            company=job.company or "Unknown",
            provider=job.provider or "",
            profile_id=ta.profile_id,
            profile_name=profile.name if profile else "Unknown",
            tailored_at=ta.updated_at.isoformat(),
            fit_score=ta.fit_score,
            template_id=ta.template_id,
            keywords_matched=ta.keywords_matched or [],
        )
        for ta, job, profile in rows
    ]


class SimilarResumeItem(BaseModel):
    job_id: int
    job_title: str
    company: str
    tailored_at: str


@manual_router.get("/check-similar", response_model=List[SimilarResumeItem])
def check_similar_title(
    title: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return existing tailored resumes whose job title shares words with the given title."""
    words = [w.lower() for w in title.strip().split() if len(w) > 2]
    if not words:
        return []

    rows = (
        db.query(TailoredApplication, Job)
        .join(Job, TailoredApplication.job_id == Job.id)
        .filter(Job.user_id == current_user.id)
        .order_by(TailoredApplication.updated_at.desc())
        .all()
    )

    results = []
    for ta, job in rows:
        if not job.title:
            continue
        job_title_lower = job.title.lower()
        if any(w in job_title_lower for w in words):
            results.append(SimilarResumeItem(
                job_id=job.id,
                job_title=job.title,
                company=job.company or "Unknown",
                tailored_at=ta.updated_at.isoformat(),
            ))

    return results[:5]


class ManualTailorRequest(BaseModel):
    title: str
    company: str
    description: str
    location: Optional[str] = None
    address: Optional[str] = None
    url: Optional[str] = None
    profile_id: Optional[int] = None
    template_id: Optional[int] = None
    tone: Optional[str] = None
    focus_areas: Optional[List[str]] = None
    one_page: bool = False


@manual_router.post("/manual", response_model=TailoredApplicationOut)
async def manual_tailor(
    body: ManualTailorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """
    Generate a tailored resume from manually entered job details.

    Creates a Job record with provider='manual', optionally fetches community
    research insights, then runs the full tailoring pipeline.
    """
    import uuid

    # ── Resolve profile ───────────────────────────────────────────────────────
    if body.profile_id:
        profile = db.query(Profile).filter(
            Profile.id == body.profile_id, Profile.user_id == current_user.id
        ).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
    else:
        profile = db.query(Profile).filter(
            Profile.user_id == current_user.id, Profile.is_default == True
        ).first()
        if not profile:
            profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(
                status_code=400,
                detail="No profiles found. Please create a profile first.",
            )

    if not profile.resume_data:
        raise HTTPException(
            status_code=400,
            detail="Profile has no resume data. Please fill in your resume in the Profiles page.",
        )

    # ── Resolve API key ───────────────────────────────────────────────────────
    anthropic_key = get_api_key("ANTHROPIC_API_KEY", db)
    if not anthropic_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY not configured. Please set it in the Settings page.",
        )

    # ── Persist Job record ────────────────────────────────────────────────────
    job_url = body.url or f"manual://{uuid.uuid4().hex}"
    job = Job(
        user_id=current_user.id,
        url=job_url,
        title=body.title,
        company=body.company,
        location=body.location or "",
        description=body.description,
        provider="manual",
        status=ApplicationStatus.BOOKMARKED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # ── Tailoring phase ───────────────────────────────────────────────────────
    job_dict = {
        "title": job.title,
        "company": job.company,
        "description": job.description,
    }
    try:
        result = await asyncio.to_thread(
            tailor_service.tailor_for_job,
            job=job_dict,
            profile_resume_data=profile.resume_data,
            profile_data=profile.profile_data,
            anthropic_api_key=anthropic_key,
            template_id=body.template_id,
            one_page=body.one_page,
            tone=body.tone,
            focus_areas=body.focus_areas,
            location_override=body.location or None,
            address_override=body.address or None,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tailoring failed: {str(exc)}")

    # ── Save TailoredApplication ──────────────────────────────────────────────
    ta = TailoredApplication(
        job_id=job.id,
        profile_id=profile.id,
        tailored_resume_text=result["tailored_resume_text"],
        tailored_resume_data=result["tailored_resume_data"],
        cover_letter=result["cover_letter"],
        fit_score=result["fit_score"],
        keywords_matched=result["keywords_matched"],
        keywords_missing=result["keywords_missing"],
        template_id=body.template_id,
    )
    db.add(ta)
    db.commit()
    db.refresh(ta)

    return _serialize(ta, profile.name)


class DeleteApplicationsRequest(BaseModel):
    tailoring_ids: List[int]


@applications_router.delete("/history")
def delete_application_history(
    body: DeleteApplicationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete specific tailored applications by their tailoring_id, scoped to the current user."""
    owned_ta_ids = [
        ta_id for (ta_id,) in db.query(TailoredApplication.id)
        .join(Job, TailoredApplication.job_id == Job.id)
        .filter(
            Job.user_id == current_user.id,
            TailoredApplication.id.in_(body.tailoring_ids),
        )
        .all()
    ]

    if owned_ta_ids:
        deleted_count = db.query(TailoredApplication).filter(
            TailoredApplication.id.in_(owned_ta_ids)
        ).delete(synchronize_session=False)
        db.commit()
    else:
        deleted_count = 0

    return {"message": f"Deleted {deleted_count} history items"}
