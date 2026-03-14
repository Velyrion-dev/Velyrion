"""Agent Registry Router — CRUD operations for AI agent profiles."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Agent, AgentStatus
from schemas import AgentCreate, AgentUpdate, AgentResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("", response_model=AgentResponse, status_code=201)
async def register_agent(data: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(
        agent_name=data.agent_name,
        owner_email=data.owner_email,
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
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Agent).order_by(Agent.created_at.desc())
    if department:
        stmt = stmt.where(Agent.department == department)
    if status:
        stmt = stmt.where(Agent.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, data: AgentUpdate, db: AsyncSession = Depends(get_db)
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}")
async def deactivate_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = AgentStatus.DEACTIVATED
    await db.commit()
    return {"status": "deactivated", "agent_id": agent_id}
