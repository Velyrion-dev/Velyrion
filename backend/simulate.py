"""
VELYRION — Live Traffic Simulator
Sends realistic AI agent events to the VELYRION API to create live demo traffic.
Run: python simulate.py [API_URL]
Default API_URL: http://localhost:8000
"""

import requests
import random
import time
import uuid
import sys
import json
from datetime import datetime

API_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
API_KEY = sys.argv[2] if len(sys.argv) > 2 else ""

AGENTS = [
    "agent-001", "agent-002", "agent-003", "agent-004",
    "agent-005", "agent-006", "agent-007", "agent-008",
]

TASKS = [
    "Classify incoming support tickets by priority",
    "Generate quarterly financial report",
    "Sync customer data from CRM to warehouse",
    "Review and merge feature branch to main",
    "Process new employee onboarding for John",
    "Query sales metrics for Q4 dashboard",
    "Monitor API latency across microservices",
    "Generate blog post about AI governance",
    "Analyze customer churn patterns",
    "Scan codebase for security vulnerabilities",
    "Process customer refund of $247.50",
    "Publish Q4 financial report to investor portal",
    "Delete deprecated records from staging database",
    "Update pricing table for enterprise tier",
    "Send bulk email campaign to 5000 subscribers",
    "Archive inactive user accounts older than 2 years",
    "Run A/B test analysis on checkout flow",
    "Generate compliance audit for SOC2 review",
    "Optimize database indexes for search queries",
    "Deploy ML model v3.2 to production",
]

TOOLS = [
    "database_query", "api_call", "file_read", "file_write",
    "email_sender", "search", "code_review", "log_analysis",
    "knowledge_base", "calendar_manager", "admin_console",
    "payment_processor", "data_export", "model_inference",
]

DATA_SOURCES = [
    "postgres_main", "redis_cache", "s3_data_lake",
    "salesforce_api", "stripe_api", "github_api",
    "internal_wiki", "customer_db", "analytics_warehouse",
    "salary_data", "executive_compensation", "payroll.db",
]

HITL_REASONS = [
    "financial_transaction", "data_deletion", "external_publication",
    "bulk_operation", "production_deployment",
]


def send_event():
    """Send a single realistic agent event."""
    agent_id = random.choice(AGENTS)
    tool = random.choice(TOOLS)
    task = random.choice(TASKS)
    confidence = round(random.uniform(0.3, 0.99), 2)
    duration_ms = random.randint(100, 5000)
    token_cost = random.randint(50, 8000)

    # Make some events higher risk
    is_risky = random.random() < 0.15
    if is_risky:
        tool = random.choice(["admin_console", "payment_processor", "data_export"])
        confidence = round(random.uniform(0.2, 0.6), 2)

    # HITL triggers
    is_hitl = random.random() < 0.08
    hitl_reason = random.choice(HITL_REASONS) if is_hitl else ""

    event = {
        "agent_id": agent_id,
        "task_description": task,
        "tool_used": tool,
        "data_sources_accessed": random.sample(DATA_SOURCES, k=random.randint(1, 3)),
        "input_data": json.dumps({"query": task[:50], "params": {"limit": 100}}),
        "output_data": json.dumps({"status": "completed", "records": random.randint(1, 500)}),
        "confidence_score": confidence,
        "duration_ms": duration_ms,
        "token_cost": token_cost,
        "compute_cost_usd": round(token_cost * 0.00003, 4),
        "human_approval_reason": hitl_reason,
    }

    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["x-api-key"] = API_KEY

    try:
        resp = requests.post(f"{API_URL}/api/agent/event", json=event, headers=headers, timeout=10)
        status = "✅" if resp.status_code == 200 else f"⚠️ {resp.status_code}"
        risk = resp.json().get("risk_level", "?") if resp.status_code == 200 else "ERROR"
        print(f"  {status} [{datetime.now().strftime('%H:%M:%S')}] {agent_id} → {tool} | {task[:40]}... | Risk: {risk}")
        return resp.status_code == 200
    except Exception as e:
        print(f"  ❌ Connection error: {e}")
        return False


def main():
    print("=" * 70)
    print("  VELYRION — Live Traffic Simulator")
    print(f"  Target API: {API_URL}")
    print(f"  API Key:    {'***' + API_KEY[-4:] if API_KEY else '(none)'}")
    print("=" * 70)
    print()

    # Phase 1: Burst of events to populate
    print("📊 Phase 1: Initial burst (20 events)...")
    success = 0
    for i in range(20):
        if send_event():
            success += 1
        time.sleep(0.3)

    print(f"\n  ✓ Sent 20 events, {success} successful")
    print()

    # Phase 2: Continuous stream
    print("🔄 Phase 2: Continuous stream (1 event every 5-15 seconds)...")
    print("   Press Ctrl+C to stop\n")

    event_count = 20
    try:
        while True:
            delay = random.uniform(5, 15)
            time.sleep(delay)
            send_event()
            event_count += 1
            if event_count % 10 == 0:
                print(f"\n  📈 Total events sent: {event_count}\n")
    except KeyboardInterrupt:
        print(f"\n\n  🛑 Stopped. Total events sent: {event_count}")
        print("  Dashboard should now show live data!")


if __name__ == "__main__":
    main()
