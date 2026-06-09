"""
backend/app/providers/ziprecruiter.py

ZipRecruiter job provider via JSearch aggregator.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RAPIDAPI SUBSCRIPTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Current API  : JSearch by OpenWeb Ninja (letscrape-6bRBa3QguO5)
 Subscribe    : https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 Free tier    : 200 requests/month
 Host         : jsearch.p.rapidapi.com
 NOTE: ZipRecruiter uses JSearch with "via ziprecruiter" query suffix.
       LinkedIn also shares this same JSearch subscription.

 If free tier runs out and you want to switch:
   Option 1 (upgrade same): https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (paid plans)
   Option 2: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch-mega
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Since the standalone ZipRecruiter API on RapidAPI is often unreliable,
this provider uses the JSearch (Google Jobs) aggregator with the
"via ziprecruiter" search operator to reliably fetch ZipRecruiter jobs.
"""

import asyncio
import json
import re
from datetime import date, datetime
from typing import List, Dict, Any

import httpx

from .jsearch import JSearchProvider, JobData
from app.config import settings


class ZipRecruiterProvider(JSearchProvider):
    """
    ZipRecruiter job provider via JSearch.

    Automatically appends "via ziprecruiter" to the search query.
    """

    def __init__(self, api_key: str, config: Dict[str, Any] = None):
        """
        Initialize ZipRecruiter provider with automatic JSearch suffix.
        """
        config = config or {}
        # Force the JSearch "via ziprecruiter" operator
        config["query_suffix"] = "via ziprecruiter"
        super().__init__(api_key=api_key, config=config)

    def get_provider_name(self) -> str:
        """Explicitly return 'ziprecruiter' for proper identification."""
        return "ziprecruiter"

    async def _scrape_date_from_url(self, job_url: str) -> date | None:
        """Try to extract datePosted from JSON-LD structured data in the job page HTML."""
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(job_url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code != 200:
                    return None
                matches = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', resp.text, re.DOTALL)
                for m in matches:
                    try:
                        data = json.loads(m)
                        items = data if isinstance(data, list) else [data]
                        for item in items:
                            dp = item.get("datePosted")
                            if dp:
                                return datetime.fromisoformat(dp[:10]).date()
                    except Exception:
                        continue
        except Exception:
            pass
        return None

    async def search_jobs(
        self,
        query: str,
        location: str = "Remote",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        """
        Search for jobs on ZipRecruiter using JSearch aggregator.
        For jobs where JSearch returns null posted_date, fetch the date via
        the /job-details endpoint (one extra API call per null-date job).
        """
        jobs = await super().search_jobs(
            query=query,
            location=location,
            remote_only=remote_only,
            limit=limit,
            **kwargs
        )

        # Concurrently enrich jobs missing date or description via /job-details
        needs_enrich = [
            i for i, j in enumerate(jobs)
            if j.source_job_id and (j.posted_date is None or not (j.description or "").strip())
        ]
        if not needs_enrich:
            return jobs

        # Quota control: each enrichment is up to 2 extra RapidAPI/HTTP calls, so cap
        # how many jobs we enrich per search instead of enriching the whole page.
        if len(needs_enrich) > settings.ZIPRECRUITER_MAX_ENRICH:
            print(f"[ziprecruiter] Capping enrichment from {len(needs_enrich)} to {settings.ZIPRECRUITER_MAX_ENRICH} jobs (quota control)")
            needs_enrich = needs_enrich[:settings.ZIPRECRUITER_MAX_ENRICH]

        print(f"[ziprecruiter] Enriching {len(needs_enrich)} jobs (missing date/description) via /job-details")

        async def enrich(i: int) -> None:
            extra = await self._fetch_job_details(jobs[i].source_job_id)
            if extra:
                updates = {}
                if "posted_date" in extra and jobs[i].posted_date is None:
                    updates["posted_date"] = extra["posted_date"]
                if "description" in extra and not (jobs[i].description or "").strip():
                    updates["description"] = extra["description"]
                if updates:
                    jobs[i] = jobs[i].model_copy(update=updates)
                    print(f"[ziprecruiter] Enriched '{jobs[i].title}': {list(updates.keys())}")

            # If date still null after /job-details, optionally scrape JSON-LD from the
            # job URL (live HTML fetch — disable via ZIPRECRUITER_SCRAPE_DATES to save quota/time).
            if settings.ZIPRECRUITER_SCRAPE_DATES and jobs[i].posted_date is None and (jobs[i].url or "").strip():
                scraped_date = await self._scrape_date_from_url(jobs[i].url)
                if scraped_date:
                    jobs[i] = jobs[i].model_copy(update={"posted_date": scraped_date})
                    print(f"[ziprecruiter] Scraped date for '{jobs[i].title}': {scraped_date}")

        await asyncio.gather(*[enrich(i) for i in needs_enrich])
        return jobs
