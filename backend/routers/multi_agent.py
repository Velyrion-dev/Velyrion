"""Multi-Agent Protocol Router — inter-agent flow governance and policies."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import AgentFlow, InterAgentPolicy, Agent
from pydantic import BaseModel

router = APIRouter(prefix="/api/multi-agent", tags=["multi-agent"])


class FlowCreate(BaseModel):
    from_agent_id: str
    to_agent_id: str
    action: str
    status: str = "governed"


class PolicyCreate(BaseModel):
    name: str
    rule: str
    enforcement: str = "enforced"


@router.get("/flows")
async def list_flows(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentFlow).order_by(AgentFlow.timestamp.desc()).limit(limit))
    flows = result.scalars().all()

    # Enrich with agent names
    agent_map = {}
    agents = (await db.execute(select(Agent))).scalars().all()
    for a in agents:
        agent_map[a.agent_id] = a.agent_name

    return [
        {
            "flow_id": f.flow_id, "from_agent_id": f.from_agent_id,
            "from_agent_name": agent_map.get(f.from_agent_id, f.from_agent_id),
            "to_agent_id": f.to_agent_id,
            "to_agent_name": agent_map.get(f.to_agent_id, f.to_agent_id),
            "action": f.action, "status": f.status, "timestamp": str(f.timestamp),
        }
        for f in flows
    ]


@router.post("/flows")
async def create_flow(data: FlowCreate, db: AsyncSession = Depends(get_db)):
    flow = AgentFlow(
        from_agent_id=data.from_agent_id, to_agent_id=data.to_agent_id,
        action=data.action, status=data.status,
    )
    db.add(flow)
    await db.commit()
    return {"flow_id": flow.flow_id, "status": flow.status}


@router.get("/flows/stats")
async def flow_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count()).select_from(AgentFlow))).scalar() or 0
    governed = (await db.execute(select(func.count()).where(AgentFlow.status == "governed"))).scalar() or 0
    blocked = (await db.execute(select(func.count()).where(AgentFlow.status == "blocked"))).scalar() or 0
    pending = (await db.execute(select(func.count()).where(AgentFlow.status == "pending"))).scalar() or 0
    return {"total": total, "governed": governed, "blocked": blocked, "pending": pending}


@router.get("/policies")
async def list_policies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InterAgentPolicy).order_by(InterAgentPolicy.created_at.desc()))
    policies = result.scalars().all()
    return [
        {
            "policy_id": p.policy_id, "name": p.name, "rule": p.rule,
            "enforcement": p.enforcement, "created_at": str(p.created_at),
        }
        for p in policies
    ]


@router.post("/policies")
async def create_policy(data: PolicyCreate, db: AsyncSession = Depends(get_db)):
    policy = InterAgentPolicy(name=data.name, rule=data.rule, enforcement=data.enforcement)
    db.add(policy)
    await db.commit()
    return {"policy_id": policy.policy_id}
