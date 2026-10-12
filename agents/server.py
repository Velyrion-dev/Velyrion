"""Velyrion Agent Server — Runs all 10 agents via REST API.

Each agent gets:
- POST /agents/{name}/chat — send a message and get a response
- GET  /agents/{name}/status — check agent health
- POST /agents/{name}/reset — reset conversation

Start: uvicorn server:app --port 8100
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_infrawatch import InfraWatch
from agent_codeguard import CodeGuard
from agent_dataclerk import DataClerk
from agent_supportbot import SupportBot
from agent_leadgen import LeadGen
from agent_meetingscribe import MeetingScribe
from agent_bughunter import BugHunter
from agent_contentwriter import ContentWriter
from agent_schedulerbot import SchedulerBot
from agent_formprocessor import FormProcessor

app = FastAPI(
    title="Velyrion Agent Fleet",
    description="10 AI agents governed by the Velyrion platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Initialize all agents ────────────────────────────────────────────────────

AGENTS = {
    "infrawatch": InfraWatch(),
    "codeguard": CodeGuard(),
    "dataclerk": DataClerk(),
    "supportbot": SupportBot(),
    "leadgen": LeadGen(),
    "meetingscribe": MeetingScribe(),
    "bughunter": BugHunter(),
    "contentwriter": ContentWriter(),
    "schedulerbot": SchedulerBot(),
    "formprocessor": FormProcessor(),
}


class ChatRequest(BaseModel):
    message: str


def _get_agent(name: str):
    agent = AGENTS.get(name.lower())
    if not agent:
        raise HTTPException(404, f"Agent '{name}' not found. Available: {list(AGENTS.keys())}")
    return agent


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "Velyrion Agent Fleet",
        "agents": len(AGENTS),
        "available": list(AGENTS.keys()),
        "docs": "/docs",
    }


@app.get("/agents")
async def list_agents():
    """List all agents with status."""
    return [agent.get_status() for agent in AGENTS.values()]


@app.post("/agents/{name}/chat")
async def chat(name: str, req: ChatRequest):
    """Send a message to an agent and get a response."""
    agent = _get_agent(name)
    response = agent.think(req.message)
    return {
        "agent": agent.agent_name,
        "agent_id": agent.agent_id,
        "response": response,
        "tokens_used": agent.total_tokens_used,
        "actions_taken": agent.actions_taken,
    }


@app.get("/agents/{name}/status")
async def status(name: str):
    """Get agent health and status."""
    agent = _get_agent(name)
    return agent.get_status()


@app.post("/agents/{name}/reset")
async def reset(name: str):
    """Reset agent conversation history."""
    agent = _get_agent(name)
    agent.reset()
    return {"message": f"{agent.agent_name} conversation reset", "agent_id": agent.agent_id}


@app.get("/health")
async def health():
    return {"status": "healthy", "agents_active": len(AGENTS)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
