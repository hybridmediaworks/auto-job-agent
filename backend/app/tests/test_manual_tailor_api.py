"""
Tests for Task 2: Manual Tailor backend API + tailor_service augmentation.

Unit tests:  tailor_service prompt augmentation (research_context, tone, focus_areas)
Integration: POST /api/tailor/manual endpoint
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db
from app.models.base import Base
from app.models.job import Job, ApplicationStatus
from app.models.profile import Profile
from app.models.user import User
from app.utils.dependencies import get_current_user

# ── In-memory DB (StaticPool so all sessions share one connection) ─────────────

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def user(db):
    u = User(
        username="tester",
        email="tester@example.com",
        password_hash="x",
        is_active=True,
        is_admin=True,
        can_create_resume=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def profile(db, user):
    p = Profile(
        user_id=user.id,
        name="My Profile",
        is_default=True,
        resume_data={"name": "Test User", "experience": [], "education": []},
        profile_data=None,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def client(db, user, profile):
    def _get_db():
        yield db

    def _get_user():
        return user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = _get_user
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── Shared helpers ────────────────────────────────────────────────────────────

_CLAUDE_JSON = (
    '{"summary":"s","role_title":"t","role_description":"d",'
    '"skills_bullets":[],"tools_list":[],"skills_list":[],'
    '"key_achievements":[],"expertise_bullets":[],"additional_skills":[],'
    '"tailored_experience":[],"keywords_targeted":[]}'
)

FAKE_TAILOR_RESULT = {
    "tailored_resume_data": {"summary": "tailored"},
    "tailored_resume_text": "tailored resume text",
    "cover_letter": "Dear Hiring Manager...",
    "fit_score": 100,
    "keywords_matched": ["python"],
    "keywords_missing": [],
}

VALID_PAYLOAD = {
    "title": "Senior Software Engineer",
    "company": "Acme Corp",
    "description": "Build scalable systems with Python and AWS.",
    "location": "Remote",
    "tone": "Professional",
    "focus_areas": ["Architecture", "Coding"],
    "enable_research": False,
    "one_page": False,
}


# ══════════════════════════════════════════════════════════════════════════════
# Unit tests: tailor_service prompt augmentation
# ══════════════════════════════════════════════════════════════════════════════

def _make_claude_client(text=_CLAUDE_JSON):
    mock = MagicMock()
    mock.messages.create.return_value = MagicMock(content=[MagicMock(text=text)])
    return mock


def test_prompt_includes_research_context():
    """research_context text must appear in the prompt sent to Claude."""
    from app.services.tailor_service import _call_claude_resume

    client = _make_claude_client()
    _call_claude_resume(
        client=client,
        job={"title": "SWE", "company": "Acme", "description": "Build things"},
        resume_text="Resume",
        profile_context="Context",
        research_context="Python is the dominant language for this role.",
    )

    prompt = client.messages.create.call_args[1]["messages"][0]["content"]
    assert "Python is the dominant language for this role." in prompt


def test_prompt_includes_tone():
    """tone value must appear in the prompt sent to Claude."""
    from app.services.tailor_service import _call_claude_resume

    client = _make_claude_client()
    _call_claude_resume(
        client=client,
        job={"title": "SWE", "company": "Acme", "description": "Build things"},
        resume_text="Resume",
        profile_context="Context",
        tone="Technical",
    )

    prompt = client.messages.create.call_args[1]["messages"][0]["content"]
    assert "Technical" in prompt


def test_prompt_includes_focus_areas():
    """All focus_areas must appear in the prompt sent to Claude."""
    from app.services.tailor_service import _call_claude_resume

    client = _make_claude_client()
    _call_claude_resume(
        client=client,
        job={"title": "SWE", "company": "Acme", "description": "Build things"},
        resume_text="Resume",
        profile_context="Context",
        focus_areas=["Architecture", "Leadership"],
    )

    prompt = client.messages.create.call_args[1]["messages"][0]["content"]
    assert "Architecture" in prompt
    assert "Leadership" in prompt


def test_tailor_for_job_passes_new_params_to_resume_call():
    """tailor_for_job must thread research_context/tone/focus_areas into _call_claude_resume."""
    from app.services import tailor_service

    with patch.object(tailor_service, "_call_claude_resume", return_value={
        "summary": "s", "role_title": "t", "role_description": "d",
        "skills_bullets": [], "tailored_experience": [], "keywords_targeted": [],
        "tools_list": [], "skills_list": [], "key_achievements": [],
        "expertise_bullets": [], "additional_skills": [],
    }) as mock_resume, patch.object(tailor_service, "_call_claude_cover_letter", return_value="cl"):
        with patch("app.services.tailor_service.anthropic.Anthropic"):
            tailor_service.tailor_for_job(
                job={"title": "SWE", "company": "Acme", "description": "JD"},
                profile_resume_data={"name": "X", "experience": [], "education": []},
                profile_data=None,
                anthropic_api_key="fake",
                research_context="Insight block",
                tone="Enthusiastic",
                focus_areas=["Coding"],
            )

    call_kw = mock_resume.call_args[1]
    assert call_kw["research_context"] == "Insight block"
    assert call_kw["tone"] == "Enthusiastic"
    assert call_kw["focus_areas"] == ["Coding"]


# ══════════════════════════════════════════════════════════════════════════════
# Integration tests: POST /api/tailor/manual
# ══════════════════════════════════════════════════════════════════════════════

def test_manual_endpoint_creates_job_with_manual_provider(client, db):
    with (
        patch("app.routers.tailor.get_api_key", return_value="fake-key"),
        patch("app.routers.tailor.tailor_service.tailor_for_job", return_value=FAKE_TAILOR_RESULT),
    ):
        resp = client.post("/api/tailor/manual", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    job = db.query(Job).filter_by(provider="manual").first()
    assert job is not None
    assert job.title == "Senior Software Engineer"
    assert job.company == "Acme Corp"
    assert job.status == ApplicationStatus.BOOKMARKED


def test_manual_endpoint_calls_tailor_service_with_tone_and_focus(client):
    with (
        patch("app.routers.tailor.get_api_key", return_value="fake-key"),
        patch("app.routers.tailor.tailor_service.tailor_for_job", return_value=FAKE_TAILOR_RESULT) as mock_tailor,
    ):
        resp = client.post("/api/tailor/manual", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    kw = mock_tailor.call_args[1]
    assert kw["tone"] == "Professional"
    assert kw["focus_areas"] == ["Architecture", "Coding"]
    assert kw["job"]["title"] == "Senior Software Engineer"


def test_manual_endpoint_passes_location_override(client):
    """location field is forwarded to tailor_for_job as location_override."""
    payload = {**VALID_PAYLOAD, "location": "New York, NY"}
    with (
        patch("app.routers.tailor.get_api_key", return_value="fake-key"),
        patch("app.routers.tailor.tailor_service.tailor_for_job", return_value=FAKE_TAILOR_RESULT) as mock_tailor,
    ):
        resp = client.post("/api/tailor/manual", json=payload)

    assert resp.status_code == 200
    kw = mock_tailor.call_args[1]
    assert kw["location_override"] == "New York, NY"


def test_manual_endpoint_passes_address_override(client):
    """address field is forwarded to tailor_for_job as address_override."""
    payload = {**VALID_PAYLOAD, "address": "123 Main St, New York, NY 10001"}
    with (
        patch("app.routers.tailor.get_api_key", return_value="fake-key"),
        patch("app.routers.tailor.tailor_service.tailor_for_job", return_value=FAKE_TAILOR_RESULT) as mock_tailor,
    ):
        resp = client.post("/api/tailor/manual", json=payload)

    assert resp.status_code == 200
    kw = mock_tailor.call_args[1]
    assert kw["address_override"] == "123 Main St, New York, NY 10001"


def test_location_override_applied_to_resume_data():
    """tailor_for_job must patch resume_data.location with location_override."""
    from app.services import tailor_service

    with patch.object(tailor_service, "_call_claude_resume", return_value={
        "summary": "s", "role_title": "t", "role_description": "d",
        "skills_bullets": [], "tailored_experience": [], "keywords_targeted": [],
        "tools_list": [], "skills_list": [], "key_achievements": [],
        "expertise_bullets": [], "additional_skills": [],
    }), patch.object(tailor_service, "_call_claude_cover_letter", return_value="cl"), \
         patch("app.services.tailor_service.anthropic.Anthropic"):
        result = tailor_service.tailor_for_job(
            job={"title": "SWE", "company": "Acme", "description": "JD"},
            profile_resume_data={"name": "X", "location": "Old City", "experience": [], "education": []},
            profile_data=None,
            anthropic_api_key="fake",
            location_override="Remote",
        )

    assert result["tailored_resume_data"]["location"] == "Remote"


def test_address_override_applied_to_resume_data():
    """tailor_for_job must set resume_data.address from address_override."""
    from app.services import tailor_service

    with patch.object(tailor_service, "_call_claude_resume", return_value={
        "summary": "s", "role_title": "t", "role_description": "d",
        "skills_bullets": [], "tailored_experience": [], "keywords_targeted": [],
        "tools_list": [], "skills_list": [], "key_achievements": [],
        "expertise_bullets": [], "additional_skills": [],
    }), patch.object(tailor_service, "_call_claude_cover_letter", return_value="cl"), \
         patch("app.services.tailor_service.anthropic.Anthropic"):
        result = tailor_service.tailor_for_job(
            job={"title": "SWE", "company": "Acme", "description": "JD"},
            profile_resume_data={"name": "X", "experience": [], "education": []},
            profile_data=None,
            anthropic_api_key="fake",
            address_override="123 Main St, NYC 10001",
        )

    assert result["tailored_resume_data"]["address"] == "123 Main St, NYC 10001"


def test_manual_endpoint_returns_application_and_job_ids(client):
    with (
        patch("app.routers.tailor.get_api_key", return_value="fake-key"),
        patch("app.routers.tailor.tailor_service.tailor_for_job", return_value=FAKE_TAILOR_RESULT),
    ):
        resp = client.post("/api/tailor/manual", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] > 0
    assert data["job_id"] > 0
    assert data["tailored_resume_text"] == "tailored resume text"
    assert data["cover_letter"] == "Dear Hiring Manager..."


def test_manual_endpoint_missing_api_key_returns_400(client):
    with patch("app.routers.tailor.get_api_key", return_value=None):
        resp = client.post("/api/tailor/manual", json=VALID_PAYLOAD)

    assert resp.status_code == 400
    assert "ANTHROPIC_API_KEY" in resp.json()["detail"]
