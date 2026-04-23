"""
backend/app/providers/indeed.py

Indeed job provider via RapidAPI (indeed12.p.rapidapi.com).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RAPIDAPI SUBSCRIPTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Current API  : Indeed12 by Mantiks
 Subscribe    : https://rapidapi.com/mantiks-mantiks-default/api/indeed12
 Free tier    : 500 requests/month
 Host         : indeed12.p.rapidapi.com

 If free tier runs out and you want to switch:
   Option 1: Use JSearch (covers Indeed via Google Jobs)
             https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
   (Update RAPIDAPI_HOST + RAPIDAPI_SEARCH_URL + RAPIDAPI_DETAIL_URL below)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from datetime import date, timedelta, datetime
from typing import List, Dict, Any, Optional
import asyncio
import re
import httpx

from .base import BaseJobProvider, JobData


class IndeedQuotaError(Exception):
    """Raised when Indeed hourly quota is exhausted (got hits but all detail fetches failed)."""
    pass


INDEED_BASE_URL = "https://www.indeed.com"

# Maps location keywords -> Indeed locality (country) code
_LOCALITY_MAP = [
    (['canada'],                                     'ca'),
    (['united kingdom', 'uk', 'england',
      'scotland', 'wales', 'britain'],               'gb'),
    (['australia'],                                  'au'),
    (['new zealand'],                                'nz'),
    (['germany', 'deutschland'],                     'de'),
    (['france'],                                     'fr'),
    (['netherlands', 'holland'],                     'nl'),
    (['spain'],                                      'es'),
    (['italy'],                                      'it'),
    (['india'],                                      'in'),
    (['singapore'],                                  'sg'),
    (['brazil'],                                     'br'),
    (['mexico'],                                     'mx'),
    (['united arab emirates', 'uae', 'dubai'],       'ae'),
    (['south africa'],                               'za'),
    (['pakistan'],                                   'pk'),
    (['nigeria'],                                    'ng'),
]


# Maps locality code → correct salary currency for that country
_LOCALITY_CURRENCY: Dict[str, str] = {
    'ca': 'CAD', 'gb': 'GBP', 'au': 'AUD', 'nz': 'NZD',
    'de': 'EUR', 'fr': 'EUR', 'nl': 'EUR', 'es': 'EUR',
    'in': 'INR', 'sg': 'SGD', 'ae': 'AED', 'pk': 'PKR',
}


def _detect_locality(location: str) -> str:
    loc = (location or '').lower().strip()
    for keywords, code in _LOCALITY_MAP:
        if any(k in loc for k in keywords):
            return code
    return 'us'



class IndeedProvider(BaseJobProvider):
    """Indeed job provider using the indeed12 RapidAPI endpoint."""

    RAPIDAPI_HOST = "indeed12.p.rapidapi.com"
    RAPIDAPI_SEARCH_URL = "https://indeed12.p.rapidapi.com/jobs/search"
    RAPIDAPI_DETAIL_URL = "https://indeed12.p.rapidapi.com/job/{job_id}"

    async def search_jobs(
        self,
        query: str,
        location: str = "Remote",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        """
        Search Indeed jobs via RapidAPI, then fetch full details concurrently.

        Args:
            query      : Job title / keywords
            location   : Location string (e.g. "Chicago, IL")
            remote_only: If True, sets remotejob=1
            limit      : Max jobs to return
            **kwargs   : locality (default "us"), fromage (valid: 1,3,7,14; default 7),
                         radius (miles, default 50), sort, page_id, offset
        """
        headers = {
            "x-rapidapi-key":  self.api_key,
            "x-rapidapi-host": self.RAPIDAPI_HOST,
        }

        # Convert offset → page_id (API uses 1-based pages, ~15 results per page)
        offset = int(kwargs.get("offset", 0))
        page_id = kwargs.get("page_id") or (offset // 15 + 1)

        params: Dict[str, Any] = {
            "query":    query,
            "location": "Remote" if remote_only else location,
            "page_id":  str(page_id),
            "locality": kwargs.get("locality") or _detect_locality(location),
            "fromage":  str(kwargs.get("fromage", 7)),
            "radius":   str(kwargs.get("radius", 50)),
            "sort":     kwargs.get("sort", "date"),
        }

        if remote_only:
            params["remotejob"] = "1"

        if kwargs.get("job_type"):
            params["job_type"] = kwargs["job_type"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            await self.rate_limiter.acquire()
            response = await client.get(
                self.RAPIDAPI_SEARCH_URL,
                headers=headers,
                params=params,
            )
            if response.status_code != 200:
                print(f"[IndeedProvider] Search {response.status_code} for '{query}': {response.text[:300]}")
            response.raise_for_status()
            data = response.json()

        hits = data.get("hits", [])
        print(f"[IndeedProvider] API returned {len(hits)} jobs for '{query}' (requested {limit})")

        hits = hits[:limit]

        # Fetch job details concurrently (for description, job_type, accurate company)
        locality = params["locality"]
        details_list = await self._fetch_details_batch(hits, locality, headers)

        jobs: List[JobData] = []
        for raw, detail in zip(hits, details_list):
            if detail is None:
                print(f"[IndeedProvider] Skipping job {raw.get('id')} — detail fetch failed, no description")
                continue
            try:
                jobs.append(self.map_fields(raw, detail=detail, locality=locality))
            except Exception as exc:
                print(f"[IndeedProvider] Error mapping job {raw.get('id')}: {exc}")

        print(f"[IndeedProvider] Returning {len(jobs)} jobs")

        # If search returned hits but every detail call failed, quota is likely exhausted
        if len(hits) > 0 and len(jobs) == 0:
            raise IndeedQuotaError(f"Got {len(hits)} hits but all detail fetches failed — quota likely exhausted")

        return jobs

    # ── Detail fetching ───────────────────────────────────────────────────────

    async def _fetch_details_batch(
        self,
        hits: List[Dict],
        locality: str,
        headers: Dict[str, str],
    ) -> List[Optional[Dict]]:
        """
        Fetch detail pages for all hits concurrently.
        Rate limiting is handled by self.rate_limiter — no manual batching needed.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [
                self._fetch_one_detail(client, raw.get("id", ""), locality, headers)
                for raw in hits
            ]
            return await asyncio.gather(*tasks)

    async def _fetch_one_detail(
        self,
        client: httpx.AsyncClient,
        job_id: str,
        locality: str,
        headers: Dict[str, str],
    ) -> Optional[Dict]:
        """Fetch a single job detail page."""
        if not job_id:
            return None
        try:
            await self.rate_limiter.acquire()
            url = self.RAPIDAPI_DETAIL_URL.format(job_id=job_id)
            resp = await client.get(url, headers=headers, params={"locality": locality})
            if resp.status_code == 200:
                return resp.json()
            print(f"[IndeedProvider] Detail {resp.status_code} for {job_id}: {resp.text[:200]}")
            return None
        except Exception as exc:
            print(f"[IndeedProvider] Detail fetch failed for {job_id}: {repr(exc)}")
            return None

    # ── Field mapping ─────────────────────────────────────────────────────────

    def map_fields(
        self,
        raw: Dict[str, Any],
        detail: Optional[Dict] = None,
        locality: str = "us",
    ) -> JobData:
        """
        Map Indeed search result + detail to unified JobData.

        Search fields:  company_name, id, title, location, link,
                        pub_date_ts_milli, salary, formatted_relative_time
        Detail fields:  apply_url, company.name, description (HTML),
                        job_type, salary (more reliable)
        """
        detail = detail or {}

        # ── URL ──────────────────────────────────────────────────────────────
        apply_url = detail.get("apply_url", "")
        link = raw.get("link", "")
        if apply_url:
            url = apply_url
        elif link.startswith("/"):
            url = f"{INDEED_BASE_URL}{link}"
        elif link.startswith("http"):
            url = link
        else:
            url = f"{INDEED_BASE_URL}/job/{raw.get('id', '')}?locality={locality}"

        # ── Company ──────────────────────────────────────────────────────────
        detail_company = (detail.get("company") or {}).get("name", "")
        company = detail_company or raw.get("company_name", "")

        # ── Title ────────────────────────────────────────────────────────────
        title = raw.get("title", "")

        # ── Location & Remote ────────────────────────────────────────────────
        location_str = raw.get("location") or detail.get("location") or "Not specified"
        is_remote = (
            "remote" in location_str.lower()
            or "remote" in title.lower()
            or "hybrid" in title.lower()
        )
        remote_type = "remote" if is_remote else "on-site"

        # ── Description (strip HTML from detail) ─────────────────────────────
        description_html = detail.get("description", "")
        description = _strip_html(description_html) if description_html else ""

        # ── Job type (from detail, e.g. "Full-time") ─────────────────────────
        job_type_raw = detail.get("job_type", "")
        job_type = _normalize_job_type(job_type_raw) if job_type_raw else None

        # ── Salary (prefer detail, fallback to search) ────────────────────────
        salary_data = detail.get("salary") or raw.get("salary")
        salary_min, salary_max = _parse_salary(salary_data)

        # ── Posted date ───────────────────────────────────────────────────────
        ts_milli = raw.get("pub_date_ts_milli")
        if ts_milli:
            try:
                posted_date = datetime.fromtimestamp(ts_milli / 1000).date()
            except Exception:
                posted_date = _parse_relative_time(raw.get("formatted_relative_time"))
        else:
            posted_date = _parse_relative_time(raw.get("formatted_relative_time"))

        return JobData(
            title=title,
            company=company,
            location=location_str,
            description=description,
            url=url,
            source_job_id=raw.get("id", ""),
            provider="indeed",
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=_LOCALITY_CURRENCY.get(locality, "USD"),
            job_type=job_type,
            remote_type=remote_type,
            posted_date=posted_date,
            raw_data=raw,
        )


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_salary(salary: Optional[Dict]) -> tuple:
    """
    Parse Indeed salary: {"min": 45000, "max": 100000, "type": "YEARLY"/"HOURLY"}
    -1 means not provided in some responses.
    Returns (salary_min, salary_max) as annual integers.
    """
    if not salary:
        return None, None

    raw_min = salary.get("min")
    raw_max = salary.get("max")
    unit = (salary.get("type") or "YEARLY").upper()

    if raw_min is not None and raw_min < 0:
        raw_min = None
    if raw_max is not None and raw_max < 0:
        raw_max = None

    multiplier = 2080 if unit == "HOURLY" else 1

    sal_min = int(raw_min * multiplier) if raw_min is not None else None
    sal_max = int(raw_max * multiplier) if raw_max is not None else None
    return sal_min, sal_max


def _strip_html(html: str) -> str:
    """Strip HTML tags, returning clean plain text."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _normalize_job_type(job_type: str) -> Optional[str]:
    """Normalize Indeed job_type string to our convention."""
    mapping = {
        "full-time":  "full-time",
        "fulltime":   "full-time",
        "part-time":  "part-time",
        "parttime":   "part-time",
        "contract":   "contract",
        "contractor": "contract",
        "temporary":  "temporary",
        "internship": "internship",
        "volunteer":  "volunteer",
    }
    return mapping.get((job_type or "").lower().replace(" ", "-"), job_type.lower() if job_type else None)


def _parse_relative_time(text: Optional[str]) -> Optional[date]:
    """Convert 'N days ago' to an estimated date."""
    if not text:
        return None
    text = text.lower().strip()
    try:
        if "just posted" in text or "today" in text:
            return date.today()
        if "hour" in text:
            return date.today()
        if "day" in text:
            num_str = text.split()[0].replace("+", "")
            return date.today() - timedelta(days=int(num_str))
    except (ValueError, IndexError):
        pass
    return None
