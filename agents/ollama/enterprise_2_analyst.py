"""
ENTERPRISE AGENT 2: Data Analyst Agent
========================================
Real-world scenario: Enterprise BI & analytics automation.
Used by: Databricks, Snowflake, Tableau, Power BI, dbt.

This agent:
- Queries databases for business metrics
- Transforms and analyzes data
- Generates charts and reports
- Delivers insights to stakeholders
- All governed by Velyrion
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import OllamaGovernedAgent

AGENT_ID = "agent-002"  # ReportGen AI from seed data

SYSTEM_PROMPT = """You are a Data Analyst AI Agent for an enterprise company.
Your job is to analyze business data, generate insights, and create reports.

When you receive an analysis request:
1. Query the database for relevant data
2. Transform/clean the data as needed
3. Build visualizations (charts)
4. Generate a PDF report
5. Email the report to stakeholders

Be precise with data, highlight key trends, and flag anomalies."""

TOOLS = [
    {"name": "database_query", "description": "Query the PostgreSQL database with SQL", "parameters": {"query": "string"}},
    {"name": "data_transform", "description": "Clean, aggregate, or transform data", "parameters": {"operation": "string", "input": "string"}},
    {"name": "chart_builder", "description": "Create a visualization chart (bar, line, pie)", "parameters": {"type": "string", "data": "string"}},
    {"name": "pdf_generator", "description": "Generate a PDF report from data and charts", "parameters": {"title": "string", "sections": "array"}},
    {"name": "email_sender", "description": "Email the report to stakeholders", "parameters": {"to": "string", "subject": "string", "attachment": "string"}},
]

SCENARIOS = [
    "Generate a Q2 2026 revenue analysis report. Compare revenue by department, identify top 3 growth areas, flag any departments with declining revenue. Send to cfo@company.com.",
    "Urgent: The CEO needs a real-time dashboard of AI agent costs. Show total spend by agent, cost trends over the last 30 days, and identify the most expensive agents. Generate the report ASAP.",
]


def run():
    agent = OllamaGovernedAgent(
        agent_id=AGENT_ID,
        agent_name="📊 Data Analyst Agent",
        system_prompt=SYSTEM_PROMPT,
        tools=TOOLS,
        data_sources=["postgres_main", "financial_db"],
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
