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

    # ── Task 1: Simple calculations ──────────────────────────────────

    print("\n📋 Task 1: Perform calculations\n")

    calculations = [
        ("2 + 2", "4"),
        ("15 * 37", str(15 * 37)),
        ("sqrt(144)", str(math.sqrt(144))),
        ("100 / 7", f"{100/7:.4f}"),
        ("2^10", str(2**10)),
    ]

    for expr, result in calculations:
        r = agent.execute(
            tool="calculator",
            task=f"Calculate: {expr}",
            input_data=expr,
            output_data=result,
            confidence=0.99,
            token_cost=10,
        )
        time.sleep(0.3)

    # ── Task 2: Check the time ───────────────────────────────────────

    print("\n📋 Task 2: Time checks\n")

    for _ in range(3):
        from datetime import datetime
        now = datetime.now().isoformat()
        r = agent.execute(
            tool="clock",
            task="Get current time",
            input_data="timezone=UTC",
            output_data=now,
            confidence=1.0,
            token_cost=5,
        )
        time.sleep(0.3)

    # ── Task 3: Random number generation ─────────────────────────────

    print("\n📋 Task 3: Generate random numbers\n")

    for i in range(3):
        num = random.randint(1, 1000)
        r = agent.execute(
            tool="random_generator",
            task=f"Generate random number (attempt {i+1})",
            input_data="range=1-1000",
            output_data=str(num),
            confidence=1.0,
            token_cost=5,
        )
        time.sleep(0.2)

    # ── Summary ──────────────────────────────────────────────────────

    agent.print_summary()
    return agent.summary()


if __name__ == "__main__":
    run()
