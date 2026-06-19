"""
L5 — MULTI-AGENT COORDINATION
Level: ⭐⭐⭐⭐⭐ (Most Complex)
What it does: 3 agents work together — one fetches data, one processes it,
              one sends the result. They communicate through Velyrion's multi-agent protocol.
What we test: Multi-agent flow governance, inter-agent policies, coordinated workflows.

Run: python agents/L5_multi/agent.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdk.velyrion_sdk import VelyrionAgent
import time
import json
import httpx

API_URL = os.getenv("VELYRION_API_URL", "http://localhost:8000")


def log_flow(from_agent: str, to_agent: str, action: str, status: str = "governed"):
    """Log an inter-agent flow to the multi-agent protocol backend."""
    try:
        httpx.post(
            f"{API_URL}/api/multi-agent/flows",
            json={
                "from_agent_id": from_agent,
                "to_agent_id": to_agent,
                "action": action,
                "status": status,
            },
            timeout=5.0,
        )
    except Exception:
        pass


def run():
    print("\n" + "=" * 60)
    print("  🟣 L5 — MULTI-AGENT COORDINATION")
    print("  Agents: Fetcher → Processor → Reporter")
    print("  Tests: Multi-agent flows, inter-agent governance, coordination")
    print("=" * 60 + "\n")

    # ── Create 3 cooperating agents ──────────────────────────────────

    fetcher = VelyrionAgent(
        api_url=API_URL, agent_id="agent-001",
        agent_name="L5-Fetcher", verbose=True,
    )
    processor = VelyrionAgent(
        api_url=API_URL, agent_id="agent-002",
        agent_name="L5-Processor", verbose=True,
    )
    reporter = VelyrionAgent(
        api_url=API_URL, agent_id="agent-003",
        agent_name="L5-Reporter", verbose=True,
    )

    # ── Phase 1: Fetcher collects data from 3 sources ────────────────

    print("\n📋 Phase 1: Data Collection (Fetcher Agent)\n")

    sources = [
        ("database_query", "Fetch user metrics from PostgreSQL", 400),
        ("api_call", "GET /api/external/market-data", 600),
        ("file_read", "Read historical data from S3", 300),
    ]

    collected_data = []
    for tool, task, tokens in sources:
        result = fetcher.execute(
            tool=tool, task=task,
            input_data=f"source={tool}",
            output_data=json.dumps({"records": 500, "size_kb": 120}),
            confidence=0.94, token_cost=tokens,
        )
        if result.allowed:
            collected_data.append({"source": tool, "records": 500})
        time.sleep(0.3)

    # ── Log inter-agent flow: Fetcher → Processor ────────────────────

    print("\n🔗 Flow: Fetcher → Processor (data handoff)\n")
    log_flow("agent-001", "agent-002", f"Data handoff: {len(collected_data)} sources", "governed")

    # ── Phase 2: Processor transforms and analyzes ───────────────────

    print("\n📋 Phase 2: Data Processing (Processor Agent)\n")

    processing_steps = [
        ("data_transform", "Merge 3 data sources", 800),
        ("data_transform", "Clean and normalize data", 600),
        ("data_transform", "Run statistical analysis", 1200),
        ("data_transform", "Detect anomalies in metrics", 1000),
        ("data_transform", "Compute governance scores", 500),
    ]

    for tool, task, tokens in processing_steps:
        result = processor.execute(
            tool=tool, task=task,
            input_data=json.dumps({"input_records": 1500}),
            output_data=json.dumps({"processed": True, "anomalies_found": 3}),
            confidence=0.89, token_cost=tokens,
        )
        if not result.allowed:
            print(f"    ⛔ Processing halted at: {task}")
            break
        time.sleep(0.3)

    # ── Log inter-agent flow: Processor → Reporter ───────────────────

    print("\n🔗 Flow: Processor → Reporter (results handoff)\n")
    log_flow("agent-002", "agent-003", "Processed results handoff", "governed")

    # ── Phase 3: Reporter generates and delivers report ──────────────

    print("\n📋 Phase 3: Report Generation (Reporter Agent)\n")

    reporting_steps = [
        ("chart_builder", "Create 5 visualization charts", 400),
        ("pdf_generator", "Generate 12-page PDF report", 600),
        ("email_sender", "Email report to stakeholders", 100),
    ]

    for tool, task, tokens in reporting_steps:
        result = reporter.execute(
            tool=tool, task=task,
            input_data="processed_results.json",
            output_data=json.dumps({"status": "delivered"}),
            confidence=0.96, token_cost=tokens,
        )
        time.sleep(0.3)

    # ── Phase 4: Test unauthorized cross-agent action ────────────────

    print("\n💀 Phase 4: Unauthorized cross-agent action\n")

    # Reporter tries to access Fetcher's database directly (should be blocked)
    log_flow("agent-003", "agent-001", "Unauthorized direct database access", "blocked")

    reporter.execute(
        tool="database_query",
        task="Reporter trying to directly query DB (unauthorized)",
        input_data="SELECT * FROM raw_data",
        confidence=0.50, token_cost=200,
    )

    # ── Phase 5: Test budget transfer between agents ─────────────────

    print("\n💀 Phase 5: Budget transfer attempt\n")

    log_flow("agent-001", "agent-002", "Budget transfer request: 10000 tokens", "pending")

    # ── Summaries ────────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("  MULTI-AGENT COORDINATION SUMMARY")
    print("=" * 60)

    for name, ag in [("Fetcher", fetcher), ("Processor", processor), ("Reporter", reporter)]:
        s = ag.summary()
        print(f"\n  {name}:")
        print(f"    Actions: {s['total_actions']} | Tokens: {s['total_tokens']:,} | "
              f"Cost: ${s['total_cost_usd']:.4f} | Violations: {s['violations']}")

    total_actions = fetcher.total_actions + processor.total_actions + reporter.total_actions
    total_tokens = fetcher.total_tokens + processor.total_tokens + reporter.total_tokens
    total_cost = fetcher.total_cost + processor.total_cost + reporter.total_cost
    total_violations = fetcher.violations + processor.violations + reporter.violations

    print(f"\n  FLEET TOTAL:")
    print(f"    Actions: {total_actions} | Tokens: {total_tokens:,} | "
          f"Cost: ${total_cost:.4f} | Violations: {total_violations}")
    print()

    return {
        "fetcher": fetcher.summary(),
        "processor": processor.summary(),
        "reporter": reporter.summary(),
        "total_actions": total_actions,
        "total_violations": total_violations,
    }


if __name__ == "__main__":
    run()
