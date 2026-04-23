"""
backend/app/routers/admin.py

Admin-only endpoints for user management.

GET  /api/admin/users          — list all users
PATCH /api/admin/users/{id}    — update a user's permissions / role
"""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import AdminUserUpdate, UserResponse
from app.utils.dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
):
    """Return all registered users. Admin only."""
    return db.query(User).order_by(User.created_at.asc()).all()


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_permissions(
    user_id: int,
    payload: AdminUserUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """
    Update a user's permissions and/or admin status.
    An admin cannot remove their own admin flag.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent admin from accidentally revoking their own admin rights
    if user.id == admin.id and payload.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin privileges",
        )

    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.can_fetch_jobs is not None:
        user.can_fetch_jobs = payload.can_fetch_jobs
    if payload.can_run_saved_search is not None:
        user.can_run_saved_search = payload.can_run_saved_search
    if payload.can_create_resume is not None:
        user.can_create_resume = payload.can_create_resume
    if payload.is_active is not None:
        user.is_active = payload.is_active

    # If any permission or admin flag is being granted, ensure the account is active and verified
    any_permission_on = any([
        payload.is_admin,
        payload.can_fetch_jobs,
        payload.can_run_saved_search,
        payload.can_create_resume,
    ])
    if any_permission_on:
        user.is_active = True
        user.email_verified = True

    db.commit()
    db.refresh(user)
    return user
