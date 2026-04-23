"""
backend/app/routers/auth.py

Authentication endpoints: login, logout, register, email verification.

Security decisions:
  - Passwords hashed with bcrypt (work factor auto-calibrated by passlib)
  - JWT stored in HttpOnly + SameSite=Lax cookie — never exposed to JavaScript
  - Registration rate-limited to 5/hour per IP via slowapi
  - Email must be verified before first login
  - Verification tokens are 32-byte URL-safe random strings (secrets module)
    with a 24-hour expiry stored in the database
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.utils.auth import (
    create_access_token,
    generate_verification_token,
    get_password_hash,
    verify_password,
)
from app.utils.dependencies import get_current_user
from app.utils.email import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Limiter instance — must match the one registered on app.state in main.py
limiter = Limiter(key_func=get_remote_address)


# ── Helper ────────────────────────────────────────────────────────────────────

def _set_auth_cookie(response: Response, token: str) -> None:
    """
    Attach the JWT as an HttpOnly cookie.

    HttpOnly  → JS cannot read it (mitigates XSS token theft)
    SameSite  → Lax blocks cross-site POST CSRF while allowing normal navigation
    Secure    → only sent over HTTPS in production
    """
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax",
        max_age=settings.JWT_EXPIRATION_MINUTES * 60,
        path="/",
    )


def _authenticate_user(identifier: str, password: str, db: Session) -> User:
    """Shared login logic — accepts username or email. Raises HTTPException on any failure."""
    # Detect whether the user typed an email or a username
    if "@" in identifier:
        user = db.query(User).filter(User.email == identifier).first()
    else:
        user = db.query(User).filter(User.username == identifier).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your inbox for the verification link.",
        )
    return user


# ── Login / Logout ────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Login with OAuth2 form data (username + password).
    Sets JWT as an HttpOnly cookie and returns user info in the body.
    """
    user = _authenticate_user(form_data.username, form_data.password, db)  # OAuth2 form always sends 'username' field
    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRATION_MINUTES),
    )
    _set_auth_cookie(response, token)
    return LoginResponse(message="Login successful", user=UserResponse.model_validate(user))


@router.post("/login-json", response_model=LoginResponse)
async def login_json(
    response: Response,
    credentials: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Login with JSON body — preferred by the React frontend.
    Sets JWT as an HttpOnly cookie and returns user info in the body.
    """
    user = _authenticate_user(credentials.identifier, credentials.password, db)
    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRATION_MINUTES),
    )
    _set_auth_cookie(response, token)
    return LoginResponse(message="Login successful", user=UserResponse.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie. The frontend should also reset its user state."""
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Logged out successfully"}


# ── Current user ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Return the authenticated user's profile (no password)."""
    return current_user


# ── Registration ──────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register(
    request: Request,
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new account. Open registration — no invite required.

    The user cannot log in until they click the email verification link.
    Password strength is validated by the RegisterRequest schema.
    """
    # Check uniqueness — give a specific error for each field
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken",
        )
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Generate email verification token
    token = generate_verification_token()
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        email_verified=False,
        email_verification_token=token,
        email_verification_expires=expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Fire verification email asynchronously — doesn't block the response
    background_tasks.add_task(
        send_verification_email,
        to_email=user.email,
        username=user.username,
        token=token,
    )

    return RegisterResponse(
        message="Account created! Please check your email to verify your address before logging in.",
        username=user.username,
    )


# ── Email verification ────────────────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(token: str, db: Annotated[Session, Depends(get_db)]):
    """
    Verify a user's email using the token from the link.
    The frontend /verify-email page calls this endpoint on mount.
    """
    user = db.query(User).filter(User.email_verification_token == token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user.email_verification_expires and user.email_verification_expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one.",
        )

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    db.commit()

    return {"message": "Email verified successfully! You can now log in."}


@router.post("/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Resend the verification email.
    Always returns the same message to avoid leaking whether an email is registered.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user and not user.email_verified:
        token = generate_verification_token()
        expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        user.email_verification_token = token
        user.email_verification_expires = expires
        db.commit()

        background_tasks.add_task(
            send_verification_email,
            to_email=user.email,
            username=user.username,
            token=token,
        )

    return {"message": "If that email is registered and unverified, a new verification link has been sent."}


# ── Password reset ─────────────────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Send a password reset link to the given email.
    Always returns the same message regardless of whether the email is registered
    to prevent leaking account existence.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user and user.is_active:
        token = generate_verification_token()
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
        db.commit()

        background_tasks.add_task(
            send_password_reset_email,
            to_email=user.email,
            username=user.username,
            token=token,
        )

    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Set a new password using the token from the reset email.
    Token is single-use and expires after 1 hour.
    """
    user = db.query(User).filter(User.password_reset_token == payload.token).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not user or (user.password_reset_expires and user.password_reset_expires < now):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user.password_hash = get_password_hash(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()

    return {"message": "Password reset successfully. You can now log in with your new password."}
