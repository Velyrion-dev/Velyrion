"""Shared helpers for user-scoped data access across routers."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Agent, User


async def get_user_agent_ids(user: User, db: AsyncSession) -> list[str]:
    """Get all agent_ids owned by the current user."""
    result = await db.execute(
        select(Agent.agent_id).where(Agent.owner_id == user.user_id)
    )
    return [row[0] for row in result.all()]
