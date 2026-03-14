"""Approvals Router — human-in-the-loop approval queue."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import ApprovalRequest, ApprovalStatus
from schemas import ApprovalRequestResponse, ApprovalDecision

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRequestResponse])
async def list_approvals(
    status: str | None = None,
    agent_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ApprovalRequest).order_by(ApprovalRequest.timestamp.desc()).limit(limit)
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
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    req.status = ApprovalStatus.APPROVED
    req.reviewed_by = decision.reviewed_by
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "approved", "request_id": request_id}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    decision: ApprovalDecision = ApprovalDecision(),
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")
    req.status = ApprovalStatus.REJECTED
    req.reviewed_by = decision.reviewed_by
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "rejected", "request_id": request_id}
