"""Threat Intelligence Router — pattern detection from real violations."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from database import get_db
from models import Violation, ThreatPattern

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"])

MITIGATIONS = {
    "UNAUTHORIZED_TOOL": "Restrict the agent's allowed_tools list. Add the tool to the blocked list or update the permission profile.",
    "TOKEN_BUDGET_EXCEEDED": "Increase max_token_budget or optimize prompts. Consider token-aware caching.",
    "DATA_SOURCE_VIOLATION": "Update data_access_level to match required sources. Implement data masking.",
    "CONFIDENCE_TOO_LOW": "Review model configuration. Upgrade model or improve prompt engineering.",
    "RATE_LIMIT_VIOLATION": "Implement exponential backoff. Add request queuing.",
    "COST_THRESHOLD_EXCEEDED": "Set tighter per-action cost limits. Implement cost-aware model routing.",
}


async def detect_patterns(db: AsyncSession):
    """Analyze violations to detect threat patterns."""
    violations = (await db.execute(select(Violation).order_by(Violation.timestamp.desc()))).scalars().all()
    await db.execute(delete(ThreatPattern))

    pattern_map = {}
    for v in violations:
        key = v.violation_type
        if key not in pattern_map:
            pattern_map[key] = {
                "type": key, "severity": v.severity, "description": v.description,
                "occurrences": 0, "agents": set(), "first_seen": v.timestamp, "last_seen": v.timestamp,
            }
        pattern_map[key]["occurrences"] += 1
        pattern_map[key]["agents"].add(v.agent_id)
        if v.timestamp < pattern_map[key]["first_seen"]:
            pattern_map[key]["first_seen"] = v.timestamp
        if v.timestamp > pattern_map[key]["last_seen"]:
            pattern_map[key]["last_seen"] = v.timestamp

    patterns = []
    for key, data in pattern_map.items():
        tp = ThreatPattern(
            pattern_type=data["type"], severity=data["severity"], description=data["description"],
            occurrences=data["occurrences"], affected_agents=list(data["agents"]),
            mitigation=MITIGATIONS.get(key, "Review violation pattern and update governance policy."),
            first_seen=data["first_seen"], last_seen=data["last_seen"],
        )
        db.add(tp)
        patterns.append(tp)

    await db.commit()
    return patterns


@router.get("/patterns")
async def list_patterns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ThreatPattern).order_by(ThreatPattern.occurrences.desc()))
    patterns = result.scalars().all()
    if not patterns:
        patterns = await detect_patterns(db)
    return [
        {
            "pattern_id": p.pattern_id, "pattern_type": p.pattern_type, "severity": p.severity,
            "description": p.description, "occurrences": p.occurrences,
            "affected_agents": p.affected_agents, "mitigation": p.mitigation,
            "first_seen": str(p.first_seen), "last_seen": str(p.last_seen),
        }
        for p in patterns
    ]


@router.get("/feed")
async def threat_feed(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Violation).order_by(Violation.timestamp.desc()).limit(limit))
    violations = result.scalars().all()
    return [
        {"timestamp": str(v.timestamp), "type": v.violation_type, "agent_id": v.agent_id,
         "severity": v.severity, "detail": v.description}
        for v in violations
    ]


@router.get("/hourly")
async def hourly_distribution(db: AsyncSession = Depends(get_db)):
    violations = (await db.execute(select(Violation))).scalars().all()
    hours = [0] * 24
    for v in violations:
        try:
            hours[v.timestamp.hour] += 1
        except Exception:
            pass
    return {"hours": hours}


@router.post("/redetect")
async def redetect_patterns(db: AsyncSession = Depends(get_db)):
    patterns = await detect_patterns(db)
    return {"detected": len(patterns)}
