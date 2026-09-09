"""Predictions Router — AI-powered risk predictions (auth-protected, user-scoped)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Agent, User
from engines.risk_predictor import predict_agent_risk, predict_all_agents
from auth import get_current_user

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("")
async def get_all_predictions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get risk predictions for user's agents — sorted by risk score."""
    all_preds = await predict_all_agents(db)
    result = await db.execute(
        select(Agent.agent_id).where(Agent.owner_id == user.user_id)
    )
    user_agent_ids = {row[0] for row in result.all()}
    return [p for p in all_preds if p.get("agent_id") in user_agent_ids]


@router.get("/{agent_id}")
async def get_agent_prediction(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = await db.get(Agent, agent_id)
    if not agent or agent.owner_id != user.user_id:
        raise HTTPException(404, "Agent not found")
    return await predict_agent_risk(db, agent)
