"""Compliance Reports Router — on-demand compliance report generation."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Agent, AuditLog, Violation, ApprovalRequest, ApprovalStatus, User
from schemas import ComplianceReport
from auth import get_current_user
from routers.user_scope import get_user_agent_ids

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/compliance", response_model=ComplianceReport)
async def generate_compliance_report(
    period: str = "2025-Q1",
    agent_id: str | None = None,
    department: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_agent_ids = await get_user_agent_ids(user, db)
    if not user_agent_ids:
        return ComplianceReport(
            report_period=period, total_agent_actions=0, policy_violations={},
            human_interventions=0, cost_per_agent=[], top_performing_agents=[],
            underperforming_agents=[], department_risk_scores=[],
        )

    # Total actions (user's agents only)
    actions_stmt = select(func.count()).select_from(AuditLog).where(AuditLog.agent_id.in_(user_agent_ids))
    if agent_id:
        actions_stmt = actions_stmt.where(AuditLog.agent_id == agent_id)
    actions_result = await db.execute(actions_stmt)
    total_actions = actions_result.scalar() or 0

    # Violations by severity
    violations = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        v_stmt = select(func.count()).select_from(Violation).where(Violation.severity == level).where(Violation.agent_id.in_(user_agent_ids))
        if agent_id:
            v_stmt = v_stmt.where(Violation.agent_id == agent_id)
        result = await db.execute(v_stmt)
        violations[level.lower()] = result.scalar() or 0

    # Human interventions
    hitl_stmt = select(func.count()).select_from(ApprovalRequest).where(ApprovalRequest.agent_id.in_(user_agent_ids))
    if agent_id:
        hitl_stmt = hitl_stmt.where(ApprovalRequest.agent_id == agent_id)
    hitl_result = await db.execute(hitl_stmt)
    human_interventions = hitl_result.scalar() or 0

    # Agent stats
    agents_stmt = select(Agent).where(Agent.owner_id == user.user_id)
    if department:
        agents_stmt = agents_stmt.where(Agent.department == department)
    agents_result = await db.execute(agents_stmt)
    agents = agents_result.scalars().all()

    cost_per_agent = [
        {"agent_id": a.agent_id, "agent_name": a.agent_name, "cost_usd": round(a.total_cost_usd, 2)}
        for a in agents
    ]

    # Top performing = most actions with fewest violations
    sorted_by_perf = sorted(
        agents,
        key=lambda a: (a.total_actions - a.total_violations * 10),
        reverse=True,
    )
    top_performing = [
        {"agent_id": a.agent_id, "agent_name": a.agent_name,
         "actions": a.total_actions, "violations": a.total_violations}
        for a in sorted_by_perf[:5]
    ]
    underperforming = [
        {"agent_id": a.agent_id, "agent_name": a.agent_name,
         "actions": a.total_actions, "violations": a.total_violations}
        for a in sorted_by_perf[-3:] if a.total_violations > 0
    ]

    # Department risk scores
    dept_map: dict[str, list] = {}
    for a in agents:
        dept_map.setdefault(a.department, []).append(a)
    dept_risk = [
        {
            "department": dept,
            "risk_score": round(
                sum(a.total_violations for a in dept_agents) /
                max(sum(a.total_actions for a in dept_agents), 1) * 100, 1
            ),
            "total_agents": len(dept_agents),
            "total_violations": sum(a.total_violations for a in dept_agents),
        }
        for dept, dept_agents in dept_map.items()
    ]

    return ComplianceReport(
        report_period=period,
        total_agent_actions=total_actions,
        policy_violations=violations,
        human_interventions=human_interventions,
        cost_per_agent=cost_per_agent,
        top_performing_agents=top_performing,
        underperforming_agents=underperforming,
        department_risk_scores=dept_risk,
    )
