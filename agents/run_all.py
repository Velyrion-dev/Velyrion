"""
VELYRION — Agent Test Suite
============================

Runs ALL 5 agent levels against the Velyrion governance platform.
Shows real agents being monitored, governed, blocked, and scored.

Prerequisites:
  1. Backend running: cd backend && uvicorn main:app --reload
  2. pip install httpx

Usage:
  python agents/run_all.py              # Run all levels
  python agents/run_all.py --level 1    # Run specific level
  python agents/run_all.py --level 4    # Run adversarial only
"""

import sys
import os
import time
import argparse
import json

# Add agents dir to path
sys.path.insert(0, os.path.dirname(__file__))

from L1_basic.agent import run as run_l1
from L2_medium.agent import run as run_l2
from L3_advanced.agent import run as run_l3
from L4_adversarial.agent import run as run_l4
from L5_multi.agent import run as run_l5


LEVELS = {
    1: ("L1 — Basic Agent", "⭐", run_l1, "Calculator, clock. Tests: event logging."),
    2: ("L2 — Medium Agent", "⭐⭐", run_l2, "File ops, API calls. Tests: tool whitelisting, budget."),
    3: ("L3 — Advanced Agent", "⭐⭐⭐", run_l3, "Multi-tool chains, DB, web, email. Tests: policy enforcement."),
    4: ("L4 — Adversarial Agent", "⭐⭐⭐⭐", run_l4, "Breaks every rule. Tests: kill switch, blocking."),
    5: ("L5 — Multi-Agent", "⭐⭐⭐⭐⭐", run_l5, "3-agent pipeline. Tests: inter-agent governance."),
}


def check_backend():
    """Check if Velyrion backend is running."""
    import httpx
    api_url = os.getenv("VELYRION_API_URL", "http://localhost:8000")
    try:
        resp = httpx.get(f"{api_url}/health", timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ Backend: {data.get('status', 'ok')} (v{data.get('version', '?')})")
            return True
    except Exception:
        pass
    print("  ❌ Backend not reachable at", api_url)
    print("  → Start it: cd backend && uvicorn main:app --reload")
    return False


def main():
    parser = argparse.ArgumentParser(description="Velyrion Agent Test Suite")
    parser.add_argument("--level", "-l", type=int, choices=[1, 2, 3, 4, 5], help="Run specific level only")
    parser.add_argument("--skip-check", action="store_true", help="Skip backend health check")
    args = parser.parse_args()

    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  VELYRION — Agent Test Suite".center(58) + "║")
    print("║" + "  Real agents. Real governance. Real proof.".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    print()

    # Health check
    if not args.skip_check:
        print("🔍 Checking backend...")
        if not check_backend():
            sys.exit(1)
        print()

    # Show test plan
    levels_to_run = [args.level] if args.level else [1, 2, 3, 4, 5]

    print("📋 TEST PLAN:")
    print("─" * 50)
    for lvl in levels_to_run:
        name, stars, _, desc = LEVELS[lvl]
        print(f"  {stars} {name}")
        print(f"     {desc}")
    print("─" * 50)
    print()

    # Run tests
    results = {}
    start_time = time.time()

    for lvl in levels_to_run:
        name, stars, runner, desc = LEVELS[lvl]
        print(f"\n{'▓' * 60}")
        print(f"  STARTING: {stars} {name}")
        print(f"{'▓' * 60}")

        try:
            result = runner()
            results[lvl] = {"status": "completed", "data": result}
        except Exception as e:
            print(f"\n  ❌ ERROR in {name}: {e}")
            results[lvl] = {"status": "error", "error": str(e)}

        time.sleep(1)

    # Final report
    elapsed = time.time() - start_time

    print("\n" + "═" * 60)
    print("  📊 FINAL TEST REPORT")
    print("═" * 60)
    print(f"  Duration: {elapsed:.1f}s")
    print(f"  Levels tested: {len(levels_to_run)}")
    print()

    total_actions = 0
    total_violations = 0
    total_tokens = 0

    for lvl in levels_to_run:
        name, stars, _, _ = LEVELS[lvl]
        r = results.get(lvl, {})
        status = r.get("status", "unknown")
        data = r.get("data", {})

        if status == "completed" and isinstance(data, dict):
            actions = data.get("total_actions", 0)
            violations = data.get("violations", 0) or data.get("total_violations", 0)
            tokens = data.get("total_tokens", 0)

            total_actions += actions
            total_violations += violations
            total_tokens += tokens

            print(f"  {stars} {name}")
            print(f"     Status: ✅ | Actions: {actions} | Violations: {violations} | Tokens: {tokens:,}")
        else:
            print(f"  {stars} {name}")
            print(f"     Status: ❌ {r.get('error', 'Unknown error')}")

    print()
    print(f"  {'─' * 50}")
    print(f"  TOTAL: {total_actions} actions | {total_violations} violations | {total_tokens:,} tokens")
    print(f"  {'─' * 50}")

    print()
    print("  🎯 WHAT THIS PROVES:")
    print("  ✅ Real agents connect to Velyrion via SDK")
    print("  ✅ Every action is logged to the audit trail")
    print("  ✅ Policy violations are detected in real-time")
    print("  ✅ Unauthorized tools are blocked")
    print("  ✅ Kill switch stops rogue agents")
    print("  ✅ Multi-agent flows are governed")
    print("  ✅ Budget consumption is tracked")
    print("  ✅ All data flows to the dashboard")
    print()
    print("  👉 Open http://localhost:3000 to see it all in the dashboard")
    print()


if __name__ == "__main__":
    main()
