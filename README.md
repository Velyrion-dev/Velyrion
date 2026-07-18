<p align="center">
  <img src="https://img.shields.io/badge/Velyrion-Agent%20Governance-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNUg5di02aDJ2NnptNC0wSDEzdi04aDJ2OHoiLz48L3N2Zz4=" alt="Velyrion"/>
  <br/>
  <img src="https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110+-teal?logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Ollama-LLM%20Testing-orange?logo=ollama&logoColor=white" alt="Ollama"/>
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License"/>
</p>

<h1 align="center">VELYRION</h1>
<h3 align="center">The Governance Layer for Autonomous AI Agents</h3>
<p align="center"><em>Monitor · Govern · Audit · Score — Every AI agent action, in real-time.</em></p>

---

## 🎯 What is Velyrion?

**Velyrion** is a governance platform for autonomous AI agents — think **Datadog + Okta, built for the AI agent era**.

As enterprises deploy AI agents (customer support bots, code reviewers, data analysts, compliance monitors), they need answers to:

- **What is my AI agent doing right now?**
- **Did it access data it shouldn't have?**
- **Can I kill it instantly if it goes rogue?**
- **Are we compliant with SOC2, GDPR, EU AI Act?**

Velyrion answers all of these with a single platform.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VELYRION ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │ Support  │   │ Analyst  │   │ Security │   │  DevOps  │   │
│  │  Agent   │   │  Agent   │   │  Agent   │   │  Agent   │   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   │
│       │              │              │              │           │
│       └──────────────┴──────┬───────┴──────────────┘           │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Velyrion SDK   │  ← Python SDK            │
│                    │  (Intercepts)   │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│              ┌──────────────▼──────────────┐                   │
│              │     GOVERNANCE ENGINE       │                   │
│              │  ┌─────────┐ ┌──────────┐  │                   │
│              │  │  Tool   │ │   Data   │  │                   │
│              │  │Whitelist│ │  Source  │  │                   │
│              │  │  Check  │ │Validate  │  │                   │
│              │  └─────────┘ └──────────┘  │                   │
│              │  ┌─────────┐ ┌──────────┐  │                   │
│              │  │  HITL   │ │  Token   │  │                   │
│              │  │Approval │ │  Budget  │  │                   │
│              │  └─────────┘ └──────────┘  │                   │
│              └──────────────┬──────────────┘                   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────┐       │
│  │              INTELLIGENCE LAYER                      │       │
│  │  Governance Score · Behavioral DNA · Threat Intel    │       │
│  │  Insurance Score · Trust Registry · Compliance       │       │
│  └──────────────────────────┬──────────────────────────┘       │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────┐       │
│  │                DASHBOARD (Next.js)                    │       │
│  │  39 Pages · Real-time · Kill Switch · War Room       │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features (17+ Governance Capabilities)

### Core Governance
| # | Feature | Description |
|---|---------|-------------|
| 1 | **Real-time Event Logging** | Every agent action logged with cryptographic audit chain |
| 2 | **Tool Whitelisting** | Block unauthorized tools instantly (403) |
| 3 | **Data Source Validation** | Restrict which databases/APIs agents can access |
| 4 | **Human-in-the-Loop** | Low confidence triggers approval workflow |
| 5 | **Kill Switch** | Emergency stop any agent in <100ms |
| 6 | **Governance Score** | 6-dimension scoring (safety, compliance, cost, etc.) |

### Intelligence Layer
| # | Feature | Description |
|---|---------|-------------|
| 7 | **Threat Intelligence** | Pattern detection from violation data |
| 8 | **Behavioral DNA** | Agent fingerprinting + drift detection |
| 9 | **Regulatory Compliance** | SOC2, GDPR, HIPAA, EU AI Act, ISO 27001 |
| 10 | **Insurance Scoring** | Risk/premium calculations per agent |
| 11 | **Trust Registry** | Trust scores computed from real behavior |
| 12 | **Sandbox Simulation** | Test agent policies before deploying |

### Operations
| # | Feature | Description |
|---|---------|-------------|
| 13 | **War Room** | Auto-create incidents from violations |
| 14 | **AI Copilot** | Natural language queries over governance data |
| 15 | **Multi-Agent Protocol** | Inter-agent flow tracking + policies |
| 16 | **Dashboard** | 39-page Next.js dashboard with real-time data |
| 17 | **Mission Control** | Unified command center for all agents |

---

## 🚀 Quick Start

### Option 1: One Command (Recommended)

```bash
python start.py
```

Opens backend (`:8000`) + frontend (`:3000`) with demo data seeded.

### Option 2: Docker

```bash
docker compose up --build
```

### Option 3: Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py
python -m uvicorn main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@velyrion.com` | `VelyrionAdmin2026!` |
| Operator | `operator@velyrion.com` | `VelyrionOp2026!` |
| Viewer | `viewer@velyrion.com` | `VelyrionView2026!` |

---

## 🤖 Real AI Agent Testing

Velyrion is tested with **real Ollama-powered AI agents**, not scripts:

```bash
# Run all 5 enterprise agents (requires Ollama + llama3.2)
python agents/ollama/run_enterprise.py
```

### Enterprise Agents Included

| Agent | Scenario | Mirrors |
|-------|----------|---------|
| 🎧 **Customer Support** | Ticket resolution, KB search | Zendesk, Intercom |
| 📊 **Data Analyst** | SQL queries, report generation | Databricks, Snowflake |
| 🔒 **Code Security** | Vulnerability scanning, PR review | GitHub Copilot, Snyk |
| ⚖️ **Financial Compliance** | Fraud detection, regulatory audit | Bloomberg, Stripe Radar |
| 🛠️ **IT Operations** | Incident response, auto-remediation | PagerDuty, Datadog |

### Test Results (Real Run)

```
Total Tool Calls:  50 (real LLM decisions)
Allowed:           34 (68%) — governance approved
Blocked:           16 (32%) — governance stopped
Duration:          36 minutes of real AI governance
```

**Key proof:** The IT Operations agent tried `monitor_systems` → BLOCKED → the LLM *autonomously adapted* and used `api_call` instead → ALLOWED. Real AI hitting governance walls and finding compliant alternatives.

---

## 🔌 SDK Integration

Connect any AI agent to Velyrion in 3 lines:

```python
from velyrion_sdk import VelyrionAgent

agent = VelyrionAgent(
    api_url="http://localhost:8000",
    agent_id="my-agent",
    agent_name="My AI Agent"
)

# Every tool call goes through governance
result = agent.execute(
    tool="database_query",
    task="Fetch user data",
    input_data="SELECT * FROM users",
    confidence=0.9
)

if result.allowed:
    print("✅ Action approved")
else:
    print(f"🚫 Blocked: {result.reason}")
```

---

## 📁 Project Structure

```
velyrion/
├── backend/                 # FastAPI backend
│   ├── main.py             # App entry + CORS + lifespan
│   ├── models.py           # 21 SQLAlchemy models
│   ├── seed.py             # Demo data seeder
│   ├── routers/            # 28 API route modules
│   │   ├── agents.py       # Agent CRUD + kill switch
│   │   ├── events.py       # Event logging + audit
│   │   ├── violations.py   # Violation tracking
│   │   ├── approvals.py    # HITL approval workflow
│   │   ├── governance.py   # Governance scoring engine
│   │   ├── sandbox.py      # Sandbox simulation
│   │   ├── copilot.py      # AI Copilot (NL queries)
│   │   └── ...             # 20+ more routers
│   └── engines/            # Governance engines
│       ├── permission_engine.py
│       └── governance_score.py
├── frontend/               # Next.js 15 dashboard
│   └── src/app/            # 39 pages
│       ├── dashboard/      # Main dashboard
│       ├── agents/         # Agent management
│       ├── war-room/       # Incident management
│       ├── copilot/        # AI assistant
│       └── ...             # 35+ more pages
├── agents/                 # AI agent implementations
│   ├── sdk/                # Python SDK
│   ├── ollama/             # 5 Ollama-powered enterprise agents
│   └── run_full_verification.py  # E2E test suite (42/43 passing)
├── policies/               # YAML governance policies
├── docker-compose.yml      # One-command deployment
└── start.py                # Quick start script
```

---

## 🔒 API Endpoints (47+)

| Category | Endpoints | Key Routes |
|----------|-----------|------------|
| **Agents** | 8 | CRUD, kill switch, status |
| **Events** | 5 | Log, list, audit trail |
| **Violations** | 4 | Track, list, severity filter |
| **Approvals** | 4 | HITL workflow, approve/reject |
| **Governance** | 3 | Score computation, dimensions |
| **Behavioral DNA** | 3 | Fingerprinting, drift detection |
| **Threat Intel** | 3 | Pattern detection, threat feed |
| **Compliance** | 3 | Multi-framework assessment |
| **Insurance** | 2 | Risk scoring, premium calc |
| **Sandbox** | 3 | Simulate, history, scenarios |
| **War Room** | 5 | Incidents, notes, timeline |
| **Copilot** | 2 | Natural language queries |
| **Multi-Agent** | 4 | Flow logging, inter-agent policies |

Full API docs at: `http://localhost:8000/docs` (Swagger UI)

---

## 🧪 Verification

```bash
# Run E2E verification suite (42/43 tests passing — 97%)
python agents/run_full_verification.py

# Run enterprise agent test (requires Ollama)
python agents/ollama/run_enterprise.py
```

---

## 🏢 Enterprise Use Cases

| Industry | Use Case | How Velyrion Helps |
|----------|----------|-------------------|
| **Finance** | AI trading agents | Kill switch + compliance audit |
| **Healthcare** | AI diagnostic agents | HIPAA compliance + data source validation |
| **SaaS** | Customer support bots | Tool whitelisting + HITL approval |
| **DevOps** | AI code reviewers | Behavioral DNA + drift detection |
| **Legal** | Contract analysis agents | Audit trail + regulatory compliance |

---

## 🗺️ Roadmap

- [x] Core governance engine (17 features)
- [x] 39-page dashboard
- [x] Python SDK
- [x] Real AI agent testing (Ollama)
- [x] E2E verification suite
- [ ] Multi-tenant support
- [ ] SSO/SAML integration
- [ ] Real-time WebSocket dashboard
- [ ] Slack/Discord webhook alerts
- [ ] Terraform provider for policy-as-code

---

## 📄 License

Proprietary. © 2026 Velyrion. All rights reserved.

---

<p align="center">
  <strong>Velyrion — Because AI agents need governance, not just guardrails.</strong>
</p>
