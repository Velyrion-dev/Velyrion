"""Shared helpers for org-scoped data access across routers."""

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import (
    Agent, User, Organization, OrgMembership, OrgRole,
    AgentGroup, AgentGroupMember, AgentGroupAssignment,
)
from database import get_db


async def get_user_membership(user: User, db: AsyncSession) -> OrgMembership | None:
    """Get the user's active organization membership (supports multi-org via active_org_id)."""
    # If user has an active org set, use that
    if user.active_org_id:
        result = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.user_id,
                OrgMembership.org_id == user.active_org_id,
            )
        )
        membership = result.scalars().first()
        if membership:
            return membership

    # Fallback: return first membership
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
    # Normalize to OrgRole enum
    role_val = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
    try:
        return OrgRole(role_val)
    except ValueError:
        return None


async def get_org_agent_ids(user: User, db: AsyncSession) -> list[str]:
    """
    Get agent_ids visible to this user based on org role + group membership.

    - SUPER_ADMIN / ADMIN: see ALL org agents
    - OPERATOR / VIEWER: see only agents in their assigned groups
    - No org: fallback to user's own agents (backward compat)
    """
    org_id = await get_user_org_id(user, db)
    if not org_id:
        # Fallback: return user's own agents (backward compat)
        result = await db.execute(
            select(Agent.agent_id).where(Agent.owner_id == user.user_id)
        )
        return [row[0] for row in result.all()]

    org_role = await get_user_org_role(user, db)

    # SUPER_ADMIN and ADMIN see ALL org agents
    if org_role in (OrgRole.SUPER_ADMIN, OrgRole.ADMIN):
        result = await db.execute(
            select(Agent.agent_id).where(Agent.org_id == org_id)
        )
        return [row[0] for row in result.all()]

    # OPERATOR and VIEWER: only agents in their assigned groups
    # 1. Find groups the user belongs to
    group_result = await db.execute(
        select(AgentGroupMember.group_id).where(
            AgentGroupMember.user_id == user.user_id
        )
    )
    user_group_ids = [row[0] for row in group_result.all()]

    if not user_group_ids:
        return []  # Not in any group → sees nothing

    # 2. Find agents assigned to those groups (within this org)
    agent_result = await db.execute(
        select(AgentGroupAssignment.agent_id).where(
            AgentGroupAssignment.group_id.in_(user_group_ids)
        )
    )
    group_agent_ids = list(set(row[0] for row in agent_result.all()))

    # 3. Filter to only agents that actually belong to this org
    if group_agent_ids:
        valid_result = await db.execute(
            select(Agent.agent_id).where(
                Agent.agent_id.in_(group_agent_ids),
                Agent.org_id == org_id,
            )
        )
        return [row[0] for row in valid_result.all()]

    return []


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
