"""Platform Admin Router — god-view over all orgs, users, groups, agents.

Only accessible by users with UserRole.ADMIN (platform-level admin).
This is different from OrgRole.SUPER_ADMIN which is org-level.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import (
    User, UserRole, Organization, OrgMembership, OrgRole, Invitation,
    Agent, AgentStatus, AgentGroup, AgentGroupMember, AgentGroupAssignment,
    OrgAuditLog,
)
from auth import get_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Platform Admin"])

# All endpoints require platform-level ADMIN role
ADMIN_DEP = Depends(require_role(UserRole.ADMIN))


# ══════════════════════════════════════════════════════════════════════════════
#  PLATFORM STATS — Overview dashboard
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_platform_stats(
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Get platform-wide statistics."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar() or 0
    total_agents = (await db.execute(select(func.count()).select_from(Agent))).scalar() or 0
    total_groups = (await db.execute(select(func.count()).select_from(AgentGroup))).scalar() or 0
    total_invitations = (await db.execute(
        select(func.count()).select_from(Invitation).where(Invitation.accepted == False)
    )).scalar() or 0

    active_agents = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.status == AgentStatus.ACTIVE)
    )).scalar() or 0
    locked_agents = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.status == AgentStatus.LOCKED)
    )).scalar() or 0

    return {
        "total_users": total_users,
        "total_orgs": total_orgs,
        "total_agents": total_agents,
        "active_agents": active_agents,
        "locked_agents": locked_agents,
        "total_groups": total_groups,
        "pending_invitations": total_invitations,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  USERS — View & manage all platform users
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/users")
async def list_all_users(
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """List all users on the platform with their org memberships."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    response = []
    for u in users:
        # Get org memberships
        memberships = (await db.execute(
            select(OrgMembership).where(OrgMembership.user_id == u.user_id)
        )).scalars().all()

        orgs = []
        for m in memberships:
            org = await db.get(Organization, m.org_id)
            if org:
                role_val = m.role.value if hasattr(m.role, "value") else str(m.role)
                orgs.append({"org_id": org.org_id, "name": org.name, "role": role_val})

        response.append({
            "user_id": u.user_id,
            "email": u.email,
            "name": u.name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "email_verified": u.email_verified,
            "avatar_url": u.avatar_url or "",
            "google_id": bool(u.google_id),  # just show if linked
            "created_at": u.created_at.isoformat() if u.created_at else "",
            "last_login": u.last_login.isoformat() if u.last_login else "",
            "orgs": orgs,
        })

    return response


@router.patch("/users/{user_id}/role")
async def change_user_platform_role(
    user_id: str,
    role: str,
    admin: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Change a user's platform-level role."""
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")

    if user_id == admin.user_id:
        raise HTTPException(400, "Cannot change your own role")

    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {role}. Valid: {[r.value for r in UserRole]}")

    old_role = target.role.value if hasattr(target.role, "value") else str(target.role)
    target.role = new_role
    await db.commit()

    return {"message": f"User {target.email} role changed from {old_role} to {new_role.value}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Delete a user from the platform. Cannot delete yourself."""
    if user_id == admin.user_id:
        raise HTTPException(400, "Cannot delete yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")

    # Check if user is SUPER_ADMIN of any org
    memberships = (await db.execute(
        select(OrgMembership).where(OrgMembership.user_id == user_id)
    )).scalars().all()

    for m in memberships:
        role_val = m.role.value if hasattr(m.role, "value") else str(m.role)
        if role_val == "SUPER_ADMIN":
            org = await db.get(Organization, m.org_id)
            raise HTTPException(
                400,
                f"User is the owner of org '{org.name if org else m.org_id}'. Transfer ownership first.",
            )
        await db.delete(m)

    # Remove from groups
    group_memberships = (await db.execute(
        select(AgentGroupMember).where(AgentGroupMember.user_id == user_id)
    )).scalars().all()
    for gm in group_memberships:
        await db.delete(gm)

    email = target.email
    await db.delete(target)
    await db.commit()

    logger.info(f"Platform admin {admin.email} deleted user {email}")
    return {"message": f"User {email} deleted"}


# ══════════════════════════════════════════════════════════════════════════════
#  ORGANIZATIONS — View & manage all orgs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/orgs")
async def list_all_orgs(
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """List all organizations with member/agent/group counts."""
    result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = result.scalars().all()

    response = []
    for org in orgs:
        member_count = (await db.execute(
            select(func.count()).select_from(OrgMembership).where(OrgMembership.org_id == org.org_id)
        )).scalar() or 0
        agent_count = (await db.execute(
            select(func.count()).select_from(Agent).where(Agent.org_id == org.org_id)
        )).scalar() or 0
        group_count = (await db.execute(
            select(func.count()).select_from(AgentGroup).where(AgentGroup.org_id == org.org_id)
        )).scalar() or 0

        # Get owner
        owner = await db.get(User, org.created_by)

        response.append({
            "org_id": org.org_id,
            "name": org.name,
            "slug": org.slug,
            "plan": org.plan,
            "max_agents": org.max_agents,
            "max_members": org.max_members,
            "member_count": member_count,
            "agent_count": agent_count,
            "group_count": group_count,
            "owner_email": owner.email if owner else "unknown",
            "created_at": org.created_at.isoformat() if org.created_at else "",
        })

    return response


@router.get("/orgs/{org_id}")
async def get_org_detail(
    org_id: str,
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed org info including all members, agents, and groups."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")

    # Members
    members_result = await db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id)
    )
    members = []
    for m in members_result.scalars().all():
        u = await db.get(User, m.user_id)
        if u:
            members.append({
                "user_id": u.user_id, "email": u.email, "name": u.name,
                "role": m.role.value if hasattr(m.role, "value") else str(m.role),
                "joined_at": m.joined_at.isoformat() if m.joined_at else "",
            })

    # Agents
    agents_result = await db.execute(
        select(Agent).where(Agent.org_id == org_id)
    )
    agents = []
    for a in agents_result.scalars().all():
        agents.append({
            "agent_id": a.agent_id, "agent_name": a.agent_name,
            "department": a.department,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "total_violations": a.total_violations,
            "total_cost_usd": a.total_cost_usd,
        })

    # Groups
    groups_result = await db.execute(
        select(AgentGroup).where(AgentGroup.org_id == org_id)
    )
    groups = []
    for g in groups_result.scalars().all():
        agent_cnt = (await db.execute(
            select(func.count()).select_from(AgentGroupAssignment).where(AgentGroupAssignment.group_id == g.group_id)
        )).scalar() or 0
        member_cnt = (await db.execute(
            select(func.count()).select_from(AgentGroupMember).where(AgentGroupMember.group_id == g.group_id)
        )).scalar() or 0
        groups.append({
            "group_id": g.group_id, "name": g.name, "description": g.description or "",
            "agent_count": agent_cnt, "member_count": member_cnt,
        })

    return {
        "org_id": org.org_id, "name": org.name, "slug": org.slug, "plan": org.plan,
        "max_agents": org.max_agents, "max_members": org.max_members,
        "created_at": org.created_at.isoformat() if org.created_at else "",
        "members": members, "agents": agents, "groups": groups,
    }


class OrgPlanUpdate(BaseModel):
    plan: Optional[str] = None
    max_agents: Optional[int] = None
    max_members: Optional[int] = None

@router.patch("/orgs/{org_id}")
async def update_org(
    org_id: str,
    req: OrgPlanUpdate,
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Update org plan/limits. Platform admin only."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")

    if req.plan is not None:
        org.plan = req.plan
    if req.max_agents is not None:
        org.max_agents = req.max_agents
    if req.max_members is not None:
        org.max_members = req.max_members
    await db.commit()

    return {"message": f"Organization '{org.name}' updated", "plan": org.plan, "max_agents": org.max_agents, "max_members": org.max_members}


@router.delete("/orgs/{org_id}")
async def delete_org(
    org_id: str,
    admin: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Delete an organization and all its data. Platform admin only."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")

    org_name = org.name

    # Delete groups & assignments
    groups = (await db.execute(select(AgentGroup).where(AgentGroup.org_id == org_id))).scalars().all()
    for g in groups:
        assigns = (await db.execute(select(AgentGroupAssignment).where(AgentGroupAssignment.group_id == g.group_id))).scalars().all()
        for a in assigns:
            await db.delete(a)
        members = (await db.execute(select(AgentGroupMember).where(AgentGroupMember.group_id == g.group_id))).scalars().all()
        for m in members:
            await db.delete(m)
        await db.delete(g)

    # Delete memberships
    memberships = (await db.execute(select(OrgMembership).where(OrgMembership.org_id == org_id))).scalars().all()
    for m in memberships:
        await db.delete(m)

    # Delete invitations
    invitations = (await db.execute(select(Invitation).where(Invitation.org_id == org_id))).scalars().all()
    for i in invitations:
        await db.delete(i)

    # Delete audit logs
    audit_logs = (await db.execute(select(OrgAuditLog).where(OrgAuditLog.org_id == org_id))).scalars().all()
    for l in audit_logs:
        await db.delete(l)

    # Unlink agents (don't delete them, just remove org association)
    agents = (await db.execute(select(Agent).where(Agent.org_id == org_id))).scalars().all()
    for a in agents:
        a.org_id = None

    await db.delete(org)
    await db.commit()

    logger.info(f"Platform admin {admin.email} deleted org '{org_name}'")
    return {"message": f"Organization '{org_name}' deleted"}


# ══════════════════════════════════════════════════════════════════════════════
#  AUDIT — Platform-wide audit log
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/audit-log")
async def get_platform_audit_log(
    limit: int = 100,
    user: User = ADMIN_DEP,
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs across ALL organizations. Platform admin only."""
    result = await db.execute(
        select(OrgAuditLog)
        .order_by(OrgAuditLog.created_at.desc())
        .limit(min(limit, 500))
    )
    logs = result.scalars().all()

    response = []
    for l in logs:
        org = await db.get(Organization, l.org_id)
        response.append({
            "log_id": l.log_id,
            "org_name": org.name if org else "Deleted Org",
            "action": l.action,
            "actor_email": l.actor_email,
            "target_email": l.target_email or "",
            "details": l.details or "",
            "created_at": l.created_at.isoformat() if l.created_at else "",
        })

    return response
