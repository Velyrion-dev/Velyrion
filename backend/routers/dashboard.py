"""Dashboard Router — aggregated stats for the UI (auth-protected, user-scoped)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from database import get_db
from models import (
    Agent, AuditLog, Violation, Anomaly, Incident,
    ApprovalRequest, AgentStatus, ApprovalStatus, RiskLevel, User,
)
from schemas import DashboardStats, AgentHealthScore, AgentCostData
from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _user_agent_ids(user: User, db: AsyncSession) -> list[str]:
    """Get all agent_ids owned by the current user."""
    result = await db.execute(
        select(Agent.agent_id).where(Agent.owner_id == user.user_id)
    )
    return [row[0] for row in result.all()]


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await _user_agent_ids(user, db)

    # Agent counts (user's only)
    agents_result = await db.execute(
        select(Agent).where(Agent.owner_id == user.user_id)
    )
    agents = agents_result.scalars().all()

    total_agents = len(agents)
    active_agents = sum(1 for a in agents if a.status == AgentStatus.ACTIVE)
    locked_agents = sum(1 for a in agents if a.status == AgentStatus.LOCKED)

    if agent_ids:
        # Event count
        events_count = await db.execute(
            select(func.count()).select_from(AuditLog).where(AuditLog.agent_id.in_(agent_ids))
        )
        total_events = events_count.scalar() or 0

        # Events in last 24h
        cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_count = await db.execute(
            select(func.count()).select_from(AuditLog)
            .where(AuditLog.agent_id.in_(agent_ids))
            .where(AuditLog.timestamp >= cutoff)
        )
        events_last_24h = recent_count.scalar() or 0

        # Violations
        violations_count = await db.execute(
            select(func.count()).select_from(Violation).where(Violation.agent_id.in_(agent_ids))
        )
        total_violations = violations_count.scalar() or 0

        # Violations by severity
        violations_by_severity = {}
        for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
            count_result = await db.execute(
                select(func.count()).select_from(Violation)
                .where(Violation.agent_id.in_(agent_ids))
                .where(Violation.severity == level)
            )
            violations_by_severity[level] = count_result.scalar() or 0

        # Anomalies
        anomalies_count = await db.execute(
            select(func.count()).select_from(Anomaly).where(Anomaly.agent_id.in_(agent_ids))
        )
        total_anomalies = anomalies_count.scalar() or 0

        # Incidents
        incidents_count = await db.execute(
            select(func.count()).select_from(Incident).where(Incident.agent_id.in_(agent_ids))
        )
        total_incidents = incidents_count.scalar() or 0

        # Pending approvals
        pending_count = await db.execute(
            select(func.count()).select_from(ApprovalRequest)
            .where(ApprovalRequest.agent_id.in_(agent_ids))
            .where(ApprovalRequest.status == ApprovalStatus.PENDING)
        )
        pending_approvals = pending_count.scalar() or 0
    else:
        total_events = events_last_24h = total_violations = 0
        total_anomalies = total_incidents = pending_approvals = 0
        violations_by_severity = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

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
async def get_agent_health(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.owner_id == user.user_id).order_by(Agent.agent_name)
    )
    agents = result.scalars().all()
    scores = []

    for agent in agents:
        violation_penalty = min(agent.total_violations * 5, 50)
        cost_ratio = (agent.tokens_used / agent.max_token_budget) if agent.max_token_budget > 0 else 0
        cost_penalty = max(0, (cost_ratio - 1.0) * 30)
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
async def get_agent_costs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.owner_id == user.user_id).order_by(Agent.agent_name)
    )
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
