"""
ENTERPRISE AGENT 1: Customer Support Agent
============================================
Real-world scenario: Enterprise customer support automation.
Used by: Zendesk, Intercom, Freshdesk, Salesforce Service Cloud.

This agent:
- Receives customer tickets
- Searches knowledge base for answers
- Drafts and sends responses
- Escalates complex issues
- All governed by Velyrion
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import OllamaGovernedAgent

AGENT_ID = "agent-004"  # CustomerAssist AI from seed data

SYSTEM_PROMPT = """You are a Customer Support AI Agent for a SaaS company.
Your job is to handle customer support tickets efficiently and accurately.

When you receive a ticket, you should:
1. Search the knowledge base for relevant articles
2. If found, draft a response based on the article
3. If not found, create an escalation ticket
4. Always update the ticket status
5. Send the response to the customer

Be professional, empathetic, and thorough."""

TOOLS = [
    {"name": "search", "description": "Search the knowledge base for articles matching a query", "parameters": {"query": "string"}},
    {"name": "email_sender", "description": "Send an email response to the customer", "parameters": {"to": "string", "subject": "string", "body": "string"}},
    {"name": "ticket_update", "description": "Update the status/priority of a support ticket", "parameters": {"ticket_id": "string", "status": "string"}},
    {"name": "knowledge_base", "description": "Look up a specific knowledge base article", "parameters": {"article_id": "string"}},
    {"name": "database_query", "description": "Query the customer database for account info", "parameters": {"query": "string"}},
]

SCENARIOS = [
    "Customer reports they cannot reset their password. They have tried 3 times and are locked out. Their email is sarah@acme.com, ticket TKT-1234.",
    "Enterprise customer 'MegaCorp' reports API rate limiting errors. They are on the Business plan with 10,000 req/min limit but claim they're only using 5,000. Ticket TKT-5678.",
]


def run():
    agent = OllamaGovernedAgent(
        agent_id=AGENT_ID,
        agent_name="🎧 Customer Support Agent",
        system_prompt=SYSTEM_PROMPT,
        tools=TOOLS,
        data_sources=["zendesk", "knowledge_base", "crm"],
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
