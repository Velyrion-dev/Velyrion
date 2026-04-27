"""Agent Control Router — Kill switch, pause, unlock, and real-time actions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from database import get_db
from models import Agent, AgentStatus, Violation, RiskLevel
from engines.alert_engine import dispatch_alert
from models import AlertType

router = APIRouter(prefix="/api/agents", tags=["agent-control"])


class ControlAction(BaseModel):
    reason: str = ""


class ControlResponse(BaseModel):
    agent_id: str
    agent_name: str
    action: str
    previous_status: str
    new_status: str
    message: str


# ── Kill Agent (Emergency Termination) ───────────────────────────────────

@router.post("/{agent_id}/kill", response_model=ControlResponse)
async def kill_agent(agent_id: str, body: ControlAction, db: AsyncSession = Depends(get_db)):
    """
    EMERGENCY KILL — Immediately lock the agent and flag all future actions.
    This is the nuclear option. Use when an agent is actively causing harm.
    """
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    previous = agent.status.value
    agent.status = AgentStatus.LOCKED

    # Log violation
    violation = Violation(
        agent_id=agent_id,
        violation_type="MANUAL_KILL_SWITCH",
        description=f"Agent '{agent.agent_name}' manually terminated via kill switch. Reason: {body.reason or 'No reason given'}",
        severity=RiskLevel.CRITICAL,
        action_taken="AGENT_KILLED",
    )
    db.add(violation)

    await dispatch_alert(
        db, AlertType.INCIDENT, agent_id,
        f"🚨 KILL SWITCH activated for {agent.agent_name}: {body.reason}",
        RiskLevel.CRITICAL, "AGENT_KILLED",
        "Agent has been locked. Review incident and unlock manually.",
    )

    await db.commit()

    return ControlResponse(
        agent_id=agent_id,
        agent_name=agent.agent_name,
        action="KILL",
        previous_status=previous,
        new_status="LOCKED",
        message=f"Agent '{agent.agent_name}' has been killed and locked.",
    )


# ── Pause Agent ──────────────────────────────────────────────────────────

@router.post("/{agent_id}/pause", response_model=ControlResponse)
async def pause_agent(agent_id: str, body: ControlAction, db: AsyncSession = Depends(get_db)):
    """Pause an agent — actions will be queued pending review."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    previous = agent.status.value
    agent.status = AgentStatus.DEACTIVATED

    await dispatch_alert(
        db, AlertType.HITL_REQUIRED, agent_id,
        f"Agent '{agent.agent_name}' paused: {body.reason}",
        RiskLevel.MEDIUM, "AGENT_PAUSED",
        "Review agent and decide whether to resume or lock.",
    )

    await db.commit()

    return ControlResponse(
        agent_id=agent_id,
        agent_name=agent.agent_name,
        action="PAUSE",
        previous_status=previous,
        new_status="DEACTIVATED",
        message=f"Agent '{agent.agent_name}' has been paused.",
    )


# ── Unlock / Resume Agent ───────────────────────────────────────────────

@router.post("/{agent_id}/unlock", response_model=ControlResponse)
async def unlock_agent(agent_id: str, body: ControlAction, db: AsyncSession = Depends(get_db)):
    """Unlock a locked or paused agent, allowing it to resume actions."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    previous = agent.status.value
    agent.status = AgentStatus.ACTIVE

    await dispatch_alert(
        db, AlertType.RESOLUTION, agent_id,
        f"Agent '{agent.agent_name}' unlocked and resumed: {body.reason}",
        RiskLevel.LOW, "AGENT_UNLOCKED",
        "Agent is now active. Monitor for further issues.",
    )

    await db.commit()

    return ControlResponse(
        agent_id=agent_id,
        agent_name=agent.agent_name,
        action="UNLOCK",
        previous_status=previous,
        new_status="ACTIVE",
        message=f"Agent '{agent.agent_name}' has been unlocked and is now active.",
    )


# ── Revoke a Tool Permission ────────────────────────────────────────────

class RevokeToolRequest(BaseModel):
    tool: str
    reason: str = ""


@router.post("/{agent_id}/revoke-tool", response_model=ControlResponse)
async def revoke_tool(agent_id: str, body: RevokeToolRequest, db: AsyncSession = Depends(get_db)):
    """Remove a tool from an agent's allowed tools list in real-time."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    if agent.allowed_tools and body.tool in agent.allowed_tools:
        agent.allowed_tools = [t for t in agent.allowed_tools if t != body.tool]

        violation = Violation(
            agent_id=agent_id,
            violation_type="TOOL_REVOKED",
            description=f"Tool '{body.tool}' revoked from '{agent.agent_name}'. Reason: {body.reason}",
            severity=RiskLevel.MEDIUM,
            action_taken="TOOL_REVOKED",
        )
        db.add(violation)
        await db.commit()

        return ControlResponse(
            agent_id=agent_id,
            agent_name=agent.agent_name,
            action="REVOKE_TOOL",
            previous_status=agent.status.value,
            new_status=agent.status.value,
            message=f"Tool '{body.tool}' has been revoked from '{agent.agent_name}'.",
        )
    else:
        raise HTTPException(400, f"Tool '{body.tool}' not in agent's allowed tools")


# ── Agent Status Check (for SDK heartbeat) ───────────────────────────────

class AgentStatusResponse(BaseModel):
    agent_id: str
    status: str
    should_kill: bool
    should_pause: bool


@router.get("/{agent_id}/status", response_model=AgentStatusResponse)
async def check_agent_status(agent_id: str, db: AsyncSession = Depends(get_db)):
    """SDK heartbeat — check if agent should continue, pause, or die."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    return AgentStatusResponse(
        agent_id=agent_id,
        status=agent.status.value,
        should_kill=agent.status == AgentStatus.LOCKED,
        should_pause=agent.status == AgentStatus.DEACTIVATED,
    )
