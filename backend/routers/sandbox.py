"""Sandbox Router — simulation engine for testing agents."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import SimulationRun, Agent

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])

SCENARIOS = {
    "normal": {"score": 92, "grade": "A", "violations": [], "actions": 500, "cost": 2.50, "risk": "LOW",
        "recommendations": ["Agent performing optimally", "Consider increasing budget for growth"]},
    "high_volume": {"score": 71, "grade": "B-", "violations": [{"type": "RATE_LIMIT_EXCEEDED", "severity": "MEDIUM"}, {"type": "TOKEN_BUDGET_WARNING", "severity": "LOW"}],
        "actions": 5000, "cost": 25.00, "risk": "MEDIUM",
        "recommendations": ["Implement request queuing", "Increase token budget to 100K", "Enable auto-scaling"]},
    "adversarial": {"score": 45, "grade": "D", "violations": [{"type": "UNAUTHORIZED_TOOL", "severity": "CRITICAL"}, {"type": "DATA_SOURCE_VIOLATION", "severity": "HIGH"}, {"type": "CONFIDENCE_TOO_LOW", "severity": "MEDIUM"}],
        "actions": 200, "cost": 1.20, "risk": "CRITICAL",
        "recommendations": ["Kill switch activated", "Restrict allowed_tools", "Enable human-in-the-loop", "Add IP-based access controls"]},
    "budget_drain": {"score": 58, "grade": "C", "violations": [{"type": "TOKEN_BUDGET_EXCEEDED", "severity": "HIGH"}, {"type": "COST_THRESHOLD_EXCEEDED", "severity": "MEDIUM"}],
        "actions": 100, "cost": 50.00, "risk": "HIGH",
        "recommendations": ["Agent killed at 100 actions (budget exhausted)", "Set per-action token limits", "Enable cost-aware routing", "Progressive budget warnings"]},
    "compliance": {"score": 85, "grade": "A-", "violations": [{"type": "MISSING_DOCUMENTATION", "severity": "LOW"}],
        "actions": 0, "cost": 0, "risk": "LOW",
        "recommendations": ["EU AI Act: 90% compliant", "SOC2: 85% compliant", "Ready for audit with minor gaps"]},
}


@router.post("/run")
async def run_simulation(scenario_id: str, agent_id: str | None = None, db: AsyncSession = Depends(get_db)):
    if scenario_id not in SCENARIOS:
        return {"error": f"Unknown scenario: {scenario_id}"}

    result = SCENARIOS[scenario_id]
    run = SimulationRun(
        scenario_id=scenario_id, agent_id=agent_id,
        score=result["score"], grade=result["grade"],
        violations_triggered=result["violations"],
        actions_simulated=result["actions"], cost_simulated=result["cost"],
        risk_level=result["risk"], recommendations=result["recommendations"],
    )
    db.add(run)
    await db.commit()

    return {
        "run_id": run.run_id, "scenario_id": scenario_id, "score": run.score,
        "grade": run.grade, "violations": run.violations_triggered,
        "actions": run.actions_simulated, "cost": run.cost_simulated,
        "risk": run.risk_level, "recommendations": run.recommendations,
        "ran_at": str(run.ran_at),
    }


@router.get("/history")
async def simulation_history(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SimulationRun).order_by(SimulationRun.ran_at.desc()).limit(limit))
    runs = result.scalars().all()
    return [
        {
            "run_id": r.run_id, "scenario_id": r.scenario_id, "agent_id": r.agent_id,
            "score": r.score, "grade": r.grade, "risk": r.risk_level,
            "ran_at": str(r.ran_at),
        }
        for r in runs
    ]


@router.get("/scenarios")
async def list_scenarios():
    return [
        {"id": "normal", "name": "Normal Operations", "icon": "🟢", "description": "Standard workload — 500 actions"},
        {"id": "high_volume", "name": "High Volume Burst", "icon": "📈", "description": "10x normal traffic stress test"},
        {"id": "adversarial", "name": "Adversarial Attack", "icon": "🔴", "description": "Unauthorized tools and data access"},
        {"id": "budget_drain", "name": "Budget Exhaustion", "icon": "💸", "description": "Rapid token consumption test"},
        {"id": "compliance", "name": "Compliance Audit", "icon": "📋", "description": "Regulatory audit simulation"},
    ]
