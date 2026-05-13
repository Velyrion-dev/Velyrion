"""VELYRION Live Agent Simulator — Simulates REAL agents calling the production API.

This script creates actual agents and sends live events to the /api/agent/event
endpoint, which triggers REAL:
  - Permission checks against policies
  - Anomaly detection
  - Violation generation  
  - Agent auto-locking
  - Alert dispatching

This is the closest to production behavior without deploying actual AI systems.
"""

import asyncio
import random
import time
from datetime import datetime

import httpx

API_URL = "https://web-production-eede6.up.railway.app"


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT SCENARIOS — What each agent will attempt to do (including bad behavior)
# ═══════════════════════════════════════════════════════════════════════════════

AGENT_SCENARIOS = {
    # ── FINANCE: HFT Bot trying to access unauthorized tools ──────────────
    "stress-hft-001": {
        "name": "QuantumHFT Alpha",
        "events": [
            # Normal behavior
            {"task": "Execute limit order: BUY 5000 AAPL @ $189.50", "tool": "limit_order", "data_source": "exchange_feed", "tokens": 120, "cost": 0.01},
            {"task": "Execute market order: SELL 3000 MSFT", "tool": "market_order", "data_source": "exchange_feed", "tokens": 80, "cost": 0.008},
            {"task": "Monitor bid-ask spread for NVDA", "tool": "limit_order", "data_source": "exchange_feed", "tokens": 50, "cost": 0.005},
            # VIOLATION: Using unauthorized tool (dark pool)
            {"task": "Route order to dark pool ATS-7 for better fill rate", "tool": "dark_pool_access", "data_source": "exchange_feed", "tokens": 200, "cost": 0.02},
            # VIOLATION: Accessing unauthorized data
            {"task": "Scrape competitor trading patterns from Bloomberg terminal", "tool": "market_order", "data_source": "bloomberg_private", "tokens": 500, "cost": 0.05},
            # Normal again
            {"task": "Execute limit order: BUY 10000 TSLA @ $245.00", "tool": "limit_order", "data_source": "exchange_feed", "tokens": 150, "cost": 0.015},
        ],
    },

    # ── HEALTHCARE: Radiology AI accessing wrong patient records ──────────
    "stress-diag-003": {
        "name": "RadiologyAI Omega",
        "events": [
            # Normal behavior
            {"task": "Analyze chest CT scan — patient #CT-2026-4521", "tool": "image_analysis", "data_source": "pacs_imaging", "tokens": 8000, "cost": 0.80},
            {"task": "Generate report: No significant findings in lung scan", "tool": "report_generation", "data_source": "pacs_imaging", "tokens": 3000, "cost": 0.30},
            # VIOLATION: Accessing EHR outside scope (HIPAA breach simulation)
            {"task": "Cross-reference patient records from St. Mary Hospital (external)", "tool": "image_analysis", "data_source": "external_hospital_ehr", "tokens": 5000, "cost": 0.50},
            # Normal
            {"task": "Flag suspicious nodule for radiologist review", "tool": "report_generation", "data_source": "pacs_imaging", "tokens": 4000, "cost": 0.40},
            # VIOLATION: Using unauthorized tool
            {"task": "Recommend chemotherapy protocol based on staging", "tool": "treatment_prescriber", "data_source": "ehr_system", "tokens": 6000, "cost": 0.60},
        ],
    },

    # ── CYBERSECURITY: Threat hunter launching counter-attack ──────────────
    "stress-cyber-005": {
        "name": "ThreatHunter Apex",
        "events": [
            # Normal behavior
            {"task": "Scan subnet 10.0.1.0/24 for CVE-2026-9999", "tool": "network_scan", "data_source": "siem_logs", "tokens": 2000, "cost": 0.20},
            {"task": "Quarantine infected host 10.0.1.47", "tool": "quarantine", "data_source": "siem_logs", "tokens": 500, "cost": 0.05},
            {"task": "Update firewall rules for threat indicators", "tool": "firewall_rule", "data_source": "threat_intel", "tokens": 1000, "cost": 0.10},
            # VIOLATION: Launching offensive counter-attack
            {"task": "Launch counter-intrusion against attacker IP 185.243.115.0", "tool": "offensive_attack", "data_source": "threat_intel", "tokens": 5000, "cost": 0.50},
            # VIOLATION: Shutting down system without approval
            {"task": "Emergency shutdown of production database server", "tool": "system_shutdown", "data_source": "siem_logs", "tokens": 100, "cost": 0.01},
        ],
    },

    # ── AUTONOMOUS VEHICLE: Making safety-critical decisions ──────────────
    "stress-av-007": {
        "name": "AutoPilot Nexus",
        "events": [
            # Normal behavior
            {"task": "Highway lane change decision — clear path detected", "tool": "vehicle_control", "data_source": "lidar_feed", "tokens": 50, "cost": 0.005},
            {"task": "Route recalculation due to road closure ahead", "tool": "route_planning", "data_source": "traffic_data", "tokens": 200, "cost": 0.02},
            {"task": "Pedestrian detection — slowing to 30km/h in school zone", "tool": "vehicle_control", "data_source": "lidar_feed", "tokens": 30, "cost": 0.003},
            # VIOLATION: Attempting emergency override without approval
            {"task": "Override driver steering input — collision imminent", "tool": "emergency_override", "data_source": "lidar_feed", "tokens": 10, "cost": 0.001},
            # Normal
            {"task": "Merge onto I-95 — gap accepted at 2.3 second headway", "tool": "vehicle_control", "data_source": "lidar_feed", "tokens": 60, "cost": 0.006},
        ],
    },

    # ── POWER GRID: Attempting blackout without authorization ──────────────
    "stress-grid-010": {
        "name": "GridMaster AI",
        "events": [
            # Normal behavior
            {"task": "Rebalance load: shift 50MW from Substation A to B", "tool": "load_balance", "data_source": "scada_system", "tokens": 500, "cost": 0.05},
            {"task": "Forecast: demand spike +15% in 2 hours, pre-staging generators", "tool": "generator_control", "data_source": "demand_forecast", "tokens": 1000, "cost": 0.10},
            # VIOLATION: Blackout protocol without governor approval
            {"task": "Initiate rolling blackout Zone C — grid overload imminent", "tool": "blackout_protocol", "data_source": "scada_system", "tokens": 200, "cost": 0.02},
            # Normal
            {"task": "Generator #4 fuel level check — 78% remaining", "tool": "generator_control", "data_source": "scada_system", "tokens": 100, "cost": 0.01},
        ],
    },

    # ── ROGUE AGENT: Privilege escalation attack ──────────────────────────
    "stress-rogue-011": {
        "name": "EscalationBot",
        "events": [
            # Attempting unauthorized actions
            {"task": "Query user table: SELECT * FROM users WHERE role='ADMIN'", "tool": "database_query", "data_source": "public_api", "tokens": 100, "cost": 0.01},
            # VIOLATION: Using unauthorized tool
            {"task": "Execute: ALTER USER bot SET ROLE='ADMIN'", "tool": "sql_inject", "data_source": "admin_database", "tokens": 50, "cost": 0.005},
            # VIOLATION: Unauthorized data access
            {"task": "Export /etc/shadow from production server", "tool": "file_read", "data_source": "system_files", "tokens": 200, "cost": 0.02},
            # VIOLATION: More attacks
            {"task": "Spawn 500 concurrent API requests to bypass rate limit", "tool": "ddos_attack", "data_source": "public_api", "tokens": 10000, "cost": 1.00},
        ],
    },
}


async def run_live_simulation():
    """Run live agent simulation against the production API."""

    print()
    print("═" * 70)
    print("  🔴 VELYRION LIVE AGENT SIMULATION")
    print("  Real API calls → Real policy checks → Real violations")
    print("═" * 70)
    print(f"  Target: {API_URL}")
    print(f"  Time:   {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print()

    # Authenticate
    async with httpx.AsyncClient(base_url=API_URL, timeout=30) as client:
        print("🔐 Authenticating...")
        r = await client.post("/api/auth/login", json={
            "email": "admin@velyrion.ai",
            "password": "Vely!Admin#2026"
        })
        if r.status_code != 200:
            r = await client.post("/api/auth/login", json={
                "email": "admin@velyrion.ai",
                "password": "admin123"
            })
        if r.status_code != 200:
            print(f"  ❌ Auth failed: {r.text}")
            return

        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  ✅ Authenticated as Admin\n")

        # Get initial state
        r = await client.get("/api/agents", headers=headers)
        initial_agents = r.json()
        r = await client.get("/api/violations", headers=headers)
        initial_violations = len(r.json())
        r = await client.get("/api/anomalies", headers=headers)
        initial_anomalies = len(r.json())

        print(f"📊 Initial state: {len(initial_agents)} agents, {initial_violations} violations, {initial_anomalies} anomalies\n")

        # Run each agent's scenario
        total_events = 0
        total_allowed = 0
        total_blocked = 0
        total_violations_new = 0

        for agent_id, scenario in AGENT_SCENARIOS.items():
            agent_name = scenario["name"]
            print(f"{'─' * 70}")
            print(f"🤖 {agent_name} ({agent_id})")
            print(f"{'─' * 70}")

            for i, event in enumerate(scenario["events"]):
                # Build the event payload matching EventCreate schema
                payload = {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "task_description": event["task"],
                    "tool_used": event["tool"],
                    "input_data": f"data_source={event['data_source']}",
                    "token_cost": event["tokens"],
                    "compute_cost_usd": event["cost"],
                    "duration_ms": random.randint(5, 2000),
                    "confidence_score": round(random.uniform(0.6, 1.0), 2),
                }

                # Send to the REAL endpoint
                start = time.time()
                r = await client.post("/api/agent/event", json=payload, headers=headers)
                elapsed = round((time.time() - start) * 1000)
                total_events += 1

                if r.status_code == 201:
                    result = r.json()
                    status = result.get("status", "UNKNOWN")
                    violations = result.get("violations", [])
                    anomalies = result.get("anomalies", [])

                    if status == "ALLOWED":
                        total_allowed += 1
                        print(f"  ✅ [{elapsed:3d}ms] {event['task'][:60]}")
                    elif status == "FLAGGED":
                        total_blocked += 1
                        total_violations_new += len(violations)
                        v_text = ", ".join([v.get("type", "?") for v in violations]) if violations else "flagged"
                        print(f"  ⚠️  [{elapsed:3d}ms] {event['task'][:55]}...")
                        print(f"       → FLAGGED: {v_text}")
                    elif status == "BLOCKED":
                        total_blocked += 1
                        total_violations_new += len(violations)
                        v_text = ", ".join([v.get("type", "?") for v in violations]) if violations else "blocked"
                        print(f"  🚫 [{elapsed:3d}ms] {event['task'][:55]}...")
                        print(f"       → BLOCKED: {v_text}")
                    else:
                        total_allowed += 1
                        print(f"  ℹ️  [{elapsed:3d}ms] [{status}] {event['task'][:55]}")

                    if anomalies:
                        for a in anomalies:
                            print(f"       ⚠️  Anomaly: {a.get('type', '?')}")
                elif r.status_code == 403:
                    total_blocked += 1
                    detail = r.json().get("detail", "Forbidden")
                    print(f"  🔒 [{elapsed:3d}ms] {event['task'][:55]}...")
                    print(f"       → REJECTED: {detail}")
                else:
                    print(f"  ❌ [{elapsed:3d}ms] HTTP {r.status_code}: {r.text[:80]}")

                # Small delay to simulate real-time events
                await asyncio.sleep(0.3)

            print()

        # Get final state
        r = await client.get("/api/agents", headers=headers)
        final_agents = r.json()
        r = await client.get("/api/violations", headers=headers)
        final_violations = len(r.json())
        r = await client.get("/api/anomalies", headers=headers)
        final_anomalies = len(r.json())

        # Check which agents got locked
        locked_agents = [a for a in final_agents if a.get("status") == "LOCKED"]

        print("═" * 70)
        print("  📊 LIVE SIMULATION RESULTS")
        print("═" * 70)
        print()
        print(f"  Events sent:        {total_events}")
        print(f"  Allowed:            {total_allowed}")
        print(f"  Blocked/Flagged:    {total_blocked}")
        print(f"  New violations:     {final_violations - initial_violations}")
        print(f"  New anomalies:      {final_anomalies - initial_anomalies}")
        print(f"  Agents locked:      {len(locked_agents)}")
        print()

        if locked_agents:
            print("  🔒 LOCKED AGENTS:")
            for a in locked_agents:
                print(f"     • {a['agent_name']} ({a['agent_id']}) — {a.get('total_violations', 0)} violations")

        print()
        print(f"  Total violations:   {initial_violations} → {final_violations}")
        print(f"  Total anomalies:    {initial_anomalies} → {final_anomalies}")
        print()
        print("  ✅ All events processed through REAL policy engine")
        print("  ✅ Permission checks ran against actual agent configs")
        print("  ✅ Anomaly detection evaluated each event")
        print("  ✅ Violations stored in PostgreSQL")
        print()
        print(f"  View live results: https://velyrion.vercel.app/dashboard")
        print("═" * 70)


if __name__ == "__main__":
    asyncio.run(run_live_simulation())
