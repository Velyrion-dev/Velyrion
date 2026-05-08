"""Auth Router — signup, login, Google OAuth, token refresh, profile."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import httpx

from database import get_db
from models import User, RefreshToken, UserRole
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
)

logger = logging.getLogger("velyrion.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Request/Response Schemas ─────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from Sign In With Google


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    avatar_url: str
    role: str
    email_verified: bool
    created_at: str


def _user_to_dict(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url or "",
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


def _create_tokens(user: User) -> tuple[str, str, datetime]:
    """Create access + refresh tokens for a user."""
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    access = create_access_token(user.user_id, user.email, role, user.name)
    refresh, expires = create_refresh_token(user.user_id)
    return access, refresh, expires


# ── Signup ───────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password."""
    # Validate
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not req.name.strip():
        raise HTTPException(400, "Name is required")

    # Check duplicate
    existing = await db.execute(select(User).where(User.email == req.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered. Try logging in instead.")

    # Create user
    user = User(
        email=req.email.lower().strip(),
        name=req.name.strip(),
        password_hash=hash_password(req.password),
        role=UserRole.VIEWER,
        email_verified=False,
    )
    db.add(user)

    # Create tokens
    access, refresh, expires = _create_tokens(user)
    db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

    await db.commit()
    logger.info(f"New user registered: {user.email} ({user.user_id})")

    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=_user_to_dict(user),
    )


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(401, "Invalid email or password")

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    # Update last login
    user.last_login = datetime.utcnow()

    # Create tokens
    access, refresh, expires = _create_tokens(user)
    db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

    await db.commit()
    logger.info(f"User logged in: {user.email}")

    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=_user_to_dict(user),
    )


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with a Google ID token (from Sign In With Google).
    Creates a new user if they don't exist.
    """
    # Verify the Google ID token
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
            if r.status_code != 200:
                raise HTTPException(401, "Invalid Google token")
            google_data = r.json()
    except httpx.HTTPError:
        raise HTTPException(401, "Failed to verify Google token")

    google_id = google_data.get("sub")
    email = google_data.get("email", "").lower()
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture", "")

    if not email:
        raise HTTPException(400, "Google account has no email")

    # Check if user exists by google_id or email
    result = await db.execute(
        select(User).where((User.google_id == google_id) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if user:
        # Update Google info
        if not user.google_id:
            user.google_id = google_id
        if picture:
            user.avatar_url = picture
        user.email_verified = True
        user.last_login = datetime.utcnow()
    else:
        # Create new user
        user = User(
            email=email,
            name=name,
            google_id=google_id,
            avatar_url=picture,
            role=UserRole.VIEWER,
            email_verified=True,
        )
        db.add(user)

    access, refresh, expires = _create_tokens(user)
    db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

    await db.commit()
    logger.info(f"Google login: {user.email}")

    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=_user_to_dict(user),
    )


# ── Token Refresh ────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for new access + refresh tokens."""
    # Validate the refresh token JWT
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
    except Exception:
        raise HTTPException(401, "Invalid or expired refresh token")

    user_id = payload.get("sub")

    # Check token in DB
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == req.refresh_token,
            RefreshToken.revoked == False,
        )
    )
    stored_token = result.scalar_one_or_none()
    if not stored_token:
        raise HTTPException(401, "Refresh token revoked or not found")

    # Revoke old token
    stored_token.revoked = True

    # Get user
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(401, "User not found")

    # Create new tokens
    access, refresh, expires = _create_tokens(user)
    db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

    await db.commit()

    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=_user_to_dict(user),
    )


# ── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token (logout)."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == req.refresh_token)
    )
    token = result.scalar_one_or_none()
    if token:
        token.revoked = True
        await db.commit()
    return {"message": "Logged out successfully"}


# ── Get Current User ─────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return _user_to_dict(user)


# ── Update Profile ───────────────────────────────────────────────────────────

@router.put("/me")
async def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile (name, avatar)."""
    if req.name is not None:
        user.name = req.name.strip()
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url
    await db.commit()
    return _user_to_dict(user)


# ── Forgot Password ─────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a password reset token (logged to console for dev, email in prod)."""
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user = result.scalar_one_or_none()

    if user and user.password_hash:
        # Create a short-lived reset token
        from auth import create_access_token
        reset_token = create_access_token(user.user_id, user.email, "reset", user.name)
        # In production: send via email. For dev: log it.
        logger.info(f"PASSWORD RESET TOKEN for {user.email}: {reset_token}")

    # Always return success to prevent email enumeration
    return {"message": "If that email exists, a reset link has been sent."}


# ── Reset Password ───────────────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a valid reset token."""
    try:
        payload = decode_token(req.token)
        if payload.get("role") != "reset":
            raise HTTPException(400, "Invalid reset token")
    except Exception:
        raise HTTPException(400, "Invalid or expired reset token")

    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(400, "Invalid reset token")

    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    user.password_hash = hash_password(req.new_password)
    await db.commit()

    logger.info(f"Password reset completed for {user.email}")
    return {"message": "Password reset successfully. You can now login."}
