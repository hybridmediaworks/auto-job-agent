"""
backend/app/providers/jsearch.py

JSearch job provider via RapidAPI.

JSearch is a high-quality job aggregator that pulls from Google Jobs,
providing access to Indeed, LinkedIn, ZipRecruiter, and more.
"""

import re
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import httpx

from .base import BaseJobProvider, JobData
from app.utils.location_filter import LOCALITY_COUNTRY

# Maps ISO country code (from job_country field) → default salary currency
_COUNTRY_CURRENCY: Dict[str, str] = {
    'CA': 'CAD',
    'GB': 'GBP',
    'AU': 'AUD',
    'NZ': 'NZD',
    'DE': 'EUR',
    'FR': 'EUR',
    'NL': 'EUR',
    'ES': 'EUR',
    'IN': 'INR',
    'SG': 'SGD',
    'AE': 'AED',
    'PK': 'PKR',
}


class JSearchProvider(BaseJobProvider):
    """
    JSearch job provider via RapidAPI.

    Uses the JSearch API (Google Jobs aggregator) from RapidAPI.
    """

    # RapidAPI endpoint configuration
    RAPIDAPI_HOST = "jsearch.p.rapidapi.com"
    RAPIDAPI_ENDPOINT = "https://jsearch.p.rapidapi.com/search"
    RAPIDAPI_DETAILS_ENDPOINT = "https://jsearch.p.rapidapi.com/job-details"

    async def search_jobs(
        self,
        query: str,
        location: str = "Remote",
        remote_only: bool = False,
        limit: int = 10,
        **kwargs
    ) -> List[JobData]:
        """
        Search for jobs on JSearch via RapidAPI.
        """
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": self.RAPIDAPI_HOST
        }

        # JSearch uses a single 'query' parameter for both keywords and location
        # Example: "Python Developer in New York, Canada"
        locality: str = kwargs.get("locality", "us")
        country = LOCALITY_COUNTRY.get(locality)

        suffix = self.config.get("query_suffix")
        full_query = f"{query} {suffix}" if suffix else f"{query}"

        if not suffix:
            if location and location.lower() not in ("remote", ""):
                if country and country.lower() not in location.lower():
                    # Append country for disambiguation (e.g. Toronto, Canada vs Toronto, OH)
                    full_query += f" in {location}, {country}"
                else:
                    full_query += f" in {location}"
            elif country:
                # No specific city — scope by country so we don't default to US results
                full_query += f" in {country}"
        else:
            # "via <publisher>" suffix present.
            # "query in country via X" returns 0 (confirmed for ZipRecruiter).
            # "query via X in country" works — suffix first, then location.
            # For non-US: add country so JSearch scopes results to that country.
            # For US: omit — JSearch already defaults to US results for these publishers.
            if country and locality != 'us':
                full_query += f" in {country}"

        # Compute page number from offset (JSearch returns ~10 results/page)
        offset = int(kwargs.get("offset", 0))
        page = kwargs.get("page") or (offset // 10 + 1)

        params = {
            "query": full_query,
            "page": str(page),
            "num_pages": "1",
            "remote_jobs_only": "true" if remote_only else "false",
            "date_posted": kwargs.get("date_posted", "all"), # all, today, 3days, week, month
        }

        provider_label = self.get_provider_name()
        print(f"[{provider_label}] Query: '{full_query}' remote_only={remote_only}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            await self.rate_limiter.acquire()
            response = await client.get(
                self.RAPIDAPI_ENDPOINT,
                headers=headers,
                params=params
            )

            if response.status_code != 200:
                print(f"[{provider_label}] Search {response.status_code} for '{query}': {response.text[:300]}")
            if response.status_code == 429:
                raise Exception("JSearch API rate limit exceeded (429).")

            response.raise_for_status()
            data = response.json()

        # Parse and map results
        jobs = []
        results = data.get("data", [])
        print(f"[{provider_label}] API returned {len(results)} raw jobs for '{query}' (requested {limit})")

        for item in results:
            if len(jobs) >= limit:
                break
            try:
                job_data = self.map_fields(item)
                jobs.append(job_data)
            except Exception as e:
                print(f"Error mapping JSearch job: {e}")
                continue

        print(f"[{provider_label}] Returning {len(jobs)} jobs")
        return jobs

    async def _fetch_job_details(self, job_id: str) -> dict:
        """
        Fetch extra fields for a single job via the JSearch /job-details endpoint.
        Returns a dict with 'posted_date' and 'description' if found, else empty dict.
        Used to enrich ZipRecruiter jobs where the search endpoint omits these fields.
        """
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": self.RAPIDAPI_HOST,
        }
        params = {"job_id": job_id, "extended_publisher_details": "false"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                await self.rate_limiter.acquire()
                response = await client.get(
                    self.RAPIDAPI_DETAILS_ENDPOINT,
                    headers=headers,
                    params=params,
                )
                if response.status_code != 200:
                    return {}
                detail = (response.json().get("data") or [None])[0]
                if not detail:
                    return {}

                result = {}

                # Date
                ts = detail.get("job_posted_at_timestamp")
                if ts:
                    try:
                        result["posted_date"] = datetime.fromtimestamp(ts).date()
                    except Exception:
                        pass
                if "posted_date" not in result:
                    dt_str = detail.get("job_posted_at_datetime_utc")
                    if dt_str:
                        try:
                            result["posted_date"] = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).date()
                        except Exception:
                            pass

                # Description — try full description first, fall back to highlights
                desc = detail.get("job_description") or ""
                if not desc:
                    highlights = detail.get("job_highlights") or {}
                    parts = []
                    for section, items in highlights.items():
                        if isinstance(items, list) and items:
                            parts.append(f"{section}:\n" + "\n".join(f"- {item}" for item in items if item))
                    desc = "\n\n".join(parts)
                if desc:
                    result["description"] = desc

                return result
        except Exception:
            pass
        return {}

    def map_fields(self, raw_data: Dict[str, Any]) -> JobData:
        """
        Map JSearch API response to JobData format.
        """
        # Parse salary information
        # JSearch returns floats (e.g. 23.1/hr) — cast to int and annualize if needed
        _raw_min = raw_data.get("job_min_salary")
        _raw_max = raw_data.get("job_max_salary")
        salary_period = (raw_data.get("job_salary_period") or "").upper()
        multiplier = 2080 if salary_period in ("HOUR", "HOURLY") else 12 if salary_period in ("MONTH", "MONTHLY") else 1
        salary_min = int(round(float(_raw_min) * multiplier)) if _raw_min is not None else None
        salary_max = int(round(float(_raw_max) * multiplier)) if _raw_max is not None else None
        # Derive default currency from the job's country so Canadian jobs don't show USD
        job_country_code = (raw_data.get("job_country") or "").upper()
        default_currency = _COUNTRY_CURRENCY.get(job_country_code, "USD")
        salary_currency = raw_data.get("job_salary_currency") or default_currency

        # Parse posted date — timestamp → ISO string → relative text fallback
        posted_date = None
        timestamp = raw_data.get("job_posted_at_timestamp")
        if timestamp:
            try:
                posted_date = datetime.fromtimestamp(timestamp).date()
            except (ValueError, TypeError, OSError):
                pass
        if posted_date is None:
            dt_str = raw_data.get("job_posted_at_datetime_utc")
            if dt_str:
                try:
                    posted_date = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).date()
                except (ValueError, TypeError):
                    pass
        # Last resort: relative text like "3 days ago", "today", "just posted"
        if posted_date is None:
            for field in ("job_posted_at", "job_age", "formatted_relative_time", "job_posted_at_datetime"):
                rel = raw_data.get(field)
                if isinstance(rel, str) and rel.strip():
                    posted_date = _parse_relative_date(rel)
                    if posted_date:
                        break


        # Determine remote type
        # job_is_remote is often False even for remote postings — also check job_city
        is_remote = raw_data.get("job_is_remote", False)
        city_lower = (raw_data.get("job_city") or "").strip().lower()
        remote_type = "remote" if (is_remote or city_lower in ("remote", "work from home", "anywhere")) else "on-site"

        # Determine job type
        raw_job_type = (raw_data.get("job_employment_type") or "").lower()
        job_type = "full-time"
        if "contract" in raw_job_type:
            job_type = "contract"
        elif "part" in raw_job_type:
            job_type = "part-time"
        elif "intern" in raw_job_type:
            job_type = "internship"

        # Location
        city = raw_data.get("job_city")
        state = raw_data.get("job_state")
        country = raw_data.get("job_country")
        
        loc_parts = [p for p in [city, state, country] if p]
        location_str = ", ".join(loc_parts) if loc_parts else "Not specified"

        # Description: prefer full text, fall back to highlights when description is null
        description = raw_data.get("job_description") or ""
        if not description:
            highlights = raw_data.get("job_highlights") or {}
            parts = []
            for section, items in highlights.items():
                if isinstance(items, list) and items:
                    parts.append(f"{section}:\n" + "\n".join(f"- {item}" for item in items if item))
            description = "\n\n".join(parts)

        return JobData(
            title=raw_data.get("job_title") or "Untitled Position",
            company=raw_data.get("employer_name") or "Unknown Company",
            location=location_str,
            description=description,
            url=raw_data.get("job_apply_link") or "",
            source_job_id=raw_data.get("job_id") or "",
            provider=self.get_provider_name(),
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=salary_currency,
            job_type=job_type,
            remote_type=remote_type,
            posted_date=posted_date,
            raw_data=raw_data
        )


def _parse_relative_date(text: str):
    """Parse relative date strings like '3 days ago', 'today', 'just posted'."""
    t = text.lower().strip()
    try:
        if any(w in t for w in ("just posted", "today", "hour", "minute")):
            return date.today()
        if "day" in t:
            m = re.search(r"(\d+)", t)
            if m:
                return date.today() - timedelta(days=int(m.group(1)))
        if "week" in t:
            m = re.search(r"(\d+)", t)
            days = int(m.group(1)) * 7 if m else 7
            return date.today() - timedelta(days=days)
        if "month" in t:
            m = re.search(r"(\d+)", t)
            days = int(m.group(1)) * 30 if m else 30
            return date.today() - timedelta(days=days)
    except Exception:
        pass
    return None
