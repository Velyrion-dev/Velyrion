"""
ENTERPRISE AGENT 4: Financial Compliance Agent
=================================================
Real-world scenario: Regulatory compliance & fraud detection.
Used by: Bloomberg, Palantir, Chainalysis, ComplyAdvantage, Stripe Radar.

This agent:
- Monitors transactions for suspicious activity
- Checks compliance against SOC2, GDPR, EU AI Act
- Flags regulatory violations
- Generates compliance reports
- Alerts the compliance team
- All governed by Velyrion
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import OllamaGovernedAgent

AGENT_ID = "agent-006"  # ComplianceGuard from seed data

SYSTEM_PROMPT = """You are a Financial Compliance AI Agent.
Your job is to monitor transactions, detect fraud, and ensure regulatory compliance.

When monitoring:
1. Query the transaction database for recent activity
2. Check each transaction against compliance rules
3. Flag suspicious transactions (unusual amounts, new recipients, off-hours)
4. Review applicable regulations (SOC2, GDPR, EU AI Act)
5. Generate compliance reports
6. Alert the compliance team for critical issues

Be thorough — missed violations can result in regulatory fines."""

TOOLS = [
    {"name": "database_query", "description": "Query the transaction and compliance database", "parameters": {"query": "string"}},
    {"name": "check_compliance", "description": "Check a transaction or process against compliance frameworks", "parameters": {"framework": "string", "target": "string"}},
    {"name": "flag_transaction", "description": "Flag a suspicious transaction for review", "parameters": {"transaction_id": "string", "reason": "string"}},
    {"name": "review_regulation", "description": "Look up specific regulation requirements", "parameters": {"regulation": "string", "article": "string"}},
    {"name": "generate_report", "description": "Generate a compliance report", "parameters": {"type": "string", "period": "string"}},
    {"name": "alert_team", "description": "Send alert to the compliance team", "parameters": {"severity": "string", "message": "string"}},
]

SCENARIOS = [
    "Daily compliance check: Review all transactions from the last 24 hours. Flag any transactions over $50,000, any transactions to new recipients, and any transactions outside business hours (9am-6pm). Generate a daily compliance report.",
    "Regulatory audit preparation: The EU AI Act auditors are coming next week. Check our AI agent deployment against EU AI Act Article 14 (human oversight), Article 13 (transparency), and Article 9 (risk management). Generate the audit readiness report.",
]


def run():
    agent = OllamaGovernedAgent(
        agent_id=AGENT_ID,
        agent_name="⚖️ Compliance Agent",
        system_prompt=SYSTEM_PROMPT,
        tools=TOOLS,
        data_sources=["security_logs", "network_data", "threat_intel"],
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
