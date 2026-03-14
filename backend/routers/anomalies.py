"""Anomalies Router — list and inspect detected anomalies."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Anomaly
from schemas import AnomalyResponse

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


@router.get("", response_model=list[AnomalyResponse])
async def list_anomalies(
    agent_id: str | None = None,
    anomaly_type: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Anomaly).order_by(Anomaly.timestamp.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(Anomaly.agent_id == agent_id)
    if anomaly_type:
        stmt = stmt.where(Anomaly.anomaly_type == anomaly_type)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(anomaly_id: str, db: AsyncSession = Depends(get_db)):
    a = await db.get(Anomaly, anomaly_id)
    if not a:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return a
