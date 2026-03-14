"""Incident Response Engine — handles CRITICAL violations with automated response."""

import json
from sqlalchemy.ext.asyncio import AsyncSession
from models import Agent, Incident, AgentStatus, RiskLevel, ResolutionStatus


async def create_incident(
    db: AsyncSession, agent: Agent, violation_type: str, context: dict | None = None
) -> Incident:
    """
    Execute the five-step critical incident response:
    1. Kill agent process (mark as locked)
    2. Snapshot agent state
    3. Create incident log
    4. Agent will be locked until manually reviewed
    5. Alert is dispatched by the caller
    """
    # Step 1 & 4: Lock the agent
    agent.status = AgentStatus.LOCKED

    # Step 2: Snapshot full agent state
    snapshot = json.dumps({
        "agent_id": agent.agent_id,
        "agent_name": agent.agent_name,
        "owner_email": agent.owner_email,
        "department": agent.department,
        "allowed_tools": agent.allowed_tools,
        "allowed_data_sources": agent.allowed_data_sources,
        "tokens_used": agent.tokens_used,
        "total_cost_usd": agent.total_cost_usd,
        "total_actions": agent.total_actions,
        "total_violations": agent.total_violations,
        "context": context or {},
    })

    # Step 3: Create immutable incident log
    incident = Incident(
        agent_id=agent.agent_id,
        violation_type=violation_type,
        severity=RiskLevel.CRITICAL,
        system_action="PROCESS_TERMINATED",
        agent_state_snapshot=snapshot,
        resolution_status=ResolutionStatus.LOCKED_PENDING_REVIEW,
    )

    db.add(incident)
    await db.flush()

    return incident


async def resolve_incident(db: AsyncSession, incident: Incident, agent: Agent) -> None:
    """Resolve an incident and unlock the agent."""
    incident.resolution_status = ResolutionStatus.RESOLVED
    agent.status = AgentStatus.ACTIVE
    await db.flush()
