"""War Room Router — incident management with timeline and notes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import WarRoomIncident, Violation, Agent
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/war-room", tags=["war-room"])


class IncidentCreate(BaseModel):
    violation_id: str | None = None
    agent_id: str
    title: str
    severity: str = "MEDIUM"
    assignee: str = "Unassigned"


class StatusUpdate(BaseModel):
    status: str


class NoteAdd(BaseModel):
    content: str
    author: str = "Operator"


@router.get("")
async def list_incidents(status: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(WarRoomIncident).order_by(WarRoomIncident.created_at.desc())
    if status:
        stmt = stmt.where(WarRoomIncident.status == status)
    result = await db.execute(stmt)
    incidents = result.scalars().all()
    return [
        {
            "incident_id": i.incident_id, "violation_id": i.violation_id,
            "agent_id": i.agent_id, "title": i.title, "severity": i.severity,
            "status": i.status, "assignee": i.assignee,
            "timeline": i.timeline, "notes": i.notes,
            "created_at": str(i.created_at), "updated_at": str(i.updated_at),
        }
        for i in incidents
    ]


@router.post("")
async def create_incident(data: IncidentCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow().isoformat()
    incident = WarRoomIncident(
        violation_id=data.violation_id, agent_id=data.agent_id,
        title=data.title, severity=data.severity, assignee=data.assignee,
        timeline=[
            {"time": now, "action": "Incident created", "actor": "System"},
            {"time": now, "action": f"Assigned to {data.assignee}", "actor": "Auto-Router"},
        ],
    )
    db.add(incident)
    await db.commit()
    return {"incident_id": incident.incident_id}


@router.put("/{incident_id}/status")
async def update_status(incident_id: str, data: StatusUpdate, db: AsyncSession = Depends(get_db)):
    incident = await db.get(WarRoomIncident, incident_id)
    if not incident:
        raise HTTPException(404, "Incident not found")
    incident.status = data.status
    timeline = list(incident.timeline)
    timeline.append({"time": datetime.utcnow().isoformat(), "action": f"Status changed to {data.status}", "actor": "Operator"})
    incident.timeline = timeline
    await db.commit()
    return {"status": incident.status}


@router.post("/{incident_id}/notes")
async def add_note(incident_id: str, data: NoteAdd, db: AsyncSession = Depends(get_db)):
    incident = await db.get(WarRoomIncident, incident_id)
    if not incident:
        raise HTTPException(404, "Incident not found")
    notes = list(incident.notes)
    notes.append({"content": data.content, "author": data.author, "time": datetime.utcnow().isoformat()})
    incident.notes = notes
    timeline = list(incident.timeline)
    timeline.append({"time": datetime.utcnow().isoformat(), "action": f"Note: {data.content[:80]}", "actor": data.author})
    incident.timeline = timeline
    await db.commit()
    return {"notes_count": len(notes)}


@router.post("/auto-create")
async def auto_create_from_violations(db: AsyncSession = Depends(get_db)):
    """Create war room incidents from unresolved violations that don't have incidents yet."""
    existing = (await db.execute(select(WarRoomIncident.violation_id))).scalars().all()
    violations = (await db.execute(
        select(Violation).where(Violation.resolved == False).order_by(Violation.timestamp.desc()).limit(20)
    )).scalars().all()

    created = 0
    TEAM = ["Security Lead", "DevOps Engineer", "ML Engineer", "Platform Admin"]
    for i, v in enumerate(violations):
        if v.violation_id in existing:
            continue
        now = datetime.utcnow().isoformat()
        assignee = TEAM[i % len(TEAM)]
        incident = WarRoomIncident(
            violation_id=v.violation_id, agent_id=v.agent_id,
            title=v.violation_type.replace("_", " "), severity=v.severity,
            assignee=assignee,
            timeline=[
                {"time": str(v.timestamp), "action": "Violation detected", "actor": "System"},
                {"time": now, "action": "Incident created", "actor": "Velyrion"},
                {"time": now, "action": f"Assigned to {assignee}", "actor": "Auto-Router"},
            ],
        )
        db.add(incident)
        created += 1

    await db.commit()
    return {"created": created}
