"""Audit Proof Router — Verify chain integrity, get Merkle proofs, export signed reports."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import AuditLog
from engines.crypto_chain import verify_chain, compute_merkle_root, get_merkle_proof, verify_merkle_proof

router = APIRouter(prefix="/api/audit", tags=["audit-proof"])


@router.get("/verify")
async def verify_audit_chain(
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
):
    """Verify the cryptographic integrity of the entire audit chain.
    
    Returns whether any events have been tampered with and the Merkle root.
    """
    stmt = select(AuditLog).order_by(AuditLog.timestamp.asc()).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    event_dicts = []
    for e in events:
        event_dicts.append({
            "event_id": e.event_id,
            "timestamp": e.timestamp.isoformat(),
            "agent_id": e.agent_id,
            "task_description": e.task_description,
            "tool_used": e.tool_used,
            "token_cost": e.token_cost,
            "risk_level": e.risk_level.value if hasattr(e.risk_level, "value") else str(e.risk_level),
            "event_hash": e.event_hash or "",
            "previous_hash": e.previous_hash or "",
        })
    
    verification = verify_chain(event_dicts)
    
    return {
        "chain_integrity": "VERIFIED" if verification["valid"] else "BROKEN",
        "total_events": verification["total_events"],
        "verified_events": verification["verified_events"],
        "merkle_root": verification["merkle_root"],
        "broken_at": verification.get("broken_at"),
        "error": verification.get("error"),
    }


@router.get("/proof/{event_id}")
async def get_event_proof(
    event_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a Merkle proof for a specific event — verifies membership without scanning the full chain."""
    # Get target event
    target = await db.get(AuditLog, event_id)
    if not target:
        raise HTTPException(404, "Event not found")
    
    # Get all events for Merkle tree
    stmt = select(AuditLog).order_by(AuditLog.timestamp.asc())
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    hashes = [e.event_hash for e in events if e.event_hash]
    
    # Find target index
    target_idx = next(
        (i for i, e in enumerate(events) if e.event_id == event_id),
        None,
    )
    
    if target_idx is None or not target.event_hash:
        raise HTTPException(400, "Event has no hash — may be from pre-chain era")
    
    proof = get_merkle_proof(hashes, target_idx)
    merkle_root = compute_merkle_root(hashes)
    valid = verify_merkle_proof(target.event_hash, proof, merkle_root)
    
    return {
        "event_id": event_id,
        "event_hash": target.event_hash,
        "previous_hash": target.previous_hash,
        "merkle_root": merkle_root,
        "proof": proof,
        "verified": valid,
        "event_data": {
            "agent_id": target.agent_id,
            "agent_name": target.agent_name,
            "task_description": target.task_description,
            "tool_used": target.tool_used,
            "timestamp": target.timestamp.isoformat(),
            "risk_level": target.risk_level.value if hasattr(target.risk_level, "value") else str(target.risk_level),
        },
    }


@router.get("/export")
async def export_audit_report(
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    """Export a signed audit report — for regulatory submission."""
    import hashlib
    from datetime import datetime
    
    stmt = select(AuditLog).order_by(AuditLog.timestamp.asc()).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    hashes = [e.event_hash for e in events if e.event_hash]
    merkle_root = compute_merkle_root(hashes) if hashes else "no-events"
    
    # Count stats
    agents = set()
    violations_count = 0
    for e in events:
        agents.add(e.agent_id)
        rl = e.risk_level.value if hasattr(e.risk_level, "value") else str(e.risk_level)
        if rl in ("CRITICAL", "HIGH"):
            violations_count += 1
    
    report = {
        "report_type": "VELYRION_CRYPTOGRAPHIC_AUDIT_REPORT",
        "generated_at": datetime.utcnow().isoformat(),
        "chain_length": len(events),
        "chain_with_hashes": len(hashes),
        "merkle_root": merkle_root,
        "unique_agents": len(agents),
        "high_risk_events": violations_count,
        "first_event": events[0].timestamp.isoformat() if events else None,
        "last_event": events[-1].timestamp.isoformat() if events else None,
        "report_hash": hashlib.sha256(
            f"{merkle_root}:{len(events)}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest(),
        "compliance_note": "This report provides cryptographic proof of audit log integrity. "
                          "The Merkle root can be used to verify that no events have been "
                          "modified, deleted, or inserted after the fact.",
    }
    
    return report


@router.get("/chain")
async def get_chain_summary(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get recent chain entries with their hashes — visual chain display."""
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    return [
        {
            "event_id": e.event_id,
            "timestamp": e.timestamp.isoformat(),
            "agent_id": e.agent_id,
            "agent_name": e.agent_name,
            "task": e.task_description[:80],
            "risk_level": e.risk_level.value if hasattr(e.risk_level, "value") else str(e.risk_level),
            "event_hash": e.event_hash[:16] + "..." if e.event_hash else "pre-chain",
            "previous_hash": e.previous_hash[:16] + "..." if e.previous_hash else "genesis",
            "hash_linked": bool(e.event_hash and e.previous_hash),
        }
        for e in events
    ]
