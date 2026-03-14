"""Violations Router — list and inspect policy violations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Violation
from schemas import ViolationResponse

router = APIRouter(prefix="/api/violations", tags=["violations"])


@router.get("", response_model=list[ViolationResponse])
async def list_violations(
    agent_id: str | None = None,
    severity: str | None = None,
    resolved: bool | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Violation).order_by(Violation.timestamp.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(Violation.agent_id == agent_id)
    if severity:
        stmt = stmt.where(Violation.severity == severity)
    if resolved is not None:
        stmt = stmt.where(Violation.resolved == resolved)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{violation_id}", response_model=ViolationResponse)
async def get_violation(violation_id: str, db: AsyncSession = Depends(get_db)):
    v = await db.get(Violation, violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    return v
