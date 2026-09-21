"""Shared helpers for org-scoped data access across routers."""

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Agent, User, Organization, OrgMembership, OrgRole
from database import get_db


async def get_user_membership(user: User, db: AsyncSession) -> OrgMembership | None:
    """Get the user's active organization membership."""
    result = await db.execute(
        select(OrgMembership).where(OrgMembership.user_id == user.user_id)
    )
    return result.scalars().first()


async def get_user_org(user: User, db: AsyncSession) -> Organization | None:
    """Get the user's active organization."""
    membership = await get_user_membership(user, db)
    if not membership:
        return None
    org = await db.get(Organization, membership.org_id)
    return org


async def get_user_org_id(user: User, db: AsyncSession) -> str | None:
    """Get the user's org_id (or None if not in any org)."""
    membership = await get_user_membership(user, db)
    return membership.org_id if membership else None


async def get_user_org_role(user: User, db: AsyncSession) -> OrgRole | None:
    """Get the user's role within their organization."""
    membership = await get_user_membership(user, db)
    if not membership:
        return None
    return membership.role


async def get_org_agent_ids(user: User, db: AsyncSession) -> list[str]:
    """Get all agent_ids in the user's organization."""
    org_id = await get_user_org_id(user, db)
    if not org_id:
        # Fallback: return user's own agents (backward compat)
        result = await db.execute(
            select(Agent.agent_id).where(Agent.owner_id == user.user_id)
        )
        return [row[0] for row in result.all()]

    result = await db.execute(
        select(Agent.agent_id).where(Agent.org_id == org_id)
    )
    return [row[0] for row in result.all()]


# Backward compatibility alias
async def get_user_agent_ids(user: User, db: AsyncSession) -> list[str]:
    """DEPRECATED: Use get_org_agent_ids instead. Kept for backward compat."""
    return await get_org_agent_ids(user, db)


def require_org_role(*roles: OrgRole):
    """
    Dependency factory: require the user has one of the specified org roles.

    Usage:
        @router.post("/admin-action")
        async def admin_only(user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN))):
            ...
    """
    from auth import get_current_user

    async def _check(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        membership = await get_user_membership(user, db)
        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of any organization.",
            )

        member_role = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
        allowed = [r.value if hasattr(r, "value") else str(r) for r in roles]
        if member_role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {', '.join(allowed)}",
            )
        return user
    return _check
