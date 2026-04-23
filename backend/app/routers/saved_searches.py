"""
backend/app/routers/saved_searches.py

CRUD endpoints for SavedSearch + manual trigger.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.saved_search import SavedSearch
from app.models.saved_search_run import SavedSearchRun
from app.models.user import User
from app.utils.dependencies import get_current_user, require_permission
from app.services.scheduler import trigger_search_now, sync_scheduler

router = APIRouter(prefix="/api/saved-searches", tags=["saved-searches"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SavedSearchCreate(BaseModel):
    name: str
    query: str
    location: str = "Remote"
    locality: str = "us"
    providers: List[str]
    remote_only: bool = False
    limit: int = 10
    interval_hours: float = 24.0
    is_active: bool = True
    max_age_days: Optional[int] = None

    @field_validator("providers")
    @classmethod
    def providers_not_empty(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one provider is required")
        return v


class SavedSearchUpdate(BaseModel):
    name: Optional[str] = None
    query: Optional[str] = None
    location: Optional[str] = None
    locality: Optional[str] = None
    providers: Optional[List[str]] = None
    remote_only: Optional[bool] = None
    limit: Optional[int] = None
    interval_hours: Optional[float] = None
    is_active: Optional[bool] = None
    max_age_days: Optional[int] = None

    @field_validator("providers")
    @classmethod
    def providers_not_empty(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None and not v:
            raise ValueError("At least one provider is required")
        return v


class SavedSearchOut(BaseModel):
    id: int
    name: str
    query: str
    location: str
    locality: str
    providers: List[str]
    remote_only: bool
    limit: int
    is_active: bool
    interval_hours: float
    max_age_days: Optional[int]
    last_run_at: Optional[datetime]
    last_new_jobs: int
    last_error: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SavedSearchRunOut(BaseModel):
    id: int
    saved_search_id: int
    started_at: datetime
    completed_at: Optional[datetime]
    new_jobs: int
    total_fetched: int
    status: str
    error: Optional[str]

    class Config:
        from_attributes = True


def _to_out(s: SavedSearch) -> SavedSearchOut:
    return SavedSearchOut(
        id=s.id,
        name=s.name,
        query=s.query,
        location=s.location,
        locality=s.locality,
        providers=s.providers_list,
        remote_only=s.remote_only,
        limit=s.limit,
        is_active=s.is_active,
        interval_hours=s.interval_hours,
        max_age_days=s.max_age_days,
        last_run_at=s.last_run_at,
        last_new_jobs=s.last_new_jobs,
        last_error=s.last_error,
        created_at=s.created_at,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SavedSearchOut])
async def list_saved_searches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    searches = db.query(SavedSearch).filter(SavedSearch.user_id == current_user.id).order_by(SavedSearch.created_at.desc()).all()
    return [_to_out(s) for s in searches]


@router.post("", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
async def create_saved_search(
    body: SavedSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_run_saved_search")),
):
    import json
    search = SavedSearch(
        name=body.name,
        query=body.query,
        location=body.location,
        locality=body.locality,
        providers=json.dumps(body.providers),
        remote_only=body.remote_only,
        limit=body.limit,
        interval_hours=body.interval_hours,
        is_active=body.is_active,
        max_age_days=body.max_age_days,
        last_new_jobs=0,
        user_id=current_user.id,
    )
    db.add(search)
    db.commit()
    db.refresh(search)

    # Sync scheduler so new search is picked up immediately
    await sync_scheduler()

    return _to_out(search)


@router.get("/{search_id}", response_model=SavedSearchOut)
async def get_saved_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return _to_out(search)


@router.put("/{search_id}", response_model=SavedSearchOut)
async def update_saved_search(
    search_id: int,
    body: SavedSearchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_run_saved_search")),
):
    import json
    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    if body.name is not None:
        search.name = body.name
    if body.query is not None:
        search.query = body.query
    if body.location is not None:
        search.location = body.location
    if body.locality is not None:
        search.locality = body.locality
    if body.providers is not None:
        search.providers = json.dumps(body.providers)
    if body.remote_only is not None:
        search.remote_only = body.remote_only
    if body.limit is not None:
        search.limit = body.limit
    if body.interval_hours is not None:
        search.interval_hours = body.interval_hours
    if body.is_active is not None:
        search.is_active = body.is_active
    if body.max_age_days is not None:
        search.max_age_days = body.max_age_days

    search.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(search)

    await sync_scheduler()

    return _to_out(search)


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_run_saved_search")),
):
    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    db.delete(search)
    db.commit()

    await sync_scheduler()


@router.post("/{search_id}/run", status_code=status.HTTP_200_OK)
async def run_now(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_run_saved_search")),
):
    """Immediately trigger a saved search (runs in background)."""
    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    # Run synchronously so we can return actual job counts to the frontend
    result = await trigger_search_now(search_id)
    new_jobs = result.get("new_jobs", 0)
    total_fetched = result.get("total_fetched", 0)

    if new_jobs > 0:
        msg = f"✅ {new_jobs} new job{'s' if new_jobs != 1 else ''} added from '{search.name}'!"
    else:
        msg = f"No new jobs found for '{search.name}' ({total_fetched} checked, all duplicates)."

    return {"message": msg, "new_jobs": new_jobs, "total_fetched": total_fetched}


class RecentJobOut(BaseModel):
    id: int
    title: str
    company: str
    provider: str
    url: str
    location: Optional[str]
    posted_date: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{search_id}/recent-jobs", response_model=List[RecentJobOut])
async def get_recent_jobs(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return jobs found in the most recent run of this saved search."""
    from app.models.job import Job

    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    query = db.query(Job).filter(
        Job.saved_search_id == search_id,
        Job.user_id == current_user.id,
    )

    # Filter to only jobs from the last run window if we have a last_run_at
    if search.last_run_at:
        window_start = search.last_run_at - timedelta(minutes=10)
        query = query.filter(Job.created_at >= window_start)

    jobs = query.order_by(Job.created_at.desc()).limit(20).all()
    return [
        RecentJobOut(
            id=j.id,
            title=j.title,
            company=j.company,
            provider=j.provider,
            url=j.url,
            location=j.location,
            posted_date=str(j.posted_date) if j.posted_date else None,
            created_at=j.created_at,
        )
        for j in jobs
    ]


@router.get("/{search_id}/runs", response_model=List[SavedSearchRunOut])
async def get_search_runs(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the last 20 execution records for a saved search."""
    search = db.query(SavedSearch).filter(SavedSearch.id == search_id, SavedSearch.user_id == current_user.id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    runs = (
        db.query(SavedSearchRun)
        .filter(SavedSearchRun.saved_search_id == search_id)
        .order_by(SavedSearchRun.started_at.desc())
        .limit(20)
        .all()
    )
    return runs
