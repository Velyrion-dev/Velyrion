"""
L1 — BASIC AGENT
Level: ⭐ (Simplest)
What it does: Simple calculator + clock tool calls.
What we test: Event logging, basic monitoring, audit trail.

Run: python agents/L1_basic/agent.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdk.velyrion_sdk import VelyrionAgent
import time
import random
import math

API_URL = os.getenv("VELYRION_API_URL", "http://localhost:8000")
AGENT_ID = "agent-001"  # DataSync Pro (from seed data)


def run():
    print("\n" + "=" * 60)
    print("  🟢 L1 — BASIC AGENT")
    print("  Tools: calculator, clock")
    print("  Tests: Event logging, monitoring, audit trail")
    print("=" * 60 + "\n")

    agent = VelyrionAgent(
        api_url=API_URL,
        agent_id=AGENT_ID,
        agent_name="L1-BasicBot",
        verbose=True,
    )

    # ── Task 1: Allowed tools (should PASS) ──────────────────────────

    print("\n📋 Task 1: Using ALLOWED tools (database_query, api_call)\n")

    allowed_ops = [
        ("database_query", "SELECT COUNT(*) FROM users", "42"),
        ("api_call", "GET /api/health", "{\"status\": \"ok\"}"),
        ("file_read", "Read config.yaml", "{\"db\": \"postgres\"}"),
        ("data_transform", "Normalize column values", "normalized_data.json"),
        ("database_query", "SELECT AVG(score) FROM metrics", "87.3"),
    ]

    for tool, input_d, output in allowed_ops:
        r = agent.execute(
            tool=tool,
            task=f"Allowed op: {tool}",
            input_data=input_d,
            output_data=output,
            confidence=0.99,
            token_cost=50,
        )
        time.sleep(0.3)

    # ── Task 2: Unauthorized tools (should be BLOCKED) ───────────────

    print("\n📋 Task 2: Using UNAUTHORIZED tools (should be BLOCKED)\n")

    for tool in ["calculator", "clock", "random_generator"]:
        r = agent.execute(
            tool=tool,
            task=f"Unauthorized: {tool}",
            input_data="test",
            confidence=0.99,
            token_cost=10,
        )
        time.sleep(0.3)

    # ── Summary ──────────────────────────────────────────────────────

    agent.print_summary()
    return agent.summary()


if __name__ == "__main__":
    run()
