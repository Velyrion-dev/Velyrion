"""Anomalies Router — list and inspect detected anomalies (auth-protected, user-scoped)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Anomaly, User
from schemas import AnomalyResponse
from auth import get_current_user
from routers.user_scope import get_user_agent_ids

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


@router.get("", response_model=list[AnomalyResponse])
async def list_anomalies(
    agent_id: str | None = None,
    anomaly_type: str | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    if not agent_ids:
        return []
    stmt = (
        select(Anomaly)
        .where(Anomaly.agent_id.in_(agent_ids))
        .order_by(Anomaly.timestamp.desc())
        .limit(limit)
    )
    if agent_id:
        stmt = stmt.where(Anomaly.agent_id == agent_id)
    if anomaly_type:
        stmt = stmt.where(Anomaly.anomaly_type == anomaly_type)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(
    anomaly_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    a = await db.get(Anomaly, anomaly_id)
    if not a or a.agent_id not in agent_ids:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return a
