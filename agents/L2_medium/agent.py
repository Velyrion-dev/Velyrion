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

    # ── Task 1: Read configuration files ─────────────────────────────

    print("\n📋 Task 1: Read configuration files\n")

    files = ["config.yaml", "settings.json", "env.production", "database.yml"]
    for f in files:
        agent.execute(
            tool="file_read",
            task=f"Read configuration file: {f}",
            input_data=f"path=/etc/app/{f}",
            output_data=json.dumps({"status": "read", "lines": 45}),
            confidence=0.97,
            token_cost=50,
        )
        time.sleep(0.2)

    # ── Task 2: Call external APIs ───────────────────────────────────

    print("\n📋 Task 2: External API calls\n")

    apis = [
        ("GET /api/users", "Fetch user list", 200),
        ("GET /api/metrics", "Fetch system metrics", 300),
        ("POST /api/reports", "Generate monthly report", 500),
        ("GET /api/billing", "Fetch billing data", 150),
    ]

    for endpoint, task, tokens in apis:
        agent.execute(
            tool="api_call",
            task=task,
            input_data=endpoint,
            output_data=json.dumps({"status": 200, "records": 42}),
            confidence=0.93,
            token_cost=tokens,
        )
        time.sleep(0.3)

    # ── Task 3: Data transformation ──────────────────────────────────

    print("\n📋 Task 3: Data transformation pipeline\n")

    transforms = [
        ("Parse CSV → JSON", 800),
        ("Aggregate daily metrics", 600),
        ("Calculate running averages", 400),
        ("Generate summary statistics", 500),
        ("Format output report", 300),
    ]

    for task, tokens in transforms:
        agent.execute(
            tool="data_transform",
            task=task,
            input_data="raw_data.csv",
            output_data="transformed_output.json",
            confidence=0.91,
            token_cost=tokens,
        )
        time.sleep(0.2)

    # ── Task 4: Write output file ────────────────────────────────────

    print("\n📋 Task 4: Write output files\n")

    agent.execute(
        tool="file_write",
        task="Write final report to disk",
        input_data="monthly_report_2026_06.pdf",
        output_data=json.dumps({"bytes_written": 24500, "format": "PDF"}),
        confidence=0.95,
        token_cost=200,
    )

    # ── Summary ──────────────────────────────────────────────────────

    agent.print_summary()
    return agent.summary()


if __name__ == "__main__":
    run()
