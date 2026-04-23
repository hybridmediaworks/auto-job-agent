"""
backend/app/providers/glassdoor.py

Glassdoor job provider via RapidAPI (glassdoor-real-time.p.rapidapi.com).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RAPIDAPI SUBSCRIPTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Current API  : Glassdoor Real-Time by api4uPro (things4u-api4upro)
 Subscribe    : https://rapidapi.com/things4u-api4upro/api/glassdoor-real-time
 Free tier    : 100 requests/month
 Host         : glassdoor-real-time.p.rapidapi.com

 If free tier runs out and you want to switch:
   Option 1: https://rapidapi.com/ntd119/api/glassdoor-real-time4
   Option 2: https://rapidapi.com/mgujjargamingm/api/glassdoor-data-scraper
   (Update RAPIDAPI_HOST + LOCATION_URL + SEARCH_URL below)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flow:
  1. GET /jobs/location?query=<location>  → get locationId
  2. GET /jobs/search?query=<title>&locationId=<id>&...  → get job listings
"""

from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import httpx

from .base import BaseJobProvider, JobData
from app.utils.location_filter import LOCALITY_COUNTRY


GLASSDOOR_BASE_URL = "https://www.glassdoor.com"


class GlassdoorProvider(BaseJobProvider):
    """Glassdoor job provider using the glassdoor-real-time RapidAPI endpoint."""

    RAPIDAPI_HOST = "glassdoor-real-time.p.rapidapi.com"
    LOCATION_URL  = "https://glassdoor-real-time.p.rapidapi.com/jobs/location"
    SEARCH_URL    = "https://glassdoor-real-time.p.rapidapi.com/jobs/search"
    DETAIL_URL    = "https://glassdoor-real-time.p.rapidapi.com/jobs/details"

    async def search_jobs(
        self,
        query: str,
        location: str = "Remote",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        """
        Search Glassdoor jobs via RapidAPI.

        Flow:
          1. Resolve location string → locationId (unless remote_only)
          2. Search jobs with query + locationId
          3. Map nested jobview fields to JobData

        Args:
            query      : Job title / keywords
            location   : Location string (e.g. "New York")
            remote_only: If True, filters for remote jobs only (skips location lookup)
            limit      : Max jobs to return
            **kwargs   : fromAge (default 7), pageNumber (default 1), offset,
                         remoteWorkType, jobType, sortBy
        """
        headers = {
            "x-rapidapi-key":  self.api_key,
            "x-rapidapi-host": self.RAPIDAPI_HOST,
        }

        # ── Step 1: Resolve locationId ────────────────────────────────────────
        location_id = None
        location_name = location
        locality: str = kwargs.get("locality", "us")
        country_name = LOCALITY_COUNTRY.get(locality)

        if not remote_only and location and location.lower() not in ("remote", ""):
            # Non-remote search: resolve city/region to locationId
            location_id, location_name = await self._get_location_id(location, headers)
            if location_id is None:
                print(
                    f"[GlassdoorProvider] WARNING: Could not resolve locationId for "
                    f"'{location}' — search will run without location filter and may "
                    f"return results from the wrong country."
                )
        elif remote_only and country_name:
            # Remote search with a country selected: scope to that country so we
            # don't get globally-unfiltered results (Glassdoor defaults to US otherwise)
            location_id, location_name = await self._get_location_id(country_name, headers)
            if location_id is None:
                print(
                    f"[GlassdoorProvider] WARNING: Could not resolve locationId for "
                    f"country '{country_name}' — remote results will not be country-filtered."
                )

        # ── Step 2: Build search params ───────────────────────────────────────
        # Convert offset → pageNumber (Glassdoor uses 1-based page numbers)
        offset = int(kwargs.get("offset", 0))
        page_number = kwargs.get("pageNumber") or (offset // limit + 1)

        params: Dict[str, Any] = {
            "query":    query,
            "fromAge":  str(kwargs.get("fromAge", 7)),  # days: 1,3,7,14,30,-1
            "sortBy":   kwargs.get("sortBy", "date_desc"),
        }

        if location_id:
            params["locationId"] = location_id

        if remote_only:
            params["remoteWorkType"] = "1"   # 1 = remote only

        if page_number > 1:
            params["pageNumber"] = str(page_number)

        if kwargs.get("jobType"):
            params["jobType"] = kwargs["jobType"]

        # ── Step 3: Fetch search results ──────────────────────────────────────
        async with httpx.AsyncClient(timeout=30.0) as client:
            await self.rate_limiter.acquire()
            response = await client.get(
                self.SEARCH_URL,
                headers=headers,
                params=params,
            )
            if response.status_code != 200:
                print(f"[GlassdoorProvider] Search {response.status_code} for '{query}': {response.text[:300]}")
            response.raise_for_status()
            data = response.json()

        listings = (data.get("data") or {}).get("jobListings", [])
        print(f"[GlassdoorProvider] API returned {len(listings)} jobs for '{query}' (requested {limit})")

        # Only fetch details for the jobs we need — trust remoteWorkType=1 API param
        listings_to_fetch = listings[:limit]

        # ── Step 4: Fetch job details for descriptions ────────────────────────
        details_list = await self._fetch_details_batch(listings_to_fetch, headers)

        # ── Step 5: Map to JobData ────────────────────────────────────────────
        jobs: List[JobData] = []
        for raw, detail in zip(listings_to_fetch, details_list):
            try:
                job = self.map_fields(raw, detail=detail, location_name=location_name, remote_only=remote_only)
                jobs.append(job)
            except Exception as exc:
                listing_id = raw.get("jobview", {}).get("job", {}).get("listingId")
                print(f"[GlassdoorProvider] Error mapping job {listing_id}: {exc}")

        print(f"[GlassdoorProvider] Returning {len(jobs)} jobs")
        return jobs

    # ── Detail fetching ───────────────────────────────────────────────────────

    async def _fetch_details_batch(
        self,
        listings: List[Dict],
        headers: Dict[str, str],
    ) -> List[Optional[Dict]]:
        """
        Fetch detail pages for all listings concurrently.
        Semaphore limits concurrency to 3 to avoid Glassdoor burst detection.
        Rate limiter handles per-second throttling on top of that.
        """
        sem = asyncio.Semaphore(3)

        async def _limited(raw: Dict) -> Optional[Dict]:
            async with sem:
                listing_id = raw.get("jobview", {}).get("job", {}).get("listingId")
                query_str  = raw.get("jobview", {}).get("job", {}).get("queryString", "")
                return await self._fetch_one_detail(client, listing_id, query_str, headers)

        async with httpx.AsyncClient(timeout=30.0) as client:
            return await asyncio.gather(*[_limited(raw) for raw in listings])

    async def _fetch_one_detail(
        self,
        client: httpx.AsyncClient,
        listing_id: Any,
        query_string: str,
        headers: Dict[str, str],
    ) -> Optional[Dict]:
        """Fetch a single job detail including description; retries once on 429."""
        if not listing_id:
            return None
        for attempt in range(2):
            try:
                await self.rate_limiter.acquire()
                resp = await client.get(
                    self.DETAIL_URL,
                    headers=headers,
                    params={"listingId": str(listing_id), "queryString": query_string},
                )
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 429 and attempt == 0:
                    print(f"[GlassdoorProvider] Detail 429 for {listing_id}, retrying in 8s...")
                    await asyncio.sleep(8.0)
                    continue
                print(f"[GlassdoorProvider] Detail {resp.status_code} for {listing_id}: {resp.text[:200]}")
                return None
            except Exception as exc:
                print(f"[GlassdoorProvider] Detail fetch failed for {listing_id}: {exc}")
                return None
        return None

    # ── Location helper ───────────────────────────────────────────────────────

    async def _get_location_id(
        self,
        location: str,
        headers: Dict[str, str],
    ) -> tuple:
        """
        Look up Glassdoor locationId for a location string.

        Returns (locationId, locationName) — falls back to (None, original_string)
        if lookup fails or returns no results.
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                await self.rate_limiter.acquire()
                resp = await client.get(
                    self.LOCATION_URL,
                    headers=headers,
                    params={"query": location},
                )
            if resp.status_code != 200:
                print(f"[GlassdoorProvider] Location {resp.status_code} for '{location}': {resp.text[:200]}")
            if resp.status_code == 200:
                results = resp.json().get("data", [])
                if results:
                    # For country-level queries prefer nation "N", then state "S", then city "C"
                    # This prevents matching e.g. "United States Coast Guard - Air Station..." (type C)
                    # when searching for "United States" (should match type N = nation)
                    picked = (
                        next((r for r in results if r.get("locationType") == "N"), None)
                        or next((r for r in results if r.get("locationType") == "S"), None)
                        or next((r for r in results if r.get("locationType") == "C"), None)
                        or results[0]
                    )
                    loc_id   = picked.get("locationId")
                    loc_name = picked.get("locationName", location)
                    print(f"[GlassdoorProvider] Resolved '{location}' -> locationId={loc_id} ({loc_name})")
                    return loc_id, loc_name
        except Exception as exc:
            print(f"[GlassdoorProvider] Location lookup failed for '{location}': {exc}")

        return None, location

    # ── Field mapping ─────────────────────────────────────────────────────────

    def map_fields(
        self,
        raw: Dict[str, Any],
        detail: Optional[Dict] = None,
        location_name: str = "",
        remote_only: bool = False,
    ) -> JobData:
        """
        Map a Glassdoor jobview record to unified JobData.

        Key nested paths:
          jobview.header.employer.name           → company (more accurate)
          jobview.header.ageInDays               → posted_date
          jobview.header.locationName            → location
          jobview.header.jobViewUrl              → url (relative → absolute)
          jobview.header.payPeriod               → salary period
          jobview.header.payPeriodAdjustedPay    → p10/p50/p90 salary
          jobview.header.payCurrency             → salary currency
          jobview.header.indeedJobAttribute      → job_type, remote_type, skills
          jobview.job.jobTitleText               → title
          jobview.job.listingId                  → source_job_id
          detail response                        → description
        """
        jobview = raw.get("jobview", {})
        header  = jobview.get("header", {})
        job     = jobview.get("job", {})

        # ── Title & Company ───────────────────────────────────────────────────
        title   = job.get("jobTitleText", "")
        # employer.name is more accurate than employerNameFromSearch
        employer = header.get("employer") or {}
        company  = employer.get("name") or header.get("employerNameFromSearch", "")

        # ── URL ───────────────────────────────────────────────────────────────
        job_view_url = header.get("jobViewUrl", "")
        listing_id   = job.get("listingId")
        if job_view_url:
            url = f"{GLASSDOOR_BASE_URL}{job_view_url}"
        elif listing_id:
            url = f"{GLASSDOOR_BASE_URL}/job-listing/jl_{listing_id}.htm"
        else:
            url = ""

        # ── Job attributes (job_type, remote_type) from indeedJobAttribute ────
        attrs = _extract_attributes(header.get("indeedJobAttribute"))
        job_type    = attrs.get("job_type")
        remote_attr = attrs.get("remote_type")  # "remote" / "hybrid" / None

        # ── Location & Remote ─────────────────────────────────────────────────
        loc_from_api = header.get("locationName", "")
        location_str = loc_from_api or location_name or "Not specified"

        if remote_only or remote_attr == "remote":
            remote_type = "remote"
        elif remote_attr == "hybrid":
            remote_type = "hybrid"
        elif "remote" in location_str.lower() or "remote" in title.lower():
            remote_type = "remote"
        elif "hybrid" in title.lower():
            remote_type = "hybrid"
        else:
            remote_type = "on-site"

        # ── Salary ────────────────────────────────────────────────────────────
        currency = header.get("payCurrency") or "USD"
        salary_min, salary_max = _parse_salary(
            header.get("payPeriodAdjustedPay"),
            header.get("payPeriod"),
        )

        # ── Posted date ───────────────────────────────────────────────────────
        age_in_days = header.get("ageInDays")
        if age_in_days is not None:
            try:
                posted_date = date.today() - timedelta(days=int(age_in_days))
            except (ValueError, TypeError):
                posted_date = None
        else:
            posted_date = None

        # ── Description (from detail API) ─────────────────────────────────────
        description = _extract_description(detail)

        return JobData(
            title=title,
            company=company,
            location=location_str,
            description=description,
            url=url,
            source_job_id=str(listing_id) if listing_id else "",
            provider="glassdoor",
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=currency,
            job_type=job_type,
            remote_type=remote_type,
            posted_date=posted_date,
            raw_data=raw,
        )


# ── Helpers ────────────────────────────────────────────────────────────────────


def _extract_description(detail: Optional[Dict]) -> str:
    """
    Extract job description from Glassdoor /jobs/details API response.

    Response structure: { "data": { "job": { "description": "<html>..." } } }
    Converts block-level tags to newlines to preserve structure.
    """
    if not detail:
        return ""
    data = detail.get("data") or {}
    raw_desc = (data.get("job") or {}).get("description") or ""
    if not raw_desc:
        return ""
    import re
    text = str(raw_desc)
    # Convert block-level tags to newlines to preserve structure
    text = re.sub(r"<(?:br|p|div|li|ul|ol|h[1-6]|tr)[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
    text = re.sub(r"[ \t]+", " ", text)          # collapse horizontal whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)        # max 2 consecutive blank lines
    return text.strip()


def _extract_attributes(indeed_attr: Optional[Dict]) -> Dict[str, Optional[str]]:
    """
    Extract job_type and remote_type from indeedJobAttribute.extractedJobAttributes.

    The attributes array has {key, value} pairs where value is human-readable.
    Known job-type values: "Full-time", "Part-time", "Contract", "Internship", "Temporary"
    Known remote values:   "Remote", "Hybrid work"
    """
    result: Dict[str, Optional[str]] = {"job_type": None, "remote_type": None}
    if not indeed_attr:
        return result

    attrs = indeed_attr.get("extractedJobAttributes") or []

    JOB_TYPE_MAP = {
        "full-time":   "full-time",
        "fulltime":    "full-time",
        "part-time":   "part-time",
        "parttime":    "part-time",
        "contract":    "contract",
        "internship":  "internship",
        "temporary":   "temporary",
        "freelance":   "contract",
    }
    REMOTE_MAP = {
        "remote":      "remote",
        "hybrid work": "hybrid",
        "hybrid":      "hybrid",
        "on-site":     "on-site",
        "on site":     "on-site",
    }

    for attr in attrs:
        value_lower = (attr.get("value") or "").lower()
        if result["job_type"] is None and value_lower in JOB_TYPE_MAP:
            result["job_type"] = JOB_TYPE_MAP[value_lower]
        if result["remote_type"] is None and value_lower in REMOTE_MAP:
            result["remote_type"] = REMOTE_MAP[value_lower]

    return result


def _parse_salary(
    pay_adj: Optional[Dict],
    pay_period: Optional[str],
) -> tuple:
    """
    Parse Glassdoor salary from payPeriodAdjustedPay percentiles.

    payPeriodAdjustedPay: {"p10": 50000, "p50": 70000, "p90": 90000}
    payPeriod: "MONTHLY" | "YEARLY" | "HOURLY" | null

    Uses p10 as salary_min and p90 as salary_max.
    Converts MONTHLY → annual (×12), HOURLY → annual (×2080).
    Returns (None, None) if no salary data.
    """
    if not pay_adj:
        return None, None

    raw_min = pay_adj.get("p10")
    raw_max = pay_adj.get("p90")

    # 0 means not provided
    if not raw_min or raw_min <= 0:
        raw_min = None
    if not raw_max or raw_max <= 0:
        raw_max = None

    if raw_min is None and raw_max is None:
        return None, None

    period = (pay_period or "YEARLY").upper()
    if period == "MONTHLY":
        multiplier = 12
    elif period == "HOURLY":
        multiplier = 2080
    else:
        multiplier = 1

    sal_min = int(raw_min * multiplier) if raw_min is not None else None
    sal_max = int(raw_max * multiplier) if raw_max is not None else None
    return sal_min, sal_max
