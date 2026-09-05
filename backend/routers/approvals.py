"""Approvals Router — human-in-the-loop approval queue (auth-protected, user-scoped)."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import ApprovalRequest, ApprovalStatus, User
from schemas import ApprovalRequestResponse, ApprovalDecision
from auth import get_current_user
from routers.user_scope import get_user_agent_ids

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRequestResponse])
async def list_approvals(
    status: str | None = None,
    agent_id: str | None = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    if not agent_ids:
        return []
    stmt = (
        select(ApprovalRequest)
        .where(ApprovalRequest.agent_id.in_(agent_ids))
        .order_by(ApprovalRequest.timestamp.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(ApprovalRequest.status == status)
    if agent_id:
        stmt = stmt.where(ApprovalRequest.agent_id == agent_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    decision: ApprovalDecision = ApprovalDecision(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    req = await db.get(ApprovalRequest, request_id)
    if not req or req.agent_id not in agent_ids:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    req.status = ApprovalStatus.APPROVED
    req.reviewed_by = user.email
    req.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"status": "approved", "request_id": request_id}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    decision: ApprovalDecision = ApprovalDecision(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent_ids = await get_user_agent_ids(user, db)
    req = await db.get(ApprovalRequest, request_id)
    if not req or req.agent_id not in agent_ids:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    req.status = ApprovalStatus.REJECTED
    req.reviewed_by = user.email
    req.reviewed_at = datetime.utcnow()
    await db.commit()
    return {"status": "rejected", "request_id": request_id}
