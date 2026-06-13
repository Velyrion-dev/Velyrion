"""Trust Registry Router — agent trust scores and tier management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import Agent, TrustRegistryEntry

router = APIRouter(prefix="/api/trust-registry", tags=["trust-registry"])


def compute_trust(agent: Agent) -> dict:
    score = max(20, min(99, round(
        (40 if agent.total_actions > 0 else 10) +
        (30 if agent.total_violations == 0 else max(0, 30 - agent.total_violations * 5)) +
        (15 if agent.status == "ACTIVE" else 5) +
        (15 if agent.max_token_budget > 0 and agent.tokens_used < agent.max_token_budget * 0.8 else 5)
    )))
    tier = "platinum" if score >= 95 else "gold" if score >= 85 else "silver" if score >= 70 else "bronze" if score >= 50 else "unverified"
    return {"trust_score": score, "tier": tier, "verified": score >= 70}


async def build_registry(db: AsyncSession):
    agents = (await db.execute(select(Agent))).scalars().all()
    await db.execute(delete(TrustRegistryEntry))

    TAG_POOL = ["NLP", "Vision", "Data Pipeline", "Customer Service", "Security", "DevOps", "Analytics", "Automation", "Research", "Finance"]
    entries = []
    for i, agent in enumerate(agents):
        trust = compute_trust(agent)
        seed = len(agent.agent_name) + i
        tags = [TAG_POOL[j] for j in range(len(TAG_POOL)) if (seed + j) % 3 == 0][:3]
        entry = TrustRegistryEntry(
            agent_id=agent.agent_id, trust_score=trust["trust_score"],
            tier=trust["tier"], verified=trust["verified"], tags=tags,
            integrations=max(1, (seed * 3) % 12),
        )
        db.add(entry)
        entries.append(entry)

    await db.commit()
    return entries


@router.get("")
async def list_registry(tier: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(TrustRegistryEntry).order_by(TrustRegistryEntry.trust_score.desc())
    if tier:
        stmt = stmt.where(TrustRegistryEntry.tier == tier)
    result = await db.execute(stmt)
    entries = result.scalars().all()
    if not entries:
        entries = await build_registry(db)
    return [
        {
            "entry_id": e.entry_id, "agent_id": e.agent_id, "trust_score": e.trust_score,
            "tier": e.tier, "verified": e.verified, "tags": e.tags,
            "integrations": e.integrations, "last_audit": str(e.last_audit),
        }
        for e in entries
    ]


@router.post("/rebuild")
async def rebuild(db: AsyncSession = Depends(get_db)):
    entries = await build_registry(db)
    return {"rebuilt": len(entries)}
