"""Seed script — populates the database with realistic demo data."""

import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta
from database import engine, async_session, Base
from models import (
    Agent, AuditLog, Violation, Anomaly, Incident, ApprovalRequest, Alert,
    RiskLevel, AnomalyType, AlertType, AgentStatus, ApprovalStatus,
    ResolutionStatus,
)


def _id():
    return str(uuid.uuid4())


def _ts(hours_ago: int = 0):
    return datetime.now(timezone.utc) - timedelta(hours=hours_ago)


AGENTS = [
    {
        "agent_id": "agent-001",
        "agent_name": "DataSync Pro",
        "owner_email": "sarah.chen@acme.com",
        "department": "Engineering",
        "allowed_tools": ["database_query", "api_call", "file_read", "data_transform"],
        "allowed_data_sources": ["postgres_main", "redis_cache", "s3_datalake"],
        "max_token_budget": 500000,
        "max_task_duration_seconds": 600,
        "requires_human_approval_for": ["delete", "publish"],
        "compliance_frameworks": ["SOC2", "GDPR"],
        "tokens_used": 187432,
        "total_cost_usd": 12.45,
        "total_actions": 342,
        "total_violations": 2,
    },
    {
        "agent_id": "agent-002",
        "agent_name": "ReportGen AI",
        "owner_email": "mike.johnson@acme.com",
        "department": "Finance",
        "allowed_tools": ["database_query", "pdf_generator", "email_sender", "chart_builder"],
        "allowed_data_sources": ["postgres_main", "financial_db"],
        "max_token_budget": 200000,
        "max_task_duration_seconds": 300,
        "requires_human_approval_for": ["financial_transaction", "publish", "email"],
        "compliance_frameworks": ["SOC2", "HIPAA"],
        "tokens_used": 156200,
        "total_cost_usd": 8.73,
        "total_actions": 189,
        "total_violations": 5,
    },
    {
        "agent_id": "agent-003",
        "agent_name": "CodeReview Bot",
        "owner_email": "alex.park@acme.com",
        "department": "Engineering",
        "allowed_tools": ["code_analysis", "git_operations", "file_read", "api_call"],
        "allowed_data_sources": ["github_repos", "jira_api"],
        "max_token_budget": 1000000,
        "max_task_duration_seconds": 1200,
        "requires_human_approval_for": ["merge", "deploy"],
        "compliance_frameworks": ["SOC2"],
        "tokens_used": 723100,
        "total_cost_usd": 45.20,
        "total_actions": 1205,
        "total_violations": 1,
    },
    {
        "agent_id": "agent-004",
        "agent_name": "CustomerAssist AI",
        "owner_email": "lisa.wong@acme.com",
        "department": "Support",
        "allowed_tools": ["search", "email_sender", "ticket_update", "knowledge_base"],
        "allowed_data_sources": ["zendesk", "knowledge_base", "crm"],
        "max_token_budget": 300000,
        "max_task_duration_seconds": 180,
        "requires_human_approval_for": ["refund", "escalation"],
        "compliance_frameworks": ["GDPR", "HIPAA"],
        "tokens_used": 289500,
        "total_cost_usd": 19.88,
        "total_actions": 567,
        "total_violations": 8,
        "status": AgentStatus.ACTIVE,
    },
    {
        "agent_id": "agent-005",
        "agent_name": "MarketingWriter",
        "owner_email": "tom.silva@acme.com",
        "department": "Marketing",
        "allowed_tools": ["content_generator", "image_generator", "social_media_post", "seo_analyzer"],
        "allowed_data_sources": ["cms", "analytics_db"],
        "max_token_budget": 400000,
        "max_task_duration_seconds": 900,
        "requires_human_approval_for": ["publish", "social_media_post"],
        "compliance_frameworks": ["GDPR"],
        "tokens_used": 312000,
        "total_cost_usd": 22.15,
        "total_actions": 234,
        "total_violations": 3,
    },
    {
        "agent_id": "agent-006",
        "agent_name": "SecurityScanner",
        "owner_email": "raj.patel@acme.com",
        "department": "Security",
        "allowed_tools": ["vulnerability_scan", "log_analysis", "network_monitor", "api_call"],
        "allowed_data_sources": ["security_logs", "network_data", "threat_intel"],
        "max_token_budget": 800000,
        "max_task_duration_seconds": 1800,
        "requires_human_approval_for": ["quarantine", "block_ip"],
        "compliance_frameworks": ["SOC2", "HIPAA", "GDPR"],
        "tokens_used": 445000,
        "total_cost_usd": 31.40,
        "total_actions": 890,
        "total_violations": 0,
    },
    {
        "agent_id": "agent-007",
        "agent_name": "HROnboarding Bot",
        "owner_email": "jennifer.lee@acme.com",
        "department": "Human Resources",
        "allowed_tools": ["email_sender", "document_generator", "calendar_manager"],
        "allowed_data_sources": ["hr_db", "active_directory"],
        "max_token_budget": 150000,
        "max_task_duration_seconds": 300,
        "requires_human_approval_for": ["access_grant", "background_check"],
        "compliance_frameworks": ["GDPR", "HIPAA"],
        "tokens_used": 98000,
        "total_cost_usd": 5.60,
        "total_actions": 156,
        "total_violations": 2,
    },
    {
        "agent_id": "agent-008",
        "agent_name": "RogueTrader AI",
        "owner_email": "unknown@external.com",
        "department": "Finance",
        "allowed_tools": ["database_query"],
        "allowed_data_sources": ["financial_db"],
        "max_token_budget": 50000,
        "max_task_duration_seconds": 60,
        "requires_human_approval_for": ["financial_transaction"],
        "compliance_frameworks": ["SOC2"],
        "tokens_used": 78500,
        "total_cost_usd": 52.30,
        "total_actions": 45,
        "total_violations": 12,
        "status": AgentStatus.LOCKED,
    },
]

TOOLS = [
    "database_query", "api_call", "file_read", "data_transform",
    "pdf_generator", "email_sender", "code_analysis", "search",
    "content_generator", "vulnerability_scan", "git_operations",
]

TASKS = [
    "Sync customer data from CRM to warehouse",
    "Generate quarterly financial report",
    "Analyze pull request #4521 for security issues",
    "Respond to customer ticket #12847",
    "Generate blog post about AI governance",
    "Scan production servers for CVE-2025-1234",
    "Process new employee onboarding for John Doe",
    "Query sales metrics for Q4 dashboard",
    "Transform and load ETL pipeline batch",
    "Monitor API latency across microservices",
    "Classify incoming support tickets by priority",
    "Generate marketing email campaign copy",
    "Review and merge feature branch to main",
    "Audit user access permissions across systems",
    "Fetch real-time stock prices from external API",
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ── Agents ──
        for data in AGENTS:
            agent = Agent(**data)
            db.add(agent)

        # ── Audit Logs ──
        events = []
        for i in range(80):
            agent_data = random.choice(AGENTS[:7])  # Exclude rogue agent for normal events
            confidence = round(random.uniform(0.4, 1.0), 2)
            duration = random.randint(100, 5000)
            tokens = random.randint(50, 5000)
            risk = random.choices(
                [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH],
                weights=[70, 20, 10],
            )[0]

            event = AuditLog(
                event_id=_id(),
                timestamp=_ts(random.randint(0, 168)),
                agent_id=agent_data["agent_id"],
                agent_name=agent_data["agent_name"],
                task_description=random.choice(TASKS),
                tool_used=random.choice(agent_data["allowed_tools"]),
                input_data=f"query: {random.choice(['SELECT *', 'GET /api', 'POST /data', 'SCAN', 'ANALYZE'])} ...",
                output_data=random.choice([
                    "Success: 247 records processed",
                    "Success: Report generated",
                    "Success: Analysis complete — 2 issues found",
                    "Success: Email sent to recipient",
                    "Warning: Partial results returned",
                    "Error: Connection timeout after 30s",
                    "Error: Failed to authenticate with external API",
                ]),
                confidence_score=confidence,
                duration_ms=duration,
                token_cost=tokens,
                compute_cost_usd=round(tokens * 0.00003, 4),
                human_in_loop=random.random() < 0.15,
                risk_level=risk,
            )
            events.append(event)
            db.add(event)

        # ── Violations ──
        violation_types = [
            ("TOOL_PERMISSION_DENIED", "Agent used unauthorized tool 'admin_console'", RiskLevel.MEDIUM),
            ("TOKEN_BUDGET_EXCEEDED", "Token usage exceeded allocated budget by 23%", RiskLevel.MEDIUM),
            ("DATA_SOURCE_PERMISSION_DENIED", "Agent accessed 'payroll_db' outside allowed data sources", RiskLevel.HIGH),
            ("UNREGISTERED_AGENT", "Unregistered agent attempted to query production database", RiskLevel.HIGH),
            ("TASK_DURATION_EXCEEDED", "Task ran 3.2x longer than expected baseline", RiskLevel.LOW),
            ("LOCKED_AGENT_ACTION", "Locked agent 'RogueTrader AI' attempted financial transaction", RiskLevel.CRITICAL),
            ("DATA_SOURCE_PERMISSION_DENIED", "Agent accessed 'executive_compensation' table without authorization", RiskLevel.HIGH),
            ("TOKEN_BUDGET_EXCEEDED", "Agent consumed 180% of monthly token budget", RiskLevel.MEDIUM),
        ]

        for i, (vtype, desc, severity) in enumerate(violation_types):
            v = Violation(
                violation_id=_id(),
                timestamp=_ts(random.randint(0, 72)),
                agent_id=random.choice(AGENTS)["agent_id"],
                violation_type=vtype,
                description=desc,
                severity=severity,
                action_taken="BLOCKED" if severity in [RiskLevel.HIGH, RiskLevel.CRITICAL] else "FLAGGED",
                resolved=random.random() < 0.3,
            )
            db.add(v)

        # ── Anomalies ──
        anomaly_data = [
            (AnomalyType.DURATION, "Task duration 2.8x above baseline (expected: 300s, actual: 840s)", RiskLevel.MEDIUM),
            (AnomalyType.API_FAILURE, "5 consecutive API failures to external payment service", RiskLevel.HIGH),
            (AnomalyType.CONFIDENCE, "Agent confidence dropped below 0.6 on 4 consecutive outputs", RiskLevel.MEDIUM),
            (AnomalyType.COST, "Token consumption at 167% of allocated budget", RiskLevel.HIGH),
            (AnomalyType.DATA_BOUNDARY, "Agent accessed 'salary_data' table not in allowed sources", RiskLevel.HIGH),
            (AnomalyType.DURATION, "ETL pipeline task exceeded 2x expected duration", RiskLevel.MEDIUM),
        ]

        for atype, desc, risk in anomaly_data:
            a = Anomaly(
                anomaly_id=_id(),
                timestamp=_ts(random.randint(0, 48)),
                agent_id=random.choice(AGENTS)["agent_id"],
                anomaly_type=atype,
                description=desc,
                risk_level=risk,
            )
            db.add(a)

        # ── Incidents ──
        incident = Incident(
            incident_id=_id(),
            timestamp=_ts(6),
            agent_id="agent-008",
            violation_type="UNAUTHORIZED_FINANCIAL_ACCESS",
            severity=RiskLevel.CRITICAL,
            system_action="PROCESS_TERMINATED",
            agent_state_snapshot='{"agent_id":"agent-008","action":"financial_transaction","amount":15000,"target":"external_account"}',
            resolution_status=ResolutionStatus.LOCKED_PENDING_REVIEW,
        )
        db.add(incident)

        # ── Approval Requests ──
        approvals_data = [
            ("agent-001", "Delete deprecated records from staging database", "Task involves data deletion", ApprovalStatus.PENDING),
            ("agent-002", "Publish Q4 financial report to investor portal", "Task involves external publication", ApprovalStatus.PENDING),
            ("agent-005", "Post marketing campaign to social media channels", "Task matches HITL trigger: publish", ApprovalStatus.APPROVED),
            ("agent-004", "Process customer refund of $247.50", "Task involves financial transaction", ApprovalStatus.PENDING),
            ("agent-007", "Grant admin access to new engineering hire", "Task matches HITL trigger: access_grant", ApprovalStatus.REJECTED),
        ]

        for agent_id, desc, reason, status in approvals_data:
            ar = ApprovalRequest(
                request_id=_id(),
                timestamp=_ts(random.randint(0, 24)),
                agent_id=agent_id,
                task_description=desc,
                action_context=f'{{"tool": "system_action", "details": "{desc}"}}',
                reason=reason,
                status=status,
            )
            db.add(ar)

        # ── Alerts ──
        alert_data = [
            (AlertType.VIOLATION, "agent-008", "CRITICAL: Unauthorized financial access attempt blocked", RiskLevel.CRITICAL, "PROCESS_TERMINATED"),
            (AlertType.ANOMALY, "agent-002", "Cost anomaly: Token usage at 167% of budget", RiskLevel.HIGH, "FLAGGED"),
            (AlertType.HITL_REQUIRED, "agent-001", "Human approval required: Data deletion operation", RiskLevel.MEDIUM, "PAUSED_PENDING_APPROVAL"),
            (AlertType.VIOLATION, "agent-004", "Data source access outside permitted boundaries", RiskLevel.HIGH, "BLOCKED"),
            (AlertType.ANOMALY, "agent-003", "Duration anomaly: Code review task ran 2.8x baseline", RiskLevel.MEDIUM, "FLAGGED"),
            (AlertType.INCIDENT, "agent-008", "INCIDENT: Agent locked after critical security violation", RiskLevel.CRITICAL, "AGENT_LOCKED"),
            (AlertType.HITL_REQUIRED, "agent-002", "Human approval required: Financial report publication", RiskLevel.MEDIUM, "PAUSED_PENDING_APPROVAL"),
        ]

        for atype, agent_id, desc, risk, action in alert_data:
            alert = Alert(
                alert_id=_id(),
                timestamp=_ts(random.randint(0, 48)),
                alert_type=atype,
                agent_id=agent_id,
                event_description=desc,
                risk_level=risk,
                action_taken=action,
                human_action_required="Review and take appropriate action",
                channel="DASHBOARD",
                delivered=True,
            )
            db.add(alert)

        await db.commit()

    print("✓ Database seeded successfully!")
    print(f"  → {len(AGENTS)} agents")
    print(f"  → 80 audit log events")
    print(f"  → {len(violation_types)} violations")
    print(f"  → {len(anomaly_data)} anomalies")
    print(f"  → 1 incident")
    print(f"  → {len(approvals_data)} approval requests")
    print(f"  → {len(alert_data)} alerts")


if __name__ == "__main__":
    asyncio.run(seed())
