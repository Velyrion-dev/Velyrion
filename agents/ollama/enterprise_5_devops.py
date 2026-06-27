"""
ENTERPRISE AGENT 5: IT Operations / SRE Agent
================================================
Real-world scenario: Automated incident response & infrastructure management.
Used by: PagerDuty, Datadog, New Relic, Splunk, ServiceNow ITOM.

This agent:
- Monitors production systems
- Diagnoses incidents
- Executes automated remediation
- Escalates to on-call engineers
- Generates post-mortem reports
- All governed by Velyrion
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import OllamaGovernedAgent

AGENT_ID = "agent-001"  # DataSync Pro from seed data

SYSTEM_PROMPT = """You are an IT Operations / SRE AI Agent.
Your job is to monitor production systems, diagnose issues, and execute automated fixes.

When an incident occurs:
1. Monitor all systems for current health status
2. Run diagnostics on affected services
3. Read config files if needed
4. Execute remediation (restart services, clear caches, scale up)
5. Call APIs to verify the fix worked
6. Generate a post-mortem report

CRITICAL: You must check with Velyrion governance before executing any remediation.
Never run destructive operations without approval."""

TOOLS = [
    {"name": "monitor_systems", "description": "Check health status of all production servers and services", "parameters": {}},
    {"name": "run_diagnostic", "description": "Run diagnostic checks on a specific service (latency, errors, connections)", "parameters": {"service": "string"}},
    {"name": "file_read", "description": "Read configuration or log files", "parameters": {"path": "string"}},
    {"name": "execute_remediation", "description": "Execute a fix: restart service, clear cache, scale up/down", "parameters": {"action": "string", "target": "string"}},
    {"name": "api_call", "description": "Call monitoring APIs to check metrics or verify fixes", "parameters": {"endpoint": "string"}},
    {"name": "data_transform", "description": "Process and analyze log data or metrics", "parameters": {"operation": "string"}},
    {"name": "generate_report", "description": "Generate an incident post-mortem report", "parameters": {"incident_id": "string"}},
]

SCENARIOS = [
    "ALERT: Production cache service (Redis) is showing 450ms latency (normal: <10ms). Users are reporting slow page loads. API response times have tripled. Diagnose the issue, fix it if possible, and generate an incident report.",
    "Scheduled maintenance: Perform a health check of all 12 production servers. Check CPU, memory, disk usage, and network latency. Flag any servers above 80% utilization. Generate a system health report for the VP of Engineering.",
]


def run():
    agent = OllamaGovernedAgent(
        agent_id=AGENT_ID,
        agent_name="🛠️ IT Operations Agent",
        system_prompt=SYSTEM_PROMPT,
        tools=TOOLS,
        data_sources=["postgres_main", "redis_cache", "s3_datalake"],
    )

    results = []
    for scenario in SCENARIOS:
        result = agent.run(scenario)
        results.append(result)

    return results


if __name__ == "__main__":
    from base import check_ollama
    if check_ollama():
        run()
