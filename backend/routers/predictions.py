"""Predictions Router — AI-powered risk predictions for all agents."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Agent
from engines.risk_predictor import predict_agent_risk, predict_all_agents

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("")
async def get_all_predictions(db: AsyncSession = Depends(get_db)):
    """Get risk predictions for all agents — sorted by risk score."""
    return await predict_all_agents(db)


@router.get("/{agent_id}")
async def get_agent_prediction(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed risk prediction for a specific agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return await predict_agent_risk(db, agent)
