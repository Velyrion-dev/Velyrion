"""Governance Score Router — compute and serve trust scores per agent."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from database import get_db
from models import Agent, Violation, AuditLog, GovernanceScore
from datetime import datetime

router = APIRouter(prefix="/api/governance-score", tags=["governance-score"])

GRADE_MAP = [
    (95, "A+"), (90, "A"), (85, "A-"), (80, "B+"), (75, "B"),
    (70, "B-"), (60, "C"), (50, "D"), (0, "F"),
]

def _grade(score: int) -> str:
    for threshold, grade in GRADE_MAP:
        if score >= threshold:
            return grade
    return "F"


async def compute_scores(db: AsyncSession):
    """Recompute governance scores for all agents from real data."""
    agents = (await db.execute(select(Agent))).scalars().all()

    # Clear old scores
    await db.execute(delete(GovernanceScore))

    scores = []
    for agent in agents:
        # Compliance: violation rate
        violation_rate = (agent.total_violations / max(agent.total_actions, 1)) * 100
        compliance = max(0, min(100, round(100 - violation_rate * 50)))

        # Cost efficiency
        cost_per_action = agent.total_cost_usd / max(agent.total_actions, 1)
        cost_eff = 100 if cost_per_action <= 0.001 else 85 if cost_per_action <= 0.01 else 70 if cost_per_action <= 0.05 else 50 if cost_per_action <= 0.1 else 30

        # Budget discipline
        budget_pct = (agent.tokens_used / max(agent.max_token_budget, 1)) * 100
        budget = 100 if budget_pct <= 50 else 85 if budget_pct <= 70 else 70 if budget_pct <= 85 else 50 if budget_pct <= 95 else 20

        # Reliability (health score from violations)
        reliability = max(0, min(100, 100 - agent.total_violations * 5))

        # Risk profile: count critical/high violations
        crit_stmt = select(func.count()).where(Violation.agent_id == agent.agent_id, Violation.severity == "CRITICAL")
        high_stmt = select(func.count()).where(Violation.agent_id == agent.agent_id, Violation.severity == "HIGH")
        crit_count = (await db.execute(crit_stmt)).scalar() or 0
        high_count = (await db.execute(high_stmt)).scalar() or 0
        risk = max(0, 100 - crit_count * 20 - high_count * 10)

        # Track record
        track = 100 if agent.total_actions >= 10000 else 85 if agent.total_actions >= 1000 else 70 if agent.total_actions >= 100 else 50 if agent.total_actions >= 10 else 20

        overall = round(
            compliance * 0.25 + cost_eff * 0.15 + budget * 0.15 +
            reliability * 0.20 + risk * 0.15 + track * 0.10
        )

        score_obj = GovernanceScore(
            agent_id=agent.agent_id,
            overall_score=overall,
            grade=_grade(overall),
            certified=overall >= 80,
            compliance_score=compliance,
            cost_efficiency_score=cost_eff,
            budget_discipline_score=budget,
            reliability_score=reliability,
            risk_profile_score=risk,
            track_record_score=track,
        )
        db.add(score_obj)
        scores.append(score_obj)

    await db.commit()
    return scores


@router.get("")
async def list_scores(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GovernanceScore).order_by(GovernanceScore.overall_score.desc()))
    scores = result.scalars().all()
    if not scores:
        scores = await compute_scores(db)
    return [
        {
            "score_id": s.score_id, "agent_id": s.agent_id, "overall_score": s.overall_score,
            "grade": s.grade, "certified": s.certified,
            "dimensions": [
                {"name": "Compliance", "icon": "🛡️", "score": s.compliance_score, "weight": 0.25, "description": "Policy adherence & violation rate", "color": "#3b82f6"},
                {"name": "Cost Efficiency", "icon": "💰", "score": s.cost_efficiency_score, "weight": 0.15, "description": "Cost per action optimization", "color": "#10b981"},
                {"name": "Budget Discipline", "icon": "📊", "score": s.budget_discipline_score, "weight": 0.15, "description": "Token budget utilization", "color": "#8b5cf6"},
                {"name": "Reliability", "icon": "❤️", "score": s.reliability_score, "weight": 0.20, "description": "Health score & uptime", "color": "#f59e0b"},
                {"name": "Risk Profile", "icon": "⚡", "score": s.risk_profile_score, "weight": 0.15, "description": "Severity of past violations", "color": "#ef4444"},
                {"name": "Proven Track Record", "icon": "📈", "score": s.track_record_score, "weight": 0.10, "description": "Volume of governed actions", "color": "#06b6d4"},
            ],
            "computed_at": str(s.computed_at),
        }
        for s in scores
    ]


@router.post("/recompute")
async def recompute_scores(db: AsyncSession = Depends(get_db)):
    scores = await compute_scores(db)
    return {"recomputed": len(scores)}
