"""Dashboard Router — aggregated stats and health scores for the UI."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
from database import get_db
from models import (
    Agent, AuditLog, Violation, Anomaly, Incident,
    ApprovalRequest, AgentStatus, ApprovalStatus, RiskLevel,
)
from schemas import DashboardStats, AgentHealthScore, AgentCostData

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Agent counts
    agents_result = await db.execute(select(Agent))
    agents = agents_result.scalars().all()

    total_agents = len(agents)
    active_agents = sum(1 for a in agents if a.status == AgentStatus.ACTIVE)
    locked_agents = sum(1 for a in agents if a.status == AgentStatus.LOCKED)

    # Event count
    events_count = await db.execute(select(func.count()).select_from(AuditLog))
    total_events = events_count.scalar() or 0

    # Events in last 24h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_count = await db.execute(
        select(func.count()).select_from(AuditLog).where(AuditLog.timestamp >= cutoff)
    )
    events_last_24h = recent_count.scalar() or 0

    # Violations
    violations_count = await db.execute(select(func.count()).select_from(Violation))
    total_violations = violations_count.scalar() or 0

    # Violations by severity
    violations_by_severity = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count_result = await db.execute(
            select(func.count()).select_from(Violation).where(Violation.severity == level)
        )
        violations_by_severity[level] = count_result.scalar() or 0

    # Anomalies
    anomalies_count = await db.execute(select(func.count()).select_from(Anomaly))
    total_anomalies = anomalies_count.scalar() or 0

    # Incidents
    incidents_count = await db.execute(select(func.count()).select_from(Incident))
    total_incidents = incidents_count.scalar() or 0

    # Pending approvals
    pending_count = await db.execute(
        select(func.count()).select_from(ApprovalRequest)
        .where(ApprovalRequest.status == ApprovalStatus.PENDING)
    )
    pending_approvals = pending_count.scalar() or 0

    # Total cost
    total_cost_usd = sum(a.total_cost_usd for a in agents)

    return DashboardStats(
        total_agents=total_agents,
        active_agents=active_agents,
        locked_agents=locked_agents,
        total_events=total_events,
        total_violations=total_violations,
        total_anomalies=total_anomalies,
        total_incidents=total_incidents,
        pending_approvals=pending_approvals,
        total_cost_usd=round(total_cost_usd, 2),
        violations_by_severity=violations_by_severity,
        events_last_24h=events_last_24h,
    )


@router.get("/health", response_model=list[AgentHealthScore])
async def get_agent_health(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.agent_name))
    agents = result.scalars().all()
    scores = []

    for agent in agents:
        # Health = 100 - (violations penalty) - (cost overrun penalty)
        violation_penalty = min(agent.total_violations * 5, 50)  # Max 50 points
        cost_ratio = (agent.tokens_used / agent.max_token_budget) if agent.max_token_budget > 0 else 0
        cost_penalty = max(0, (cost_ratio - 1.0) * 30)  # Penalty only if over budget
        health = max(0.0, min(100.0, 100.0 - violation_penalty - cost_penalty))

        scores.append(AgentHealthScore(
            agent_id=agent.agent_id,
            agent_name=agent.agent_name,
            health_score=round(health, 1),
            total_actions=agent.total_actions,
            total_violations=agent.total_violations,
            total_cost_usd=round(agent.total_cost_usd, 2),
            status=agent.status,
        ))

    return sorted(scores, key=lambda s: s.health_score, reverse=True)


@router.get("/costs", response_model=list[AgentCostData])
async def get_agent_costs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.agent_name))
    agents = result.scalars().all()

    return [
        AgentCostData(
            agent_id=a.agent_id,
            agent_name=a.agent_name,
            tokens_used=a.tokens_used,
            max_token_budget=a.max_token_budget,
            total_cost_usd=round(a.total_cost_usd, 2),
            budget_usage_pct=round(
                (a.tokens_used / a.max_token_budget * 100) if a.max_token_budget > 0 else 0, 1
            ),
        )
        for a in agents
    ]
