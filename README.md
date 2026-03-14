# VELYRION — Agent Governance & Audit Intelligence System

> *"Datadog + Okta — built for the AI agent era."*

**VELYRION** is the governance layer for autonomous AI agents. Monitor, log, evaluate, and report on all AI agent activity across your organization — regardless of vendor or framework.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up --build
```

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Option 2: Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py                              # Populate demo data
uvicorn main:app --port 8000

# Frontend
cd frontend
npm install
npm run dev -- -p 3000
```

---

## 📦 Architecture

| Layer           | Stack                                                |
|-----------------|------------------------------------------------------|
| **Backend**     | Python FastAPI, SQLAlchemy (async), SQLite/PostgreSQL |
| **Frontend**    | Next.js 15, TypeScript, TailwindCSS                  |
| **Deployment**  | Docker + docker-compose                              |
| **Auth**        | API key header (`x-api-key`)                         |

---

## ✨ Product Features

### Core Modules (9)

| # | Module | Description |
|---|--------|-------------|
| 1 | **Agent Registry** | CRUD with permission profiles, budgets, compliance frameworks |
| 2 | **Event Logging** | Immutable, append-only audit trail for every agent action |
| 3 | **Permission Engine** | Real-time validation — tools, data sources, budgets, durations |
| 4 | **Anomaly Detection** | 5 algorithms: duration, API failure, cost, confidence, data boundary |
| 5 | **Human-in-the-Loop** | Approval queue with approve/reject + toast notifications |
| 6 | **Incident Response** | Automated kill → snapshot → lock → alert → log workflow |
| 7 | **Alert System** | Multi-channel dispatch (DB + email/Slack/webhook stubs) |
| 8 | **Compliance Reports** | On-demand reports with dept risk scores + JSON export |
| 9 | **Real-Time Dashboard** | 9 polished pages with live data, search, filters, auto-refresh |

### Production Features

- ✅ Structured logging with request IDs
- ✅ Per-IP rate limiting (configurable RPM)
- ✅ Optional API key authentication
- ✅ Global error handling with incident logging
- ✅ CORS configuration via environment variables
- ✅ Health check endpoint (`/health`)
- ✅ Response timing headers (`X-Response-Time`)
- ✅ Docker deployment with health checks
- ✅ Marketing landing page with pricing
- ✅ Toast notification system
- ✅ Search & filter bars on all data pages
- ✅ 10-second auto-refresh with live indicators
- ✅ Mobile responsive with sidebar toggle
- ✅ Empty state handling

---

## 🔑 API Reference

### System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | System info |
| `GET` | `/health` | Health check |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents` | Register agent |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/{id}` | Get agent detail |
| `PUT` | `/api/agents/{id}` | Update agent |
| `DELETE` | `/api/agents/{id}` | Deactivate agent |

### Events & Governance
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/event` | Ingest event (webhook) |
| `GET` | `/api/events` | List audit events |
| `GET` | `/api/violations` | List violations |
| `GET` | `/api/anomalies` | List anomalies |
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents/{id}/resolve` | Resolve incident |
| `GET` | `/api/approvals` | List approvals |
| `POST` | `/api/approvals/{id}/approve` | Approve HITL request |
| `POST` | `/api/approvals/{id}/reject` | Reject HITL request |
| `GET` | `/api/alerts` | List alerts |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/stats` | Dashboard stats |
| `GET` | `/api/dashboard/health` | Agent health scores |
| `GET` | `/api/dashboard/costs` | Token cost data |
| `GET` | `/api/reports/compliance` | Compliance report |

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./velyrion.db` | Database connection string |
| `VELYRION_API_KEY` | *(empty — no auth)* | API key for webhook auth |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `RATE_LIMIT_RPM` | `300` | Max requests per minute per IP |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL for frontend |

---

## 📁 Project Structure

```
velyrion/
├── backend/
│   ├── main.py              # FastAPI entry + middleware
│   ├── database.py          # Async SQLAlchemy engine
│   ├── models.py            # ORM models (7 tables)
│   ├── schemas.py           # Pydantic schemas
│   ├── seed.py              # Demo data seeder
│   ├── engines/             # Governance engines
│   │   ├── permission_engine.py
│   │   ├── anomaly_engine.py
│   │   ├── incident_engine.py
│   │   └── alert_engine.py
│   ├── routers/             # API endpoints (9 modules)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # 9 pages + landing page
│   │   ├── components/      # Sidebar, layout, toasts
│   │   └── lib/api.ts       # Typed API client
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 📋 Compliance Ready

VELYRION maps to the audit requirements of:
- **EU AI Act 2025** — Article 14 (human oversight), Article 13 (transparency)
- **SEC AI Oversight** — Audit trail requirements
- **SOC2** — Trust Services Criteria
- **GDPR** — Data processing records
- **HIPAA** — Activity logging for healthcare AI

---

## License

MIT
