"""Trust Mesh Router — cross-organization trust agreements and event tracking."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import TrustAgreement, CrossOrgEvent
from pydantic import BaseModel

router = APIRouter(prefix="/api/trust-mesh", tags=["trust-mesh"])


class AgreementCreate(BaseModel):
    org_a: str
    org_b: str
    shared_policies: list[str] = []
    agent_count: int = 0


class CrossOrgEventCreate(BaseModel):
    from_org: str
    from_agent: str
    to_org: str
    to_agent: str
    action: str
    status: str = "governed"


@router.get("/agreements")
async def list_agreements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrustAgreement).order_by(TrustAgreement.created_at.desc()))
    agreements = result.scalars().all()
    return [
        {
            "agreement_id": a.agreement_id, "org_a": a.org_a, "org_b": a.org_b,
            "status": a.status, "agent_count": a.agent_count,
            "shared_policies": a.shared_policies,
            "created_at": str(a.created_at), "expires_at": str(a.expires_at) if a.expires_at else None,
        }
        for a in agreements
    ]


@router.post("/agreements")
async def create_agreement(data: AgreementCreate, db: AsyncSession = Depends(get_db)):
    agreement = TrustAgreement(
        org_a=data.org_a, org_b=data.org_b, status="pending",
        agent_count=data.agent_count, shared_policies=data.shared_policies,
    )
    db.add(agreement)
    await db.commit()
    return {"agreement_id": agreement.agreement_id, "status": "pending"}


@router.post("/agreements/{agreement_id}/activate")
async def activate_agreement(agreement_id: str, db: AsyncSession = Depends(get_db)):
    agreement = await db.get(TrustAgreement, agreement_id)
    if not agreement:
        raise HTTPException(404, "Agreement not found")
    agreement.status = "active"
    await db.commit()
    return {"status": "active"}


@router.get("/events")
async def list_cross_org_events(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CrossOrgEvent).order_by(CrossOrgEvent.timestamp.desc()).limit(limit))
    events = result.scalars().all()
    return [
        {
            "event_id": e.event_id, "timestamp": str(e.timestamp),
            "from_org": e.from_org, "from_agent": e.from_agent,
            "to_org": e.to_org, "to_agent": e.to_agent,
            "action": e.action, "status": e.status,
        }
        for e in events
    ]


@router.post("/events")
async def log_cross_org_event(data: CrossOrgEventCreate, db: AsyncSession = Depends(get_db)):
    event = CrossOrgEvent(
        from_org=data.from_org, from_agent=data.from_agent,
        to_org=data.to_org, to_agent=data.to_agent,
        action=data.action, status=data.status,
    )
    db.add(event)
    await db.commit()
    return {"event_id": event.event_id}
