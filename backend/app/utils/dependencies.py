"""
backend/app/utils/dependencies.py

FastAPI dependencies for authentication and database access.

Token resolution order:
  1. HttpOnly cookie "access_token" (preferred — set by login endpoint)
  2. Authorization: Bearer <token> header (fallback for API clients)
"""

from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.auth import verify_token


# OAuth2 scheme — auto=False so it doesn't 401 when the header is missing
# (we handle the fallback to cookie ourselves)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _extract_token(
    bearer_token: Optional[str],
    cookie_token: Optional[str],
) -> Optional[str]:
    """
    Return the raw JWT string from whichever source is available.
    Cookie value is stored as "Bearer <token>"; strip the prefix.
    """
    if cookie_token:
        # Cookie value: "Bearer eyJ..."
        return cookie_token.removeprefix("Bearer ").strip()
    if bearer_token:
        return bearer_token
    return None


def get_current_user(
    request: Request,
    bearer_token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> User:
    """
    Dependency to get the current authenticated user.

    Reads JWT from HttpOnly cookie first, then falls back to Authorization header.
    Raises 401 if no valid token is found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    raw_token = _extract_token(bearer_token, access_token)
    if raw_token is None:
        raise credentials_exception

    username = verify_token(raw_token)
    if username is None:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Convenience dependency — explicit alias for get_current_user."""
    return current_user


def require_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Dependency — raises 403 if the current user is not an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_permission(permission: str):
    """
    Factory that returns a FastAPI dependency enforcing a specific permission.

    Admins always pass. Non-admins need the matching boolean column to be True.

    Usage:
        current_user: User = Depends(require_permission("can_fetch_jobs"))
    """
    def _dependency(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.is_admin:
            return current_user
        if not getattr(current_user, permission, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to perform this action",
            )
        return current_user
    return _dependency
