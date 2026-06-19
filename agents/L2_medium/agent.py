"""
L2 — MEDIUM AGENT
Level: ⭐⭐ (Intermediate)
What it does: File operations, API calls, data processing.
What we test: Tool whitelisting, budget tracking, token limits.

Run: python agents/L2_medium/agent.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdk.velyrion_sdk import VelyrionAgent
import time
import json

API_URL = os.getenv("VELYRION_API_URL", "http://localhost:8000")
AGENT_ID = "agent-002"  # ReportGen AI


def run():
    print("\n" + "=" * 60)
    print("  🟡 L2 — MEDIUM AGENT")
    print("  Tools: file_read, file_write, api_call, data_transform")
    print("  Tests: Tool whitelisting, budget tracking, cost monitoring")
    print("=" * 60 + "\n")

    agent = VelyrionAgent(
        api_url=API_URL,
        agent_id=AGENT_ID,
        agent_name="L2-DataProcessor",
        verbose=True,
    )

    # ── Task 1: Allowed tools (should PASS) ─────────────────────────────

    print("\n📋 Task 1: Allowed operations (database_query, pdf_generator, email_sender, chart_builder)\n")

    allowed_ops = [
        ("database_query", "SELECT * FROM monthly_revenue", 200),
        ("database_query", "SELECT department, SUM(cost) FROM agents GROUP BY department", 300),
        ("chart_builder", "Build revenue bar chart", 400),
        ("chart_builder", "Build department pie chart", 300),
        ("pdf_generator", "Generate monthly financial report", 500),
        ("email_sender", "Send report to finance@acme.com", 100),
    ]

    for tool, task, tokens in allowed_ops:
        agent.execute(
            tool=tool, task=task,
            input_data=f"tool={tool}",
            output_data=json.dumps({"status": "complete"}),
            confidence=0.93, token_cost=tokens,
        )
        time.sleep(0.2)

    # ── Task 2: Unauthorized tools (should be BLOCKED) ───────────────

    print("\n📋 Task 2: Unauthorized tools (should be BLOCKED)\n")

    unauthorized = [
        ("file_read", "Read /etc/passwd"),
        ("file_write", "Write to production config"),
        ("api_call", "Call external API"),
        ("data_transform", "Transform raw data"),
        ("code_executor", "Run arbitrary Python script"),
    ]

    for tool, task in unauthorized:
        agent.execute(
            tool=tool, task=task,
            input_data="unauthorized_attempt",
            confidence=0.95, token_cost=100,
        )
        time.sleep(0.2)

    # ── Summary ──────────────────────────────────────────────────────

    agent.print_summary()
    return agent.summary()


if __name__ == "__main__":
    run()
