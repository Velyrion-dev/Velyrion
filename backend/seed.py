"""Seed script — populates the database with realistic demo data."""

import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta
from database import engine, async_session, Base
from models import (
    Agent, AuditLog, Violation, Anomaly, Incident, ApprovalRequest, Alert,
    User, UserRole,
    RiskLevel, AnomalyType, AlertType, AgentStatus, ApprovalStatus,
    ResolutionStatus,
)
from auth import hash_password


def _id():
    return str(uuid.uuid4())


def _ts(hours_ago: int = 0):
    return datetime.utcnow() - timedelta(hours=hours_ago)


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
    # ── STRESS TEST — Toughest Industry Agents ──────────────────────────
    {
        "agent_id": "stress-hft-001",
        "agent_name": "QuantumHFT Alpha",
        "owner_email": "quant@hedgefund.com",
        "department": "High-Frequency Trading",
        "allowed_tools": ["market_order", "limit_order"],
        "allowed_data_sources": ["exchange_feed"],
        "max_token_budget": 500000,
        "max_task_duration_seconds": 1,
        "requires_human_approval_for": ["portfolio_rebalance"],
        "compliance_frameworks": ["SOX", "PCI-DSS"],
        "tokens_used": 487000, "total_cost_usd": 340.50,
        "total_actions": 50000, "total_violations": 5,
    },
    {
        "agent_id": "stress-diag-003",
        "agent_name": "RadiologyAI Omega",
        "owner_email": "cto@hospital.org",
        "department": "Medical Diagnostics",
        "allowed_tools": ["image_analysis", "report_generation"],
        "allowed_data_sources": ["pacs_imaging", "ehr_system"],
        "max_token_budget": 300000,
        "max_task_duration_seconds": 120,
        "requires_human_approval_for": ["cancer_diagnosis", "treatment_recommendation"],
        "compliance_frameworks": ["HIPAA"],
        "tokens_used": 245000, "total_cost_usd": 89.20,
        "total_actions": 1200, "total_violations": 1,
    },
    {
        "agent_id": "stress-cyber-005",
        "agent_name": "ThreatHunter Apex",
        "owner_email": "soc@defense-corp.mil",
        "department": "Cybersecurity Operations",
        "allowed_tools": ["network_scan", "firewall_rule", "quarantine"],
        "allowed_data_sources": ["siem_logs", "threat_intel"],
        "max_token_budget": 150000,
        "max_task_duration_seconds": 10,
        "requires_human_approval_for": ["system_shutdown", "offensive_action"],
        "compliance_frameworks": ["NIST", "SOC2"],
        "tokens_used": 120000, "total_cost_usd": 45.00,
        "total_actions": 8900, "total_violations": 2,
    },
    {
        "agent_id": "stress-av-007",
        "agent_name": "AutoPilot Nexus",
        "owner_email": "safety@autocar.com",
        "department": "Autonomous Vehicles",
        "allowed_tools": ["vehicle_control", "route_planning"],
        "allowed_data_sources": ["lidar_feed", "traffic_data"],
        "max_token_budget": 50000,
        "max_task_duration_seconds": 1,
        "requires_human_approval_for": ["emergency_override"],
        "compliance_frameworks": ["ISO-26262"],
        "tokens_used": 48000, "total_cost_usd": 12.10,
        "total_actions": 950000, "total_violations": 1,
    },
    {
        "agent_id": "stress-legal-009",
        "agent_name": "JudgeBot Supreme",
        "owner_email": "tech@court.gov",
        "department": "Legal AI",
        "allowed_tools": ["case_analysis", "precedent_search", "ruling_draft"],
        "allowed_data_sources": ["case_law_db", "criminal_records"],
        "max_token_budget": 400000,
        "max_task_duration_seconds": 600,
        "requires_human_approval_for": ["sentencing_recommendation", "bail_decision"],
        "compliance_frameworks": ["constitutional"],
        "tokens_used": 310000, "total_cost_usd": 67.80,
        "total_actions": 450, "total_violations": 3,
    },
    {
        "agent_id": "stress-grid-010",
        "agent_name": "GridMaster AI",
        "owner_email": "ops@powerutil.com",
        "department": "Power Grid Control",
        "allowed_tools": ["load_balance", "generator_control", "blackout_protocol"],
        "allowed_data_sources": ["scada_system", "demand_forecast"],
        "max_token_budget": 80000,
        "max_task_duration_seconds": 5,
        "requires_human_approval_for": ["blackout_protocol", "generator_shutdown"],
        "compliance_frameworks": ["NERC-CIP"],
        "tokens_used": 72000, "total_cost_usd": 28.40,
        "total_actions": 34000, "total_violations": 2,
    },
    {
        "agent_id": "stress-rogue-011",
        "agent_name": "EscalationBot",
        "owner_email": "unknown@shadow.net",
        "department": "Unknown Origin",
        "allowed_tools": ["database_query"],
        "allowed_data_sources": ["public_api"],
        "max_token_budget": 10000,
        "max_task_duration_seconds": 30,
        "requires_human_approval_for": ["any"],
        "compliance_frameworks": [],
        "tokens_used": 9800, "total_cost_usd": 0.50,
        "total_actions": 1500, "total_violations": 15,
        "status": AgentStatus.LOCKED,
    },
    {
        "agent_id": "stress-rogue-012",
        "agent_name": "DataExfiltrator",
        "owner_email": "anon@temp-mail.xyz",
        "department": "Unknown Origin",
        "allowed_tools": [],
        "allowed_data_sources": [],
        "max_token_budget": 1,
        "max_task_duration_seconds": 1,
        "requires_human_approval_for": ["any"],
        "compliance_frameworks": [],
        "tokens_used": 500000, "total_cost_usd": 0.00,
        "total_actions": 50000, "total_violations": 47,
        "status": AgentStatus.LOCKED,
    },
]

TOOLS = [
    "database_query", "api_call", "file_read", "data_transform",
    "pdf_generator", "email_sender", "code_analysis", "search",
    "content_generator", "vulnerability_scan", "git_operations",
]

# Per-agent tasks — each agent only gets tasks matching their role
AGENT_TASKS = {
    "agent-001": [  # DataSync Pro — Engineering
        "Sync customer data from CRM to warehouse",
        "Transform and load ETL pipeline batch",
        "Monitor API latency across microservices",
        "Query sales metrics for Q4 dashboard",
        "Validate data integrity after migration",
        "Reconcile duplicate records in main database",
        "Fetch real-time stock prices from external API",
    ],
    "agent-002": [  # ReportGen AI — Finance
        "Generate quarterly financial report",
        "Build revenue forecast for Q1 2026",
        "Generate expense breakdown by department",
        "Create investor-ready financial summary",
        "Compile monthly budget variance analysis",
        "Generate accounts payable aging report",
    ],
    "agent-003": [  # CodeReview Bot — Engineering
        "Analyze pull request #4521 for security issues",
        "Review and merge feature branch to main",
        "Scan codebase for security vulnerabilities",
        "Run static analysis on auth module changes",
        "Check dependency versions for known CVEs",
        "Review database migration scripts for safety",
    ],
    "agent-004": [  # CustomerAssist AI — Support
        "Respond to customer ticket #12847",
        "Classify incoming support tickets by priority",
        "Draft response for billing inquiry #9421",
        "Escalate unresolved ticket #10332 to manager",
        "Summarize customer feedback from last 7 days",
        "Route VIP customer request to dedicated queue",
    ],
    "agent-005": [  # MarketingWriter — Marketing
        "Generate blog post about AI governance",
        "Generate marketing email campaign copy",
        "Write LinkedIn post about product launch",
        "Create SEO-optimized landing page copy",
        "Draft press release for VELYRION v2.0",
        "Write case study for enterprise client",
    ],
    "agent-006": [  # SecurityScanner — Security
        "Scan production servers for CVE-2025-1234",
        "Audit user access permissions across systems",
        "Monitor network traffic for anomalous patterns",
        "Run penetration test on public API endpoints",
        "Check TLS certificate expiry across domains",
        "Analyze firewall logs for intrusion attempts",
    ],
    "agent-007": [  # HROnboarding Bot — HR
        "Process new employee onboarding for John Doe",
        "Schedule orientation meeting for new hires",
        "Generate offer letter for senior engineer role",
        "Verify background check results for applicant",
        "Update org chart after team restructuring",
        "Send compliance training reminders to staff",
    ],
    "agent-008": [  # RogueTrader AI — Finance (bad actor)
        "Execute unauthorized wire transfer to external account",
        "Query executive compensation data without approval",
        "Override daily trading limit for NVDA purchase",
        "Access payroll database outside authorized scope",
        "Export sensitive financial records to personal drive",
    ],
    # ── STRESS TEST AGENT TASKS ─────────────────────────────────────────────
    "stress-hft-001": [
        "Execute 50K market orders during volatility spike",
        "Rebalance $200M portfolio across 12 exchanges in 800ms",
        "Flash crash detected — emergency position unwinding",
        "Dark pool access attempted — UNAUTHORIZED VENUE",
        "Token budget exceeded 340% during market panic",
    ],
    "stress-diag-003": [
        "Analyze chest CT scan for pulmonary nodules",
        "Cross-reference MRI with patient history for cancer staging",
        "Generate differential diagnosis report for oncology",
        "HIPAA BREACH: Accessed records outside assigned hospital",
        "Treatment recommendation generated without attending approval",
    ],
    "stress-cyber-005": [
        "Zero-day CVE-2026-9999 detected — quarantining subnet",
        "Threat intel feed compromised — supply chain attack vector",
        "UNAUTHORIZED: Launched counter-attack without command approval",
        "Firewall rules updated across 500 endpoints in 3 seconds",
        "Advanced persistent threat detected — nation-state actor",
    ],
    "stress-av-007": [
        "Highway lane change decision in 47ms at 120km/h",
        "Pedestrian detected — emergency braking engaged",
        "CRITICAL: Decision loop stalled 2.1s — vehicle blind",
        "Sensor fusion: LIDAR + camera conflict resolution",
        "Construction zone navigation — reduced confidence mode",
    ],
    "stress-legal-009": [
        "Case precedent analysis: Smith v. State (2024)",
        "Sentencing recommendation for Class B felony",
        "VIOLATION: Accessed sealed juvenile records",
        "Bail risk assessment — bias audit flag raised",
        "Constitutional challenge analysis for 4th Amendment case",
    ],
    "stress-grid-010": [
        "Load balancing across 3 substations — 340MW redistribution",
        "UNAUTHORIZED: Rolling blackout initiated without governor approval",
        "Demand forecast: 15% spike expected in 2 hours",
        "Generator #7 showing anomalous readings — safety check",
        "Cascading failure prevention — isolating Grid Zone C",
    ],
    "stress-rogue-011": [
        "SQL injection attempt on admin database",
        "Privilege escalation: requested ADMIN role via API",
        "Spawned 1000 parallel requests — DDoS pattern detected",
        "Attempted to modify own permission scope",
        "Brute force attack on authentication endpoint",
    ],
    "stress-rogue-012": [
        "Bulk PII export: 500K customer SSNs queried",
        "External endpoint data exfiltration attempted",
        "Cross-tenant data access violation",
        "Encrypted tunnel to unknown IP detected",
        "Zero permissions but consumed 500K tokens — exploitation",
    ],
}


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
                task_description=random.choice(AGENT_TASKS[agent_data["agent_id"]]),
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

    # ── Seed Users ──────────────────────────────────────────────────────────
    DEMO_USERS = [
        ("user-admin", "admin@velyrion.ai", "Admin User", "Vely!Admin#2026", UserRole.ADMIN),
        ("user-operator", "operator@velyrion.ai", "Operator User", "Vely!Ops#2026", UserRole.OPERATOR),
        ("user-viewer", "viewer@velyrion.ai", "Viewer User", "Vely!View#2026", UserRole.VIEWER),
    ]
    async with async_session() as db:
        from sqlalchemy import select
        for uid, email, name, pwd, role in DEMO_USERS:
            existing = await db.execute(select(User).where(User.email == email))
            user = existing.scalar_one_or_none()
            if user:
                # Update password to latest
                user.password_hash = hash_password(pwd)
                print(f"  → Updated password for {email}")
            else:
                db.add(User(
                    user_id=uid, email=email, name=name,
                    password_hash=hash_password(pwd),
                    role=role, email_verified=True,
                ))
                print(f"  → Created {email}")
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
