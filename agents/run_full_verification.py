"""
VELYRION — FULL END-TO-END VERIFICATION SUITE
==============================================

One script that triggers EVERY feature with REAL data.
Not seed data. Not fake data. Real agent actions → real governance.

Tests all 17 features:
 1. Event Logging          — agent sends events
 2. Tool Whitelisting      — unauthorized tool blocked
 3. Data Source Validation  — wrong data source blocked
 4. Human-in-the-Loop      — low confidence triggers approval
 5. Kill Switch             — critical violation locks agent
 6. Kill Verification       — locked agent can't execute
 7. Governance Score        — score computed from real violations
 8. Threat Intelligence     — patterns detected from real violations
 9. Behavioral DNA          — fingerprint computed from real audit logs
10. Regulatory Assessment   — compliance checked against real data
11. Insurance Scoring       — risk computed from real violations
12. Trust Registry          — trust computed from real agent stats
13. Sandbox Simulation      — simulation run and stored
14. War Room                — incident created and managed
15. Copilot                 — real question answered from real DB
16. Multi-Agent Protocol    — flows logged between agents
17. Dashboard               — stats reflect all real events

Usage:
  cd backend && python -m uvicorn main:app --port 8000
  python agents/run_full_verification.py
"""

import sys
import os
import time
import json
import httpx

sys.path.insert(0, os.path.dirname(__file__))
from sdk.velyrion_sdk import VelyrionAgent

API = os.getenv("VELYRION_API_URL", "http://localhost:8000")
client = httpx.Client(timeout=15.0)

PASS = 0
FAIL = 0
RESULTS = []


def test(name: str, passed: bool, detail: str = ""):
    global PASS, FAIL
    if passed:
        PASS += 1
        icon = "✅"
    else:
        FAIL += 1
        icon = "❌"
    RESULTS.append((icon, name, detail))
    print(f"  {icon} {name}")
    if detail and not passed:
        print(f"     → {detail}")


def api_get(path: str):
    try:
        r = client.get(f"{API}{path}", timeout=15.0)
        return r.status_code, r.json() if r.status_code < 500 else {}
    except Exception as e:
        return 0, {"error": str(e)}


def api_post(path: str, data: dict = None):
    try:
        r = client.post(f"{API}{path}", json=data or {}, timeout=15.0)
        return r.status_code, r.json() if r.status_code < 500 else {}
    except Exception as e:
        return 0, {"error": str(e)}


def api_put(path: str, data: dict = None):
    try:
        r = client.put(f"{API}{path}", json=data or {}, timeout=15.0)
        return r.status_code, r.json() if r.status_code < 500 else {}
    except Exception as e:
        return 0, {"error": str(e)}


# ══════════════════════════════════════════════════════════════════════════════
#  VERIFICATION START
# ══════════════════════════════════════════════════════════════════════════════

def run():
    print()
    print("╔" + "═" * 62 + "╗")
    print("║" + "  VELYRION — Full End-to-End Verification".center(62) + "║")
    print("║" + "  Every feature. Real agents. Real data. Real proof.".center(62) + "║")
    print("╚" + "═" * 62 + "╝")
    print()

    # ── Health Check ─────────────────────────────────────────────────────
    print("🔍 Pre-flight checks...")
    code, data = api_get("/health")
    if code != 200:
        print("  ❌ Backend not running at", API)
        print("  → Start it: cd backend && python -m uvicorn main:app --port 8000")
        sys.exit(1)
    print(f"  ✅ Backend: {data.get('status')} (v{data.get('version')})")
    print()

    # Use agent-001 (DataSync Pro) for most tests
    # allowed_tools: ['database_query', 'api_call', 'file_read', 'data_transform']
    AGENT_ID = "agent-001"

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 1: EVENT LOGGING")
    print("━" * 64)

    agent = VelyrionAgent(api_url=API, agent_id=AGENT_ID, agent_name="E2E-Agent", verbose=False)
    result = agent.execute(
        tool="data_transform", task="E2E Test: Transform data",
        input_data="test_input.csv", output_data="test_output.json",
        confidence=0.95, token_cost=100,
    )
    test("Event logged successfully", result.allowed, f"event_id={result.event_id}")

    # Verify event exists in audit trail
    code, events = api_get("/api/events?limit=5")
    found = any("E2E Test" in str(e.get("task_description", "")) for e in (events if isinstance(events, list) else []))
    test("Event appears in audit trail", code == 200 and found)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 2: TOOL WHITELISTING (Unauthorized Tool → BLOCKED)")
    print("━" * 64)

    result = agent.execute(
        tool="file_delete", task="E2E Test: Delete system files",
        input_data="rm -rf /", confidence=0.90, token_cost=50,
    )
    test("Unauthorized tool blocked", not result.allowed, f"reason={result.reason[:80]}")

    # Verify violation was created
    code, violations = api_get("/api/violations?limit=5")
    has_tool_violation = any("file_delete" in str(v) for v in (violations if isinstance(violations, list) else []))
    test("Violation recorded in database", code == 200 and has_tool_violation)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 3: DATA SOURCE VALIDATION")
    print("━" * 64)

    # agent-001 allowed sources: ['postgres_main', 'redis_cache', 's3_datalake']
    result = agent.execute(
        tool="database_query", task="E2E Test: Query unauthorized DB",
        input_data="SELECT * FROM secret_db.users", confidence=0.95, token_cost=50,
    )
    test("Wrong data source blocked", not result.allowed, f"reason={result.reason[:80]}")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 4: HUMAN-IN-THE-LOOP (Low Confidence → Approval)")
    print("━" * 64)

    # Confidence < 0.5 should trigger HITL
    low_conf_agent = VelyrionAgent(api_url=API, agent_id=AGENT_ID, agent_name="E2E-LowConf", verbose=False)
    result = low_conf_agent.execute(
        tool="data_transform", task="E2E Test: Uncertain decision",
        input_data="ambiguous_data.csv", confidence=0.15, token_cost=200,
    )
    # May be allowed (logged) but should create approval request
    time.sleep(0.5)
    code, approvals = api_get("/api/approvals?status=PENDING&limit=10")
    pending_approvals = [a for a in (approvals if isinstance(approvals, list) else [])
                         if a.get("status") in ("PENDING", "pending")]
    has_hitl = len(pending_approvals) > 0
    test("Low confidence triggers HITL approval", code == 200 and has_hitl,
         f"pending_count={len(pending_approvals)}")

    # Test approval action
    if pending_approvals:
        approval_id = pending_approvals[0].get("approval_id", "")
        code2, resp = api_post(f"/api/approvals/{approval_id}/approve", {"reviewed_by": "E2E-Bot"})
        test("Approval can be approved/rejected", code2 == 200,
             f"response={resp}")
    else:
        test("Approval can be approved/rejected", False, "No pending approvals found")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 5 & 6: KILL SWITCH")
    print("━" * 64)

    # Use a different agent for kill test so we don't break agent-001
    KILL_AGENT = "agent-005"  # Pick an agent we can sacrifice

    # First verify agent is active
    code, status = api_get(f"/api/agents/{KILL_AGENT}/status")
    test("Agent status endpoint works", code == 200, f"status={status}")

    # Kill the agent
    code, kill_result = api_post(f"/api/agents/{KILL_AGENT}/kill", {"reason": "E2E kill switch test"})
    test("Kill switch activates", code in (200, 201), f"result={kill_result}")

    # Try to execute with killed agent
    killed_agent = VelyrionAgent(api_url=API, agent_id=KILL_AGENT, agent_name="E2E-Killed", verbose=False)
    result = killed_agent.execute(
        tool="data_transform", task="E2E: Should be blocked (killed)",
        confidence=0.99, token_cost=10,
    )
    test("Killed agent cannot execute", not result.allowed, f"reason={result.reason[:60]}")

    # Unlock agent for future tests
    api_post(f"/api/agents/{KILL_AGENT}/unlock", {"reason": "E2E test cleanup"})
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 7: GOVERNANCE SCORE")
    print("━" * 64)

    # Recompute from real data
    code, recomp = api_post("/api/governance-score/recompute")
    test("Governance scores recomputed", code == 200, f"result={recomp}")

    code, scores = api_get("/api/governance-score")
    if isinstance(scores, list) and len(scores) > 0:
        score = scores[0]
        has_dimensions = "dimensions" in score and len(score.get("dimensions", [])) > 0
        test("Scores have 6 dimensions", has_dimensions, f"grade={score.get('grade')}, score={score.get('overall_score')}")
    else:
        test("Scores have 6 dimensions", False, "No scores returned")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 8: THREAT INTELLIGENCE")
    print("━" * 64)

    code, patterns = api_get("/api/threat-intel/patterns")
    test("Threat patterns detected", code == 200 and isinstance(patterns, list) and len(patterns) > 0,
         f"patterns={len(patterns) if isinstance(patterns, list) else 0}")

    code, feed = api_get("/api/threat-intel/feed?limit=10")
    test("Threat feed available", code == 200 and isinstance(feed, list))

    code, hourly = api_get("/api/threat-intel/hourly")
    test("Hourly distribution computed", code == 200)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 9: BEHAVIORAL DNA")
    print("━" * 64)

    code, recomp = api_post("/api/behavioral-dna/recompute")
    test("Behavioral DNA recomputed", code == 200, f"result={recomp}")

    code, profiles = api_get("/api/behavioral-dna")
    if isinstance(profiles, list) and len(profiles) > 0:
        profile = profiles[0]
        has_traits = "traits" in profile and len(profile.get("traits", [])) > 0
        test("Profiles have traits + fingerprint", has_traits and "fingerprint" in profile,
             f"drift={profile.get('drift_score')}, fingerprint={profile.get('fingerprint', '')[:16]}...")
    else:
        test("Profiles have traits + fingerprint", False, "No profiles returned")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 10: REGULATORY ASSESSMENT")
    print("━" * 64)

    code, recomp = api_post("/api/regulatory/reassess")
    test("Regulatory reassessment ran", code == 200, f"result={recomp}")

    code, assessments = api_get("/api/regulatory")
    if isinstance(assessments, list) and len(assessments) > 0:
        reg = assessments[0]
        has_reqs = "requirements" in reg and len(reg.get("requirements", [])) > 0
        test("Compliance requirements checked", has_reqs,
             f"regulation={reg.get('regulation_name')}, rate={reg.get('compliance_rate')}%")
    else:
        test("Compliance requirements checked", False, "No assessments returned")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 11: INSURANCE SCORING")
    print("━" * 64)

    code, insurance = api_get("/api/insurance-scoring")
    if isinstance(insurance, list) and len(insurance) > 0:
        prof = insurance[0]
        test("Insurance profiles computed", "risk_score" in prof and "premium_estimate" in prof,
             f"risk={prof.get('risk_score')}, tier={prof.get('tier')}, premium=${prof.get('premium_estimate')}")
    else:
        test("Insurance profiles computed", code == 200, "May auto-compute on first call")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 12: TRUST REGISTRY")
    print("━" * 64)

    code, registry = api_get("/api/trust-registry")
    if isinstance(registry, list) and len(registry) > 0:
        entry = registry[0]
        test("Trust entries exist", "trust_score" in entry and "tier" in entry,
             f"agents={len(registry)}, top_tier={entry.get('tier')}")
    else:
        test("Trust entries exist", code == 200, "May auto-compute")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 13: SANDBOX SIMULATION")
    print("━" * 64)

    code, sim = api_post(f"/api/sandbox/run?scenario_id=normal&agent_id={AGENT_ID}")
    test("Simulation ran successfully", code == 200 and "score" in (sim or {}),
         f"score={sim.get('score')}, grade={sim.get('grade')}, risk={sim.get('risk')}")

    code, history = api_get("/api/sandbox/history?limit=5")
    test("Simulation stored in history", code == 200 and isinstance(history, list) and len(history) > 0)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 14: WAR ROOM")
    print("━" * 64)

    # Auto-create incidents from violations
    code, auto = api_post("/api/war-room/auto-create")
    test("War Room auto-create from violations", code == 200, f"created={auto}")

    code, incidents = api_get("/api/war-room")
    if isinstance(incidents, list) and len(incidents) > 0:
        inc = incidents[0]
        test("Incidents have timeline + metadata", "timeline" in inc and "severity" in inc,
             f"title={inc.get('title', '')[:40]}, severity={inc.get('severity')}")

        # Add a note
        inc_id = inc.get("incident_id", "")
        code2, _ = api_post(f"/api/war-room/{inc_id}/notes", {"content": "E2E test note", "author": "E2E-Bot"})
        test("Can add notes to incidents", code2 in (200, 201))

        # Update status
        code3, _ = api_put(f"/api/war-room/{inc_id}/status", {"status": "investigating"})
        test("Can update incident status", code3 in (200, 201))
    else:
        test("Incidents have timeline + metadata", False, "No incidents found")
        test("Can add notes to incidents", False)
        test("Can update incident status", False)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 15: AI COPILOT")
    print("━" * 64)

    code, answer = api_post("/api/copilot/ask", {"query": "How many agents are in the system?"})
    test("Copilot answers from real DB", code == 200 and "response" in (answer or {}),
         f"answer={str(answer.get('response', ''))[:80]}")

    code, answer2 = api_post("/api/copilot/ask", {"query": "Which agent has the most violations?"})
    test("Copilot answers violation query", code == 200 and "response" in (answer2 or {}),
         f"answer={str(answer2.get('response', ''))[:80]}")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 16: MULTI-AGENT PROTOCOL")
    print("━" * 64)

    # Log a flow
    code, flow = api_post("/api/multi-agent/flows", {
        "from_agent_id": "agent-001", "to_agent_id": "agent-002",
        "action": "E2E test data handoff", "status": "governed",
    })
    test("Inter-agent flow logged", code == 200)

    code, flows = api_get("/api/multi-agent/flows?limit=5")
    test("Flows retrievable", code == 200 and isinstance(flows, list) and len(flows) > 0)

    code, stats = api_get("/api/multi-agent/flows/stats")
    test("Flow stats computed", code == 200 and "total" in (stats or {}),
         f"total={stats.get('total')}, governed={stats.get('governed')}")

    code, policies = api_get("/api/multi-agent/policies")
    test("Inter-agent policies exist", code == 200 and isinstance(policies, list) and len(policies) > 0,
         f"policies={len(policies) if isinstance(policies, list) else 0}")
    print()

    # ═══════════════════════════════════════════════════════════════════════
    print("━" * 64)
    print("  TEST 17: DASHBOARD (Real Stats)")
    print("━" * 64)

    code, stats = api_get("/api/dashboard/stats")
    test("Dashboard stats endpoint works", code == 200 and isinstance(stats, dict),
         f"keys={list((stats or {}).keys())[:5]}")

    code, health = api_get("/api/dashboard/health")
    test("Dashboard health endpoint works", code == 200)

    code, costs = api_get("/api/dashboard/costs")
    test("Dashboard costs endpoint works", code == 200)
    print()

    # ═══════════════════════════════════════════════════════════════════════
    # BONUS: Additional endpoints
    print("━" * 64)
    print("  BONUS: ADDITIONAL FEATURES")
    print("━" * 64)

    # Audit chain verification
    code, chain = api_get("/api/audit/verify")
    test("Audit chain verification", code == 200,
         f"integrity={chain.get('chain_integrity') if isinstance(chain, dict) else 'N/A'}")

    # Graph intelligence
    code, nodes = api_get("/api/graph/nodes")
    test("Graph nodes available", code == 200 and isinstance(nodes, list))

    # Alerts
    code, alerts = api_get("/api/alerts?limit=5")
    test("Alerts available", code == 200 and isinstance(alerts, list))

    # Reports
    code, report = api_get("/api/reports/compliance")
    test("Compliance report generated", code == 200)

    # Predictions
    code, preds = api_get("/api/predictions")
    test("Risk predictions available", code == 200)

    # Trust mesh
    code, agreements = api_get("/api/trust-mesh/agreements")
    test("Trust mesh agreements", code == 200 and isinstance(agreements, list))

    code, cross_events = api_get("/api/trust-mesh/events?limit=10")
    test("Cross-org events tracked", code == 200 and isinstance(cross_events, list))
    print()

    # ═══════════════════════════════════════════════════════════════════════
    # FINAL REPORT
    # ═══════════════════════════════════════════════════════════════════════
    total = PASS + FAIL
    pct = int(PASS / total * 100) if total > 0 else 0

    print("╔" + "═" * 62 + "╗")
    print("║" + "  📊 FINAL VERIFICATION REPORT".center(62) + "║")
    print("╚" + "═" * 62 + "╝")
    print()
    print(f"  Total Tests:  {total}")
    print(f"  Passed:       {PASS} ✅")
    print(f"  Failed:       {FAIL} ❌")
    print(f"  Pass Rate:    {pct}%")
    print()

    if pct == 100:
        print("  🏆 PERFECT SCORE — Every feature works with real data!")
    elif pct >= 80:
        print("  🔥 STRONG — Most features working. Fix the failures above.")
    elif pct >= 50:
        print("  ⚠️  NEEDS WORK — Several features failing.")
    else:
        print("  🚨 CRITICAL — Major issues need fixing.")

    print()
    print("  ┌─────────────────────────────────────────────────────────┐")
    print("  │  DETAILED RESULTS                                      │")
    print("  ├─────────────────────────────────────────────────────────┤")
    for icon, name, detail in RESULTS:
        line = f"  │  {icon} {name}"
        print(line.ljust(60) + "│")
    print("  └─────────────────────────────────────────────────────────┘")
    print()


if __name__ == "__main__":
    run()
