"""Event Logging Router — webhook ingestion with permission/anomaly checks."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import (
    Agent, AuditLog, Violation, ApprovalRequest, RiskLevel,
    AlertType, AgentStatus, ApprovalStatus,
)
from schemas import EventCreate, EventResponse
from engines.permission_engine import check_permissions, has_critical_violation, has_blocking_violation
from engines.anomaly_engine import detect_anomalies
from engines.incident_engine import create_incident
from engines.alert_engine import dispatch_alert
from engines.crypto_chain import compute_event_hash, GENESIS_HASH
from ws_manager import ws_manager

router = APIRouter(prefix="/api", tags=["events"])


@router.post("/agent/event", response_model=EventResponse, status_code=201)
async def ingest_event(event: EventCreate, db: AsyncSession = Depends(get_db)):
    """
    Main webhook endpoint — receives agent events, validates permissions,
    detects anomalies, and triggers appropriate responses.
    """
    # 1. Check agent exists
    agent = await db.get(Agent, event.agent_id)
    if not agent:
        # Unregistered agent — block + log violation
        violation = Violation(
            agent_id=event.agent_id,
            violation_type="UNREGISTERED_AGENT",
            description=f"Unregistered agent '{event.agent_id}' attempted action: {event.task_description}",
            severity=RiskLevel.HIGH,
            action_taken="BLOCKED",
        )
        db.add(violation)
        await dispatch_alert(
            db, AlertType.VIOLATION, event.agent_id,
            f"Unregistered agent action blocked",
            RiskLevel.HIGH, "BLOCKED",
            "Register the agent before allowing actions",
        )
        await db.commit()
        raise HTTPException(status_code=403, detail="Unregistered agent — action blocked")

    # Fill in agent name if not provided
    if not event.agent_name:
        event.agent_name = agent.agent_name

    # 2. Permission checks
    violations = await check_permissions(db, agent, event)
    risk_level = RiskLevel.LOW

    if violations:
        for v in violations:
            db.add(v)
        agent.total_violations += len(violations)

        # Determine highest severity
        severities = [v.severity for v in violations]
        if RiskLevel.CRITICAL in severities:
            risk_level = RiskLevel.CRITICAL
        elif RiskLevel.HIGH in severities:
            risk_level = RiskLevel.HIGH
        elif RiskLevel.MEDIUM in severities:
            risk_level = RiskLevel.MEDIUM

        # Critical => incident response
        if has_critical_violation(violations):
            incident = await create_incident(
                db, agent, violations[0].violation_type,
                {"task": event.task_description, "tool": event.tool_used},
            )
            await dispatch_alert(
                db, AlertType.INCIDENT, agent.agent_id,
                f"CRITICAL violation — agent locked. Incident: {incident.incident_id}",
                RiskLevel.CRITICAL, "PROCESS_TERMINATED + AGENT_LOCKED",
                "Review incident and manually unlock agent",
            )
            await db.commit()
            raise HTTPException(
                status_code=403,
                detail=f"CRITICAL violation — agent locked. Incident: {incident.incident_id}"
            )

        # Blocking violations => reject
        if has_blocking_violation(violations):
            await dispatch_alert(
                db, AlertType.VIOLATION, agent.agent_id,
                f"Action blocked: {violations[0].description}",
                risk_level, "BLOCKED",
                "Review agent permissions",
            )
            # Still log the event for audit trail
            audit = AuditLog(
                agent_id=agent.agent_id,
                agent_name=agent.agent_name,
                task_description=event.task_description,
                tool_used=event.tool_used,
                input_data=event.input_data,
                output_data=f"BLOCKED: {violations[0].description}",
                confidence_score=event.confidence_score,
                duration_ms=event.duration_ms,
                token_cost=event.token_cost,
                compute_cost_usd=event.compute_cost_usd,
                human_in_loop=event.human_in_loop,
                risk_level=risk_level,
            )
            db.add(audit)
            await db.commit()
            await db.refresh(audit)
            raise HTTPException(status_code=403, detail=f"Action blocked: {violations[0].description}")

    # 3. Human-in-the-loop checks
    hitl_required = False
    hitl_reason = ""

    # Check if task type requires approval
    if agent.requires_human_approval_for:
        for trigger in agent.requires_human_approval_for:
            trigger_lower = trigger.lower()
            if trigger_lower in event.task_description.lower() or trigger_lower in event.tool_used.lower():
                hitl_required = True
                hitl_reason = f"Task matches HITL trigger: {trigger}"
                break

    # Confidence below 0.5
    if event.confidence_score < 0.5:
        hitl_required = True
        hitl_reason = f"Confidence score ({event.confidence_score}) below 0.5 threshold"

    if hitl_required:
        approval = ApprovalRequest(
            agent_id=agent.agent_id,
            task_description=event.task_description,
            action_context=f'{{"tool": "{event.tool_used}", "input": "{event.input_data[:200]}"}}',
            reason=hitl_reason,
            status=ApprovalStatus.PENDING,
        )
        db.add(approval)
        await dispatch_alert(
            db, AlertType.HITL_REQUIRED, agent.agent_id,
            f"Human approval required: {hitl_reason}",
            RiskLevel.MEDIUM, "PAUSED_PENDING_APPROVAL",
            "Review and approve/reject the pending action",
        )
        risk_level = RiskLevel.MEDIUM

    # 4. Determine risk level based on confidence
    if risk_level == RiskLevel.LOW:
        if event.confidence_score < 0.6:
            risk_level = RiskLevel.MEDIUM
        elif event.confidence_score < 0.3:
            risk_level = RiskLevel.HIGH

    # 5. Create audit log entry (immutable) with cryptographic hash chain
    audit = AuditLog(
        agent_id=agent.agent_id,
        agent_name=agent.agent_name,
        task_description=event.task_description,
        tool_used=event.tool_used,
        input_data=event.input_data,
        output_data=event.output_data,
        confidence_score=event.confidence_score,
        duration_ms=event.duration_ms,
        token_cost=event.token_cost,
        compute_cost_usd=event.compute_cost_usd,
        human_in_loop=event.human_in_loop or hitl_required,
        risk_level=risk_level,
    )
    db.add(audit)
    await db.flush()

    # Compute cryptographic hash chain
    last_event = await db.execute(
        select(AuditLog)
        .where(AuditLog.event_id != audit.event_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(1)
    )
    prev = last_event.scalar_one_or_none()
    prev_hash = prev.event_hash if prev and prev.event_hash else GENESIS_HASH

    audit.previous_hash = prev_hash
    audit.event_hash = compute_event_hash(
        event_id=audit.event_id,
        timestamp=audit.timestamp.isoformat(),
        agent_id=audit.agent_id,
        task_description=audit.task_description,
        tool_used=audit.tool_used,
        token_cost=audit.token_cost,
        risk_level=audit.risk_level.value if hasattr(audit.risk_level, 'value') else str(audit.risk_level),
        previous_hash=prev_hash,
    )
    await db.flush()

    # 6. Anomaly detection
    anomalies = await detect_anomalies(db, agent, event, audit.event_id)
    for a in anomalies:
        db.add(a)
        await dispatch_alert(
            db, AlertType.ANOMALY, agent.agent_id,
            f"Anomaly detected: {a.description}",
            a.risk_level, "FLAGGED",
            "Investigate agent behavior",
        )

    # 7. Update agent stats
    agent.tokens_used += event.token_cost
    agent.total_cost_usd += event.compute_cost_usd
    agent.total_actions += 1

    await db.commit()
    await db.refresh(audit)

    # 8. Broadcast to WebSocket clients (real-time dashboard)
    try:
        await ws_manager.broadcast_event(audit)
        for v in violations:
            await ws_manager.broadcast_violation(v)
        for a in anomalies:
            await ws_manager.broadcast_anomaly(a)
    except Exception:
        pass  # WebSocket errors should never break event processing

    return audit


@router.get("/events", response_model=list[EventResponse])
async def list_events(
    agent_id: str | None = None,
    risk_level: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(AuditLog.agent_id == agent_id)
    if risk_level:
        stmt = stmt.where(AuditLog.risk_level == risk_level)
    result = await db.execute(stmt)
    return result.scalars().all()
