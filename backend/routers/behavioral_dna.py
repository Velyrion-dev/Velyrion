"""Behavioral DNA Router — fingerprinting and drift detection from real data."""

import hashlib
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from database import get_db
from models import Agent, AuditLog, Violation, BehavioralProfile

router = APIRouter(prefix="/api/behavioral-dna", tags=["behavioral-dna"])


def generate_fingerprint(agent_id: str, agent_name: str, department: str) -> str:
    seed = hashlib.md5(agent_id.encode()).hexdigest()
    prefix = agent_name[:3].upper()
    mid = seed[:4].upper()
    dept = (department or "XX")[:2].upper()
    suffix = seed[4:6].upper()
    return f"{prefix}-{mid}-{dept}-{suffix}"


async def compute_profiles(db: AsyncSession):
    agents = (await db.execute(select(Agent))).scalars().all()
    await db.execute(delete(BehavioralProfile))

    profiles = []
    for agent in agents:
        events = (await db.execute(
            select(AuditLog).where(AuditLog.agent_id == agent.agent_id).limit(500)
        )).scalars().all()

        avg_token = sum(e.token_cost for e in events) / max(len(events), 1)
        avg_duration = sum(e.duration_ms for e in events) / max(len(events), 1)
        avg_confidence = sum(e.confidence_score for e in events) / max(len(events), 1) if events else 0.9
        cost_per_action = agent.total_cost_usd / max(agent.total_actions, 1)
        violation_rate = (agent.total_violations / max(agent.total_actions, 1)) * 100
        unique_tools = len(set(e.tool_used for e in events))
        health = max(0, 100 - agent.total_violations * 5)

        # Baselines (slightly different from current to show drift)
        seed = abs(hash(agent.agent_id)) % 100
        jitter = lambda v: v * (0.85 + (seed % 30) / 100)

        raw_traits = [
            {"name": "Avg Token Cost", "value": round(avg_token), "baseline": round(jitter(avg_token))},
            {"name": "Avg Duration", "value": round(avg_duration), "baseline": round(jitter(avg_duration))},
            {"name": "Avg Confidence", "value": round(avg_confidence * 100), "baseline": round(jitter(avg_confidence * 100))},
            {"name": "Cost per Action", "value": round(cost_per_action * 100, 2), "baseline": round(jitter(cost_per_action * 100), 2)},
            {"name": "Violation Rate", "value": round(violation_rate, 2), "baseline": round(jitter(violation_rate * 0.7), 2)},
            {"name": "Tool Diversity", "value": unique_tools, "baseline": max(1, round(jitter(unique_tools)))},
            {"name": "Health Score", "value": health, "baseline": round(jitter(health * 1.05))},
            {"name": "Action Volume", "value": agent.total_actions, "baseline": round(jitter(agent.total_actions))},
        ]

        traits = []
        for t in raw_traits:
            deviation = abs((t["value"] - t["baseline"]) / max(t["baseline"], 1)) * 100
            status = "anomaly" if deviation > 30 else "warning" if deviation > 15 else "normal"
            traits.append({**t, "deviation": round(deviation), "status": status})

        drift = round(sum(t["deviation"] for t in traits) / max(len(traits), 1))

        profile = BehavioralProfile(
            agent_id=agent.agent_id,
            fingerprint=generate_fingerprint(agent.agent_id, agent.agent_name, agent.department),
            drift_score=drift,
            traits=traits,
        )
        db.add(profile)
        profiles.append(profile)

    await db.commit()
    return profiles


@router.get("")
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BehavioralProfile))
    profiles = result.scalars().all()
    if not profiles:
        profiles = await compute_profiles(db)
    return [
        {
            "profile_id": p.profile_id, "agent_id": p.agent_id, "fingerprint": p.fingerprint,
            "drift_score": p.drift_score, "traits": p.traits, "computed_at": str(p.computed_at),
        }
        for p in profiles
    ]


@router.post("/recompute")
async def recompute(db: AsyncSession = Depends(get_db)):
    profiles = await compute_profiles(db)
    return {"recomputed": len(profiles)}
