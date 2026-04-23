# Auto Job Agent — Debugging & Fix Log

## Golden Rules (NEVER break these)
1. **No job without a description should ever be saved** — except ZipRecruiter and Indeed (explicitly loosened by user)
2. **Only jobs from the exact searched location should be saved** — strict country ISO enforcement. Remote jobs still must match country.

---

## Provider Status Summary

| Provider | Status | Notes |
|---|---|---|
| LinkedIn | ✅ Working | Saves 10/10, best quality |
| Glassdoor | ⚠️ Partial | too_old drops many (null dates from API) |
| JSearch | ✅ Working | Used directly and as fallback base |
| ZipRecruiter | ⚠️ US-only | Descriptions via /job-details. Dates always null. job_country=US → rejected for non-US searches |
| Indeed | ❌ Monthly quota exhausted | Falls back to JSearch "via indeed". Also US-only via JSearch |

---

## All Fixes Applied

### Fix 1 — JSearch: Description fallback to `job_highlights`
**File:** `backend/app/providers/jsearch.py`
**Issue:** `job_description` is null for some JSearch results → Pydantic crash
**Fix:** If `job_description` is null, build description from `job_highlights` sections. If both null → empty string → dropped by no_desc gate.

### Fix 2 — JSearch: "via X" suffix before location, skip location entirely when suffix present
**File:** `backend/app/providers/jsearch.py`
**Issue:** Query `"wordpress in United States via ziprecruiter"` → 0 results. Suffix must come before location.
**Fix:** Suffix prepended. Then skip location injection entirely when suffix is present.
**Confirmed via live API:** `"wordpress via ziprecruiter"` = 10 results, `"wordpress in United States via ziprecruiter"` = 0.

### Fix 3 — LinkedIn: `.get(key, "")` → `.get(key) or ""`
**File:** `backend/app/providers/linkedin.py`
**Issue:** `.get(key, "")` returns `None` when key exists with null value → Pydantic crash on title/company/description
**Fix:** Changed to `or ""` pattern on all three fields.

### Fix 4 — Indeed: `repr(exc)` for error visibility
**File:** `backend/app/providers/indeed.py`
**Issue:** `str(exc)` returns empty string for some httpx exceptions → silent failures in logs
**Fix:** `repr(exc)` for detail fetch error logging.

### Fix 5 — Glassdoor: 429 retry sleep 3s → 8s
**File:** `backend/app/providers/glassdoor.py`
**Issue:** Concurrent detail fetches hit rate limits too fast
**Fix:** Retry sleep increased from 3s to 8s.

### Fix 6 — ZipRecruiter: remove `date_posted` API parameter
**File:** `backend/app/utils/provider_utils.py`
**Issue:** `date_posted=3days` returns 0 results from JSearch's sparse ZipRecruiter index
**Fix:** Split ZipRecruiter out from JSearch in `build_date_kwargs()`. Returns `{}` for ZipRecruiter — no API date filter. Age cutoff still applied in code via `posted_date` field.
**Confirmed:** `date_posted=3days` → 0 results, `date_posted=all` → 10 results.

### Fix 7 — Indeed fallback: remove `date_posted` API parameter
**File:** `backend/app/routers/providers.py` → `_fetch_indeed_jsearch_fallback()`
**Issue:** "via indeed" on JSearch also has sparse index — strict date filter returns 0
**Fix:** Changed to `date_kwargs = {}` for the fallback.

### Fix 8 — Pipeline logging
**File:** `backend/app/routers/providers.py`
**Added:** Per-provider-per-keyword logs:
- `after_provider`, `query_rejected`, `loc_rejected`, `passing_to_save`
- `received`, `saved`, `no_url`, `no_desc`, `too_old`, `dup`

### Fix 9 — ZipRecruiter + Indeed fallback: 4x raw fetch limit
**File:** `backend/app/routers/providers.py`
**Issue:** With ~70% drop rate, requesting 10 raw → 1-2 saved
**Fix:** `raw_limit = limit * 4` for ZipRecruiter. `limit * 4` for Indeed fallback. More raw → more survivors after filters.

### Fix 10 — Indeed fallback: null `posted_date` set to today
**File:** `backend/app/routers/providers.py` → `_fetch_indeed_jsearch_fallback()`
**Issue:** JSearch "via indeed" often has null `posted_date` → dropped as too_old
**Fix:** `posted_date = date.today()` for null-date jobs in the fallback.

### Fix 11 — Age gate: only drop jobs with a confirmed old date (not null)
**File:** `backend/app/routers/providers.py`
**Issue:** `posted_date is None` was treated as too_old for all providers
**Fix:** Changed to `if job_data.posted_date is not None and job_data.posted_date < age_cutoff`
**Exception:** ZipRecruiter still drops null-date jobs (Fix 13)

### Fix 12 — Description gate: loosened for ZipRecruiter and Indeed
**File:** `backend/app/routers/providers.py`
**Issue:** ZipRecruiter/Indeed via JSearch often have no description in search results
**Fix:** `provider_name not in ("ziprecruiter", "indeed")` — these two exempt from no_desc drop
**Golden Rule 1:** Intentionally loosened for these two providers only, by explicit user request.

### Fix 13 — ZipRecruiter: drop null-date jobs at backend
**File:** `backend/app/routers/providers.py`
**Issue:** JSearch returns null dates for ALL ZipRecruiter jobs. User doesn't want "Unknown Date" jobs.
**Fix:** ZipRecruiter jobs with `posted_date is None` are dropped (counted in too_old).
**Result:** Only ZipRecruiter jobs that got a date from /job-details enrichment are saved.

### Fix 14 — Relative date parsing in jsearch.py
**File:** `backend/app/providers/jsearch.py`
**Fix:** Added `_parse_relative_date()` helper. Checks `job_posted_at`, `job_age`, `formatted_relative_time`, `job_posted_at_datetime`.
**Result (confirmed via debug logs):** ZipRecruiter jobs have ALL three date fields as explicit `null` in JSearch. Not a text field issue — JSearch genuinely has no date data for ZipRecruiter jobs. The "Posted X days ago" on ZipRecruiter's site is a live calculation from their own database, not scraped by Google/JSearch.

### Fix 15 — ZipRecruiter: /job-details enrichment for description AND date
**File:** `backend/app/providers/jsearch.py` + `backend/app/providers/ziprecruiter.py`
**Issue:** JSearch search endpoint returns null description and null date for ZipRecruiter jobs
**Fix:**
- Added `_fetch_job_details()` to JSearchProvider — calls JSearch `/job-details` endpoint
- ZipRecruiterProvider.search_jobs() overrides to concurrently enrich jobs missing description or date
**Result:** Descriptions enriched successfully (10/10). Dates still null — /job-details also returns null for ZipRecruiter. Confirmed: dates are simply not available through JSearch for ZipRecruiter.

### Fix 16 — "No Desc" badge in UI
**File:** `frontend/src/pages/Jobs.tsx`
**Fix:** Orange "No Desc" badge shown next to job title when `job.description` is empty.

---

## Known Remaining Issues

### ZipRecruiter — dates always null
- JSearch (Google Jobs aggregator) doesn't scrape ZipRecruiter's dynamic date counter
- All ZipRecruiter jobs dropped if no date after /job-details enrichment
- **Only real fix:** Direct ZipRecruiter API on RapidAPI

### ZipRecruiter + Indeed — only works for US searches
- Both return `job_country=US` for all jobs (US-first platforms)
- Location filter Layer 1 (ISO check) rejects them for any non-US locality (UK, PK, etc.)
- `loc_rejected=all` confirmed in logs for UK search
- User confirmed: **do NOT relax location filter for remote jobs** — remote UK = only UK jobs, remote US = only US jobs
- **Only fix:** Direct APIs for these providers that have global job indexes

### Indeed — monthly quota exhausted
- Indeed12 RapidAPI PRO plan monthly limit hit
- Falls back to JSearch "via indeed" automatically — but this also has US-only issue

---

## Files Modified

| File | Changes |
|---|---|
| `backend/app/providers/jsearch.py` | description fallback, query suffix fix, relative date parsing, `_fetch_job_details()` |
| `backend/app/providers/ziprecruiter.py` | `search_jobs()` with /job-details enrichment |
| `backend/app/providers/linkedin.py` | `.get() or ""` fix |
| `backend/app/providers/indeed.py` | `repr(exc)` logging |
| `backend/app/providers/glassdoor.py` | 429 retry 3s→8s |
| `backend/app/routers/providers.py` | pipeline logging, fallback fixes, null-date handling, 4x raw limit, ZipRecruiter null-date drop |
| `backend/app/utils/provider_utils.py` | ZipRecruiter split from JSearch in `build_date_kwargs()` |
| `frontend/src/pages/Jobs.tsx` | "No Desc" badge |

---

## Deploy Commands

```bash
# Backend only
ssh -i ~/.ssh/hybrid-python.pem ubuntu@3.239.16.121 "sudo git -C /var/www/auto-job-agent pull origin hirelyhybrid && sudo systemctl restart auto-job-agent"

# With frontend build
ssh -i ~/.ssh/hybrid-python.pem ubuntu@3.239.16.121 "sudo git -C /var/www/auto-job-agent pull origin hirelyhybrid && cd /var/www/auto-job-agent/frontend && npm run build && sudo systemctl restart auto-job-agent"

# With pip install (new deps)
sudo /var/www/auto-job-agent/venv/bin/pip install -r /var/www/auto-job-agent/backend/requirements-web.txt
```

## Log Commands

```bash
# All recent logs
ssh -i ~/.ssh/hybrid-python.pem ubuntu@3.239.16.121 "sudo journalctl -u auto-job-agent -n 200 --no-pager"

# Enrichment status
ssh -i ~/.ssh/hybrid-python.pem ubuntu@3.239.16.121 "sudo journalctl -u auto-job-agent -n 300 --no-pager | grep -E '(Enriching|Enriched)'"

# Drop reasons
ssh -i ~/.ssh/hybrid-python.pem ubuntu@3.239.16.121 "sudo journalctl -u auto-job-agent -n 300 --no-pager | grep -E '(loc_rejected|too_old|no_desc)'"
```
