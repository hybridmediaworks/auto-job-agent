"""
backend/app/routers/providers.py

Job provider management and job fetching endpoints.
Supports multi-keyword search (comma-separated) and parallel provider fetching.
"""

import asyncio
import json
import math
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.job import Job, ApplicationStatus
from app.models.user import User
from app.providers import ProviderFactory, JobData
from app.providers.linkedin import LinkedInProvider
from app.providers.jsearch import JSearchProvider
from app.providers.indeed import IndeedQuotaError
from app.utils.dependencies import get_current_user, require_permission
from app.utils.api_keys import get_api_key
from app.utils.location_filter import passes_location_filter, LOCALITY_ISO, LOCALITY_TERMS, GENERIC_LOCATIONS
from app.utils.provider_utils import ProviderRateLimiter, job_matches_query, build_date_kwargs, split_keywords
from app.config import settings
from app.services.slack_service import send_slack_notification


# Ensure linkedin is always registered even if __init__ missed it
if not ProviderFactory.is_registered("linkedin"):
    ProviderFactory.register_provider("linkedin", LinkedInProvider)


router = APIRouter(prefix="/api/providers", tags=["providers"])


class FetchJobsRequest(BaseModel):
    """Request schema for fetching jobs"""
    providers: List[str]
    query: str          # supports comma-separated keywords: "AI, ML, Python"
    location: str = "Remote"
    locality: str = "us"   # Indeed country code: us, ca, gb, au, de, fr, etc.
    remote_only: bool = True
    limit: int = Field(10, ge=1, le=100)
    max_age_days: Optional[int] = None  # Only keep jobs posted within N days; None = no filter


class ProviderError(BaseModel):
    """Per-provider error details"""
    provider: str
    error_type: str   # "rate_limit" | "auth" | "unknown"
    message: str      # Human-readable explanation


class FetchJobsResponse(BaseModel):
    """Response schema for job fetching"""
    message: str
    total_fetched: int
    new_jobs: int
    duplicate_jobs: int
    no_desc_dropped: int = 0
    provider_errors: List[ProviderError] = []


def _classify_error(provider: str, exc: Exception) -> ProviderError:
    """Turn a raw exception into a structured, user-friendly ProviderError."""
    msg = str(exc)

    # For HTTP errors, include the response body — it contains the real API error message
    response_body = ""
    if hasattr(exc, "response") and exc.response is not None:
        try:
            response_body = exc.response.text[:300]
        except Exception:
            pass

    full_context = f"{msg} {response_body}"

    if "429" in full_context or "Too Many Requests" in full_context:
        if "per hour" in full_context.lower():
            limit_msg = f"Hourly rate limit hit for '{provider}'. Wait a few minutes and try again."
        elif "per month" in full_context.lower() or "monthly" in full_context.lower():
            limit_msg = f"Monthly request limit reached for '{provider}'. Check your RapidAPI plan at rapidapi.com."
        else:
            limit_msg = f"Rate limit exceeded for '{provider}'. Wait a moment and try again."
        return ProviderError(
            provider=provider,
            error_type="rate_limit",
            message=limit_msg,
        )
    if "401" in full_context or "Unauthorized" in full_context or "403" in full_context or "Forbidden" in full_context:
        api_info = {
            "indeed":       ("Indeed12",                   "https://rapidapi.com/mantiks-mantiks-default/api/indeed12"),
            "glassdoor":    ("Glassdoor Real-Time",        "https://rapidapi.com/things4u-api4upro/api/glassdoor-real-time"),
            "ziprecruiter": ("JSearch",                    "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"),
            "linkedin":     ("LinkedIn Job Search API",    "https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api"),
        }
        api_name, api_url = api_info.get(provider, (provider, "https://rapidapi.com"))
        return ProviderError(
            provider=provider,
            error_type="auth",
            message=(
                f"API key rejected (401/403) for '{provider}'. "
                f"Subscribe to the '{api_name}' API on RapidAPI: {api_url}"
            ),
        )
    if "timeout" in full_context.lower() or "connect" in full_context.lower():
        return ProviderError(
            provider=provider,
            error_type="timeout",
            message=f"Request timed out. The '{provider}' API did not respond in time. Try again.",
        )

    detail = msg
    if response_body:
        detail += f" | API response: {response_body}"

    return ProviderError(
        provider=provider,
        error_type="unknown",
        message=f"Unexpected error from '{provider}': {detail[:400]}",
    )


async def _fetch_indeed_jsearch_fallback(
    keyword: str,
    rapidapi_key: str,
    location: str,
    remote_only: bool,
    limit: int,
    locality: str,
    jsearch_limiter: "ProviderRateLimiter | None" = None,
    max_age_days: Optional[int] = None,
) -> tuple:
    """
    Silent fallback: fetch Indeed jobs via JSearch when Indeed quota is hit.
    Jobs are tagged provider='indeed' so the user sees no difference.
    JSearch includes full descriptions — no separate detail call needed.
    jsearch_limiter should be the shared JSearch limiter (used by ziprecruiter)
    so both don't exceed the 5 req/sec API limit simultaneously.
    """
    print(f"[indeed→jsearch] Quota hit, falling back to JSearch 'via indeed' for '{keyword}'")
    jsearch = JSearchProvider(api_key=rapidapi_key, config={"query_suffix": "via indeed"})
    jsearch.rate_limiter = jsearch_limiter or ProviderRateLimiter(4.0)
    # "via indeed" on JSearch has a sparse index — passing date_posted filters returns 0 results.
    # Skip API-level date filtering; age_cutoff in the main loop enforces it via posted_date.
    date_kwargs = {}
    try:
        jobs = await jsearch.search_jobs(
            query=keyword,
            location=location,
            remote_only=remote_only,
            limit=limit * settings.PROVIDER_RAW_FETCH_MULTIPLIER,  # "via indeed" index has a high no_desc drop rate
            locality=locality,
            **date_kwargs,
        )
        # Tag as indeed so it's silent to the user.
        # Also set posted_date=today for jobs where JSearch didn't return a date —
        # JSearch is surfacing these as current listings so we treat them as recent.
        indeed_jobs = []
        for job in jobs:
            updates = {"provider": "indeed"}
            if job.posted_date is None:
                updates["posted_date"] = date.today()
            try:
                indeed_jobs.append(job.model_copy(update=updates))
            except AttributeError:
                for k, v in updates.items():
                    setattr(job, k, v)
                indeed_jobs.append(job)
        # Enrich Indeed jobs missing descriptions via /job-details
        needs_enrich = [j for j in indeed_jobs if j.source_job_id and not (j.description or "").strip()]
        if needs_enrich:
            print(f"[indeed→jsearch] Enriching {len(needs_enrich)} jobs missing descriptions")
            async def enrich_indeed(job):
                extra = await jsearch._fetch_job_details(job.source_job_id)
                if extra and extra.get("description"):
                    return job.model_copy(update={"description": extra["description"]})
                return job
            enriched = await asyncio.gather(*[enrich_indeed(j) for j in needs_enrich])
            enrich_map = {j.source_job_id: e for j, e in zip(needs_enrich, enriched)}
            indeed_jobs = [enrich_map.get(j.source_job_id, j) for j in indeed_jobs]

        query_matched = [j for j in indeed_jobs if job_matches_query(j.title or "", j.description or "", keyword)]
        filtered = [j for j in query_matched if passes_location_filter(j, locality, location, remote_only)]

        print(f"[indeed→jsearch] Fallback returned {len(filtered)} jobs for '{keyword}'")
        return ("indeed", keyword, filtered, None)
    except Exception as exc:
        print(f"[indeed→jsearch] Fallback also failed for '{keyword}': {exc}")
        return ("indeed", keyword, [], exc)


async def _fetch_single(
    provider_name: str,
    keyword: str,
    rapidapi_key: str,
    location: str,
    remote_only: bool,
    limit: int,
    locality: str,
    limiter: ProviderRateLimiter,
    jsearch_limiter: "ProviderRateLimiter | None" = None,
    max_age_days: Optional[int] = None,
) -> tuple:
    """
    Fetch jobs from a single provider for a single keyword.
    Returns (provider_name, keyword, jobs_list, error_or_none).
    Indeed automatically falls back to JSearch on quota exhaustion.
    """
    provider = ProviderFactory.create(
        provider_name,
        api_key=rapidapi_key,
        config={}
    )
    provider.rate_limiter = limiter

    date_kwargs = build_date_kwargs(provider_name, max_age_days)

    # ZipRecruiter via JSearch has a high drop rate (too_old, no_desc) — fetch a
    # multiple of the raw jobs so survivors after filtering meet the user's limit.
    # Multiplier is configurable (PROVIDER_RAW_FETCH_MULTIPLIER) for quota control.
    raw_limit = limit * settings.PROVIDER_RAW_FETCH_MULTIPLIER if provider_name == "ziprecruiter" else limit

    all_jobs = []
    offset = 0
    max_pages = 3
    total_query_rejected = 0

    for _ in range(max_pages):
        if len(all_jobs) >= raw_limit:
            break

        # Retry once on 429 (except Indeed — fallback immediately)
        for attempt in range(2):
            try:
                jobs = await provider.search_jobs(
                    query=keyword,
                    location=location,
                    remote_only=remote_only,
                    limit=raw_limit,
                    offset=offset,
                    locality=locality,
                    **date_kwargs,
                )
                break  # success
            except IndeedQuotaError:
                # All detail fetches failed — quota exhausted, fallback to JSearch
                return await _fetch_indeed_jsearch_fallback(keyword, rapidapi_key, location, remote_only, limit, locality, jsearch_limiter, max_age_days)
            except Exception as exc:
                is_429 = "429" in str(exc) or "Too Many Requests" in str(exc)
                if is_429 and provider_name == "indeed":
                    # Indeed quota hit on search — fallback immediately, no retry
                    return await _fetch_indeed_jsearch_fallback(keyword, rapidapi_key, location, remote_only, limit, locality, jsearch_limiter, max_age_days)
                if attempt == 0 and is_429:
                    body = ""
                    if hasattr(exc, "response") and exc.response is not None:
                        try:
                            body = exc.response.text[:300]
                        except Exception:
                            pass
                    print(f"[{provider_name}] 429 on search for '{keyword}': {body or str(exc)}")
                    await asyncio.sleep(3)
                else:
                    return (provider_name, keyword, all_jobs or [], exc)
        else:
            jobs = []

        if not jobs:
            break

        # Collect query-relevant jobs — location filtering happens after all pages
        _query_rejected = 0
        for job_data in jobs:
            if len(all_jobs) >= raw_limit:
                break
            if job_matches_query(job_data.title or "", job_data.description or "", keyword):
                all_jobs.append(job_data)
            else:
                _query_rejected += 1
        total_query_rejected += _query_rejected

        offset += max(len(jobs), limit)

        if len(jobs) < limit:
            break

    # ── Location filter ─────────────────────────────────────────────────────────
    final_jobs = [j for j in all_jobs if passes_location_filter(j, locality, location, remote_only)]
    loc_rejected = len(all_jobs) - len(final_jobs)
    print(f"[{provider_name}/{keyword}] after_provider={len(all_jobs) + total_query_rejected} query_rejected={total_query_rejected} loc_rejected={loc_rejected} passing_to_save={len(final_jobs)}")

    return (provider_name, keyword, final_jobs, None)


@router.post("/fetch", response_model=FetchJobsResponse)
async def fetch_jobs(
    request: FetchJobsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_fetch_jobs"))
):
    """
    Fetch jobs from selected providers with multi-keyword support.
    All provider+keyword combinations run in PARALLEL for speed.
    Comma-separated keywords (e.g. "AI, ML, Python") create separate searches.
    """
    # Validate providers
    invalid_providers = [
        p for p in request.providers
        if not ProviderFactory.is_registered(p)
    ]
    if invalid_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid providers: {invalid_providers}. Available: {ProviderFactory.get_registered_providers()}"
        )

    # Resolve RAPIDAPI_KEY from DB (Settings page) or fall back to .env
    rapidapi_key = get_api_key("RAPIDAPI_KEY", db)
    if not rapidapi_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RAPIDAPI_KEY not configured. Please set it in the Settings page."
        )

    # Split keywords
    keywords = split_keywords(request.query)

    # Divide limit across keywords → total jobs ≈ request.limit, not limit × keywords.
    # e.g. limit=10, keywords=["AI","ML","Python"] → 4 per keyword (ceil), ~10 total.
    per_keyword_limit = math.ceil(request.limit / len(keywords)) if len(keywords) > 1 else request.limit

    # One rate limiter per provider (4 req/sec, safe under PRO 5/sec limit).
    # ZipRecruiter and the Indeed fallback both hit JSearch — share one limiter
    # so they don't collectively exceed the 5 req/sec API limit.
    limiters = {p: ProviderRateLimiter(4.0) for p in request.providers}
    jsearch_limiter = limiters.get("ziprecruiter") or ProviderRateLimiter(4.0)

    # Build parallel tasks: one per (provider × keyword)
    tasks = []
    for provider_name in request.providers:
        for keyword in keywords:
            tasks.append(
                _fetch_single(
                    provider_name=provider_name,
                    keyword=keyword,
                    rapidapi_key=rapidapi_key,
                    location=request.location,
                    remote_only=request.remote_only,
                    limit=per_keyword_limit,
                    locality=request.locality,
                    limiter=limiters[provider_name],
                    jsearch_limiter=jsearch_limiter,
                    max_age_days=request.max_age_days,
                )
            )

    # Run fetches with concurrency cap (semaphore inside each task)
    results = await asyncio.gather(*tasks)

    # Process results
    total_fetched = 0
    new_jobs = 0
    duplicate_jobs = 0
    total_no_desc = 0
    provider_errors: List[ProviderError] = []
    all_new_jobs: List[Job] = []
    seen_urls: set = set()  # in-batch dedup

    # Collect errors (deduplicate per provider)
    errored_providers = set()
    for provider_name, keyword, jobs_list, error in results:
        if error and provider_name not in errored_providers:
            # Suppress Indeed 429/rate-limit errors — the JSearch fallback already
            # attempted silently; if it also failed, the user still gets jobs from
            # other providers and seeing "Indeed 429" is just noise.
            if provider_name == "indeed":
                err_str = str(error).lower()
                if "429" in err_str or "too many requests" in err_str or "quota" in err_str or "rate" in err_str:
                    continue
            errored_providers.add(provider_name)
            provider_errors.append(_classify_error(provider_name, error))

    # Date cutoff for posted_date filtering
    age_cutoff: Optional[date] = (
        date.today() - timedelta(days=request.max_age_days)
        if request.max_age_days else None
    )

    # Process fetched jobs
    for provider_name, keyword, jobs_list, error in results:
        if error:
            continue

        total_fetched += len(jobs_list)
        _no_url = _no_desc = _too_old = _dup = _saved = 0

        for job_data in jobs_list:
            # URL is mandatory — user needs it to apply
            if not (job_data.url or "").strip():
                _no_url += 1
                continue

            # Description is mandatory — tailoring requires it.
            if not (job_data.description or "").strip():
                _no_desc += 1
                continue

            # ZipRecruiter: JSearch never returns dates — drop if still null after enrichment.
            if provider_name == "ziprecruiter" and job_data.posted_date is None:
                _too_old += 1
                continue

            # Filter by posting age — only drop jobs that have a date AND it's too old.
            # Jobs with no date from other providers are let through.
            if age_cutoff is not None:
                if job_data.posted_date is not None and job_data.posted_date < age_cutoff:
                    _too_old += 1
                    continue

            # In-batch dedup (same job from multiple keyword searches)
            if job_data.url in seen_urls:
                _dup += 1
                duplicate_jobs += 1
                continue
            seen_urls.add(job_data.url)

            # DB duplicate check — scoped per user so two users can have the same job
            existing = db.query(Job).filter(Job.url == job_data.url, Job.user_id == current_user.id).first()
            if not existing and job_data.source_job_id:
                existing = db.query(Job).filter(
                    Job.provider == job_data.provider,
                    Job.source_job_id == job_data.source_job_id,
                    Job.user_id == current_user.id,
                ).first()

            if existing:
                _dup += 1
                duplicate_jobs += 1
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
                user_id=current_user.id,
            )
            try:
                with db.begin_nested():
                    db.add(new_job)
                    db.flush()
                all_new_jobs.append(new_job)
                _saved += 1
                new_jobs += 1
            except IntegrityError:
                # Another user already has this URL — treat as duplicate, not a crash
                _dup += 1
                duplicate_jobs += 1

        total_no_desc += _no_desc
        print(f"[{provider_name}/{keyword}] received={len(jobs_list)} saved={_saved} | dropped: no_url={_no_url} no_desc={_no_desc} too_old={_too_old} dup={_dup}")

    db.commit()

    # Send Slack notification for manual fetches
    if all_new_jobs:
        slack_url = get_api_key("SLACK_WEBHOOK_URL", db)
        if slack_url:
            kw_label = ", ".join(keywords)
            label = f'"{kw_label}" via {", ".join(request.providers)}'
            await send_slack_notification(slack_url, label, all_new_jobs)

    kw_str = f" ({len(keywords)} keywords)" if len(keywords) > 1 else ""
    msg = f"Fetched {total_fetched} jobs{kw_str} — {new_jobs} new, {duplicate_jobs} already in DB"

    return FetchJobsResponse(
        message=msg,
        total_fetched=total_fetched,
        new_jobs=new_jobs,
        duplicate_jobs=duplicate_jobs,
        no_desc_dropped=total_no_desc,
        provider_errors=provider_errors,
    )


@router.get("/list")
async def list_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all registered job providers.

    Returns provider names that can be used for job fetching.
    """
    providers = ProviderFactory.get_registered_providers()

    return {
        "providers": [
            {
                "name": name,
                "display_name": name.title(),
                "is_active": True
            }
            for name in providers
        ]
    }
