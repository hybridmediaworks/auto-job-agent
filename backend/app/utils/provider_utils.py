"""
backend/app/utils/provider_utils.py

Shared utilities for job provider logic.

Used by both routers/providers.py and services/scheduler.py so that manual
fetches and scheduled searches behave identically — same rate limiting, same
keyword splitting, same relevance filtering, same date-range translation.
"""

import asyncio
import re
import time
from typing import List, Optional


# ── Rate limiter ───────────────────────────────────────────────────────────────

class ProviderRateLimiter:
    """
    Per-provider async rate limiter.

    Caps request rate to max_per_second across all concurrent tasks that share
    the same instance.  PRO plans on RapidAPI are typically 5 req/sec; we use 4
    to stay comfortably under the limit.
    """

    def __init__(self, rate_per_second: float = 4.0) -> None:
        self._interval = 1.0 / rate_per_second
        self._lock = asyncio.Lock()
        self._last_call: float = 0.0

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = self._interval - (now - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()


# ── Query relevance filtering ─────────────────────────────────────────────────

# Words that alone don't identify a job speciality — ignored when deciding
# whether a result matches the user's intent.
GENERIC_JOB_WORDS: frozenset = frozenset({
    "developer", "engineer", "manager", "lead", "senior", "junior", "sr",
    "jr", "staff", "remote", "head", "director", "associate", "principal",
    "architect", "specialist", "analyst", "consultant", "coordinator",
    "expert", "professional", "mid", "entry", "level", "full", "stack",
    "backend", "frontend", "software", "it", "tech", "technical",
    "the", "and", "or", "for", "with", "in", "at", "of",
})


def split_keywords(query: str) -> List[str]:
    """
    Split a comma-separated query into individual keywords.

        "AI, ML, Python"      → ["AI", "ML", "Python"]
        "WordPress Developer" → ["WordPress Developer"]
    """
    if "," in query:
        parts = [k.strip() for k in query.split(",") if k.strip()]
        return parts if parts else [query]
    return [query]


def job_matches_query(title: str, description: str, query: str) -> bool:
    """
    Return True if the job is relevant to the search query.

    Strips generic job words (developer, engineer, etc.) to find the actual
    specialty terms.  If nothing remains after stripping, every job passes
    (e.g. query = "software engineer" has no specialty terms — can't filter).

    Checks title first, then description (first 400 chars).
    Uses word-boundary matching so 'python' won't match 'cpython', and
    'automation' in a company name like 'Automation Corp' won't match a
    'Cleaner' job just because the company name appears in the description.
    Even 1 key term matching (in title OR description) is enough to pass.
    """
    words = [re.sub(r"[^a-zA-Z0-9_]", "", w).lower() for w in query.split()]
    key_terms = [w for w in words if len(w) > 2 and w not in GENERIC_JOB_WORDS]
    if not key_terms:
        return True

    title_lower = (title or "").lower()
    desc_lower = (description or "")[:400].lower()

    for term in key_terms:
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, title_lower) or re.search(pattern, desc_lower):
            return True
    return False


# ── Date-range kwargs ─────────────────────────────────────────────────────────

def build_date_kwargs(provider_name: str, max_age_days: Optional[int]) -> dict:
    """
    Translate max_age_days into each provider's native date-filter parameter.

    JSearch / ZipRecruiter  → date_posted : "today" | "3days" | "week" | "month"
    Indeed                  → fromage     : 1 | 3 | 7 | 14
    Glassdoor               → fromAge     : 1 | 3 | 7 | 14 | 30
    LinkedIn                → (no native param — post-filter by posted_date only)
    """
    if not max_age_days:
        return {}

    if provider_name == "jsearch":
        if max_age_days <= 1:
            dp = "today"
        elif max_age_days <= 3:
            dp = "3days"
        elif max_age_days <= 7:
            dp = "week"
        else:
            dp = "month"
        return {"date_posted": dp}

    # ZipRecruiter has a sparse index in JSearch — passing date_posted=3days/today
    # returns 0 results. Skip API-level date filtering; age_cutoff in providers.py
    # enforces the date requirement via the posted_date field after fetch.
    if provider_name == "ziprecruiter":
        return {}

    if provider_name == "indeed":
        if max_age_days <= 1:
            fa = 1
        elif max_age_days <= 3:
            fa = 3
        elif max_age_days <= 7:
            fa = 7
        else:
            fa = 14
        return {"fromage": fa}

    if provider_name == "glassdoor":
        if max_age_days <= 1:
            fa = 1
        elif max_age_days <= 3:
            fa = 3
        elif max_age_days <= 7:
            fa = 7
        elif max_age_days <= 14:
            fa = 14
        else:
            fa = 30
        return {"fromAge": fa}

    return {}
