"""
backend/app/routers/profiles.py

Profile management API — CRUD for named applicant profiles.

On first GET /api/profiles (empty table), auto-seeds from
client_data/profile.json + client_data/resume_data.json if they exist.
"""

import asyncio
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile
from app.models.user import User
from app.utils.api_keys import get_api_key
from app.utils.dependencies import get_current_user, require_permission
from app.services import resume_parser

router = APIRouter(prefix="/api/profiles", tags=["profiles"])

_CLIENT_DATA_DIR = Path("client_data")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProfileOut(BaseModel):
    id: int
    name: str
    is_default: bool
    profile_data: Optional[dict]
    resume_data: Optional[dict]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, p: Profile) -> "ProfileOut":
        return cls(
            id=p.id,
            name=p.name,
            is_default=p.is_default,
            profile_data=p.profile_data,
            resume_data=p.resume_data,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )


class ProfileCreate(BaseModel):
    name: str
    is_default: bool = False
    profile_data: Optional[dict] = None
    resume_data: Optional[dict] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    profile_data: Optional[dict] = None
    resume_data: Optional[dict] = None


# ── Seed helpers ──────────────────────────────────────────────────────────────

def _load_json_file(path: Path) -> Optional[dict]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


def _seed_default_profile(db: Session, user_id: int) -> Profile:
    """Create a default profile seeded from client_data JSON files."""
    profile_json = _load_json_file(_CLIENT_DATA_DIR / "profile.json")
    resume_json  = _load_json_file(_CLIENT_DATA_DIR / "resume_data.json")

    profile = Profile(
        name="Default",
        is_default=True,
        profile_data=profile_json,
        resume_data=resume_json,
        user_id=user_id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _ensure_one_default(db: Session, user_id: int, exclude_id: Optional[int] = None) -> None:
    """If no profile is marked default for this user, mark the first one."""
    q = db.query(Profile).filter(Profile.user_id == user_id)
    if exclude_id:
        q = q.filter(Profile.id != exclude_id)
    if not db.query(Profile).filter(Profile.user_id == user_id, Profile.is_default == True).first():
        first = q.first()
        if first:
            first.is_default = True
            db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ProfileOut])
def list_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all profiles for the current user. Auto-seeds on first call."""
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).order_by(Profile.id).all()

    if not profiles:
        seeded = _seed_default_profile(db, current_user.id)
        return [ProfileOut.from_orm_model(seeded)]

    return [ProfileOut.from_orm_model(p) for p in profiles]


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Create a new named profile for the current user."""
    if body.is_default:
        db.query(Profile).filter(Profile.user_id == current_user.id, Profile.is_default == True).update({"is_default": False})

    profile = Profile(
        name=body.name,
        is_default=body.is_default,
        profile_data=body.profile_data,
        resume_data=body.resume_data,
        user_id=current_user.id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    _ensure_one_default(db, current_user.id)

    return ProfileOut.from_orm_model(profile)


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single profile by ID."""
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileOut.from_orm_model(profile)


@router.put("/{profile_id}", response_model=ProfileOut)
def update_profile(
    profile_id: int,
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Update a profile."""
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.name is not None:
        profile.name = body.name

    if body.is_default is True:
        db.query(Profile).filter(
            Profile.user_id == current_user.id, Profile.is_default == True, Profile.id != profile_id
        ).update({"is_default": False})
        profile.is_default = True
    elif body.is_default is False:
        profile.is_default = False

    if body.profile_data is not None:
        profile.profile_data = body.profile_data

    if body.resume_data is not None:
        profile.resume_data = body.resume_data

    db.commit()
    db.refresh(profile)

    _ensure_one_default(db, current_user.id)

    return ProfileOut.from_orm_model(profile)


@router.post("/{profile_id}/set-default", response_model=ProfileOut)
def set_default_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Mark a profile as the default."""
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    db.query(Profile).filter(Profile.user_id == current_user.id, Profile.is_default == True).update({"is_default": False})
    profile.is_default = True
    db.commit()
    db.refresh(profile)
    return ProfileOut.from_orm_model(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Delete a profile. Cannot delete the last remaining profile."""
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    total = db.query(Profile).filter(Profile.user_id == current_user.id).count()
    if total <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last profile. Create another profile first."
        )

    db.delete(profile)
    db.commit()

    _ensure_one_default(db, current_user.id)


@router.post("/parse-resume")
async def parse_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_resume")),
):
    """Parse a PDF or DOCX resume with Claude and return structured ResumeData JSON."""
    content_type = file.content_type or ""
    filename = file.filename or ""
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")
    is_docx = content_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or filename.lower().endswith(".docx")

    if not is_pdf and not is_docx:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF or DOCX file.",
        )

    anthropic_key = get_api_key("ANTHROPIC_API_KEY", db)
    if not anthropic_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY not configured. Please set it in the Settings page.",
        )

    file_bytes = await file.read()

    try:
        if is_pdf:
            raw_text = await asyncio.to_thread(resume_parser.extract_text_from_pdf, file_bytes)
        else:
            raw_text = await asyncio.to_thread(resume_parser.extract_text_from_docx, file_bytes)

        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")

        parsed = await asyncio.to_thread(resume_parser.parse_resume_with_claude, raw_text, anthropic_key)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

    return parsed
