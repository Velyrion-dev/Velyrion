"""
VELYRION SDK — AI Agent Governance in 2 Lines of Code.

Usage:
    from velyrion import Velyrion

    v = Velyrion(api_url="https://api.velyrion.com")
    agent = v.wrap(your_agent, agent_id="agent-001")
"""

from velyrion.client import VelyrionClient as Velyrion
from velyrion.decorators import governed, track
from velyrion.policy import Policy

__version__ = "0.1.0"
__all__ = ["Velyrion", "governed", "track", "Policy"]
