"""Agent Registry Router — CRUD operations for AI agent profiles (auth-protected)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Agent, AgentStatus, User
from schemas import AgentCreate, AgentUpdate, AgentResponse
from auth import get_current_user

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ── Helper: verify agent belongs to current user ─────────────────────────────

async def _get_user_agent(agent_id: str, user: User, db: AsyncSession) -> Agent:
    """Fetch an agent and verify it belongs to the current user."""
    agent = await db.get(Agent, agent_id)
    if not agent or agent.owner_id != user.user_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=AgentResponse, status_code=201)
async def register_agent(
    data: AgentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        agent_name=data.agent_name,
        owner_id=user.user_id,
        owner_email=user.email,
        department=data.department,
        allowed_tools=data.allowed_tools,
        allowed_data_sources=data.allowed_data_sources,
        max_token_budget=data.max_token_budget,
        max_task_duration_seconds=data.max_task_duration_seconds,
        requires_human_approval_for=data.requires_human_approval_for,
        compliance_frameworks=data.compliance_frameworks,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    department: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Agent)
        .where(Agent.owner_id == user.user_id)
        .order_by(Agent.created_at.desc())
    )
    if department:
        stmt = stmt.where(Agent.department == department)
    if status:
        stmt = stmt.where(Agent.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_agent(agent_id, user, db)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_user_agent(agent_id, user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}")
async def deactivate_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_user_agent(agent_id, user, db)
    agent.status = AgentStatus.DEACTIVATED
    await db.commit()
    return {"status": "deactivated", "agent_id": agent_id}
