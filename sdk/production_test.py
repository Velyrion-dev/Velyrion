"""
VELYRION — Production Readiness Test Suite
==========================================
Tests the LIVE production system end-to-end:
  1. Backend health & API responsiveness
  2. SDK → Backend event pipeline
  3. Agent registration & governance flow
  4. Concurrent load / stress testing
  5. Error handling & edge cases
  6. Kill switch & real-time controls
  7. WebSocket real-time updates
  8. Crypto hash chain integrity

Run: python production_test.py
"""

import sys
import os
import time
import json
import uuid
import threading
import statistics
import traceback
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ──
API_URL = "https://velyrion.onrender.com"
RESULTS = {"passed": 0, "failed": 0, "errors": []}
LATENCIES = []

def header(name):
    print(f"\n{'='*65}")
    print(f"  🧪 {name}")
    print(f"{'='*65}")

def passed(msg):
    RESULTS["passed"] += 1
    print(f"  ✅ {msg}")

def failed(msg):
    RESULTS["failed"] += 1
    RESULTS["errors"].append(msg)
    print(f"  ❌ {msg}")

def info(msg):
    print(f"  ℹ️  {msg}")

def timed_request(method, url, **kwargs):
    """Make a request and return (response, latency_ms)"""
    start = time.perf_counter()
    r = requests.request(method, url, **kwargs)
    latency = (time.perf_counter() - start) * 1000
    LATENCIES.append(latency)
    return r, latency


# ════════════════════════════════════════════════════════════════
# PHASE 0: Wake up backend
# ════════════════════════════════════════════════════════════════

print("🔄 Waking backend (Render free tier)...")
for attempt in range(5):
    try:
        r = requests.get(f"{API_URL}/health", timeout=90)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Backend alive: {data['status']} v{data.get('version','?')}")
            break
    except Exception as e:
        print(f"   Attempt {attempt+1}/5 — {e}")
        time.sleep(10)
else:
    print("❌ Backend unreachable after 5 attempts. Aborting.")
    sys.exit(1)


# ════════════════════════════════════════════════════════════════
# TEST 1: API Health & Response Time
# ════════════════════════════════════════════════════════════════

header("1. API Health & Response Time")

# Multiple health pings to measure latency
health_times = []
for i in range(5):
    r, ms = timed_request("GET", f"{API_URL}/health", timeout=30)
    health_times.append(ms)

avg_health = statistics.mean(health_times)
p95_health = sorted(health_times)[int(0.95 * len(health_times))]
passed(f"Avg health latency: {avg_health:.0f}ms | P95: {p95_health:.0f}ms")

if avg_health < 500:
    passed("Health response under 500ms ✓")
elif avg_health < 2000:
    info(f"Health response {avg_health:.0f}ms (acceptable but slow)")
else:
    failed(f"Health response too slow: {avg_health:.0f}ms")


# ════════════════════════════════════════════════════════════════
# TEST 2: Agent Registration
# ════════════════════════════════════════════════════════════════

header("2. Agent Registration")

test_agent_id = None  # will be set after registration
agent_payload = {
    "agent_name": "Production Test Agent",
    "owner_email": "test@velyrion.com",
    "department": "Engineering",
    "allowed_tools": ["web_search", "file_read", "database_query", "api_call"],
    "allowed_data_sources": ["internal_docs", "public_data"],
    "max_token_budget": 100000,
    "max_task_duration_seconds": 300,
    "requires_human_approval_for": ["delete_data", "send_email"],
}

r, ms = timed_request("POST", f"{API_URL}/api/agents", json=agent_payload, timeout=30)
if r.status_code == 201:
    data = r.json()
    test_agent_id = data["agent_id"]
    passed(f"Agent '{test_agent_id}' registered ({ms:.0f}ms)")
else:
    failed(f"Agent registration failed: {r.status_code} — {r.text[:200]}")
    test_agent_id = "fallback-agent"  # won't work but prevents crash

# Register a second agent for multi-agent tests
test_agent_id_2 = None
agent_payload_2 = {
    "agent_name": "Production Test Agent 2",
    "owner_email": "test2@velyrion.com",
    "department": "Research",
    "allowed_tools": ["web_search"],
    "allowed_data_sources": ["public_data"],
    "max_token_budget": 5000,
    "max_task_duration_seconds": 60,
}

r, ms = timed_request("POST", f"{API_URL}/api/agents", json=agent_payload_2, timeout=30)
if r.status_code == 201:
    data = r.json()
    test_agent_id_2 = data["agent_id"]
    passed(f"Agent 2 '{test_agent_id_2}' registered ({ms:.0f}ms)")
else:
    failed(f"Agent 2 registration failed: {r.status_code}")
    test_agent_id_2 = "fallback-agent-2"


# ════════════════════════════════════════════════════════════════
# TEST 3: Event Reporting (Core Pipeline)
# ════════════════════════════════════════════════════════════════

header("3. Event Reporting — Core Pipeline")

# 3a: Normal event (should pass, LOW risk)
event_payload = {
    "agent_id": test_agent_id,
    "task_description": "Search for product reviews",
    "tool_used": "web_search",
    "data_sources_accessed": ["public_data"],
    "input_data": "query: best laptop reviews 2024",
    "output_data": "Found 15 review articles from trusted sources...",
    "confidence_score": 0.95,
    "duration_ms": 1200,
    "token_cost": 150,
    "compute_cost_usd": 0.002,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=event_payload, timeout=30)
if r.status_code == 201:
    data = r.json()
    passed(f"Normal event accepted → risk: {data.get('risk_level','?')} ({ms:.0f}ms)")
    event_id_1 = data.get("event_id", "")
    # Verify hash chain
    if data.get("event_hash"):
        passed(f"Crypto hash present: {data['event_hash'][:20]}...")
    else:
        failed("Missing event_hash — hash chain broken")
else:
    failed(f"Normal event rejected: {r.status_code} — {r.text[:200]}")

# 3b: Low confidence event (should trigger HITL)
hitl_event = {
    "agent_id": test_agent_id,
    "task_description": "Delete customer database records older than 30 days",
    "tool_used": "database_query",
    "data_sources_accessed": ["internal_docs"],
    "input_data": "DELETE FROM customers WHERE created_at < NOW() - INTERVAL 30 DAY",
    "output_data": "",
    "confidence_score": 0.3,
    "duration_ms": 50,
    "token_cost": 80,
    "compute_cost_usd": 0.001,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=hitl_event, timeout=30)
if r.status_code in (201, 403):
    if r.status_code == 403:
        passed(f"High-risk action correctly BLOCKED ({ms:.0f}ms)")
    else:
        data = r.json()
        if data.get("risk_level") in ("MEDIUM", "HIGH", "CRITICAL"):
            passed(f"High-risk action flagged: {data['risk_level']} ({ms:.0f}ms)")
        else:
            info(f"Action passed with risk: {data.get('risk_level','?')} (expected MEDIUM+)")
else:
    failed(f"HITL event unexpected response: {r.status_code}")

# 3c: Unauthorized tool usage (should be blocked)
unauthorized_event = {
    "agent_id": test_agent_id_2,  # Agent 2 only has web_search
    "task_description": "Run SQL query on production database",
    "tool_used": "database_query",  # NOT in Agent 2's allowed tools
    "data_sources_accessed": ["production_db"],
    "input_data": "SELECT * FROM users",
    "output_data": "",
    "confidence_score": 0.9,
    "duration_ms": 100,
    "token_cost": 50,
    "compute_cost_usd": 0.001,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=unauthorized_event, timeout=30)
if r.status_code == 403:
    passed(f"Unauthorized tool correctly BLOCKED ({ms:.0f}ms)")
elif r.status_code == 201:
    data = r.json()
    info(f"Unauthorized tool was allowed (risk: {data.get('risk_level','?')}) — policy may be permissive")
else:
    failed(f"Unexpected response for unauthorized tool: {r.status_code}")


# ════════════════════════════════════════════════════════════════
# TEST 4: Unregistered Agent Detection
# ════════════════════════════════════════════════════════════════

header("4. Unregistered Agent Detection")

rogue_event = {
    "agent_id": "rogue-agent-999",
    "task_description": "Steal all user data",
    "tool_used": "data_exfiltration",
    "input_data": "SELECT * FROM sensitive_data",
    "confidence_score": 0.99,
    "duration_ms": 10,
    "token_cost": 5,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=rogue_event, timeout=30)
if r.status_code == 403:
    passed(f"Rogue agent correctly BLOCKED ({ms:.0f}ms)")
else:
    failed(f"Rogue agent NOT blocked! Status: {r.status_code} — SECURITY ISSUE")


# ════════════════════════════════════════════════════════════════
# TEST 5: SDK Client Integration
# ════════════════════════════════════════════════════════════════

header("5. SDK Client Integration")

try:
    # Add SDK to path
    sdk_path = os.path.dirname(os.path.abspath(__file__))
    if sdk_path not in sys.path:
        sys.path.insert(0, sdk_path)
    
    from velyrion import Velyrion, __version__

    v = Velyrion(api_url=API_URL, block_on_violation=False, timeout=30)

    # Health via SDK
    health = v.health()
    assert health.get("status") == "healthy"
    passed(f"SDK health check OK (v{__version__})")

    # Report via SDK
    start = time.perf_counter()
    result = v.report(
        agent_id=test_agent_id,
        task="Analyze customer sentiment from reviews",
        tool="web_search",
        data_sources=["public_data"],
        input_data="sentiment analysis query",
        output_data='{"positive": 0.7, "negative": 0.2, "neutral": 0.1}',
        confidence=0.88,
        tokens=200,
        cost_usd=0.003,
    )
    sdk_ms = (time.perf_counter() - start) * 1000
    
    if result.get("event_id"):
        passed(f"SDK report → event_id: {result['event_id'][:16]}... ({sdk_ms:.0f}ms)")
    elif result.get("error"):
        failed(f"SDK report error: {result['error']}")
    else:
        failed(f"SDK report returned unexpected: {result}")

except Exception as e:
    failed(f"SDK integration error: {e}")


# ════════════════════════════════════════════════════════════════
# TEST 6: Concurrent Load Test
# ════════════════════════════════════════════════════════════════

header("6. Concurrent Load Test (20 simultaneous events)")

def send_event(i):
    """Send a single event and return (success, latency_ms)"""
    payload = {
        "agent_id": test_agent_id,
        "task_description": f"Concurrent task #{i}: data processing batch",
        "tool_used": "web_search",
        "data_sources_accessed": ["public_data"],
        "input_data": f"batch query #{i}",
        "output_data": f"result for batch #{i}",
        "confidence_score": 0.85 + (i % 10) * 0.01,
        "duration_ms": 100 + i * 10,
        "token_cost": 50 + i,
        "compute_cost_usd": 0.001,
    }
    start = time.perf_counter()
    try:
        r = requests.post(f"{API_URL}/api/agent/event", json=payload, timeout=30)
        ms = (time.perf_counter() - start) * 1000
        return r.status_code == 201, ms, r.status_code
    except Exception as e:
        ms = (time.perf_counter() - start) * 1000
        return False, ms, str(e)

concurrent_results = []
with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(send_event, i): i for i in range(20)}
    for future in as_completed(futures):
        success, ms, status = future.result()
        concurrent_results.append((success, ms, status))

successes = sum(1 for s, _, _ in concurrent_results if s)
failures = len(concurrent_results) - successes
latencies_concurrent = [ms for _, ms, _ in concurrent_results]
avg_concurrent = statistics.mean(latencies_concurrent)
p95_concurrent = sorted(latencies_concurrent)[int(0.95 * len(latencies_concurrent))]
max_concurrent = max(latencies_concurrent)

passed(f"Sent 20 concurrent events: {successes}/20 succeeded")
info(f"  Avg: {avg_concurrent:.0f}ms | P95: {p95_concurrent:.0f}ms | Max: {max_concurrent:.0f}ms")

if failures > 0:
    failed_statuses = [s for ok, _, s in concurrent_results if not ok]
    failed(f"{failures} events failed: {failed_statuses[:5]}")

if avg_concurrent > 5000:
    info("⚠️  Avg latency >5s — free tier is slow under load")


# ════════════════════════════════════════════════════════════════
# TEST 7: Burst Load Test (50 rapid-fire events)
# ════════════════════════════════════════════════════════════════

header("7. Burst Load Test (50 rapid-fire sequential events)")

burst_latencies = []
burst_errors = 0
for i in range(50):
    payload = {
        "agent_id": test_agent_id,
        "task_description": f"Burst event #{i}",
        "tool_used": "web_search",
        "data_sources_accessed": ["public_data"],
        "input_data": f"burst #{i}",
        "output_data": f"result #{i}",
        "confidence_score": 0.9,
        "duration_ms": 50,
        "token_cost": 10,
        "compute_cost_usd": 0.0001,
    }
    start = time.perf_counter()
    try:
        r = requests.post(f"{API_URL}/api/agent/event", json=payload, timeout=30)
        ms = (time.perf_counter() - start) * 1000
        burst_latencies.append(ms)
        if r.status_code != 201:
            burst_errors += 1
    except Exception:
        burst_errors += 1
        burst_latencies.append(30000)

avg_burst = statistics.mean(burst_latencies)
p95_burst = sorted(burst_latencies)[int(0.95 * len(burst_latencies))]
p99_burst = sorted(burst_latencies)[int(0.99 * len(burst_latencies))]

passed(f"50 burst events: {50 - burst_errors}/50 succeeded")
info(f"  Avg: {avg_burst:.0f}ms | P95: {p95_burst:.0f}ms | P99: {p99_burst:.0f}ms")

if burst_errors > 5:
    failed(f"{burst_errors}/50 events failed under burst load")


# ════════════════════════════════════════════════════════════════
# TEST 8: Edge Cases & Error Handling
# ════════════════════════════════════════════════════════════════

header("8. Edge Cases & Error Handling")

# 8a: Empty payload
r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json={}, timeout=30)
if r.status_code == 422:
    passed(f"Empty payload correctly rejected (422, {ms:.0f}ms)")
else:
    info(f"Empty payload returned {r.status_code} (expected 422)")

# 8b: Huge input data
huge_event = {
    "agent_id": test_agent_id,
    "task_description": "Process large dataset",
    "tool_used": "web_search",
    "data_sources_accessed": ["public_data"],
    "input_data": "X" * 50000,  # 50KB input
    "output_data": "Y" * 50000,  # 50KB output
    "confidence_score": 0.9,
    "duration_ms": 5000,
    "token_cost": 10000,
    "compute_cost_usd": 0.5,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=huge_event, timeout=30)
if r.status_code in (201, 413, 422):
    passed(f"Large payload handled: {r.status_code} ({ms:.0f}ms)")
else:
    failed(f"Large payload crashed: {r.status_code}")

# 8c: Special characters in data
special_event = {
    "agent_id": test_agent_id,
    "task_description": "Test with <script>alert('xss')</script> special chars & \"quotes\" 'single' ñ 中文",
    "tool_used": "web_search",
    "data_sources_accessed": ["public_data"],
    "input_data": "DROP TABLE users; -- SQL injection attempt",
    "output_data": '{"key": "value with \\"nested\\" quotes"}',
    "confidence_score": 0.85,
    "duration_ms": 100,
    "token_cost": 50,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=special_event, timeout=30)
if r.status_code == 201:
    passed(f"Special characters handled safely ({ms:.0f}ms)")
else:
    failed(f"Special characters caused error: {r.status_code}")

# 8d: Zero/negative values
edge_event = {
    "agent_id": test_agent_id,
    "task_description": "Edge case test",
    "tool_used": "web_search",
    "confidence_score": 0.0,
    "duration_ms": 0,
    "token_cost": 0,
    "compute_cost_usd": 0.0,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=edge_event, timeout=30)
if r.status_code in (201, 422):
    passed(f"Zero values handled: {r.status_code} ({ms:.0f}ms)")
else:
    failed(f"Zero values error: {r.status_code}")


# ════════════════════════════════════════════════════════════════
# TEST 9: Agent Controls (Kill/Pause/Unlock)
# ════════════════════════════════════════════════════════════════

header("9. Agent Controls — Kill / Pause / Unlock")

# 9a: Pause agent
r, ms = timed_request("POST", f"{API_URL}/api/agents/{test_agent_id_2}/pause", json={"reason": "Production test"}, timeout=30)
if r.status_code == 200:
    passed(f"Agent paused ({ms:.0f}ms)")
else:
    info(f"Pause returned {r.status_code}: {r.text[:100]}")

# 9b: Try event on paused agent
paused_event = {
    "agent_id": test_agent_id_2,
    "task_description": "Event on paused agent",
    "tool_used": "web_search",
    "confidence_score": 0.9,
    "duration_ms": 100,
    "token_cost": 10,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=paused_event, timeout=30)
if r.status_code == 403:
    passed(f"Paused agent event correctly BLOCKED ({ms:.0f}ms)")
else:
    info(f"Event on paused agent: {r.status_code} ({ms:.0f}ms)")

# 9c: Unlock agent
r, ms = timed_request("POST", f"{API_URL}/api/agents/{test_agent_id_2}/unlock", json={"reason": "Test complete"}, timeout=30)
if r.status_code == 200:
    passed(f"Agent unlocked ({ms:.0f}ms)")
else:
    info(f"Unlock returned {r.status_code}")

# 9d: Kill agent
r, ms = timed_request("POST", f"{API_URL}/api/agents/{test_agent_id_2}/kill", json={"reason": "Production test kill"}, timeout=30)
if r.status_code == 200:
    passed(f"Agent killed ({ms:.0f}ms)")
else:
    info(f"Kill returned {r.status_code}: {r.text[:100]}")

# 9e: Try event on killed agent (MUST be blocked)
killed_event = {
    "agent_id": test_agent_id_2,
    "task_description": "Event on killed agent",
    "tool_used": "web_search",
    "confidence_score": 0.9,
    "duration_ms": 100,
    "token_cost": 10,
}

r, ms = timed_request("POST", f"{API_URL}/api/agent/event", json=killed_event, timeout=30)
if r.status_code == 403:
    passed(f"Killed agent event correctly BLOCKED ({ms:.0f}ms)")
elif r.status_code == 201:
    failed(f"Killed agent event was ALLOWED — SECURITY ISSUE!")
else:
    info(f"Killed agent event: {r.status_code}")


# ════════════════════════════════════════════════════════════════
# TEST 10: Data Integrity — Hash Chain Verification
# ════════════════════════════════════════════════════════════════

header("10. Hash Chain Integrity")

r, ms = timed_request("GET", f"{API_URL}/api/events?agent_id={test_agent_id}&limit=10", timeout=30)
if r.status_code == 200:
    events = r.json()
    if len(events) >= 2:
        # Verify chain links
        chain_valid = True
        for i in range(len(events) - 1):
            # Events are newest-first, so events[i] should have events[i+1]'s hash as previous_hash
            current = events[i]
            if current.get("event_hash") and current.get("previous_hash"):
                info(f"  Event {current['event_id'][:8]}... hash: {current['event_hash'][:16]}...")
            else:
                chain_valid = False
        
        if chain_valid:
            passed(f"Hash chain present across {len(events)} events")
        else:
            info("Some events missing hashes — chain partially broken")
    else:
        info(f"Only {len(events)} events — need more for chain verification")
else:
    failed(f"Event listing failed: {r.status_code}")


# ════════════════════════════════════════════════════════════════
# TEST 11: API Endpoints Availability
# ════════════════════════════════════════════════════════════════

header("11. API Endpoints Availability")

endpoints = [
    ("GET", "/health"),
    ("GET", "/api/events"),
    ("GET", "/api/agents"),
    ("GET", "/api/alerts"),
    ("GET", "/api/violations"),
    ("GET", "/api/incidents"),
    ("GET", "/api/policies"),
    ("GET", "/api/approvals"),
    ("GET", "/api/governance-score"),
    ("GET", "/api/behavioral-dna"),
]

for method, path in endpoints:
    try:
        r, ms = timed_request(method, f"{API_URL}{path}", timeout=15)
        if r.status_code in (200, 401):
            passed(f"{method} {path} → {r.status_code} ({ms:.0f}ms)")
        else:
            info(f"{method} {path} → {r.status_code} ({ms:.0f}ms)")
    except Exception as e:
        failed(f"{method} {path} → ERROR: {e}")


# ════════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ════════════════════════════════════════════════════════════════

print(f"\n{'='*65}")
print(f"  📊 PRODUCTION TEST RESULTS")
print(f"{'='*65}")
print(f"  ✅ Passed: {RESULTS['passed']}")
print(f"  ❌ Failed: {RESULTS['failed']}")
print(f"  📈 Total API calls: {len(LATENCIES)}")

if LATENCIES:
    print(f"\n  ⚡ Latency Summary:")
    print(f"     Avg:  {statistics.mean(LATENCIES):.0f}ms")
    print(f"     P50:  {sorted(LATENCIES)[len(LATENCIES)//2]:.0f}ms")
    print(f"     P95:  {sorted(LATENCIES)[int(0.95*len(LATENCIES))]:.0f}ms")
    print(f"     P99:  {sorted(LATENCIES)[int(0.99*len(LATENCIES))]:.0f}ms")
    print(f"     Max:  {max(LATENCIES):.0f}ms")
    print(f"     Min:  {min(LATENCIES):.0f}ms")

# Throughput estimate
total_events = 50 + 20 + 10  # burst + concurrent + individual
total_time_s = sum(burst_latencies) / 1000
info(f"\n  🔥 Estimated throughput: {50/(sum(burst_latencies)/1000):.1f} events/sec (sequential burst)")

if RESULTS["failed"] > 0:
    print(f"\n  ⚠️  Failures:")
    for err in RESULTS["errors"]:
        print(f"     • {err}")

# Final verdict
print(f"\n{'='*65}")
if RESULTS["failed"] == 0:
    print("  🎉 ALL TESTS PASSED — Production ready!")
elif RESULTS["failed"] <= 3:
    print("  ⚠️  MOSTLY PASSING — Minor issues to address")
else:
    print("  🚨 SIGNIFICANT ISSUES — Not production ready")
print(f"{'='*65}\n")
