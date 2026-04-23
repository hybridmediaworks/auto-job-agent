"""
backend/app/providers/linkedin.py

LinkedIn job provider via RapidAPI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RAPIDAPI SUBSCRIPTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Current API  : LinkedIn Job Search API by Fantastic.Jobs
 Subscribe    : https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api
 Free tier    : 100 requests/month
 Host         : linkedin-job-search-api.p.rapidapi.com
 Endpoint     : /active-jb-7d

 If free tier runs out and you want to switch:
   Option 1: https://rapidapi.com/jaypat87/api/linkedin-jobs-search
             (Host: linkedin-jobs-search.p.rapidapi.com)
   Option 2: https://rapidapi.com/mgujjargamingm/api/linkedin-bulk-data-scraper
             (Host: linkedin-bulk-data-scraper.p.rapidapi.com)
   NOTE: Switching requires updating RAPIDAPI_HOST + RAPIDAPI_ENDPOINT
         + map_fields() below to match the new API's response structure.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Response fields mapped:
  id                → source_job_id
  title             → title
  organization      → company
  url               → url
  locations_derived → location
  description_text  → description
  salary_raw        → salary_min / salary_max / salary_currency
  employment_type   → job_type
  remote_derived    → remote_type
  date_posted       → posted_date
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx

from .base import BaseJobProvider, JobData
from app.utils.location_filter import LOCALITY_COUNTRY


class LinkedInProvider(BaseJobProvider):
    """
    LinkedIn job provider using the LinkedIn Job Search API on RapidAPI.
    Subscribe at: https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api
    """

    RAPIDAPI_HOST = "linkedin-job-search-api.p.rapidapi.com"
    RAPIDAPI_ENDPOINT = "https://linkedin-job-search-api.p.rapidapi.com/active-jb-7d"

    async def search_jobs(
        self,
        query: str,
        location: str = "United States",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        headers = {
            "x-rapidapi-key":  self.api_key,
            "x-rapidapi-host": self.RAPIDAPI_HOST,
        }

        # Split multi-term queries (e.g. "AI, ML, Python") into OR-joined terms
        # so LinkedIn doesn't do an exact phrase match on the whole string
        raw_terms = [t.strip() for t in query.replace(",", " ").split() if len(t.strip()) > 1]
        if len(raw_terms) == 1:
            title_filter = f'"{raw_terms[0]}"'
        else:
            title_filter = " OR ".join(f'"{t}"' for t in raw_terms)
        locality: str = kwargs.get("locality", "us")
        country = LOCALITY_COUNTRY.get(locality)

        if remote_only:
            if country:
                # Scope remote results to the selected country instead of worldwide
                location_filter = f'"{country}" OR "Remote" OR "Worldwide"'
            else:
                location_filter = (
                    '"United States" OR "United Kingdom" OR "Remote" OR '
                    '"Canada" OR "Australia" OR "Europe" OR "Worldwide"'
                )
        elif location and location.lower() not in ("remote", ""):
            if country and country.lower() not in location.lower():
                # Scope to the selected country: prefer "City, Country" to avoid
                # ambiguous city names (e.g. Toronto, OH vs Toronto, Canada)
                location_filter = f'"{location}, {country}"'
            else:
                location_filter = f'"{location}"'
        else:
            if country:
                location_filter = f'"{country}" OR "Remote"'
            else:
                location_filter = '"United States" OR "Remote"'

        fetch_limit = min(limit * 2, 100)

        params: Dict[str, Any] = {
            "limit":            str(fetch_limit),
            "offset":           str(kwargs.get("offset", 0)),
            "title_filter":     title_filter,
            "location_filter":  location_filter,
            "description_type": kwargs.get("description_type", "text"),
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            await self.rate_limiter.acquire()
            response = await client.get(
                self.RAPIDAPI_ENDPOINT,
                headers=headers,
                params=params,
            )
            if response.status_code != 200:
                print(f"[LinkedInProvider] Search {response.status_code} for '{query}': {response.text[:300]}")
            response.raise_for_status()
            data = response.json()

        raw_jobs = data if isinstance(data, list) else data.get("data", [])
        print(f"[LinkedInProvider] API returned {len(raw_jobs)} raw jobs for '{query}' (requested {limit})")

        jobs: List[JobData] = []
        for raw in raw_jobs:
            if len(jobs) >= limit:
                break
            try:
                job = self.map_fields(raw)
                jobs.append(job)
            except Exception as exc:
                print(f"[LinkedInProvider] Error mapping job {raw.get('id')}: {exc}")

        print(f"[LinkedInProvider] Returning {len(jobs)} jobs")
        return jobs

    def map_fields(self, raw: Dict[str, Any]) -> JobData:
        is_remote = raw.get("remote_derived", False)
        location_type = (raw.get("location_type") or "").upper()
        locations = raw.get("locations_derived") or []
        # remote_derived is often False even for remote jobs — also check the
        # locations_derived list for an explicit "Remote" value
        has_remote_location = any("remote" in loc.lower() for loc in locations)

        if is_remote or location_type == "TELECOMMUTE" or has_remote_location:
            remote_type = "remote"
        else:
            remote_type = "on-site"

        if remote_type == "remote":
            country = locations[0] if locations else None
            location_str = f"Remote ({country})" if country else "Remote"
        else:
            location_str = locations[0] if locations else (
                raw.get("locations_raw") and _first_location_raw(raw["locations_raw"])
            ) or "Not specified"

        salary_min, salary_max, salary_currency = _parse_salary(raw.get("salary_raw"))

        emp_types: list = raw.get("employment_type") or []
        job_type = _normalize_employment_type(emp_types[0]) if emp_types else None

        posted_date = None
        raw_date = raw.get("date_posted") or raw.get("date_created")
        if raw_date:
            try:
                posted_date = datetime.fromisoformat(raw_date).date()
            except (ValueError, TypeError):
                pass

        return JobData(
            title=raw.get("title") or "Untitled Position",
            company=raw.get("organization") or "Unknown Company",
            location=location_str,
            description=raw.get("description_text") or "",
            url=raw.get("url", ""),
            source_job_id=str(raw.get("id", "")),
            provider="linkedin",
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=salary_currency,
            job_type=job_type,
            remote_type=remote_type,
            posted_date=posted_date,
            raw_data=raw,
        )


# ── Helpers ────────────────────────────────────────────────────────────────────


def _first_location_raw(locations_raw: list) -> Optional[str]:
    if not locations_raw:
        return None
    try:
        addr = locations_raw[0].get("address", {})
        parts = [addr.get("addressLocality"), addr.get("addressRegion"), addr.get("addressCountry")]
        return ", ".join(p for p in parts if p)
    except Exception:
        return None


def _parse_salary(salary_raw: Optional[Dict]) -> tuple:
    if not salary_raw:
        return None, None, "USD"
    currency = salary_raw.get("currency", "USD")
    value = salary_raw.get("value", {}) or {}
    unit = (value.get("unitText") or "YEAR").upper()
    raw_min = value.get("minValue")
    raw_max = value.get("maxValue")
    multiplier = 2080 if unit == "HOUR" else 1
    sal_min = int(raw_min * multiplier) if raw_min is not None else None
    sal_max = int(raw_max * multiplier) if raw_max is not None else None
    return sal_min, sal_max, currency


def _normalize_employment_type(emp_type: str) -> Optional[str]:
    mapping = {
        "FULL_TIME":  "full-time",
        "PART_TIME":  "part-time",
        "CONTRACT":   "contract",
        "CONTRACTOR": "contract",
        "TEMPORARY":  "temporary",
        "INTERNSHIP": "internship",
        "VOLUNTEER":  "volunteer",
        "OTHER":      "other",
    }
    return mapping.get((emp_type or "").upper(), emp_type.lower() if emp_type else None)


