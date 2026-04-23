# Auto Job Agent

An autonomous job application system with two modes:

- **CLI Agent** — discovers Glassdoor Easy Apply jobs, tailors your resume with Claude AI, and submits applications via a browser agent
- **Web UI** — a full-stack dashboard to discover and track jobs from Indeed, Glassdoor, and ZipRecruiter

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [CLI Mode Setup](#cli-mode-setup)
3. [Web UI Setup](#web-ui-setup)
4. [Configuration Reference](#configuration-reference)
5. [Project Structure](#project-structure)
6. [RapidAPI Setup Guide](#rapidapi-setup-guide-new-account)
7. [Application Tracking](#application-tracking)
8. [Anti-Bot Strategy](#anti-bot-strategy)
9. [Troubleshooting](#troubleshooting)
10. [Cost Estimate](#cost-estimate)

---

## How It Works

### CLI Pipeline

```
Glassdoor API (RapidAPI)
    ↓  discovers Easy Apply jobs with full descriptions
Claude AI (Anthropic)
    ↓  scores job fit (1–10), rewrites resume bullets to match JD keywords
      preserves your natural writing voice — keyword insertion only
Playwright
    ↓  renders tailored resume → pixel-perfect PDF
browser-use + Claude
    ↓  navigates Easy Apply form, answers screening questions, submits
SQLite
    ↓  logs every job: status, fit score, matched keywords, PDF path
Slack webhook (optional)
    ↓  notifies you of results
```

### Web UI

React frontend + FastAPI backend for multi-provider job discovery and management. Auto-apply is Phase 2 — the UI focuses on fetching, reviewing, and tracking jobs.

---

## CLI Mode Setup

### Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.11+ | |
| [Anthropic API key](https://console.anthropic.com) | Pay-as-you-go, ~$20–40/mo at 10 apps/day |
| [RapidAPI account](https://rapidapi.com) | Subscribe to Glassdoor Job Search API |
| Glassdoor account | Complete profile required |

### 1. Clone and create a virtual environment

```bash
git clone https://github.com/your-username/auto-job-agent.git
cd auto-job-agent
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
playwright install chromium firefox
camoufox fetch
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your keys (see [Configuration Reference](#configuration-reference)).

### 4. Add your resume — `client_data/resume_data.json`

```bash
cp client_data/resume_data.example.json client_data/resume_data.json
```

Fill in every field with your real data. Validate:

```bash
python3 -c "import json; json.load(open('client_data/resume_data.json')); print('OK')"
```

### 5. Add your applicant profile — `client_data/profile.json`

```bash
cp client_data/profile.example.json client_data/profile.json
```

This file answers screening questions during form submission — it never appears on your resume.

| Field | What it controls |
|---|---|
| `personal` | Name, email, phone typed into form fields |
| `work_authorization` | Visa/sponsorship questions |
| `experience` | Years-of-experience dropdowns |
| `salary.desired_min/max` | Salary expectation fields |
| `availability.notice_period_weeks` | "When can you start?" |
| `screening_defaults` | EEO/diversity question answers |

Validate:

```bash
python3 -c "import json; json.load(open('client_data/profile.json')); print('OK')"
```

### 6. Configure search targets — `config.yaml`

```yaml
search:
  job_titles:
    - "WordPress Developer"
    - "PHP Developer"
  location: "Remote"
  country: "US"
  easy_apply_only: true

daily_limits:
  max_applications_per_day: 10

resume:
  min_fit_score: 5    # jobs scored below this (out of 10) are skipped
```

### 7. Run

```bash
python main.py
```

Logs are written to `logs/agent.log`. Tailored PDFs are saved to `client_data/generated/`.

---

## Web UI Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- [RapidAPI account](https://rapidapi.com) — subscribe to Indeed12, Glassdoor Job Search, ZipRecruiter

### 1. Install backend dependencies

```bash
source venv/bin/activate   # macOS/Linux
pip install -r backend/requirements-web.txt
```

### 2. Configure environment variables

Ensure your `.env` file includes:

```env
JWT_SECRET_KEY=your_super_secret_jwt_key_min_32_chars
RAPIDAPI_KEY=your_rapidapi_key_here
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
DATABASE_URL=sqlite:///./database/jobs.db
```

### 3. Seed the database

```bash
python backend/seed_db.py
```

Creates admin user (`admin` / `admin123`) and provider configurations for Indeed, Glassdoor, ZipRecruiter.

### 4. Start the backend

```bash
uvicorn app.main:app --reload --app-dir backend
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

### 5. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

- Web UI: http://localhost:5173

### 6. Login

Navigate to http://localhost:5173 and log in with one of the default accounts:

| Username | Password |
|---|---|
| `admin` | `admin123` |
| `Mirza Waleed` | `Mirzawaleed123` |

> These accounts are seeded automatically on first run if the database is empty.

---

## Configuration Reference

### `.env` file

```env
# ── CLI Mode ──────────────────────────────────────────────
ANTHROPIC_API_KEY=your_anthropic_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here

# Slack notifications (optional — leave blank to disable)
SLACK_WEBHOOK_URL=

# Proxy (optional — only needed when running from a VPN or server)
PROXY_HOST=
PROXY_PORT=
PROXY_USER=
PROXY_PASS=

# ── Web UI Mode ───────────────────────────────────────────
JWT_SECRET_KEY=your_super_secret_jwt_key_min_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
DATABASE_URL=sqlite:///./database/jobs.db
DEBUG=False
```

### `config.yaml`

| Key | Default | Description |
|---|---|---|
| `search.job_titles` | `[]` | List of job titles to search |
| `search.location` | `"Remote"` | Search location |
| `search.country` | `"US"` | Country code |
| `search.easy_apply_only` | `true` | Only return Easy Apply listings |
| `daily_limits.max_applications_per_day` | `10` | Hard cap on daily applications |
| `resume.min_fit_score` | `5` | Minimum Claude fit score (1–10) to process a job |

---

## Project Structure

```
auto-job-agent/
├── main.py                      # CLI entry point — runs the full pipeline
├── config.yaml                  # Search targets, daily limits, fit threshold
├── requirements.txt             # CLI Python dependencies
│
├── agent/
│   ├── resume_tailor.py         # Claude → tailored resume bullets → Playwright PDF
│   └── form_agent.py            # browser-use + Claude → Easy Apply form submission
│
├── scraper/
│   ├── discovery.py             # RapidAPI Glassdoor → job listings
│   └── models.py                # ExtractedJob dataclass
│
├── database/
│   ├── models.py                # SQLAlchemy ORM (Job model, ApplicationStatus enum)
│   ├── engine.py                # DB init, session factory, context manager
│   └── queries.py               # All read/write operations
│
├── utils/
│   ├── config.py                # Singleton config (reads .env + config.yaml)
│   ├── helpers.py               # random_delay, clean_text, random_viewport
│   ├── logger.py                # Structured logger (stdout + logs/agent.log)
│   └── notifier.py              # Slack webhook notifications
│
├── templates/
│   └── resume.html              # Jinja2 resume template — edit to match your style
│
├── client_data/                 # Gitignored — your personal files go here
│   ├── resume_data.json         # Your structured resume (create from .example.json)
│   ├── profile.json             # Your applicant profile (create from .example.json)
│   └── generated/               # Tailored PDFs saved here per application
│
├── backend/                     # FastAPI backend (Web UI mode)
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (Pydantic)
│   │   ├── database.py          # SQLAlchemy session
│   │   ├── models/              # ORM models (user, job, provider, etc.)
│   │   ├── routers/             # API endpoints (auth, jobs, providers, stats)
│   │   ├── providers/           # Indeed, Glassdoor, ZipRecruiter implementations
│   │   ├── services/            # Scheduler, Slack, resume tailoring service
│   │   └── utils/               # JWT auth, dependency injection
│   ├── seed_db.py               # Database seeding script
│   └── requirements-web.txt     # Backend Python dependencies
│
└── frontend/                    # React + TypeScript frontend (Web UI mode)
    ├── src/
    │   ├── pages/               # Dashboard, Jobs, JobDetails, Login, etc.
    │   ├── components/          # Reusable layout components
    │   ├── services/api.ts      # Axios API client
    │   ├── contexts/            # Auth context
    │   └── types/               # TypeScript interfaces
    ├── package.json
    └── vite.config.ts
```

---

## RapidAPI Setup Guide (New Account)

When your free tier runs out, create a new RapidAPI account and follow these steps:

### Step 1: Create a new RapidAPI account

1. Go to **https://rapidapi.com** → **Sign Up**
2. Use a new email (Gmail aliases work: `yourname+2@gmail.com`)
3. Verify your email

### Step 2: Subscribe to all 4 provider APIs (free tier)

Open each link below and click **"Subscribe to Test"** (or "Pricing" → **Basic / Free** plan → **Subscribe**):

| # | Provider | API Name | Subscribe Link | Host | Free Tier |
|---|----------|----------|----------------|------|-----------|
| 1 | **Indeed** | Indeed12 by Mantiks | [Subscribe →](https://rapidapi.com/mantiks-mantiks-default/api/indeed12) | `indeed12.p.rapidapi.com` | 500 req/mo |
| 2 | **Glassdoor** | Glassdoor Real-Time | [Subscribe →](https://rapidapi.com/things4u-api4upro/api/glassdoor-real-time) | `glassdoor-real-time.p.rapidapi.com` | 100 req/mo |
| 3 | **ZipRecruiter** | JSearch by OpenWeb Ninja | [Subscribe →](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) | `jsearch.p.rapidapi.com` | 200 req/mo |
| 4 | **LinkedIn** | LinkedIn Job Search API by Fantastic.Jobs | [Subscribe →](https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api) | `linkedin-job-search-api.p.rapidapi.com` | 100 req/mo |

> **Important:** You MUST subscribe to each API individually. Just having a RapidAPI account is not enough.

### Step 3: Copy your API key

1. Go to **https://rapidapi.com/developer/dashboard** (or click your avatar → **Dashboard**)
2. Click **"Security"** in the left sidebar (or go to **https://rapidapi.com/developer/security**)
3. Copy the **"Application Key"** (starts with a long alphanumeric string)

> **One key works for ALL subscribed APIs** — you don't need separate keys.

### Step 4: Update the key in the app

**Option A — Settings page (recommended, no restart needed):**
1. Open the app → **Settings** page
2. Paste the new key in the `RAPIDAPI_KEY` field → click **Update**

**Option B — .env file:**
1. Open `.env` in the project root
2. Replace the `RAPIDAPI_KEY=` value with your new key
3. Restart the backend: `uvicorn app.main:app --reload --app-dir backend`

### Step 5: Test it

1. Go to **Jobs** page → click **Fetch Jobs**
2. Select providers and run a search
3. If you see `401/403` errors for a provider, you forgot to subscribe to that API

### Troubleshooting

| Error | Fix |
|-------|-----|
| `403 - You are not subscribed` | Open the subscribe link for that provider and click Subscribe |
| `429 - Rate limit exceeded` | Free tier exhausted. Wait until next month or create a new account |
| `401 - Unauthorized` | Your API key is wrong. Re-copy from RapidAPI Dashboard → Security |

---

## Application Tracking

All jobs are stored in `database/jobs.db` (SQLite — open in [DB Browser for SQLite](https://sqlitebrowser.org)).

| Status | Meaning |
|---|---|
| `DISCOVERED` | Found by the scraper, not yet processed |
| `PENDING` | Resume tailored successfully — ready for form submission |
| `IN_PROGRESS` | Form submission in progress |
| `APPLIED` | Application submitted successfully |
| `SKIPPED` | Fit score too low, no Easy Apply button, or extraction failed |
| `FAILED` | Unrecoverable error |
| `BLOCKED` | Cloudflare-blocked — automatically retried on next run |

Jobs are deduplicated by URL. `BLOCKED` is the only status that gets retried — all other terminal statuses are permanent.

---

## Anti-Bot Strategy

### Phase 1 (default — works on home broadband)

- **camoufox** (hardened Firefox) handles job scraping with fingerprint spoofing
- **browser-use** (Chromium) handles form submission with automation signals removed
- Running from a residential home IP is usually sufficient — no proxy needed

### Phase 2 (when you need it)

**Authenticated session** — eliminates most Cloudflare blocks:

1. Log into Glassdoor in a real Chrome browser
2. Export cookies using the **Cookie-Editor** Chrome extension → save as JSON
3. Save the file as `client_data/cookies.json`
4. Both the scraper and form agent auto-detect and load it on the next run

**Residential proxy** — add to `.env` when running from a VPN or server:

```env
PROXY_HOST=gate.smartproxy.com
PROXY_PORT=7000
PROXY_USER=your_username
PROXY_PASS=your_password
```

---

## Troubleshooting

### Backend won't start

```bash
# Check if port 8000 is already in use
lsof -i :8000       # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Try a different port
uvicorn app.main:app --reload --app-dir backend --port 8001
```

> **Import errors**: Always run from the project root with `--app-dir backend`. Do NOT `cd backend` first.

### Frontend can't connect to backend

1. Verify the backend is running: http://localhost:8000/docs
2. Check `BACKEND_CORS_ORIGINS` in `.env` includes `http://localhost:5173`
3. Check the Vite proxy config in `frontend/vite.config.ts`

### RapidAPI errors

1. Verify `RAPIDAPI_KEY` is set correctly in `.env`
2. Confirm your RapidAPI subscription is active for the relevant APIs
3. Check your RapidAPI rate limits

### Database errors

```bash
# Reset the database
rm database/jobs.db
python backend/seed_db.py
```

### No jobs discovered (CLI)

- Confirm `RAPIDAPI_KEY` is set in `.env`
- Check that `config.yaml` has valid `job_titles` and `location`
- Verify your RapidAPI subscription to the Glassdoor Job Search API

---

## Adding a New Job Provider (Web UI)

### 1. Create a provider class

```python
# backend/app/providers/linkedin.py
from .base import BaseJobProvider, JobData

class LinkedInProvider(BaseJobProvider):
    RAPIDAPI_HOST = "linkedin-api8.p.rapidapi.com"
    RAPIDAPI_ENDPOINT = "https://linkedin-api8.p.rapidapi.com/search-jobs"

    async def search_jobs(self, query, location, remote_only=False, limit=10, **kwargs):
        # Implement the RapidAPI call here
        pass

    def map_fields(self, raw_data):
        return JobData(
            title=raw_data["title"],
            company=raw_data["companyName"],
            # ... map remaining fields
        )
```

### 2. Register the provider

```python
# backend/app/providers/__init__.py
from .linkedin import LinkedInProvider

ProviderFactory.register_provider("linkedin", LinkedInProvider)
```

The provider is now available in the API and UI.

---

## Cost Estimate

| Service | Plan | Monthly cost |
|---|---|---|
| RapidAPI (Glassdoor/Indeed/ZipRecruiter) | Free tier | $0 |
| Anthropic API | Pay-as-you-go at 10 apps/day | ~$20–40 |
| Smartproxy (Phase 2 only) | 5GB residential | ~$50 |
| **Total (Phase 1)** | | **~$20–40/mo** |

---

## Fit Score and Voice Preservation

**Fit scoring:** Claude reads the job description and scores it 1–10 against your resume. Jobs below `min_fit_score` (default 5) are skipped automatically. Configurable in `config.yaml`.

**Voice preservation:** Claude inserts JD keywords into your existing bullets — not rewrite them. If more than 60% of words in a bullet are changed, the original is kept. This prevents the stiff AI-generated language common with other resume tools.

---

## Quick Start Commands

### ✅ Recommendedd — one command starts everything

```bash
cd /Users/ashir/Documents/workk2/agent/auto-job-agent
./start.sh
```

`start.sh` automatically:
- Kills any stale processes on ports 8000 and 5173
- Starts the backend (FastAPI on :8000)
- Waits until the backend is healthy
- Starts the frontend (Vite on :5173)
- Shuts both down cleanly on Ctrl+C

---

### Manual startup (if you prefer separate terminals)

```bash
# Terminal 1 — Backends
cd /Users/ashir/Documents/workk2/agent/auto-job-agent
source venv/bin/activate
uvicorn app.main:app --reload --app-dir backend

# Terminal 2 — Frontend
cd /Users/ashir/Documents/workk2/agent/auto-job-agent/frontend
npm run dev
```

> **"Address already in use" on port 8000?**
> ```bash
> lsof -ti:8000 | xargs kill -9 2>/dev/null
> ```
> Then start the backend again.

---

**URLs:**
- Web UI: http://localhost:5173
- API docs: http://localhost:8000/docs

**Login accounts:**

| Username | Password |
|---|---|
| `admin` | `admin123` |
