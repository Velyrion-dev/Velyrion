"""Replay & Forensics Router — timeline view of agent actions for investigation."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import AuditLog, Agent, Violation, Anomaly
from pydantic import BaseModel
from datetime import datetime
import logging, traceback

logger = logging.getLogger("velyrion.replay")

router = APIRouter(prefix="/api/replay", tags=["replay"])


class TimelineEvent(BaseModel):
    event_id: str
    timestamp: datetime
    agent_id: str
    agent_name: str
    task_description: str
    tool_used: str
    input_data: str
    output_data: str
    confidence_score: float
    duration_ms: int
    token_cost: int
    compute_cost_usd: float
    risk_level: str
    human_in_loop: bool

    class Config:
        from_attributes = True


class AgentSession(BaseModel):
    agent_id: str
    agent_name: str
    total_events: int
    total_tokens: int
    total_cost_usd: float
    avg_confidence: float
    risk_breakdown: dict[str, int]
    first_event: datetime
    last_event: datetime


class ReplayResponse(BaseModel):
    session: AgentSession
    timeline: list[TimelineEvent]
    violations: list[dict]
    anomalies: list[dict]


# ── Get full agent replay ────────────────────────────────────────────────

@router.get("/{agent_id}")
async def get_agent_replay(
    agent_id: str,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a complete forensic replay of an agent's activity.
    Shows every action in chronological order with full details.
    """
    try:
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(404, f"Agent '{agent_id}' not found")

        # Get all events for this agent
        stmt = (
            select(AuditLog)
            .where(AuditLog.agent_id == agent_id)
            .order_by(AuditLog.timestamp.asc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        events = result.scalars().all()

        if not events:
            raise HTTPException(404, f"No events found for agent '{agent_id}'")

        # Build timeline
        timeline = [TimelineEvent.model_validate(e) for e in events]

        # Calculate session stats
        total_tokens = sum(e.token_cost for e in events)
        total_cost = sum(e.compute_cost_usd for e in events)
        avg_conf = sum(e.confidence_score for e in events) / len(events)
        risk_breakdown = {}
        for e in events:
            level = e.risk_level.value if hasattr(e.risk_level, 'value') else str(e.risk_level)
            risk_breakdown[level] = risk_breakdown.get(level, 0) + 1

        session = AgentSession(
            agent_id=agent_id,
            agent_name=agent.agent_name,
            total_events=len(events),
            total_tokens=total_tokens,
            total_cost_usd=round(total_cost, 4),
            avg_confidence=round(avg_conf, 3),
            risk_breakdown=risk_breakdown,
            first_event=events[0].timestamp,
            last_event=events[-1].timestamp,
        )

        # Get violations
        v_stmt = (
            select(Violation)
            .where(Violation.agent_id == agent_id)
            .order_by(Violation.timestamp.desc())
            .limit(50)
        )
        v_result = await db.execute(v_stmt)
        violations = [
            {
                "violation_id": v.violation_id,
                "type": v.violation_type,
                "description": v.description,
                "severity": v.severity.value if hasattr(v.severity, 'value') else str(v.severity),
                "action_taken": v.action_taken,
                "created_at": v.timestamp.isoformat(),
            }
            for v in v_result.scalars().all()
        ]

        # Get anomalies
        a_stmt = (
            select(Anomaly)
            .where(Anomaly.agent_id == agent_id)
            .order_by(Anomaly.timestamp.desc())
            .limit(50)
        )
        a_result = await db.execute(a_stmt)
        anomalies = [
            {
                "anomaly_id": a.anomaly_id,
                "type": a.anomaly_type,
                "description": a.description,
                "risk_level": a.risk_level.value if hasattr(a.risk_level, 'value') else str(a.risk_level),
                "detected_at": a.timestamp.isoformat(),
            }
            for a in a_result.scalars().all()
        ]

        return {
            "session": session.model_dump(),
            "timeline": [t.model_dump() for t in timeline],
            "violations": violations,
            "anomalies": anomalies,
        }

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(f"Replay error for {agent_id}: {ex}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Replay error: {str(ex)}"},
        )


# ── Compare two agents side-by-side ──────────────────────────────────────

@router.get("/compare/{agent_a}/{agent_b}")
async def compare_agents(
    agent_a: str,
    agent_b: str,
    db: AsyncSession = Depends(get_db),
):
    """Compare two agents' behavior side-by-side."""
    stats = {}
    for aid in [agent_a, agent_b]:
        agent = await db.get(Agent, aid)
        if not agent:
            raise HTTPException(404, f"Agent '{aid}' not found")

        stmt = select(AuditLog).where(AuditLog.agent_id == aid)
        result = await db.execute(stmt)
        events = result.scalars().all()

        v_stmt = select(func.count(Violation.violation_id)).where(Violation.agent_id == aid)
        v_count = (await db.execute(v_stmt)).scalar() or 0

        stats[aid] = {
            "agent_name": agent.agent_name,
            "status": agent.status.value,
            "total_events": len(events),
            "total_tokens": sum(e.token_cost for e in events),
            "total_cost_usd": round(sum(e.compute_cost_usd for e in events), 4),
            "avg_confidence": round(sum(e.confidence_score for e in events) / max(len(events), 1), 3),
            "violations": v_count,
            "health_score": agent.health_score,
        }

    return {"comparison": stats}
