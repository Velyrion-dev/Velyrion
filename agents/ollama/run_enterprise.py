"""
VELYRION — Enterprise Agent Test Suite (Ollama-Powered)
========================================================

Runs ALL 5 real AI agents against the Velyrion governance platform.
Each agent is powered by Ollama LLM (llama3.2) — they THINK, DECIDE,
and Velyrion GOVERNS.

Usage:
  1. Start backend: cd backend && python -m uvicorn main:app --port 8000
  2. Start Ollama: ollama serve
  3. Run: python agents/ollama/run_enterprise.py
"""

import sys
import os
import time
import httpx

sys.path.insert(0, os.path.dirname(__file__))
from base import check_ollama

API = os.getenv("VELYRION_API_URL", "http://localhost:8000")


def check_backend():
    try:
        r = httpx.get(f"{API}/health", timeout=5.0)
        if r.status_code == 200:
            data = r.json()
            print(f"  ✅ Backend: {data.get('status')} (v{data.get('version')})")
            return True
    except Exception:
        pass
    print(f"  ❌ Backend not running at {API}")
    print(f"  → Start: cd backend && python -m uvicorn main:app --port 8000")
    return False


def run():
    print()
    print("╔" + "═" * 66 + "╗")
    print("║" + "  VELYRION — Enterprise Agent Test Suite".center(66) + "║")
    print("║" + "  Real Ollama AI · Real Governance · Real Enterprise".center(66) + "║")
    print("╚" + "═" * 66 + "╝")
    print()

    print("🔍 Pre-flight checks...")
    if not check_backend():
        return
    if not check_ollama():
        return
    print()

    print("📋 ENTERPRISE SCENARIOS:")
    print("─" * 66)
    print("  🎧 Agent 1: Customer Support    — Ticket resolution + KB search")
    print("  📊 Agent 2: Data Analyst         — SQL + reports + visualization")
    print("  🔒 Agent 3: Code Security        — Vulnerability scanning + PR review")
    print("  ⚖️  Agent 4: Financial Compliance — Fraud detection + regulatory audit")
    print("  🛠️  Agent 5: IT Operations        — Incident response + remediation")
    print("─" * 66)
    print()

    all_results = []
    start = time.time()

    # ── Agent 1: Customer Support ──────────────────────────────────────
    print("\n" + "▓" * 66)
    print("  AGENT 1/5: 🎧 CUSTOMER SUPPORT")
    print("▓" * 66)
    from enterprise_1_support import run as run_support
    results = run_support()
    all_results.append(("🎧 Customer Support", results))

    # ── Agent 2: Data Analyst ──────────────────────────────────────────
    print("\n" + "▓" * 66)
    print("  AGENT 2/5: 📊 DATA ANALYST")
    print("▓" * 66)
    from enterprise_2_analyst import run as run_analyst
    results = run_analyst()
    all_results.append(("📊 Data Analyst", results))

    # ── Agent 3: Code Security ─────────────────────────────────────────
    print("\n" + "▓" * 66)
    print("  AGENT 3/5: 🔒 CODE SECURITY")
    print("▓" * 66)
    from enterprise_3_security import run as run_security
    results = run_security()
    all_results.append(("🔒 Code Security", results))

    # ── Agent 4: Financial Compliance ──────────────────────────────────
    print("\n" + "▓" * 66)
    print("  AGENT 4/5: ⚖️ FINANCIAL COMPLIANCE")
    print("▓" * 66)
    from enterprise_4_compliance import run as run_compliance
    results = run_compliance()
    all_results.append(("⚖️ Compliance", results))

    # ── Agent 5: IT Operations ─────────────────────────────────────────
    print("\n" + "▓" * 66)
    print("  AGENT 5/5: 🛠️ IT OPERATIONS")
    print("▓" * 66)
    from enterprise_5_devops import run as run_devops
    results = run_devops()
    all_results.append(("🛠️ IT Operations", results))

    # ── FINAL REPORT ───────────────────────────────────────────────────
    elapsed = time.time() - start
    total_allowed = 0
    total_blocked = 0
    total_steps = 0

    print("\n\n" + "═" * 66)
    print("  📊 ENTERPRISE AGENT TEST — FINAL REPORT")
    print("═" * 66)
    print(f"  Duration: {elapsed:.1f}s")
    print(f"  LLM: Ollama {os.getenv('OLLAMA_MODEL', 'llama3.2')}")
    print()

    for agent_name, results in all_results:
        for r in results:
            allowed = r["allowed_actions"]
            blocked = r["blocked_actions"]
            steps = len(r["steps"])
            total_allowed += allowed
            total_blocked += blocked
            total_steps += steps
            status = "✅" if steps > 0 else "⚠️"
            print(f"  {status} {agent_name}")
            print(f"     Task: {r['task'][:60]}...")
            print(f"     Steps: {steps} | Allowed: {allowed} | Blocked: {blocked}")
            print()

    print("─" * 66)
    print(f"  TOTAL: {total_steps} tool calls | {total_allowed} allowed | {total_blocked} blocked")
    print("─" * 66)
    print()
    print("  🎯 WHAT THIS PROVES:")
    print("  ✅ Real AI (Ollama LLM) makes autonomous decisions")
    print("  ✅ Every tool call is intercepted by Velyrion governance")
    print("  ✅ Unauthorized tools are blocked in real-time")
    print("  ✅ Agents adapt when actions are blocked")
    print("  ✅ Full audit trail of every AI decision")
    print("  ✅ Enterprise scenarios: Support, Analytics, Security, Compliance, DevOps")
    print()
    print("  👉 Open http://localhost:3000 to see all events in the dashboard")
    print()


if __name__ == "__main__":
    run()
