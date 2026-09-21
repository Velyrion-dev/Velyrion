"""Auth Router — signup, login, Google OAuth, token refresh, profile."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import httpx

from database import get_db
from models import User, RefreshToken, UserRole, Organization, OrgMembership, OrgRole
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


async def _user_to_dict(user: User, db: AsyncSession = None) -> dict:
    data = {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url or "",
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else "",
        "org": None,
    }
    if db:
        # Fetch org membership
        from sqlalchemy import select as sa_select
        result = await db.execute(
            sa_select(OrgMembership).where(OrgMembership.user_id == user.user_id)
        )
        membership = result.scalars().first()
        if membership:
            org = await db.get(Organization, membership.org_id)
            if org:
                data["org"] = {
                    "org_id": org.org_id,
                    "name": org.name,
                    "slug": org.slug,
                    "plan": org.plan,
                    "role": membership.role.value if hasattr(membership.role, "value") else str(membership.role),
                }
    return data


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
    await db.flush()  # get user_id

    # Auto-create personal organization
    import re
    slug = re.sub(r'[^a-z0-9-]', '', req.name.strip().lower().replace(' ', '-'))[:48] or "my-org"
    # Ensure unique slug
    import secrets as _secrets
    slug = f"{slug}-{_secrets.token_hex(3)}"
    org = Organization(
        name=f"{req.name.strip()}'s Organization",
        slug=slug,
        created_by=user.user_id,
    )
    db.add(org)
    await db.flush()

    membership = OrgMembership(
        org_id=org.org_id,
        user_id=user.user_id,
        role=OrgRole.SUPER_ADMIN,
    )
    db.add(membership)

    # Create tokens
    access, refresh, expires = _create_tokens(user)
    db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

    await db.commit()
    logger.info(f"New user registered: {user.email} ({user.user_id}) + org '{org.name}'")

    return AuthResponse(
        access_token=access,
        refresh_token=refresh,
        user=await _user_to_dict(user, db),
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
        user=await _user_to_dict(user, db),
    )


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with a Google ID token (from Sign In With Google).
    Creates a new user if they don't exist.
    """
    # Step 1: Verify the Google ID token
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
            if r.status_code != 200:
                logger.error(f"Google tokeninfo returned {r.status_code}: {r.text[:200]}")
                raise HTTPException(401, "Invalid Google token")
            google_data = r.json()
    except httpx.HTTPError as e:
        logger.error(f"Google tokeninfo HTTP error: {e}")
        raise HTTPException(401, "Failed to verify Google token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google tokeninfo unexpected error: {e}")
        raise HTTPException(500, f"Token verification failed: {type(e).__name__}")

    # Step 2: Extract + validate user info
    try:
        google_id = google_data.get("sub")
        email = google_data.get("email", "").lower().strip()
        name = google_data.get("name") or google_data.get("given_name") or email.split("@")[0]
        picture = google_data.get("picture", "")

        if not email:
            raise HTTPException(400, "Google account has no email")
        if not google_id:
            raise HTTPException(400, "Google token missing user ID (sub)")

        # Validate audience — token must be issued for OUR app
        token_aud = google_data.get("aud", "")
        if GOOGLE_CLIENT_ID and token_aud != GOOGLE_CLIENT_ID:
            logger.warning(f"Google token audience mismatch: {token_aud} != {GOOGLE_CLIENT_ID}")
            raise HTTPException(401, "Google token was not issued for this application")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google data extraction error: {e}, data={google_data}")
        raise HTTPException(500, f"Data extraction failed: {type(e).__name__}")

    # Step 3: Find or create user
    try:
        # First try by google_id, then by email (avoid OR query issues)
        user = None
        if google_id:
            result = await db.execute(select(User).where(User.google_id == google_id))
            user = result.scalar_one_or_none()

        if not user:
            result = await db.execute(select(User).where(User.email == email))
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
            # Create new user — set user_id explicitly
            user = User(
                user_id=str(uuid.uuid4()),
                email=email,
                name=name,
                google_id=google_id,
                avatar_url=picture,
                role=UserRole.VIEWER,
                email_verified=True,
            )
            db.add(user)
            await db.flush()  # Ensure user_id is persisted before creating RefreshToken

        access, refresh, expires = _create_tokens(user)
        db.add(RefreshToken(user_id=user.user_id, token=refresh, expires_at=expires))

        await db.commit()
        logger.info(f"Google login: {user.email}")

        return AuthResponse(
            access_token=access,
            refresh_token=refresh,
            user=await _user_to_dict(user, db),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth DB error: {type(e).__name__}: {e}")
        await db.rollback()
        raise HTTPException(500, f"Database error: {type(e).__name__}: {str(e)[:100]}")


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
        user=await _user_to_dict(user, db),
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
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get the current authenticated user's profile."""
    return await _user_to_dict(user, db)


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
    return await _user_to_dict(user, db)


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
        # In production: send via email. For dev: log that a token was generated (NOT the token itself).
        logger.info(f"Password reset token generated for {user.email}")
        # TODO: Send reset_token via email service

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
