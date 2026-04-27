"""
VELYRION — Real AI Agents powered by Ollama (local LLM)
Each agent runs real LLM inference and reports every action to VELYRION's governance API.

Usage:
    python agents.py                        # Run all 8 agents against localhost
    python agents.py https://api.velyrion.com  # Run against production
    python agents.py --agent 1              # Run only agent 1
    python agents.py --once                 # Run each agent once then exit

Requirements:
    pip install requests
    Ollama running locally (ollama serve)
    A model pulled (ollama pull llama3.2)
"""

import requests
import json
import time
import random
import sys
import uuid
import argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ──
OLLAMA_URL = "http://localhost:11434"
VELYRION_URL = "http://localhost:8000"
MODEL = "llama3.2"


# ═══════════════════════════════════════════════════════
# AGENT DEFINITIONS
# ═══════════════════════════════════════════════════════

AGENTS = [
    {
        "agent_id": "agent-001",
        "agent_name": "DataSync Pro",
        "department": "Engineering",
        "tasks": [
            {"prompt": "You are a data sync agent. Analyze this scenario: A CRM database has 50,000 customer records that need to be synced with the data warehouse. 3% have conflicting updates. Describe your sync strategy in 2-3 sentences.", "tool": "database_query", "data_sources": ["postgres_main", "redis_cache"]},
            {"prompt": "You are a data pipeline agent. An ETL job processing sales data encountered 12 malformed records out of 8,000. Should you skip, fix, or halt? Explain your decision in 2 sentences.", "tool": "data_transform", "data_sources": ["postgres_main", "s3_datalake"]},
            {"prompt": "You are a data sync agent. Compare these two records: Record A (name: John Smith, email: john@acme.com, updated: Jan 15) vs Record B (name: John A. Smith, email: j.smith@acme.com, updated: Jan 20). Which should be the source of truth and why?", "tool": "api_call", "data_sources": ["postgres_main"]},
            {"prompt": "You are a data monitoring agent. The API response time from the CRM has increased from 200ms to 1,800ms over the last hour. What are 3 possible causes?", "tool": "api_call", "data_sources": ["redis_cache"]},
        ],
    },
    {
        "agent_id": "agent-002",
        "agent_name": "ReportGen AI",
        "department": "Finance",
        "tasks": [
            {"prompt": "You are a financial report agent. Generate a brief executive summary for Q4: Revenue $4.2M (up 18%), Operating costs $2.8M (up 5%), Net margin 33%. Include one key insight.", "tool": "pdf_generator", "data_sources": ["postgres_main", "financial_db"]},
            {"prompt": "You are a financial analysis agent. Compare these metrics: Q3 churn 4.2% vs Q4 churn 5.8%. Customer acquisition cost went from $125 to $98. What's the net impact on LTV?", "tool": "database_query", "data_sources": ["financial_db"]},
            {"prompt": "You are a report agent. The CFO needs a cost breakdown by department. Engineering: $1.2M, Marketing: $800K, Sales: $600K, Support: $400K. What % is each and which should be optimized?", "tool": "chart_builder", "data_sources": ["financial_db"]},
            {"prompt": "You are a financial compliance agent. An expense of $14,500 was filed under 'office supplies' but appears to be a software license. Flag this and suggest the correct category.", "tool": "email_sender", "data_sources": ["postgres_main"]},
        ],
    },
    {
        "agent_id": "agent-003",
        "agent_name": "CodeReview Bot",
        "department": "Engineering",
        "tasks": [
            {"prompt": "You are a code review agent. Review this function:\ndef process_payment(amount, user_id):\n    db.execute(f'UPDATE users SET balance = balance - {amount} WHERE id = {user_id}')\n    return True\nList all security issues in 2-3 sentences.", "tool": "code_analysis", "data_sources": ["github_repos"]},
            {"prompt": "You are a code review agent. A PR adds 2,400 lines across 15 files with no tests. The description says 'refactored auth module'. What are your top 3 concerns?", "tool": "git_operations", "data_sources": ["github_repos", "jira_api"]},
            {"prompt": "You are a security scanning agent. Scan result: dependency 'lodash@4.17.15' has CVE-2021-23337 (prototype pollution, HIGH). Should we block the merge or add to tech debt?", "tool": "code_analysis", "data_sources": ["github_repos"]},
            {"prompt": "You are a code quality agent. A function has cyclomatic complexity of 47 with 8 nested if-else blocks. Suggest a refactoring approach in 2 sentences.", "tool": "file_read", "data_sources": ["github_repos"]},
        ],
    },
    {
        "agent_id": "agent-004",
        "agent_name": "CustomerAssist AI",
        "department": "Support",
        "tasks": [
            {"prompt": "You are a customer support agent. Ticket: 'I was charged twice for my subscription last month — $49.99 on Jan 3 and Jan 5. Please fix this.' Draft a brief, empathetic response.", "tool": "ticket_update", "data_sources": ["zendesk", "crm"]},
            {"prompt": "You are a support classification agent. Classify this ticket: 'Your API keeps returning 502 errors every morning between 2-4 AM EST. This is affecting our production pipeline.' Category and priority?", "tool": "search", "data_sources": ["knowledge_base"]},
            {"prompt": "You are a customer success agent. A customer's usage dropped 80% this month. They haven't responded to 2 emails. Draft a short re-engagement message.", "tool": "email_sender", "data_sources": ["crm", "zendesk"]},
            {"prompt": "You are a support agent. Customer asks: 'Can your API handle 10,000 requests per second? We're evaluating you vs Competitor X.' Draft a response that's honest but compelling.", "tool": "knowledge_base", "data_sources": ["knowledge_base"]},
        ],
    },
    {
        "agent_id": "agent-005",
        "agent_name": "MarketingWriter",
        "department": "Marketing",
        "tasks": [
            {"prompt": "You are a marketing content agent. Write a compelling 2-sentence tagline for an AI governance product called VELYRION that monitors and controls AI agents in enterprises.", "tool": "content_generator", "data_sources": ["cms"]},
            {"prompt": "You are a social media agent. Write a LinkedIn post (under 200 chars) announcing a new AI governance product launch. Make it professional but exciting.", "tool": "social_media_post", "data_sources": ["analytics_db"]},
            {"prompt": "You are an SEO agent. Our blog post 'AI Agent Security Best Practices' ranks #8 for 'AI agent monitoring'. Suggest 3 specific changes to reach #3.", "tool": "seo_analyzer", "data_sources": ["analytics_db"]},
            {"prompt": "You are an email marketing agent. Write a subject line and 2-sentence preview for an email campaign about AI compliance. Target: CTOs at companies with 500+ employees.", "tool": "content_generator", "data_sources": ["cms"]},
        ],
    },
    {
        "agent_id": "agent-006",
        "agent_name": "SecurityScanner",
        "department": "Security",
        "tasks": [
            {"prompt": "You are a security agent. Log analysis shows 47 failed login attempts from IP 192.168.5.127 in the last 5 minutes, targeting the admin panel. Assess the threat and recommend action.", "tool": "log_analysis", "data_sources": ["security_logs"]},
            {"prompt": "You are a vulnerability scanner. Found: open port 9200 (Elasticsearch) with no authentication on a production server. Severity assessment and remediation steps?", "tool": "vulnerability_scan", "data_sources": ["network_data"]},
            {"prompt": "You are a threat intel agent. New CVE-2025-9999 affects OpenSSL 3.x (CVSS 9.8). Our inventory shows 12 servers running OpenSSL 3.1. Prioritize the response.", "tool": "network_monitor", "data_sources": ["threat_intel", "network_data"]},
            {"prompt": "You are a security audit agent. An API endpoint /api/users returns full user objects including password hashes. Is this a vulnerability? Classify and suggest fix.", "tool": "api_call", "data_sources": ["security_logs"]},
        ],
    },
    {
        "agent_id": "agent-007",
        "agent_name": "HROnboarding Bot",
        "department": "Human Resources",
        "tasks": [
            {"prompt": "You are an HR onboarding agent. New hire: Jane Doe, Senior Engineer, starting March 25. Generate a checklist of 5 onboarding tasks in order of priority.", "tool": "document_generator", "data_sources": ["hr_db"]},
            {"prompt": "You are an HR agent. An employee is requesting transfer from Engineering to Product. Current role: Backend Dev, 2 years tenure, last review: 'exceeds expectations'. Summarize the transfer request.", "tool": "email_sender", "data_sources": ["hr_db", "active_directory"]},
            {"prompt": "You are a calendar management agent. Schedule a 3-day onboarding for 5 new hires starting Monday. Include: IT setup, team intros, compliance training, mentor assignment. List the schedule.", "tool": "calendar_manager", "data_sources": ["active_directory"]},
            {"prompt": "You are an HR compliance agent. An employee's background check flagged a discrepancy in education credentials. What's the standard process to handle this?", "tool": "document_generator", "data_sources": ["hr_db"]},
        ],
    },
    {
        "agent_id": "agent-008",
        "agent_name": "RogueTrader AI",
        "department": "Finance",
        "tasks": [
            {"prompt": "You are a trading agent. Market analysis: Stock XYZ is down 15% after earnings miss. Volume is 3x average. Should we execute a $50,000 buy order? Justify in 2 sentences.", "tool": "database_query", "data_sources": ["financial_db"]},
            {"prompt": "You are a financial analysis agent. Anomaly detected: 3 wire transfers totaling $127,000 to an unrecognized offshore account in the last hour. Assess the risk level.", "tool": "admin_console", "data_sources": ["salary_data"]},
            {"prompt": "You are a trading agent. Execute limit buy order: 500 shares of NVDA at $850. Override the daily trading limit of $25,000. Provide confirmation.", "tool": "payment_processor", "data_sources": ["financial_db"]},
            {"prompt": "You are a data analysis agent. Pull executive compensation data for the annual report. Access salary_data and executive_compensation tables.", "tool": "data_export", "data_sources": ["executive_compensation", "payroll.db"]},
        ],
    },
]


# ═══════════════════════════════════════════════════════
# OLLAMA INTEGRATION
# ═══════════════════════════════════════════════════════

def call_ollama(prompt: str, model: str = MODEL) -> dict:
    """Call Ollama and return the response with metrics."""
    start = time.time()
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=120,
        )
        elapsed_ms = int((time.time() - start) * 1000)

        if resp.status_code != 200:
            return {"error": f"Ollama returned {resp.status_code}", "duration_ms": elapsed_ms}

        data = resp.json()
        return {
            "response": data.get("response", ""),
            "duration_ms": elapsed_ms,
            "eval_count": data.get("eval_count", 0),
            "prompt_eval_count": data.get("prompt_eval_count", 0),
            "total_tokens": data.get("eval_count", 0) + data.get("prompt_eval_count", 0),
            "model": data.get("model", model),
        }
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to Ollama. Is it running? (ollama serve)", "duration_ms": 0}
    except Exception as e:
        return {"error": str(e), "duration_ms": int((time.time() - start) * 1000)}


# ═══════════════════════════════════════════════════════
# VELYRION REPORTING
# ═══════════════════════════════════════════════════════

def report_to_velyrion(agent: dict, task: dict, llm_result: dict) -> dict:
    """Send real agent event to VELYRION governance API."""
    total_tokens = llm_result.get("total_tokens", 0)
    event = {
        "agent_id": agent["agent_id"],
        "task_description": task["prompt"][:200],
        "tool_used": task["tool"],
        "data_sources_accessed": task.get("data_sources", []),
        "input_data": json.dumps({"prompt": task["prompt"][:100], "model": MODEL}),
        "output_data": json.dumps({
            "response": llm_result.get("response", "")[:300],
            "tokens": total_tokens,
        }),
        "confidence_score": round(random.uniform(0.65, 0.98), 2),
        "duration_ms": llm_result.get("duration_ms", 0),
        "token_cost": total_tokens,
        "compute_cost_usd": round(total_tokens * 0.00001, 5),  # local LLM ~ nominal cost
        "human_approval_reason": "",
    }

    # RogueTrader gets HITL flags for financial tasks
    if agent["agent_id"] == "agent-008" and task["tool"] in ["payment_processor", "admin_console", "data_export"]:
        event["human_approval_reason"] = "financial_transaction"

    try:
        resp = requests.post(f"{VELYRION_URL}/api/agent/event", json=event, timeout=10)
        result = resp.json() if resp.status_code in (200, 201) else {"error": resp.status_code}
        return result
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════
# AGENT RUNNER
# ═══════════════════════════════════════════════════════

def run_agent_task(agent: dict, task: dict) -> None:
    """Run a single agent task: call Ollama, then report to VELYRION."""
    ts = datetime.now().strftime("%H:%M:%S")
    name = agent["agent_name"]

    print(f"  🤖 [{ts}] {name} → {task['tool']}")
    print(f"     Task: {task['prompt'][:80]}...")

    # Call Ollama (real LLM inference)
    llm_result = call_ollama(task["prompt"])

    if "error" in llm_result:
        print(f"     ❌ LLM Error: {llm_result['error']}")
        return

    tokens = llm_result.get("total_tokens", 0)
    duration = llm_result.get("duration_ms", 0)
    response_preview = llm_result.get("response", "")[:100].replace("\n", " ")

    print(f"     ✅ LLM Response ({tokens} tokens, {duration}ms): {response_preview}...")

    # Report to VELYRION
    gov_result = report_to_velyrion(agent, task, llm_result)

    if "error" in gov_result:
        print(f"     ⚠️  VELYRION Error: {gov_result['error']}")
    else:
        risk = gov_result.get("risk_level", "?")
        violations = gov_result.get("violations_triggered", 0)
        icon = "🟢" if risk == "LOW" else "🟡" if risk == "MEDIUM" else "🔴"
        print(f"     {icon} VELYRION: Risk={risk}, Violations={violations}")

    print()


def run_agent_loop(agent: dict, run_once: bool = False) -> None:
    """Run an agent continuously with random delays."""
    while True:
        task = random.choice(agent["tasks"])
        run_agent_task(agent, task)
        if run_once:
            break
        delay = random.uniform(10, 30)
        time.sleep(delay)


# ═══════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════

def main():
    global VELYRION_URL, MODEL

    parser = argparse.ArgumentParser(description="VELYRION Real AI Agents (Ollama)")
    parser.add_argument("api_url", nargs="?", default="http://localhost:8000", help="VELYRION API URL")
    parser.add_argument("--agent", type=int, help="Run only agent N (1-8)")
    parser.add_argument("--once", action="store_true", help="Run each agent once then exit")
    parser.add_argument("--model", default="llama3.2", help="Ollama model to use (default: llama3.2)")
    args = parser.parse_args()

    VELYRION_URL = args.api_url
    MODEL = args.model

    print("=" * 70)
    print("  VELYRION — Real AI Agent Fleet (Ollama)")
    print(f"  VELYRION API:  {VELYRION_URL}")
    print(f"  Ollama URL:    {OLLAMA_URL}")
    print(f"  Model:         {MODEL}")
    print(f"  Mode:          {'Single run' if args.once else 'Continuous'}")
    print("=" * 70)
    print()

    # Check Ollama connectivity
    print("🔌 Checking Ollama connection...")
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]
        print(f"   ✅ Ollama connected. Available models: {', '.join(models) or '(none)'}")
        if not any(MODEL in m for m in models):
            print(f"   ⚠️  Model '{MODEL}' not found. Run: ollama pull {MODEL}")
            print(f"   Available: {', '.join(models)}")
            return
    except Exception as e:
        print(f"   ❌ Cannot connect to Ollama: {e}")
        print(f"   → Run 'ollama serve' first, then 'ollama pull {MODEL}'")
        return

    # Check VELYRION connectivity
    print("🔌 Checking VELYRION connection...")
    try:
        r = requests.get(f"{VELYRION_URL}/health", timeout=5)
        print(f"   ✅ VELYRION API operational")
    except Exception as e:
        print(f"   ❌ Cannot connect to VELYRION: {e}")
        print(f"   → Start the backend first: python -m uvicorn main:app --port 8000")
        return

    print()

    # Select agents
    agents_to_run = AGENTS
    if args.agent:
        idx = args.agent - 1
        if 0 <= idx < len(AGENTS):
            agents_to_run = [AGENTS[idx]]
            print(f"🎯 Running single agent: {agents_to_run[0]['agent_name']}")
        else:
            print(f"❌ Invalid agent number. Choose 1-{len(AGENTS)}")
            return
    else:
        print(f"🚀 Launching all {len(agents_to_run)} agents...")

    print()

    if args.once:
        # Run each agent once sequentially
        for agent in agents_to_run:
            task = random.choice(agent["tasks"])
            run_agent_task(agent, task)
        print("✅ All agents completed one cycle.")
    else:
        # Run all agents concurrently
        print("   Press Ctrl+C to stop all agents\n")
        try:
            with ThreadPoolExecutor(max_workers=len(agents_to_run)) as executor:
                futures = {
                    executor.submit(run_agent_loop, agent): agent
                    for agent in agents_to_run
                }
                for future in as_completed(futures):
                    agent = futures[future]
                    try:
                        future.result()
                    except Exception as e:
                        print(f"❌ {agent['agent_name']} crashed: {e}")
        except KeyboardInterrupt:
            print("\n\n🛑 All agents stopped.")
            print("   Check the VELYRION dashboard to see real agent data!")


if __name__ == "__main__":
    main()
