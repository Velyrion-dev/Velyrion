"""VELYRION — AI Agent Governance SDK.

Monitor, control, and audit every AI agent action.

Quick Start:
    from velyrion import Velyrion
    
    v = Velyrion(api_url="https://your-api.com", api_key="...")
    v.wrap(agent, agent_id="agent-001")

Async:
    from velyrion import AsyncVelyrion
    
    v = AsyncVelyrion(api_url="https://your-api.com")
    await v.report(agent_id="agent-001", task="...", tool="...")

Decorators:
    from velyrion import governed, track
    
    @governed(agent_id="agent-001")
    def my_task(query):
        return llm.generate(query)
"""

__version__ = "0.2.0"

from velyrion.client import VelyrionClient as Velyrion
from velyrion.client import AgentKilledException, ActionBlockedException
from velyrion.decorators import governed, track
from velyrion.policy import Policy

# Async client (requires httpx)
try:
    from velyrion.client import AsyncVelyrionClient as AsyncVelyrion
except ImportError:
    AsyncVelyrion = None  # httpx not installed

__all__ = [
    "Velyrion",
    "AsyncVelyrion",
    "governed",
    "track",
    "Policy",
    "AgentKilledException",
    "ActionBlockedException",
    "__version__",
]
