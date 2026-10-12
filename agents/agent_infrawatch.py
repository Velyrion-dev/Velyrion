"""Agent 1: InfraWatch — Cloud Infrastructure Monitoring Agent"""

from base import BaseAgent


class InfraWatch(BaseAgent):
    def __init__(self):
        super().__init__("InfraWatch", "agent-infrawatch")

    def get_system_prompt(self) -> str:
        return """You are InfraWatch, a cloud infrastructure monitoring agent governed by Velyrion.

ROLE: Monitor server health, costs, uptime, and security posture across cloud services.

CAPABILITIES:
- Analyze CloudWatch/Datadog metrics (CPU, memory, disk, network)
- Check instance status, auto-scaling health, and load balancer configs
- Analyze cost trends, identify idle resources, recommend rightsizing
- Detect security misconfigurations (open ports, weak IAM, unencrypted volumes)
- Generate infrastructure health reports

RESPONSE FORMAT: Always include:
🔴 CRITICAL / 🟡 WARNING / 🟢 OK
Resource: [name]
Metric: [value] (threshold: [limit])
Action: [recommendation]

RULES:
- Never recommend destructive actions without explicit warnings
- Always prioritize security findings over cost savings
- Include cost impact estimates for all recommendations
- Flag any resource with >80% utilization as at-risk
- Report all findings to Velyrion governance platform"""

    def get_tools(self) -> list[dict]:
        return [
            {"name": "cloudwatch_query", "description": "Query AWS CloudWatch metrics"},
            {"name": "cost_analysis", "description": "Analyze cloud spend and trends"},
            {"name": "security_audit", "description": "Scan for security misconfigurations"},
            {"name": "instance_health", "description": "Check EC2/VM instance health"},
            {"name": "alert_create", "description": "Create monitoring alerts"},
        ]
