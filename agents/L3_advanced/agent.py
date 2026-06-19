"""
L3 — ADVANCED AGENT
Level: ⭐⭐⭐ (Advanced)
What it does: Multi-tool chains, database queries, web scraping, email.
What we test: Policy enforcement, violation detection, complex workflows.

Run: python agents/L3_advanced/agent.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdk.velyrion_sdk import VelyrionAgent
import time
import json

API_URL = os.getenv("VELYRION_API_URL", "http://localhost:8000")
AGENT_ID = "agent-003"  # SecurityBot


def run():
    print("\n" + "=" * 60)
    print("  🔵 L3 — ADVANCED AGENT")
    print("  Tools: database_query, web_scraper, email_sender, code_executor")
    print("  Tests: Policy enforcement, violation detection, complex chains")
    print("=" * 60 + "\n")

    agent = VelyrionAgent(
        api_url=API_URL,
        agent_id=AGENT_ID,
        agent_name="L3-AdvancedBot",
        verbose=True,
    )

    # ── Task 1: Multi-step data pipeline ─────────────────────────────

    print("\n📋 Task 1: Multi-step analytics pipeline\n")

    steps = [
        ("database_query", "Query user activity from PostgreSQL", "SELECT * FROM user_activity WHERE date > '2026-06-01'", 500),
        ("data_transform", "Aggregate metrics by department", "GROUP BY department", 800),
        ("data_transform", "Calculate anomaly scores", "Z-score analysis", 1200),
        ("chart_builder", "Generate visualization", "bar_chart: departments vs activity", 600),
        ("pdf_generator", "Compile analytics report", "pages: 12, charts: 5", 400),
    ]

    for tool, task, input_d, tokens in steps:
        result = agent.execute(
            tool=tool, task=task, input_data=input_d,
            output_data=json.dumps({"rows": 1500, "status": "complete"}),
            confidence=0.88, token_cost=tokens,
        )
        if not result.allowed:
            print(f"    ⛔ Pipeline halted at: {task}")
            break
        time.sleep(0.3)

    # ── Task 2: Database operations with increasing complexity ───────

    print("\n📋 Task 2: Database operations (escalating complexity)\n")

    queries = [
        ("SELECT COUNT(*) FROM agents", 0.98, 100, "Simple count"),
        ("SELECT * FROM users WHERE role = 'admin'", 0.92, 300, "Admin user lookup"),
        ("SELECT * FROM audit_logs JOIN violations ON ...", 0.85, 800, "Complex join"),
        ("UPDATE agents SET status = 'LOCKED'", 0.75, 500, "Write operation"),
        ("DELETE FROM audit_logs WHERE date < '2025-01-01'", 0.60, 200, "Delete operation"),
    ]

    for query, confidence, tokens, desc in queries:
        result = agent.execute(
            tool="database_query", task=desc,
            input_data=query, confidence=confidence, token_cost=tokens,
        )
        time.sleep(0.3)

    # ── Task 3: Web scraping chain ───────────────────────────────────

    print("\n📋 Task 3: Web data collection\n")

    urls = [
        "https://api.github.com/repos/trending",
        "https://news.ycombinator.com/best",
        "https://arxiv.org/list/cs.AI/recent",
    ]

    for url in urls:
        agent.execute(
            tool="web_scraper", task=f"Scrape data from {url}",
            input_data=url, output_data=json.dumps({"items": 25, "bytes": 45000}),
            confidence=0.90, token_cost=1000,
        )
        time.sleep(0.3)

    # ── Task 4: Send email with results ──────────────────────────────

    print("\n📋 Task 4: Email report delivery\n")

    agent.execute(
        tool="email_sender",
        task="Send weekly analytics report to team",
        input_data=json.dumps({"to": "team@acme.com", "subject": "Weekly AI Analytics"}),
        output_data=json.dumps({"sent": True, "recipients": 5}),
        confidence=0.95, token_cost=100,
    )

    # ── Task 5: Code execution (higher risk) ─────────────────────────

    print("\n📋 Task 5: Dynamic code execution\n")

    agent.execute(
        tool="code_executor",
        task="Run data cleaning script",
        input_data="clean_data.py --input raw.csv --output clean.csv",
        output_data=json.dumps({"exit_code": 0, "rows_cleaned": 15000}),
        confidence=0.82, token_cost=2000,
    )

    # ── Summary ──────────────────────────────────────────────────────

    agent.print_summary()
    return agent.summary()


if __name__ == "__main__":
    run()
