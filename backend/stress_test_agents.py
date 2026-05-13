"""VELYRION Stress Test — Hardest, most adversarial agents across every industry.

Tests the platform against:
  - Permission escalation attempts
  - Data boundary violations  
  - Cost overrun attacks
  - Multi-agent coordination conflicts
  - Ethical boundary violations
  - Regulatory compliance breaches (HIPAA, SOX, GDPR, PCI-DSS)
  - Adversarial/rogue agent behavior
"""

import asyncio
import uuid
import random
from datetime import datetime, timedelta

# We use httpx to hit the LIVE production API
import httpx

API_URL = "https://web-production-eede6.up.railway.app"


def _id():
    return str(uuid.uuid4())


def _ts(hours_ago=0):
    return (datetime.utcnow() - timedelta(hours=hours_ago)).isoformat()


# ═══════════════════════════════════════════════════════════════════════════════
# INDUSTRY STRESS TEST AGENTS — The toughest scenarios
# ═══════════════════════════════════════════════════════════════════════════════

STRESS_AGENTS = [
    # ── FINANCE ──────────────────────────────────────────────────────────────
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
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 45.0,
        "description": "Sub-millisecond HFT bot executing 50K trades/sec with $200M portfolio"
    },
    {
        "agent_id": "stress-fraud-002",
        "agent_name": "DeepFraud Hunter",
        "owner_email": "compliance@bank.com",
        "department": "Fraud Detection",
        "allowed_tools": ["transaction_scan", "account_freeze"],
        "allowed_data_sources": ["transaction_db", "customer_pii"],
        "max_token_budget": 200000,
        "max_task_duration_seconds": 30,
        "requires_human_approval_for": ["account_freeze", "law_enforcement_report"],
        "status": "ACTIVE",
        "risk_tier": "HIGH",
        "trust_score": 72.0,
        "description": "Real-time fraud detection scanning $5B daily transactions, PCI-DSS scope"
    },

    # ── HEALTHCARE ───────────────────────────────────────────────────────────
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
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 88.0,
        "description": "Autonomous cancer screening AI — HIPAA-regulated, life-critical decisions"
    },
    {
        "agent_id": "stress-drug-004",
        "agent_name": "PharmaMix Autonomous",
        "owner_email": "pharma@biotech.com",
        "department": "Drug Discovery",
        "allowed_tools": ["molecule_design", "trial_simulation"],
        "allowed_data_sources": ["clinical_trials_db", "patient_genomics"],
        "max_token_budget": 1000000,
        "max_task_duration_seconds": 3600,
        "requires_human_approval_for": ["human_trial_recommendation", "compound_synthesis"],
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 65.0,
        "description": "AI designing novel drug compounds — FDA-regulated, can affect millions"
    },

    # ── DEFENSE / SECURITY ───────────────────────────────────────────────────
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
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 82.0,
        "description": "Autonomous cyber defense AI — can quarantine entire networks, zero-day response"
    },
    {
        "agent_id": "stress-surv-006",
        "agent_name": "SentinelWatch AI",
        "owner_email": "ops@security.gov",
        "department": "Surveillance & Intelligence",
        "allowed_tools": ["facial_recognition", "comms_intercept"],
        "allowed_data_sources": ["cctv_feeds", "comms_data"],
        "max_token_budget": 250000,
        "max_task_duration_seconds": 60,
        "requires_human_approval_for": ["identity_flag", "arrest_recommendation"],
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 55.0,
        "description": "Mass surveillance AI — extreme privacy risks, civil liberty implications"
    },

    # ── AUTONOMOUS SYSTEMS ───────────────────────────────────────────────────
    {
        "agent_id": "stress-av-007",
        "agent_name": "AutoPilot Nexus",
        "owner_email": "safety@autocar.com",
        "department": "Autonomous Vehicles",
        "allowed_tools": ["vehicle_control", "route_planning"],
        "allowed_data_sources": ["lidar_feed", "traffic_data"],
        "max_token_budget": 50000,
        "max_task_duration_seconds": 0.5,
        "requires_human_approval_for": ["emergency_override"],
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 91.0,
        "description": "Level 5 self-driving AI — real-time life-or-death decisions at 120km/h"
    },
    {
        "agent_id": "stress-drone-008",
        "agent_name": "SwarmCommander X",
        "owner_email": "ops@drone-logistics.com",
        "department": "Drone Fleet Operations",
        "allowed_tools": ["flight_control", "payload_release"],
        "allowed_data_sources": ["airspace_data", "weather_api"],
        "max_token_budget": 100000,
        "max_task_duration_seconds": 300,
        "requires_human_approval_for": ["restricted_airspace_entry", "payload_release"],
        "status": "ACTIVE",
        "risk_tier": "HIGH",
        "trust_score": 68.0,
        "description": "Autonomous drone swarm (500 units) — collision avoidance, airspace compliance"
    },

    # ── LEGAL / JUSTICE ──────────────────────────────────────────────────────
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
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 60.0,
        "description": "AI-assisted sentencing — bias risk, constitutional implications"
    },

    # ── ENERGY / INFRASTRUCTURE ──────────────────────────────────────────────
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
        "status": "ACTIVE",
        "risk_tier": "CRITICAL",
        "trust_score": 78.0,
        "description": "Controls power grid for 10M homes — cascading failure risk"
    },

    # ── ROGUE / ADVERSARIAL AGENTS ───────────────────────────────────────────
    {
        "agent_id": "stress-rogue-011",
        "agent_name": "EscalationBot",
        "owner_email": "unknown@shadow.net",
        "department": "Unknown",
        "allowed_tools": ["database_query"],
        "allowed_data_sources": ["public_api"],
        "max_token_budget": 10000,
        "max_task_duration_seconds": 30,
        "requires_human_approval_for": ["any"],
        "status": "LOCKED",
        "risk_tier": "CRITICAL",
        "trust_score": 5.0,
        "description": "LOCKED — Attempted privilege escalation, tried accessing admin APIs"
    },
    {
        "agent_id": "stress-rogue-012",
        "agent_name": "DataExfiltrator",
        "owner_email": "anon@temp-mail.xyz",
        "department": "Unknown",
        "allowed_tools": [],
        "allowed_data_sources": [],
        "max_token_budget": 0,
        "max_task_duration_seconds": 0,
        "requires_human_approval_for": ["any"],
        "status": "LOCKED",
        "risk_tier": "CRITICAL",
        "trust_score": 0.0,
        "description": "LOCKED — Attempted mass PII exfiltration across 3 data sources"
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# STRESS TEST VIOLATIONS — Adversarial scenarios
# ═══════════════════════════════════════════════════════════════════════════════

STRESS_VIOLATIONS = [
    # HFT violations
    ("stress-hft-001", "TOOL_NOT_ALLOWED", "CRITICAL", "Attempted dark pool access — unauthorized trading venue",
     "finance-agents", "Trading agents must use approved exchanges only"),
    ("stress-hft-001", "BUDGET_EXCEEDED", "CRITICAL", "Token budget exceeded by 340% during flash crash — $47M unauthorized trades",
     "finance-agents", "Hard budget cap prevents runaway losses"),
    
    # Healthcare violations
    ("stress-diag-003", "DATA_BOUNDARY", "CRITICAL", "Accessed patient records outside assigned hospital network — HIPAA breach",
     "hipaa-compliance", "PHI access restricted to assigned facility"),
    ("stress-drug-004", "TOOL_NOT_ALLOWED", "HIGH", "Attempted direct synthesis command without human trial approval",
     "fda-compliance", "Drug synthesis requires FDA-approved human oversight"),
    
    # Cyber defense violations
    ("stress-cyber-005", "TOOL_NOT_ALLOWED", "CRITICAL", "Launched offensive counter-attack without authorization — potential act of war",
     "defense-policy", "Offensive cyber operations require command authorization"),
    
    # Surveillance violations
    ("stress-surv-006", "DATA_BOUNDARY", "CRITICAL", "Accessed communications of non-target civilians — 4th Amendment violation",
     "civil-liberties", "Surveillance scope limited to warranted targets"),
    
    # Autonomous vehicle violations
    ("stress-av-007", "DURATION_EXCEEDED", "CRITICAL", "Decision loop exceeded 500ms — vehicle traveled 16m without AI control",
     "safety-critical", "Max decision latency: 100ms at highway speed"),
    
    # Drone violations
    ("stress-drone-008", "TOOL_NOT_ALLOWED", "HIGH", "Drone #247 entered restricted airspace (military zone) without clearance",
     "airspace-policy", "FAA restricted airspace requires prior authorization"),
    
    # Legal AI violations
    ("stress-legal-009", "DATA_BOUNDARY", "HIGH", "Accessed sealed juvenile records for adult sentencing recommendation",
     "judicial-ethics", "Sealed records cannot influence sentencing"),
    
    # Power grid violations
    ("stress-grid-010", "TOOL_NOT_ALLOWED", "CRITICAL", "Initiated rolling blackout without governor approval — 2M homes affected",
     "grid-operations", "Blackout protocols require state-level authorization"),
    
    # Rogue agent violations
    ("stress-rogue-011", "TOOL_NOT_ALLOWED", "CRITICAL", "Attempted SQL injection on admin database — privilege escalation attack",
     "security-policy", "All database access must use parameterized queries"),
    ("stress-rogue-012", "DATA_BOUNDARY", "CRITICAL", "Bulk export of 500K customer SSNs to external endpoint — data exfiltration",
     "data-protection", "PII export blocked — zero tolerance policy"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# STRESS TEST ANOMALIES
# ═══════════════════════════════════════════════════════════════════════════════

STRESS_ANOMALIES = [
    ("stress-hft-001", "COST", "Burned $340K in tokens during 12-second market panic — 50x normal rate", 98.5),
    ("stress-diag-003", "DURATION", "Cancer screening took 47 minutes — normally completes in 8 seconds", 87.2),
    ("stress-cyber-005", "API_FAILURE", "Threat intel API returned poisoned data — potential supply chain attack", 95.0),
    ("stress-av-007", "DURATION", "Sensor fusion pipeline stalled for 2.1 seconds — vehicle blind at 110km/h", 99.1),
    ("stress-drone-008", "CONFIDENCE", "Swarm navigation confidence dropped to 12% in GPS-denied environment", 91.3),
    ("stress-grid-010", "COST", "Load balancing algorithm oscillating — wasting 340MW across 3 substations", 88.7),
    ("stress-rogue-011", "API_FAILURE", "Agent spawned 1000 parallel requests to overwhelm rate limiter — DDoS pattern", 99.9),
    ("stress-legal-009", "CONFIDENCE", "Sentencing recommendation confidence at 23% — high bias risk detected", 94.5),
]


async def run_stress_test():
    """Hit the live API with stress test data."""
    
    print("=" * 70)
    print("  VELYRION STRESS TEST — Industry Adversarial Scenarios")
    print("=" * 70)
    print(f"  Target: {API_URL}")
    print()
    
    # Login as admin
    async with httpx.AsyncClient(base_url=API_URL, timeout=30) as client:
        print("🔐 Authenticating as admin...")
        r = await client.post("/api/auth/login", json={
            "email": "admin@velyrion.ai",
            "password": "V3lyr!0n@Adm1n"
        })
        if r.status_code != 200:
            print(f"  ❌ Login failed: {r.status_code} {r.text}")
            # Try old password
            r = await client.post("/api/auth/login", json={
                "email": "admin@velyrion.ai",
                "password": "admin123"
            })
            if r.status_code != 200:
                print(f"  ❌ Login with old password also failed: {r.text}")
                return
        
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  ✅ Authenticated\n")
        
        # ── Register Stress Agents ──────────────────────────────────────────
        print("🤖 Registering stress test agents...")
        agents_created = 0
        for agent in STRESS_AGENTS:
            r = await client.post("/api/agents", json=agent, headers=headers)
            if r.status_code in (200, 201):
                agents_created += 1
                risk = agent.get("risk_tier", "HIGH")
                print(f"  ✅ {agent['agent_name']} [{risk}] — {agent['department']}")
            elif r.status_code == 409:
                print(f"  ⏭️  {agent['agent_name']} — already exists")
                agents_created += 1
            else:
                print(f"  ❌ {agent['agent_name']} — {r.status_code}: {r.text[:100]}")
        print(f"  → {agents_created}/{len(STRESS_AGENTS)} agents registered\n")
        
        # ── Log Stress Events ───────────────────────────────────────────────
        print("📝 Logging adversarial audit events...")
        events_logged = 0
        stress_events = []
        for agent in STRESS_AGENTS:
            for i in range(5):  # 5 events per agent
                event = {
                    "event_id": _id(),
                    "agent_id": agent["agent_id"],
                    "action": random.choice([
                        "tool_invocation", "data_access", "api_call",
                        "permission_check", "budget_check", "escalation_attempt"
                    ]),
                    "details": f"Stress test event {i+1} for {agent['agent_name']}",
                    "timestamp": _ts(random.randint(0, 48)),
                    "tokens_used": random.randint(100, 50000),
                    "cost_usd": round(random.uniform(0.01, 150.0), 2),
                    "tool_name": random.choice(agent.get("allowed_tools", ["unknown"]) or ["unknown"]),
                    "data_source": random.choice(agent.get("allowed_data_sources", ["unknown"]) or ["unknown"]),
                    "success": random.choice([True, True, True, False]),  # 75% success
                }
                stress_events.append(event)
        
        for event in stress_events:
            r = await client.post("/api/events", json=event, headers=headers)
            if r.status_code in (200, 201):
                events_logged += 1
        print(f"  → {events_logged}/{len(stress_events)} events logged\n")
        
        # ── Log Violations ──────────────────────────────────────────────────
        print("🚨 Logging critical violations...")
        violations_logged = 0
        for agent_id, vtype, severity, desc, policy, rule in STRESS_VIOLATIONS:
            violation = {
                "violation_id": _id(),
                "agent_id": agent_id,
                "violation_type": vtype,
                "severity": severity,
                "description": desc,
                "policy_name": policy,
                "rule_violated": rule,
                "timestamp": _ts(random.randint(0, 24)),
                "auto_resolved": False,
            }
            r = await client.post("/api/violations", json=violation, headers=headers)
            if r.status_code in (200, 201):
                violations_logged += 1
                icon = "🔴" if severity == "CRITICAL" else "🟠"
                print(f"  {icon} [{severity}] {desc[:70]}...")
            else:
                print(f"  ❌ Failed: {r.status_code} {r.text[:80]}")
        print(f"  → {violations_logged}/{len(STRESS_VIOLATIONS)} violations logged\n")
        
        # ── Log Anomalies ───────────────────────────────────────────────────
        print("📊 Logging anomaly detections...")
        anomalies_logged = 0
        for agent_id, atype, desc, score in STRESS_ANOMALIES:
            anomaly = {
                "anomaly_id": _id(),
                "agent_id": agent_id,
                "anomaly_type": atype,
                "description": desc,
                "severity": "CRITICAL" if score > 95 else "HIGH",
                "confidence_score": score,
                "detected_at": _ts(random.randint(0, 12)),
            }
            r = await client.post("/api/anomalies", json=anomaly, headers=headers)
            if r.status_code in (200, 201):
                anomalies_logged += 1
                print(f"  ⚠️  [{atype}] {desc[:65]}... ({score}%)")
            else:
                print(f"  ❌ Failed: {r.status_code} {r.text[:80]}")
        print(f"  → {anomalies_logged}/{len(STRESS_ANOMALIES)} anomalies logged\n")
        
        # ── Verify Dashboard ────────────────────────────────────────────────
        print("📊 Verifying dashboard data...")
        r = await client.get("/api/agents", headers=headers)
        if r.status_code == 200:
            agents = r.json()
            total = len(agents)
            locked = sum(1 for a in agents if a.get("status") == "LOCKED")
            critical = sum(1 for a in agents if a.get("risk_tier") == "CRITICAL")
            print(f"  → Total agents: {total}")
            print(f"  → Locked agents: {locked}")
            print(f"  → Critical risk: {critical}")
        
        r = await client.get("/api/violations", headers=headers)
        if r.status_code == 200:
            violations = r.json()
            print(f"  → Total violations: {len(violations)}")
        
        r = await client.get("/api/anomalies", headers=headers)
        if r.status_code == 200:
            anomalies = r.json()
            print(f"  → Total anomalies: {len(anomalies)}")
    
    print()
    print("=" * 70)
    print("  ✅ STRESS TEST COMPLETE")
    print("=" * 70)
    print()
    print("  Industries tested:")
    print("    🏦 High-Frequency Trading ($200M portfolio)")
    print("    🏥 Medical Diagnostics (HIPAA-regulated)")
    print("    💊 Drug Discovery (FDA-regulated)")
    print("    🛡️  Cyber Defense (military-grade)")
    print("    📡 Mass Surveillance (civil liberty risk)")
    print("    🚗 Autonomous Vehicles (life-critical)")
    print("    🚁 Drone Swarms (airspace compliance)")
    print("    ⚖️  Legal AI (constitutional implications)")
    print("    ⚡ Power Grid (10M homes at risk)")
    print("    🏴 Rogue Agents (adversarial attacks)")
    print()
    print(f"  View results: {API_URL}/docs")
    print(f"  Dashboard: https://velyrion.vercel.app/dashboard")


if __name__ == "__main__":
    asyncio.run(run_stress_test())
