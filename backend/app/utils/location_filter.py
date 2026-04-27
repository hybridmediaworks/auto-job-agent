"""
backend/app/utils/location_filter.py

Shared location filtering logic used by both the providers router (manual fetch)
and the scheduler (saved search cron jobs).

Filter pipeline:
  Layer 0 — Remote gate:       remote job + remote_only=False → reject
  Layer 1 — ISO code:          authoritative job_country mismatch → reject  (JSearch/ZipRecruiter/Indeed)
  Layer 2 — Positive signal:   non-remote job with no ISO code must have a clear geo signal → reject if absent  (LinkedIn/Glassdoor)
  Layer 2r— Remote blocklist:  remote job with no ISO code must NOT name a foreign country explicitly
  Layer 3 — City filter:       specific city query must appear in location
"""

import re
from typing import Dict, List

# ── ISO country codes ──────────────────────────────────────────────────────────
# Maps locality code → ISO 3166-1 alpha-2 (matches JSearch/ZipRecruiter job_country)
LOCALITY_ISO: Dict[str, str] = {
    'us': 'US', 'ca': 'CA', 'gb': 'GB', 'au': 'AU', 'nz': 'NZ',
    'de': 'DE', 'fr': 'FR', 'nl': 'NL', 'es': 'ES', 'in': 'IN',
    'sg': 'SG', 'ae': 'AE', 'pk': 'PK', 'ie': 'IE',
}

# Maps locality code → country display name (used by providers for query building)
# Single source of truth — imported by jsearch.py, linkedin.py, glassdoor.py
LOCALITY_COUNTRY: Dict[str, str] = {
    'us': 'United States',
    'ca': 'Canada',
    'gb': 'United Kingdom',
    'au': 'Australia',
    'nz': 'New Zealand',
    'de': 'Germany',
    'fr': 'France',
    'nl': 'Netherlands',
    'es': 'Spain',
    'in': 'India',
    'sg': 'Singapore',
    'ae': 'UAE',
    'pk': 'Pakistan',
    'ie': 'Ireland',
}

# ── Foreign country blocklist ──────────────────────────────────────────────────
# Used for remote jobs without ISO codes — reject if location names a DIFFERENT country.
# Also includes provinces/states of each country to catch "London, Ontario" style locations.
LOCALITY_TERMS: Dict[str, List[str]] = {
    'us': ['united states', 'usa', 'u.s.a', 'u.s.', 'america'],
    'ca': ['canada', 'ontario', 'british columbia', 'quebec', 'alberta',
           'nova scotia', 'new brunswick', 'manitoba', 'saskatchewan',
           'newfoundland', 'prince edward island'],
    'gb': ['united kingdom', 'great britain', 'britain',
           'england', 'scotland', 'wales', 'northern ireland'],
    'au': ['australia', 'new south wales', 'queensland', 'western australia',
           'south australia', 'tasmania', 'northern territory'],
    'nz': ['new zealand'],
    'de': ['germany', 'deutschland'],
    'fr': ['france'],
    'nl': ['netherlands', 'holland'],
    'es': ['spain'],
    'in': ['india'],
    'sg': ['singapore'],
    'ae': ['united arab emirates', 'uae', 'dubai', 'abu dhabi'],
    'pk': ['pakistan'],
    'ie': ['ireland'],
}

# ── Positive geo signals ───────────────────────────────────────────────────────
# For non-remote LinkedIn/Glassdoor jobs (no ISO code), the location MUST contain
# at least one of these signals to be accepted.
# Includes: country names, state/province/region names, major cities, abbreviations.
_POSITIVE_SIGNALS: Dict[str, List[str]] = {
    'us': [
        # Country
        'united states', 'usa', 'u.s.', 'u.s.a', 'america',
        # All 50 states + DC (full names)
        'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
        'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
        'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
        'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
        'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
        'new hampshire', 'new jersey', 'new mexico', 'new york',
        'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
        'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
        'tennessee', 'texas', 'utah', 'vermont', 'virginia',
        'washington', 'west virginia', 'wisconsin', 'wyoming',
        'washington dc', 'washington d.c.',
        # Major unambiguous US cities (no equivalent in UK/AU/CA)
        'chicago', 'los angeles', 'san francisco', 'san jose', 'san diego',
        'houston', 'dallas', 'austin', 'denver', 'phoenix', 'atlanta',
        'seattle', 'portland', 'boston', 'miami', 'detroit', 'minneapolis',
        'philadelphia', 'las vegas', 'charlotte', 'nashville', 'raleigh',
        'pittsburgh', 'st. louis', 'salt lake city', 'kansas city',
        'new orleans', 'indianapolis', 'columbus', 'memphis', 'baltimore',
        'san antonio', 'fort worth', 'el paso', 'sacramento', 'fresno',
        'tucson', 'albuquerque', 'mesa', 'omaha', 'cleveland',
        'silicon valley', 'bay area',
        # US regions that contain foreign country names — must be listed here
        # so the positive-signal check fires BEFORE the blocklist sees "england"
        'new england',
    ],
    'gb': [
        # Country / parts
        'united kingdom', 'uk', 'great britain', 'britain',
        'england', 'scotland', 'wales', 'northern ireland',
        # Major UK cities
        'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh',
        'liverpool', 'sheffield', 'bristol', 'cardiff', 'belfast', 'newcastle',
        'cambridge', 'oxford', 'brighton', 'coventry', 'leicester', 'nottingham',
        'southampton', 'portsmouth', 'reading', 'derby', 'hull', 'swansea',
        'exeter', 'plymouth', 'stoke', 'wolverhampton',
    ],
    'au': [
        # Country / states (full names)
        'australia', 'new south wales', 'victoria', 'queensland',
        'western australia', 'south australia', 'tasmania',
        'northern territory', 'australian capital territory',
        # Major AU cities
        'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra',
        'gold coast', 'newcastle', 'wollongong', 'geelong', 'hobart', 'darwin',
    ],
    'ca': [
        # Country / provinces (full names)
        'canada', 'ontario', 'british columbia', 'quebec', 'alberta',
        'nova scotia', 'new brunswick', 'manitoba', 'saskatchewan',
        'newfoundland', 'prince edward island',
        # Major CA cities
        'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton',
        'winnipeg', 'quebec city', 'hamilton', 'kitchener', 'london ontario',
    ],
    'nz': [
        'new zealand', 'auckland', 'wellington', 'christchurch',
        'hamilton', 'tauranga', 'dunedin',
    ],
    'de': [
        'germany', 'deutschland',
        'berlin', 'munich', 'hamburg', 'frankfurt', 'cologne', 'düsseldorf',
        'stuttgart', 'dortmund', 'essen', 'Leipzig', 'bremen', 'hanover',
    ],
    'fr': [
        'france',
        'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'nice',
        'nantes', 'strasbourg', 'montpellier', 'lille',
    ],
    'nl': [
        'netherlands', 'holland',
        'amsterdam', 'rotterdam', 'the hague', 'utrecht', 'eindhoven',
    ],
    'in': [
        'india',
        'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad',
        'chennai', 'pune', 'kolkata', 'ahmedabad', 'jaipur', 'surat',
        'noida', 'gurgaon', 'gurugram',
    ],
    'sg': ['singapore'],
    'ae': [
        'united arab emirates', 'uae',
        'dubai', 'abu dhabi', 'sharjah', 'ajman',
    ],
    'pk': [
        'pakistan',
        'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad',
        'multan', 'peshawar', 'quetta',
    ],
    'ie': [
        'ireland',
        'dublin', 'cork', 'galway', 'limerick', 'waterford',
    ],
}

# US state 2-letter abbreviations — used to detect ", TX" style signals
_US_STATE_ABBREVS = frozenset({
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
    'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
    'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
    'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
    'WI', 'WY', 'DC', 'PR', 'GU',
})

# AU state abbreviations
_AU_STATE_ABBREVS = frozenset({'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'})

# CA province abbreviations
_CA_PROVINCE_ABBREVS = frozenset({'ON', 'BC', 'QC', 'AB', 'NS', 'NB', 'MB', 'SK', 'NL', 'PE', 'NT', 'YT', 'NU'})

# Location values that mean "no specific city" — skip the city-level filter
GENERIC_LOCATIONS = frozenset({
    '', 'remote', 'united states', 'usa', 'us', 'canada', 'united kingdom',
    'uk', 'australia', 'germany', 'france', 'netherlands', 'spain', 'india',
    'singapore', 'uae', 'pakistan', 'new zealand', 'ireland',
})


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_remote_job(job) -> bool:
    loc = (job.location or '').lower()
    return (
        (job.remote_type or '').lower() in ('remote',)
        or 'remote' in loc
        or 'worldwide' in loc
        or 'anywhere' in loc
        or 'work from home' in loc
        or 'wfh' in loc
        or 'telecommut' in loc   # telecommute / telecommuting
        or 'virtual' in loc
    )


def _has_country_term(location_lower: str, terms: List[str]) -> bool:
    """True if location contains any of the terms at a word boundary."""
    return any(re.search(r'\b' + re.escape(t) + r'\b', location_lower) for t in terms)


def _has_positive_signal(location_lower: str, location_raw: str, locality: str) -> bool:
    """
    True if the location string contains a clear positive indicator that this
    job belongs to the requested locality.

    Checks:
      1. Text signals: country name, state/region name, major city name
      2. Abbreviation patterns:
           US  → ", NY" / ", TX" etc.
           AU  → "NSW" / "VIC" etc.
           CA  → "ON" / "BC" etc.
    """
    # 1. Text-based signals (word-boundary aware)
    signals = _POSITIVE_SIGNALS.get(locality, [])
    if any(re.search(r'\b' + re.escape(s) + r'\b', location_lower) for s in signals):
        return True

    # 2. Abbreviation patterns
    if locality == 'us':
        m = re.search(r',\s*([A-Z]{2})(?:[,\s]|$)', location_raw)
        if m and m.group(1) in _US_STATE_ABBREVS:
            return True

    if locality == 'au':
        if re.search(r'\b(' + '|'.join(_AU_STATE_ABBREVS) + r')\b', location_raw.upper()):
            return True

    if locality == 'ca':
        if re.search(r'\b(' + '|'.join(_CA_PROVINCE_ABBREVS) + r')\b', location_raw.upper()):
            return True

    return False


# ── Main filter ────────────────────────────────────────────────────────────────

def passes_location_filter(
    job,
    locality: str,
    location_query: str,
    remote_only: bool = True,
) -> bool:
    """
    Returns True if the job belongs to the requested geography.

    Layer 0  — Remote gate:
      remote_only=False → reject ALL remote/WFH/virtual jobs.

    Layer 1  — ISO country code  [JSearch / ZipRecruiter / Indeed]:
      Authoritative ISO-3166 code ("US", "GB", "AU" …). Mismatch = instant reject.
      Note: this field is a COUNTRY code, never a state abbreviation, so "NY" is
      never confused with anything here.

    Layer 2  — Positive signal  [LinkedIn / Glassdoor — no ISO code]:
      Non-remote jobs MUST contain a clear positive indicator for the selected
      country (country name, state/province name, major city, or abbreviation).
      No signal = reject.
      Examples (locality='us'):
        "Austin, TX"          → pass  (TX = Texas state abbrev)
        "New York, NY"        → pass  (NY state abbrev)
        "San Francisco"       → pass  ("san francisco" is in US cities list)
        "London"              → reject (no US signal, could be anywhere)
        "London, OH"          → pass  (OH = Ohio)
        "Bristol"             → reject (no US signal)
        "Bristol, VA"         → pass  (VA = Virginia)

    Layer 2r — Remote blocklist  [LinkedIn / Glassdoor — no ISO code, remote jobs]:
      Remote jobs must NOT explicitly name a foreign country.
      Plain "Remote" / "Worldwide" → pass (API is already scoped to locality).
      "Remote (UK)" / "Remote, London" → reject for locality='us'.

    Layer 3  — City filter:
      If user typed a specific city, non-remote jobs must include it in location.
    """
    location_lower = (job.location or '').lower().strip()
    location_raw   = (job.location or '').strip()
    expected_iso   = LOCALITY_ISO.get(locality)
    is_remote      = _is_remote_job(job)

    # ── Layer 0: Remote gate ───────────────────────────────────────────────────
    if is_remote and not remote_only:
        return False
    if remote_only and not is_remote:
        return False

    # ── Layer 1: ISO country code (authoritative) ──────────────────────────────
    if expected_iso:
        raw_country = ((job.raw_data or {}).get('job_country') or '').upper()
        if raw_country:
            if raw_country != expected_iso:
                # ZipRecruiter jobs always carry job_country=US in JSearch regardless of
                # actual location. Indeed via JSearch fallback has the same issue.
                # For these two providers: skip the ISO hard-reject on NON-REMOTE jobs and
                # fall through to the text-based Layer 2 check instead.
                # Remote jobs keep the strict reject — we can't verify remote scope from text.
                job_provider = (getattr(job, 'provider', None) or '').lower()
                if job_provider in ('ziprecruiter', 'indeed') and not is_remote:
                    pass  # fall through to text-based checks below
                else:
                    return False  # wrong country — instant reject
            else:
                # ISO confirmed correct country — still fall through to city filter (Layer 3)
                city_query = (location_query or '').strip().lower()
                if city_query not in GENERIC_LOCATIONS:
                    location_lower = (job.location or '').lower().strip()
                    if not is_remote and city_query not in location_lower:
                        return False
                return True

    # ── No ISO code (LinkedIn / Glassdoor) — use text-based checks ────────────

    # Reject jobs with no location at all — can't verify geo
    if not location_lower or location_lower in ('not specified', 'n/a', 'unknown'):
        return False

    if is_remote:
        # Layer 2r: remote jobs
        # Step 1 — if the location already has a clear signal for OUR country, trust it
        #           and skip all further checks. This handles "Remote - New England Area"
        #           (new england → US signal → pass before "england" blocklist fires).
        if _has_positive_signal(location_lower, location_raw, locality):
            pass  # confirmed ours — fall through to city filter
        else:
            # Step 2 — reject if location explicitly names a foreign country/region
            for loc_code, terms in LOCALITY_TERMS.items():
                if loc_code == locality:
                    continue
                if _has_country_term(location_lower, terms):
                    return False
            # Step 3 — reject if location has a positive signal for a DIFFERENT country
            #           Catches "Remote, London" (GB signal, no US signal → reject for US)
            #           Allows  "Remote, Manchester, NH" (GB signal but NH = US signal)
            for loc_code in _POSITIVE_SIGNALS:
                if loc_code == locality:
                    continue
                if _has_positive_signal(location_lower, location_raw, loc_code):
                    return False  # signals another country, we already know ours is absent
    else:
        # Layer 2: non-remote jobs — require positive geo signal
        if not _has_positive_signal(location_lower, location_raw, locality):
            return False

    # ── Layer 3: City-level filter ─────────────────────────────────────────────
    city_query = (location_query or '').strip().lower()
    if city_query not in GENERIC_LOCATIONS:
        if not is_remote and city_query not in location_lower:
            return False

    return True
