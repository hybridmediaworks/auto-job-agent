"""
backend/app/services/scheduler.py

APScheduler-based cron job runner.

On startup, FastAPI calls `start_scheduler()` which:
  1. Loads all active SavedSearch records from DB
  2. Schedules each one as an interval job (interval_hours)
  3. Also schedules a "sync" job every 5 minutes that picks up
     newly created/modified searches without a server restart.

Each saved search run:
  - Splits comma-separated keywords (e.g. "Python, Django" → two searches)
  - Fetches jobs from all providers in PARALLEL via asyncio.gather
  - Falls back to JSearch when Indeed quota is exhausted
  - Skips jobs without URL (can't apply) and jobs without description (can't tailor)
  - Saves new (non-duplicate) jobs to DB
  - Sends a Slack notification if new jobs were found and SLACK_WEBHOOK_URL is set
"""

import asyncio
import math
from datetime import datetime, timezone
from typing import Optional, Tuple, List

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import SessionLocal
from app.models.job import Job, ApplicationStatus
from app.models.saved_search import SavedSearch
from app.models.saved_search_run import SavedSearchRun
from app.models.user import User
from app.models.setting import AppSetting
from app.providers import ProviderFactory
from app.providers.linkedin import LinkedInProvider
from app.config import settings as env_settings
from app.services.slack_service import send_slack_notification
from app.utils.location_filter import passes_location_filter
from app.utils.provider_utils import (
    ProviderRateLimiter,
    job_matches_query,
    build_date_kwargs,
    split_keywords,
)

# Ensure linkedin provider is always registered
if not ProviderFactory.is_registered("linkedin"):
    ProviderFactory.register_provider("linkedin", LinkedInProvider)


# ── Module-level scheduler instance ───────────────────────────────────────────

_scheduler: Optional[AsyncIOScheduler] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str) -> Optional[str]:
    """Read a setting from DB, fall back to env."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and row.value:
        return row.value
    return getattr(env_settings, key, None)


# ── Per-keyword fetch helpers ─────────────────────────────────────────────────

async def _scheduler_indeed_fallback(
    keyword: str,
    rapidapi_key: str,
    location: str,
    remote_only: bool,
    limit: int,
    locality: str,
    max_age_days: Optional[int],
) -> Tuple[str, str, List, Optional[Exception]]:
    """
    JSearch fallback when Indeed quota is exhausted.
    Tags results as provider='indeed' so the user sees no difference.
    """
    from app.providers.jsearch import JSearchProvider

    print(f"[scheduler][indeed→jsearch] Quota hit, falling back for '{keyword}'")
    jsearch = JSearchProvider(api_key=rapidapi_key, config={"query_suffix": "via indeed"})
    date_kwargs = build_date_kwargs("jsearch", max_age_days)

    try:
        jobs = await jsearch.search_jobs(
            query=keyword,
            location=location,
            remote_only=remote_only,
            limit=limit,
            locality=locality,
            **date_kwargs,
        )
        results = []
        for j in jobs:
            if not (j.url or "").strip():
                continue
            if not (j.description or "").strip():
                continue
            if not job_matches_query(j.title or "", j.description or "", keyword):
                continue
            if not passes_location_filter(j, locality, location, remote_only):
                continue
            try:
                j = j.model_copy(update={"provider": "indeed"})
            except AttributeError:
                j.provider = "indeed"
            results.append(j)
        print(f"[scheduler][indeed→jsearch] Fallback: {len(results)} jobs for '{keyword}'")
        return ("indeed", keyword, results, None)
    except Exception as exc:
        print(f"[scheduler][indeed→jsearch] Fallback failed for '{keyword}': {exc}")
        return ("indeed", keyword, [], exc)


async def _scheduler_fetch_one(
    provider_name: str,
    keyword: str,
    rapidapi_key: str,
    location: str,
    remote_only: bool,
    limit: int,
    locality: str,
    max_age_days: Optional[int],
    limiter: ProviderRateLimiter,
) -> Tuple[str, str, List, Optional[Exception]]:
    """
    Fetch jobs for one (provider, keyword) pair.
    Returns (provider_name, keyword, jobs_list, error_or_None).
    - Skips jobs with no URL or no description
    - Applies query-relevance and location filters
    - Falls back to JSearch on Indeed quota exhaustion
    """
    from app.providers.indeed import IndeedQuotaError

    provider = ProviderFactory.create(provider_name, api_key=rapidapi_key, config={})
    provider.rate_limiter = limiter
    date_kwargs = build_date_kwargs(provider_name, max_age_days)

    try:
        jobs = await provider.search_jobs(
            query=keyword,
            location=location,
            remote_only=remote_only,
            limit=limit,
            locality=locality,
            **date_kwargs,
        )

        filtered = []
        for j in jobs:
            # URL is mandatory — no URL means nowhere to apply
            if not (j.url or "").strip():
                continue
            # Description is mandatory for tailoring — LinkedIn often returns empty
            # descriptions on free/basic tier, so we save them anyway
            if provider_name != "linkedin" and not (j.description or "").strip():
                continue
            # Must be relevant to the keyword
            if not job_matches_query(j.title or "", j.description or "", keyword):
                continue
            # Must be in the requested geography
            if not passes_location_filter(j, locality, location, remote_only):
                continue
            filtered.append(j)

        return (provider_name, keyword, filtered, None)

    except IndeedQuotaError:
        return await _scheduler_indeed_fallback(
            keyword, rapidapi_key, location, remote_only, limit, locality, max_age_days
        )
    except Exception as exc:
        # Indeed 429 → fallback immediately
        if ("429" in str(exc) or "Too Many Requests" in str(exc)) and provider_name == "indeed":
            return await _scheduler_indeed_fallback(
                keyword, rapidapi_key, location, remote_only, limit, locality, max_age_days
            )
        if provider_name == "linkedin":
            print(f"[scheduler] CRITICAL LinkedIn Error for '{keyword}': {repr(exc)}")
        else:
            print(f"[scheduler] Error from '{provider_name}' for '{keyword}': {exc}")
        return (provider_name, keyword, [], exc)


# ── Core run function ─────────────────────────────────────────────────────────

async def run_saved_search(search_id: int, force: bool = False) -> dict:
    """
    Execute a single saved search:
      1. Acquire DB-level distributed lock (is_running flag)
      2. Split comma-separated keywords, build parallel tasks
      3. Fetch jobs from all (provider × keyword) pairs simultaneously
      4. Save new jobs (skip duplicates, no-URL, no-description)
      5. Send Slack notification if new jobs found
      6. Update last_run_at, last_new_jobs, last_error
      7. Log run to saved_search_runs table
    Returns a dict with new_jobs, total_fetched counts.
    """
    db: Session = SessionLocal()
    run_record: Optional[SavedSearchRun] = None
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    try:
        search = db.query(SavedSearch).filter(SavedSearch.id == search_id).first()
        if not search:
            return {"new_jobs": 0, "total_fetched": 0}
        if not search.is_active and not force:
            return {"new_jobs": 0, "total_fetched": 0}

        # Check owner still has permission to run saved searches
        owner = db.query(User).filter(User.id == search.user_id).first()
        if not owner or (not owner.is_admin and not owner.can_run_saved_search):
            print(f"[scheduler] SavedSearch {search_id}: owner lacks can_run_saved_search permission, skipping")
            return {"new_jobs": 0, "total_fetched": 0}

        # ── Distributed lock: atomically claim is_running ──────────────────────
        result = db.execute(
            text("UPDATE saved_searches SET is_running=1 WHERE id=:id AND (is_running IS NULL OR is_running=0)"),
            {"id": search_id},
        )
        db.commit()
        if result.rowcount == 0:
            print(f"[scheduler] SavedSearch {search_id} already running, skipping")
            return {"new_jobs": 0, "total_fetched": 0}

        # Create run record
        run_record = SavedSearchRun(
            saved_search_id=search_id,
            started_at=now,
            status="running",
        )
        db.add(run_record)
        db.commit()
        db.refresh(run_record)

        rapidapi_key = _get_setting(db, "RAPIDAPI_KEY")
        if not rapidapi_key:
            print(f"[scheduler] SavedSearch {search_id}: RAPIDAPI_KEY not configured, skipping")
            run_record.status = "skipped"
            run_record.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            run_record.error = "RAPIDAPI_KEY not configured"
            db.commit()
            return {"new_jobs": 0, "total_fetched": 0}

        providers_list = search.providers_list
        if not providers_list:
            run_record.status = "skipped"
            run_record.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            run_record.error = "No providers configured"
            db.commit()
            return {"new_jobs": 0, "total_fetched": 0}

        print(f"[scheduler] Running saved search '{search.name}' (id={search_id})")

        # ── Split keywords and build parallel tasks ───────────────────────────
        keywords = split_keywords(search.query)
        per_kw_limit = math.ceil(search.limit / len(keywords)) if len(keywords) > 1 else search.limit

        # One rate limiter per provider — shared across all tasks for that provider
        # so concurrent keyword tasks don't collectively exceed 5 req/sec
        limiters = {pname: ProviderRateLimiter(4.0) for pname in providers_list}

        tasks = []
        for provider_name in providers_list:
            if not ProviderFactory.is_registered(provider_name):
                print(f"[scheduler] Unknown provider '{provider_name}', skipping")
                continue
            for keyword in keywords:
                tasks.append(
                    _scheduler_fetch_one(
                        provider_name=provider_name,
                        keyword=keyword,
                        rapidapi_key=rapidapi_key,
                        location=search.location,
                        remote_only=search.remote_only,
                        limit=per_kw_limit,
                        locality=search.locality,
                        max_age_days=search.max_age_days,
                        limiter=limiters[provider_name],
                    )
                )

        # ── Run all fetches in parallel ───────────────────────────────────────
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── Process results ───────────────────────────────────────────────────
        new_jobs_added: List[Job] = []
        total_fetched: int = 0
        provider_errors: List[str] = []
        seen_urls: set = set()  # in-batch dedup across keyword results

        for raw_result in raw_results:
            if isinstance(raw_result, Exception):
                provider_errors.append(str(raw_result))
                continue

            provider_name, keyword, jobs_list, error = raw_result

            if error:
                err_msg = f"{provider_name}: {error}"
                if err_msg not in provider_errors:
                    provider_errors.append(err_msg)
                continue

            total_fetched += len(jobs_list)

            for job_data in jobs_list:
                # In-batch dedup (same job from multiple keyword searches)
                if job_data.url and job_data.url in seen_urls:
                    continue
                if job_data.url:
                    seen_urls.add(job_data.url)

                # DB duplicate check — scoped per user so users don't block each other
                existing = db.query(Job).filter(
                    Job.url == job_data.url,
                    Job.user_id == search.user_id,
                ).first()
                if not existing and job_data.source_job_id:
                    existing = db.query(Job).filter(
                        Job.provider == job_data.provider,
                        Job.source_job_id == job_data.source_job_id,
                        Job.user_id == search.user_id,
                    ).first()
                if existing:
                    continue

                new_job = Job(
                    title=job_data.title,
                    company=job_data.company,
                    location=job_data.location,
                    url=job_data.url,
                    provider=job_data.provider,
                    source_job_id=job_data.source_job_id,
                    description=job_data.description,
                    salary_min=job_data.salary_min,
                    salary_max=job_data.salary_max,
                    salary_currency=job_data.salary_currency,
                    job_type=job_data.job_type,
                    remote_type=job_data.remote_type,
                    posted_date=job_data.posted_date,
                    raw_data=job_data.raw_data,
                    status=ApplicationStatus.DISCOVERED,
                    easy_apply=False,
                    user_id=search.user_id,
                    saved_search_id=search.id,
                )
                db.add(new_job)
                new_jobs_added.append(new_job)

        db.commit()

        # Update metadata
        completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        search.last_run_at = completed_at
        search.last_new_jobs = len(new_jobs_added)
        search.is_running = False
        search.last_error = "; ".join(provider_errors) if provider_errors else None
        db.commit()

        kw_str = f" ({len(keywords)} keywords)" if len(keywords) > 1 else ""
        print(f"[scheduler] '{search.name}' done{kw_str} — {len(new_jobs_added)} new jobs, {total_fetched} fetched")

        # Finalize run record
        run_record.completed_at = completed_at
        run_record.new_jobs = len(new_jobs_added)
        run_record.total_fetched = total_fetched
        run_record.status = "error" if provider_errors and not new_jobs_added else "success"
        if provider_errors:
            run_record.error = "; ".join(provider_errors)
        db.commit()

        # Slack notification
        if new_jobs_added:
            slack_url = _get_setting(db, "SLACK_WEBHOOK_URL")
            if slack_url:
                for job in new_jobs_added:
                    db.refresh(job)
                await send_slack_notification(slack_url, search.name, new_jobs_added)

        return {"new_jobs": len(new_jobs_added), "total_fetched": total_fetched}

    except Exception as exc:
        print(f"[scheduler] Unexpected error in saved search {search_id}: {exc}")
        try:
            db.execute(text("UPDATE saved_searches SET is_running=0, last_error=:err WHERE id=:id"),
                       {"err": str(exc), "id": search_id})
            db.commit()
        except Exception:
            pass
        if run_record:
            try:
                run_record.status = "error"
                run_record.error = str(exc)
                run_record.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                db.commit()
            except Exception:
                pass
        return {"new_jobs": 0, "total_fetched": 0}
    finally:
        db.close()


# ── Scheduler sync: picks up new/modified searches ───────────────────────────

async def sync_scheduler():
    """
    Called every 5 minutes.  Ensures every active SavedSearch has a running
    APScheduler job and removes jobs for inactive/deleted searches.
    """
    global _scheduler
    if not _scheduler:
        return

    db: Session = SessionLocal()
    try:
        searches = db.query(SavedSearch).all()
    finally:
        db.close()

    active_ids = set()
    for search in searches:
        job_id = f"saved_search_{search.id}"
        if search.is_active:
            active_ids.add(job_id)
            existing = _scheduler.get_job(job_id)
            if existing is None:
                _scheduler.add_job(
                    run_saved_search,
                    trigger=IntervalTrigger(hours=search.interval_hours),
                    args=[search.id],
                    id=job_id,
                    replace_existing=True,
                    max_instances=1,
                    misfire_grace_time=300,
                )
                print(f"[scheduler] Scheduled saved search '{search.name}' every {search.interval_hours}h")
            else:
                # Check if interval changed
                current_interval = None
                try:
                    current_interval = existing.trigger.interval.total_seconds() / 3600
                except Exception:
                    pass
                if current_interval is not None and abs(current_interval - search.interval_hours) > 0.01:
                    _scheduler.reschedule_job(
                        job_id,
                        trigger=IntervalTrigger(hours=search.interval_hours),
                    )
                    print(f"[scheduler] Rescheduled '{search.name}' to every {search.interval_hours}h")
        else:
            if _scheduler.get_job(job_id):
                _scheduler.remove_job(job_id)
                print(f"[scheduler] Removed inactive search '{search.name}'")

    # Remove orphaned jobs (search deleted from DB)
    for job in _scheduler.get_jobs():
        if job.id.startswith("saved_search_") and job.id not in active_ids:
            _scheduler.remove_job(job.id)


# ── Public lifecycle API ───────────────────────────────────────────────────────

def start_scheduler():
    """Call from FastAPI startup_event()."""
    global _scheduler
    _scheduler = AsyncIOScheduler()

    _scheduler.add_job(
        sync_scheduler,
        trigger=IntervalTrigger(minutes=5),
        id="__scheduler_sync__",
        replace_existing=True,
        max_instances=1,
        next_run_time=datetime.now(timezone.utc),
    )

    _scheduler.start()
    print("[scheduler] Started. Sync runs every 5 minutes.")


def stop_scheduler():
    """Call from FastAPI shutdown_event()."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[scheduler] Stopped.")


def get_scheduler() -> Optional[AsyncIOScheduler]:
    return _scheduler


async def trigger_search_now(search_id: int) -> dict:
    """Manually trigger a saved search immediately (used by the frontend 'Run Now' button)."""
    return await run_saved_search(search_id, force=True)
