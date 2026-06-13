"""Insurance Scoring Router — risk profiles and premium estimation from real data."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import Agent, InsuranceProfile

router = APIRouter(prefix="/api/insurance-scoring", tags=["insurance-scoring"])

TIERS = {
    "low": {"discount": 40}, "moderate": {"discount": 20},
    "elevated": {"discount": 5}, "high": {"discount": 0},
}


async def compute_insurance(db: AsyncSession):
    agents = (await db.execute(select(Agent))).scalars().all()
    await db.execute(delete(InsuranceProfile))

    profiles = []
    for agent in agents:
        risk = 50
        factors = []

        # Violations
        if agent.total_violations == 0:
            risk -= 15
            factors.append({"name": "Clean Record", "impact": "positive", "weight": 15, "detail": "Zero violations"})
        elif agent.total_violations <= 3:
            risk += 5
            factors.append({"name": "Minor Violations", "impact": "negative", "weight": 5, "detail": f"{agent.total_violations} violations"})
        else:
            risk += 20
            factors.append({"name": "Violation History", "impact": "negative", "weight": 20, "detail": f"{agent.total_violations} violations"})

        # Budget
        budget_pct = (agent.tokens_used / max(agent.max_token_budget, 1)) * 100
        if budget_pct < 60:
            risk -= 10
            factors.append({"name": "Conservative Budget", "impact": "positive", "weight": 10, "detail": f"{budget_pct:.0f}% used"})
        elif budget_pct > 90:
            risk += 15
            factors.append({"name": "Budget Strain", "impact": "negative", "weight": 15, "detail": f"{budget_pct:.0f}% consumed"})

        # Track record
        if agent.total_actions >= 1000:
            risk -= 10
            factors.append({"name": "Proven Track Record", "impact": "positive", "weight": 10, "detail": f"{agent.total_actions:,} actions"})
        elif agent.total_actions < 50:
            risk += 5
            factors.append({"name": "Limited History", "impact": "negative", "weight": 5, "detail": "Insufficient history"})

        # Status
        if agent.status == "ACTIVE":
            risk -= 5
            factors.append({"name": "Active & Monitored", "impact": "positive", "weight": 5, "detail": "Actively monitored"})
        else:
            risk += 10
            factors.append({"name": "Inactive/Locked", "impact": "negative", "weight": 10, "detail": f"Status: {agent.status}"})

        risk = max(5, min(95, risk))
        tier = "low" if risk <= 25 else "moderate" if risk <= 50 else "elevated" if risk <= 75 else "high"
        premium = round(1000 * (risk / 50))
        savings = round(1000 * (TIERS[tier]["discount"] / 100))

        profile = InsuranceProfile(
            agent_id=agent.agent_id, risk_score=risk, tier=tier,
            premium_estimate=premium, annual_savings=savings, factors=factors,
        )
        db.add(profile)
        profiles.append(profile)

    await db.commit()
    return profiles


@router.get("")
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InsuranceProfile).order_by(InsuranceProfile.risk_score))
    profiles = result.scalars().all()
    if not profiles:
        profiles = await compute_insurance(db)
    return [
        {
            "profile_id": p.profile_id, "agent_id": p.agent_id, "risk_score": p.risk_score,
            "tier": p.tier, "premium_estimate": p.premium_estimate,
            "annual_savings": p.annual_savings, "factors": p.factors,
            "computed_at": str(p.computed_at),
        }
        for p in profiles
    ]


@router.post("/recompute")
async def recompute(db: AsyncSession = Depends(get_db)):
    profiles = await compute_insurance(db)
    return {"recomputed": len(profiles)}
