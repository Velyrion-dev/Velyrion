"""Violations Router — list and inspect policy violations (auth-protected, user-scoped)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Violation, User
from schemas import ViolationResponse
from auth import get_current_user
from routers.user_scope import get_user_agent_ids

router = APIRouter(prefix="/api/violations", tags=["violations"])


@router.get("", response_model=list[ViolationResponse])
async def list_violations(
    agent_id: str | None = None,
    severity: str | None = None,
    resolved: bool | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    if not agent_ids:
        return []
    stmt = (
        select(Violation)
        .where(Violation.agent_id.in_(agent_ids))
        .order_by(Violation.timestamp.desc())
        .limit(limit)
    )
    if agent_id:
        stmt = stmt.where(Violation.agent_id == agent_id)
    if severity:
        stmt = stmt.where(Violation.severity == severity)
    if resolved is not None:
        stmt = stmt.where(Violation.resolved == resolved)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{violation_id}", response_model=ViolationResponse)
async def get_violation(
    violation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    v = await db.get(Violation, violation_id)
    if not v or v.agent_id not in agent_ids:
        raise HTTPException(status_code=404, detail="Violation not found")
    return v
