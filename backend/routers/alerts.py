"""Alerts Router — list alert history."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Alert
from schemas import AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    agent_id: str | None = None,
    alert_type: str | None = None,
    risk_level: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Alert).order_by(Alert.timestamp.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(Alert.agent_id == agent_id)
    if alert_type:
        stmt = stmt.where(Alert.alert_type == alert_type)
    if risk_level:
        stmt = stmt.where(Alert.risk_level == risk_level)
    result = await db.execute(stmt)
    return result.scalars().all()
