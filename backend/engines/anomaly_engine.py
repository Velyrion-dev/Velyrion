"""Anomaly Detection Engine — flags behavioral anomalies in agent activity."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import Agent, AuditLog, Anomaly, AnomalyType, RiskLevel
from schemas import EventCreate


async def detect_anomalies(
    db: AsyncSession, agent: Agent, event: EventCreate, event_id: str
) -> list[Anomaly]:
    """
    Check incoming event for anomaly conditions.
    Returns list of Anomaly model instances (unsaved).
    """
    anomalies: list[Anomaly] = []

    # 1. Duration Anomaly — task > 2x expected baseline
    expected_ms = agent.max_task_duration_seconds * 1000
    if event.duration_ms > 2 * expected_ms:
        anomalies.append(Anomaly(
            agent_id=agent.agent_id,
            event_id=event_id,
            anomaly_type=AnomalyType.DURATION,
            description=f"Task duration ({event.duration_ms}ms) exceeds 2x baseline ({2 * expected_ms}ms)",
            risk_level=RiskLevel.MEDIUM,
        ))

    # 2. API Failure Anomaly — check for 3+ consecutive failures
    # We look at the last 3 events from this agent for failure indicators
    stmt = (
        select(AuditLog)
        .where(AuditLog.agent_id == agent.agent_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(3)
    )
    result = await db.execute(stmt)
    recent_events = result.scalars().all()

    if len(recent_events) >= 3:
        all_failed = all(
            "error" in (e.output_data or "").lower() or
            "fail" in (e.output_data or "").lower()
            for e in recent_events
        )
        if all_failed:
            anomalies.append(Anomaly(
                agent_id=agent.agent_id,
                event_id=event_id,
                anomaly_type=AnomalyType.API_FAILURE,
                description=f"Agent has 3+ consecutive failed API calls",
                risk_level=RiskLevel.HIGH,
            ))

    # 3. Confidence Anomaly — repeated low confidence (< 0.6)
    if event.confidence_score < 0.6:
        # Check if previous events also had low confidence
        low_conf_stmt = (
            select(func.count())
            .select_from(AuditLog)
            .where(
                AuditLog.agent_id == agent.agent_id,
                AuditLog.confidence_score < 0.6
            )
        )
        result = await db.execute(low_conf_stmt)
        low_conf_count = result.scalar() or 0
        if low_conf_count >= 2:  # This is the 3rd+ low confidence event
            anomalies.append(Anomaly(
                agent_id=agent.agent_id,
                event_id=event_id,
                anomaly_type=AnomalyType.CONFIDENCE,
                description=f"Agent has {low_conf_count + 1} events with confidence < 0.6 (current: {event.confidence_score})",
                risk_level=RiskLevel.MEDIUM,
            ))

    # 4. Cost Anomaly — token usage > 150% of budget
    projected_tokens = agent.tokens_used + event.token_cost
    threshold = int(agent.max_token_budget * 1.5)
    if projected_tokens > threshold:
        anomalies.append(Anomaly(
            agent_id=agent.agent_id,
            event_id=event_id,
            anomaly_type=AnomalyType.COST,
            description=f"Token usage ({projected_tokens}) exceeds 150% of budget ({threshold})",
            risk_level=RiskLevel.HIGH,
        ))

    # 5. Data Boundary Violation — accessing unlisted data source
    if agent.allowed_data_sources and event.tool_used.lower() in [
        "database_query", "api_call", "file_read", "data_fetch"
    ]:
        source_match = any(
            src.lower() in event.input_data.lower()
            for src in agent.allowed_data_sources
        )
        if not source_match and event.input_data:
            anomalies.append(Anomaly(
                agent_id=agent.agent_id,
                event_id=event_id,
                anomaly_type=AnomalyType.DATA_BOUNDARY,
                description=f"Agent accessed data outside allowed sources: {agent.allowed_data_sources}",
                risk_level=RiskLevel.HIGH,
            ))

    return anomalies
