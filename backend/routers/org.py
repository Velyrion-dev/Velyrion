"""Organization Router — org management, member invitations, role changes."""

import re
import secrets
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional

from database import get_db
from models import (
    User, Organization, OrgMembership, OrgRole, Invitation, Agent,
    AgentGroup, AgentGroupMember, AgentGroupAssignment,
)
from auth import get_current_user
from routers.user_scope import get_user_membership, get_user_org, require_org_role

logger = logging.getLogger("velyrion.org")

router = APIRouter(prefix="/api/org", tags=["organization"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class OrgCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None  # auto-generated from name if not provided

class OrgUpdateRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    max_agents: Optional[int] = None
    max_members: Optional[int] = None

class OrgResponse(BaseModel):
    org_id: str
    name: str
    slug: str
    plan: str
    max_agents: int
    max_members: int
    member_count: int
    agent_count: int
    created_by: str
    created_at: str

class MemberResponse(BaseModel):
    user_id: str
    email: str
    name: str
    avatar_url: str
    role: str
    joined_at: str

class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "VIEWER"

class InviteResponse(BaseModel):
    invite_id: str
    email: str
    role: str
    token: str
    expires_at: str

class AcceptInviteRequest(BaseModel):
    token: str

class RoleChangeRequest(BaseModel):
    role: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """Generate a URL-safe slug from org name."""
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', name.lower())
    slug = re.sub(r'[\s-]+', '-', slug).strip('-')
    return slug[:64] or "org"


# ── Create Organization ─────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_org(
    req: OrgCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. The creator becomes SUPER_ADMIN."""
    # Check if user already belongs to an org
    existing = await get_user_membership(user, db)
    if existing:
        raise HTTPException(400, "You already belong to an organization. Leave it first to create a new one.")

    if not req.name or len(req.name.strip()) < 2:
        raise HTTPException(400, "Organization name must be at least 2 characters")

    slug = _slugify(req.slug or req.name)

    # Check slug uniqueness
    result = await db.execute(select(Organization).where(Organization.slug == slug))
    if result.scalar_one_or_none():
        slug = f"{slug}-{secrets.token_hex(3)}"

    org = Organization(
        name=req.name.strip(),
        slug=slug,
        created_by=user.user_id,
    )
    db.add(org)
    await db.flush()  # get org_id

    # Add creator as SUPER_ADMIN
    membership = OrgMembership(
        org_id=org.org_id,
        user_id=user.user_id,
        role=OrgRole.SUPER_ADMIN,
    )
    db.add(membership)

    # Migrate user's existing agents to this org
    agents_result = await db.execute(
        select(Agent).where(Agent.owner_id == user.user_id, Agent.org_id == None)  # noqa: E711
    )
    for agent in agents_result.scalars().all():
        agent.org_id = org.org_id

    await db.commit()
    logger.info(f"Organization created: {org.name} ({org.org_id}) by {user.email}")

    return {
        "org_id": org.org_id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "message": f"Organization '{org.name}' created successfully",
    }


# ── Get Current Org ──────────────────────────────────────────────────────────

@router.get("")
async def get_org(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's organization details."""
    org = await get_user_org(user, db)
    if not org:
        return {"org": None, "message": "You don't belong to any organization"}

    # Count members
    member_count = (await db.execute(
        select(func.count()).select_from(OrgMembership).where(OrgMembership.org_id == org.org_id)
    )).scalar() or 0

    # Count agents
    agent_count = (await db.execute(
        select(func.count()).select_from(Agent).where(Agent.org_id == org.org_id)
    )).scalar() or 0

    # Get user's role
    membership = await get_user_membership(user, db)

    return {
        "org_id": org.org_id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "max_agents": org.max_agents,
        "max_members": org.max_members,
        "member_count": member_count,
        "agent_count": agent_count,
        "created_by": org.created_by,
        "created_at": org.created_at.isoformat() if org.created_at else "",
        "your_role": membership.role.value if membership and hasattr(membership.role, "value") else str(membership.role) if membership else None,
    }


# ── Update Org ───────────────────────────────────────────────────────────────

@router.put("")
async def update_org(
    req: OrgUpdateRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Update organization settings. SUPER_ADMIN only."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    if req.name is not None:
        org.name = req.name.strip()
    if req.plan is not None and req.plan in ("free", "pro", "enterprise"):
        org.plan = req.plan
    if req.max_agents is not None:
        org.max_agents = max(1, req.max_agents)
    if req.max_members is not None:
        org.max_members = max(1, req.max_members)

    await db.commit()
    return {"message": "Organization updated", "name": org.name, "plan": org.plan}


# ── List Members ─────────────────────────────────────────────────────────────

@router.get("/members")
async def list_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all members of the current organization."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "You don't belong to any organization")

    result = await db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org.org_id)
    )
    memberships = result.scalars().all()

    members = []
    for m in memberships:
        member_user = await db.get(User, m.user_id)
        if member_user:
            members.append({
                "user_id": member_user.user_id,
                "email": member_user.email,
                "name": member_user.name,
                "avatar_url": member_user.avatar_url or "",
                "role": m.role.value if hasattr(m.role, "value") else str(m.role),
                "joined_at": m.joined_at.isoformat() if m.joined_at else "",
            })

    return members


# ── Invite Member ────────────────────────────────────────────────────────────

@router.post("/invite")
async def invite_member(
    req: InviteRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user to the organization by email. ADMIN+ only."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    # Validate role
    try:
        invite_role = OrgRole(req.role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {req.role}. Must be one of: {', '.join(r.value for r in OrgRole)}")

    # Can't invite as SUPER_ADMIN (only one per org)
    if invite_role == OrgRole.SUPER_ADMIN:
        raise HTTPException(400, "Cannot invite as SUPER_ADMIN. Transfer ownership instead.")

    # Check member limit
    member_count = (await db.execute(
        select(func.count()).select_from(OrgMembership).where(OrgMembership.org_id == org.org_id)
    )).scalar() or 0
    if member_count >= org.max_members:
        raise HTTPException(400, f"Organization member limit reached ({org.max_members}). Upgrade your plan.")

    # Check if user already a member
    existing_user = (await db.execute(select(User).where(User.email == req.email.lower()))).scalar_one_or_none()
    if existing_user:
        existing_membership = (await db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org.org_id,
                OrgMembership.user_id == existing_user.user_id,
            )
        )).scalar_one_or_none()
        if existing_membership:
            raise HTTPException(400, f"{req.email} is already a member of this organization")

    # Check for existing pending invite
    existing_invite = (await db.execute(
        select(Invitation).where(
            Invitation.org_id == org.org_id,
            Invitation.email == req.email.lower(),
            Invitation.accepted == False,
        )
    )).scalar_one_or_none()
    if existing_invite:
        raise HTTPException(400, f"A pending invitation already exists for {req.email}")

    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        org_id=org.org_id,
        email=req.email.lower(),
        role=invite_role,
        token=token,
        invited_by=user.user_id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invitation)
    await db.commit()

    logger.info(f"Invitation sent: {req.email} → {org.name} as {invite_role.value} (by {user.email})")

    return {
        "invite_id": invitation.invite_id,
        "email": invitation.email,
        "role": invite_role.value,
        "token": token,
        "expires_at": invitation.expires_at.isoformat(),
        "message": f"Invitation sent to {req.email}",
    }


# ── List Pending Invitations ─────────────────────────────────────────────────

@router.get("/invitations")
async def list_invitations(
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """List pending invitations for the organization."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    result = await db.execute(
        select(Invitation).where(
            Invitation.org_id == org.org_id,
            Invitation.accepted == False,
        )
    )
    invitations = result.scalars().all()

    return [
        {
            "invite_id": inv.invite_id,
            "email": inv.email,
            "role": inv.role.value if hasattr(inv.role, "value") else str(inv.role),
            "token": inv.token,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else "",
            "created_at": inv.created_at.isoformat() if inv.created_at else "",
        }
        for inv in invitations
    ]


# ── Accept Invitation ────────────────────────────────────────────────────────

@router.post("/invite/accept")
async def accept_invitation(
    req: AcceptInviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept an organization invitation using the invite token."""
    # Find invitation
    result = await db.execute(
        select(Invitation).where(
            Invitation.token == req.token,
            Invitation.accepted == False,
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(404, "Invalid or already used invitation token")

    # Check expiry
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invitation has expired")

    # Check email matches
    if invitation.email != user.email.lower():
        raise HTTPException(403, "This invitation was sent to a different email address")

    # Check if already in an org
    existing = await get_user_membership(user, db)
    if existing:
        raise HTTPException(400, "You already belong to an organization. Leave it first.")

    # Accept
    invitation.accepted = True
    membership = OrgMembership(
        org_id=invitation.org_id,
        user_id=user.user_id,
        role=invitation.role,
        invited_by=invitation.invited_by,
    )
    db.add(membership)

    # Migrate user's agents to the org
    agents_result = await db.execute(
        select(Agent).where(Agent.owner_id == user.user_id, Agent.org_id == None)  # noqa: E711
    )
    for agent in agents_result.scalars().all():
        agent.org_id = invitation.org_id

    await db.commit()

    org = await db.get(Organization, invitation.org_id)
    logger.info(f"Invitation accepted: {user.email} joined {org.name if org else 'unknown'}")

    return {
        "message": f"Welcome to {org.name if org else 'the organization'}!",
        "org_id": invitation.org_id,
        "role": invitation.role.value if hasattr(invitation.role, "value") else str(invitation.role),
    }


# ── Change Member Role ───────────────────────────────────────────────────────

@router.put("/members/{member_user_id}/role")
async def change_member_role(
    member_user_id: str,
    req: RoleChangeRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Change a member's role. SUPER_ADMIN only."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    # Validate role
    try:
        new_role = OrgRole(req.role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {req.role}")

    if new_role == OrgRole.SUPER_ADMIN:
        raise HTTPException(400, "Cannot assign SUPER_ADMIN role. Use ownership transfer instead.")

    # Find membership
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.org_id == org.org_id,
            OrgMembership.user_id == member_user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Member not found in organization")

    # Can't change own role
    if member_user_id == user.user_id:
        raise HTTPException(400, "Cannot change your own role")

    old_role = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
    membership.role = new_role
    await db.commit()

    member_user = await db.get(User, member_user_id)
    logger.info(f"Role changed: {member_user.email if member_user else member_user_id} {old_role} → {new_role.value} in {org.name}")

    return {
        "message": f"Role updated to {new_role.value}",
        "user_id": member_user_id,
        "old_role": old_role,
        "new_role": new_role.value,
    }


# ── Remove Member ────────────────────────────────────────────────────────────

@router.delete("/members/{member_user_id}")
async def remove_member(
    member_user_id: str,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the organization. ADMIN+ only."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    # Can't remove yourself
    if member_user_id == user.user_id:
        raise HTTPException(400, "Cannot remove yourself. Use /leave instead.")

    # Can't remove SUPER_ADMIN
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.org_id == org.org_id,
            OrgMembership.user_id == member_user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Member not found")

    member_role = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
    if member_role == "SUPER_ADMIN":
        raise HTTPException(400, "Cannot remove the organization owner")

    await db.delete(membership)
    await db.commit()

    member_user = await db.get(User, member_user_id)
    logger.info(f"Member removed: {member_user.email if member_user else member_user_id} from {org.name}")

    return {"message": f"Member removed from organization"}


# ── Leave Organization ───────────────────────────────────────────────────────

@router.post("/leave")
async def leave_org(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave the current organization. SUPER_ADMIN cannot leave (must transfer ownership)."""
    membership = await get_user_membership(user, db)
    if not membership:
        raise HTTPException(400, "You don't belong to any organization")

    member_role = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
    if member_role == "SUPER_ADMIN":
        raise HTTPException(400, "Organization owner cannot leave. Transfer ownership first or delete the organization.")

    org = await db.get(Organization, membership.org_id)
    await db.delete(membership)
    await db.commit()

    logger.info(f"Member left: {user.email} left {org.name if org else 'unknown'}")
    return {"message": "You have left the organization"}


# ══════════════════════════════════════════════════════════════════════════════
#  AGENT GROUPS — Fine-grained visibility control
# ══════════════════════════════════════════════════════════════════════════════

class GroupCreateRequest(BaseModel):
    name: str
    description: str = ""

class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class GroupAgentRequest(BaseModel):
    agent_id: str

class GroupMemberRequest(BaseModel):
    user_id: str


# ── Create Group ─────────────────────────────────────────────────────────────

@router.post("/groups", status_code=201)
async def create_group(
    req: GroupCreateRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent group within the organization. ADMIN+ only."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    if not req.name or len(req.name.strip()) < 2:
        raise HTTPException(400, "Group name must be at least 2 characters")

    group = AgentGroup(
        org_id=org.org_id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else "",
        created_by=user.user_id,
    )
    db.add(group)
    await db.commit()

    logger.info(f"Group created: '{group.name}' in {org.name} by {user.email}")
    return {
        "group_id": group.group_id,
        "name": group.name,
        "description": group.description,
        "message": f"Group '{group.name}' created",
    }


# ── List Groups ──────────────────────────────────────────────────────────────

@router.get("/groups")
async def list_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List agent groups. ADMIN+ sees all, others see their own groups."""
    from routers.user_scope import get_user_org_role
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "You don't belong to any organization")

    org_role = await get_user_org_role(user, db)

    # ADMIN+ sees all groups
    if org_role in (OrgRole.SUPER_ADMIN, OrgRole.ADMIN):
        result = await db.execute(
            select(AgentGroup).where(AgentGroup.org_id == org.org_id)
        )
    else:
        # Others see only groups they belong to
        member_groups = await db.execute(
            select(AgentGroupMember.group_id).where(AgentGroupMember.user_id == user.user_id)
        )
        group_ids = [row[0] for row in member_groups.all()]
        if not group_ids:
            return []
        result = await db.execute(
            select(AgentGroup).where(
                AgentGroup.group_id.in_(group_ids),
                AgentGroup.org_id == org.org_id,
            )
        )

    groups = result.scalars().all()
    response = []
    for g in groups:
        # Count agents and members in group
        agent_count = (await db.execute(
            select(func.count()).select_from(AgentGroupAssignment).where(AgentGroupAssignment.group_id == g.group_id)
        )).scalar() or 0
        member_count = (await db.execute(
            select(func.count()).select_from(AgentGroupMember).where(AgentGroupMember.group_id == g.group_id)
        )).scalar() or 0

        response.append({
            "group_id": g.group_id,
            "name": g.name,
            "description": g.description or "",
            "agent_count": agent_count,
            "member_count": member_count,
            "created_at": g.created_at.isoformat() if g.created_at else "",
        })

    return response


# ── Get Group Detail ─────────────────────────────────────────────────────────

@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get group detail with agents and members."""
    org = await get_user_org(user, db)
    if not org:
        raise HTTPException(404, "Organization not found")

    group = await db.get(AgentGroup, group_id)
    if not group or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    # Get agents in group
    agents_result = await db.execute(
        select(AgentGroupAssignment.agent_id).where(AgentGroupAssignment.group_id == group_id)
    )
    agent_ids = [row[0] for row in agents_result.all()]
    agents = []
    for aid in agent_ids:
        agent = await db.get(Agent, aid)
        if agent:
            agents.append({"agent_id": agent.agent_id, "agent_name": agent.agent_name, "status": agent.status.value if hasattr(agent.status, 'value') else str(agent.status)})

    # Get members in group
    members_result = await db.execute(
        select(AgentGroupMember.user_id).where(AgentGroupMember.group_id == group_id)
    )
    member_ids = [row[0] for row in members_result.all()]
    members = []
    for uid in member_ids:
        u = await db.get(User, uid)
        if u:
            members.append({"user_id": u.user_id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url or ""})

    return {
        "group_id": group.group_id,
        "name": group.name,
        "description": group.description or "",
        "agents": agents,
        "members": members,
        "created_at": group.created_at.isoformat() if group.created_at else "",
    }


# ── Update Group ─────────────────────────────────────────────────────────────

@router.put("/groups/{group_id}")
async def update_group(
    group_id: str,
    req: GroupUpdateRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Update a group's name or description. ADMIN+ only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    if req.name is not None:
        group.name = req.name.strip()
    if req.description is not None:
        group.description = req.description.strip()
    await db.commit()

    return {"message": "Group updated", "name": group.name}


# ── Delete Group ─────────────────────────────────────────────────────────────

@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Delete a group and all its assignments. SUPER_ADMIN only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    # Delete all agent assignments and member assignments
    agent_assigns = await db.execute(
        select(AgentGroupAssignment).where(AgentGroupAssignment.group_id == group_id)
    )
    for a in agent_assigns.scalars().all():
        await db.delete(a)

    member_assigns = await db.execute(
        select(AgentGroupMember).where(AgentGroupMember.group_id == group_id)
    )
    for m in member_assigns.scalars().all():
        await db.delete(m)

    group_name = group.name
    await db.delete(group)
    await db.commit()

    logger.info(f"Group deleted: '{group_name}' in {org.name} by {user.email}")
    return {"message": f"Group '{group_name}' deleted"}


# ── Assign Agent to Group ────────────────────────────────────────────────────

@router.post("/groups/{group_id}/agents")
async def assign_agent_to_group(
    group_id: str,
    req: GroupAgentRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Assign an agent to a group. ADMIN+ only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    agent = await db.get(Agent, req.agent_id)
    if not agent or agent.org_id != org.org_id:
        raise HTTPException(404, "Agent not found in this organization")

    # Check if already assigned
    existing = (await db.execute(
        select(AgentGroupAssignment).where(
            AgentGroupAssignment.group_id == group_id,
            AgentGroupAssignment.agent_id == req.agent_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Agent already assigned to this group")

    db.add(AgentGroupAssignment(group_id=group_id, agent_id=req.agent_id))
    await db.commit()

    return {"message": f"Agent '{agent.agent_name}' added to group '{group.name}'"}


# ── Remove Agent from Group ──────────────────────────────────────────────────

@router.delete("/groups/{group_id}/agents/{agent_id}")
async def remove_agent_from_group(
    group_id: str,
    agent_id: str,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Remove an agent from a group. ADMIN+ only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    assignment = (await db.execute(
        select(AgentGroupAssignment).where(
            AgentGroupAssignment.group_id == group_id,
            AgentGroupAssignment.agent_id == agent_id,
        )
    )).scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Agent not assigned to this group")

    await db.delete(assignment)
    await db.commit()

    return {"message": "Agent removed from group"}


# ── Add Member to Group ──────────────────────────────────────────────────────

@router.post("/groups/{group_id}/members")
async def add_member_to_group(
    group_id: str,
    req: GroupMemberRequest,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Add a user to a group. ADMIN+ only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    # Verify user is org member
    target_membership = (await db.execute(
        select(OrgMembership).where(
            OrgMembership.org_id == org.org_id,
            OrgMembership.user_id == req.user_id,
        )
    )).scalar_one_or_none()
    if not target_membership:
        raise HTTPException(404, "User is not a member of this organization")

    # Check if already in group
    existing = (await db.execute(
        select(AgentGroupMember).where(
            AgentGroupMember.group_id == group_id,
            AgentGroupMember.user_id == req.user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "User already in this group")

    db.add(AgentGroupMember(group_id=group_id, user_id=req.user_id))
    await db.commit()

    target_user = await db.get(User, req.user_id)
    return {"message": f"{target_user.name if target_user else 'User'} added to group '{group.name}'"}


# ── Remove Member from Group ────────────────────────────────────────────────

@router.delete("/groups/{group_id}/members/{member_user_id}")
async def remove_member_from_group(
    group_id: str,
    member_user_id: str,
    user: User = Depends(require_org_role(OrgRole.SUPER_ADMIN, OrgRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user from a group. ADMIN+ only."""
    org = await get_user_org(user, db)
    group = await db.get(AgentGroup, group_id)
    if not group or not org or group.org_id != org.org_id:
        raise HTTPException(404, "Group not found")

    membership = (await db.execute(
        select(AgentGroupMember).where(
            AgentGroupMember.group_id == group_id,
            AgentGroupMember.user_id == member_user_id,
        )
    )).scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "User not in this group")

    await db.delete(membership)
    await db.commit()

    return {"message": "Member removed from group"}
