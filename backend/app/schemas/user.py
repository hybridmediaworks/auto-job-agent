"""
backend/app/schemas/user.py

Pydantic schemas for user authentication and management.
"""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserBase(BaseModel):
    """Base user schema with common fields"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """Schema for updating user details"""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user response (without password)"""
    id: int
    is_active: bool
    email_verified: bool
    is_admin: bool
    can_fetch_jobs: bool
    can_run_saved_search: bool
    can_create_resume: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data"""
    username: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for login request — accepts username or email"""
    identifier: str   # username or email
    password: str


# Password strength regex: ≥8 chars, 1 uppercase, 1 digit, 1 special character
_PASSWORD_REGEX = re.compile(r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]).{8,}$')


class RegisterRequest(BaseModel):
    """Schema for new user registration."""
    username: str = Field(..., min_length=3, max_length=50, description="3–50 characters, alphanumeric + underscores")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str

    @model_validator(mode="after")
    def validate_registration(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not _PASSWORD_REGEX.match(self.password):
            raise ValueError(
                "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character"
            )
        return self


class RegisterResponse(BaseModel):
    """Returned after successful registration (before email verification)."""
    message: str
    username: str


class ResendVerificationRequest(BaseModel):
    """Request to resend the verification email."""
    email: EmailStr


class LoginResponse(BaseModel):
    """Returned after successful login — token travels via HttpOnly cookie, not body."""
    message: str
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    """Request to send a password reset link."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request to set a new password using the token from the reset email."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not _PASSWORD_REGEX.match(self.new_password):
            raise ValueError(
                "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character"
            )
        return self


class AdminUserUpdate(BaseModel):
    """Admin-only: update a user's role and feature permissions."""
    is_admin: Optional[bool] = None
    can_fetch_jobs: Optional[bool] = None
    can_run_saved_search: Optional[bool] = None
    can_create_resume: Optional[bool] = None
    is_active: Optional[bool] = None
