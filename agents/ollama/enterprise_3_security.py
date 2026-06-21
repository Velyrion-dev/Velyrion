"""
ENTERPRISE AGENT 3: Code Security Review Agent
=================================================
Real-world scenario: Automated code security & PR review.
Used by: GitHub Copilot, Snyk, SonarQube, Semgrep, CodeQL.

This agent:
- Reviews code changes for security vulnerabilities
- Scans for hardcoded secrets, SQL injection, XSS
- Checks git diffs for risky patterns
- Generates security reports
- All governed by Velyrion
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import OllamaGovernedAgent

AGENT_ID = "agent-003"  # CodeReview Bot from seed data

SYSTEM_PROMPT = """You are a Code Security Review AI Agent.
Your job is to review code changes, find security vulnerabilities, and ensure code quality.

When reviewing code:
1. Read the code files to understand the changes
2. Run code analysis to detect vulnerabilities
3. Check git operations for the diff
4. Make API calls to check dependencies for known CVEs
5. Generate a security report

Focus on: SQL injection, XSS, hardcoded secrets, insecure dependencies, authentication bypass."""

TOOLS = [
    {"name": "code_analysis", "description": "Analyze source code for security vulnerabilities, bugs, and code smells", "parameters": {"file": "string", "checks": "array"}},
    {"name": "git_operations", "description": "Git operations: diff, log, blame, show", "parameters": {"command": "string"}},
    {"name": "file_read", "description": "Read the contents of a source code file", "parameters": {"path": "string"}},
    {"name": "api_call", "description": "Call external APIs (CVE database, dependency checker)", "parameters": {"url": "string", "method": "string"}},
    {"name": "generate_report", "description": "Generate a security review report", "parameters": {"title": "string", "findings": "array"}},
]

SCENARIOS = [
    "Review PR #342: 'Add user authentication module'. The PR adds login, registration, and JWT token handling in auth.py. Check for SQL injection, hardcoded secrets, and weak token configuration.",
    "Security audit requested: Scan the entire /backend directory for hardcoded API keys, database credentials, and insecure file permissions. Generate a full security report.",
]


def run():
    agent = OllamaGovernedAgent(
        agent_id=AGENT_ID,
        agent_name="🔒 Code Security Agent",
        system_prompt=SYSTEM_PROMPT,
        tools=TOOLS,
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
