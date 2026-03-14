"""Incidents Router — list incidents and resolve/unlock agents."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Incident, Agent
from schemas import IncidentResponse
from engines.incident_engine import resolve_incident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentResponse])
async def list_incidents(
    agent_id: str | None = None,
    resolution_status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Incident).order_by(Incident.timestamp.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(Incident.agent_id == agent_id)
    if resolution_status:
        stmt = stmt.where(Incident.resolution_status == resolution_status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{incident_id}/resolve")
async def resolve(incident_id: str, db: AsyncSession = Depends(get_db)):
    incident = await db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    agent = await db.get(Agent, incident.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await resolve_incident(db, incident, agent)
    await db.commit()
    return {"status": "resolved", "incident_id": incident_id, "agent_status": "ACTIVE"}
