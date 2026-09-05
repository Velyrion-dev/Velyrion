"""Alerts Router — list alert history (auth-protected, user-scoped)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Alert, User
from schemas import AlertResponse
from auth import get_current_user
from routers.user_scope import get_user_agent_ids

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    agent_id: str | None = None,
    alert_type: str | None = None,
    risk_level: str | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    if not agent_ids:
        return []
    stmt = (
        select(Alert)
        .where(Alert.agent_id.in_(agent_ids))
        .order_by(Alert.timestamp.desc())
        .limit(limit)
    )
    if agent_id:
        stmt = stmt.where(Alert.agent_id == agent_id)
    if alert_type:
        stmt = stmt.where(Alert.alert_type == alert_type)
    if risk_level:
        stmt = stmt.where(Alert.risk_level == risk_level)
    result = await db.execute(stmt)
    return result.scalars().all()
