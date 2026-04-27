# VELYRION — Agent Governance & Audit Intelligence System

> *"Datadog + Okta — built for the AI agent era."*

**VELYRION** is the governance layer for autonomous AI agents. Monitor, log, evaluate, and report on all AI agent activity across your organization — regardless of vendor or framework.

---

## 🚀 Quick Start

### Option 1: Automated Start (Recommended)

```bash
python start.py
```
This starts both backend (port 8000) and frontend (port 3000), seeds the database with demo data.

### Option 2: Docker

```bash
docker-compose up --build
```

### Option 3: Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py                     # Seed demo data + default users
uvicorn main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- -p 3000
```

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@velyrion.ai` | `admin123` |
| **Operator** | `operator@velyrion.ai` | `operator123` |
| **Viewer** | `viewer@velyrion.ai` | `viewer123` |

**URLs:**
- **Dashboard**: http://localhost:3000 → redirects to `/login`
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 📦 Architecture

| Layer | Stack |
|-------|-------|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy (async), SQLite/PostgreSQL |
| **Frontend** | Next.js 16, TypeScript, React 19 |
| **Auth** | JWT (access + refresh tokens), bcrypt, Google OAuth 2.0 |
| **Deployment** | Docker, Render, Railway, AWS, Vercel |

```
┌─────────────┐     JWT Bearer    ┌─────────────────┐     SQL     ┌──────────┐
│  Next.js UI │ ◄──────────────► │  FastAPI Backend │ ◄──────────► │ Database │
│  (port 3000)│                  │  (port 8000)     │              │ SQLite/  │
│             │                  │  • Auth           │              │ Postgres │
│  Login/     │                  │  • Governance     │              └──────────┘
│  Dashboard  │                  │  • Webhooks       │
└─────────────┘                  │  • Replay/Forensic│
                                  └─────────────────┘
                                          │
                                   ┌──────┴──────┐
                                   │ Webhook Dispatch│
                                   │ Slack / PagerDuty│
                                   └──────────────┘
```

---

## ✨ Features

### Core Governance (13 Modules)

| # | Module | Description |
|---|--------|-------------|
| 1 | **Authentication** | JWT tokens, Google OAuth, bcrypt passwords, RBAC |
| 2 | **Agent Registry** | CRUD with permission profiles, budgets, compliance frameworks |
| 3 | **Event Logging** | Immutable, append-only audit trail for every agent action |
| 4 | **Permission Engine** | Real-time validation — tools, data sources, budgets, durations |
| 5 | **Anomaly Detection** | 5 algorithms: duration, API failure, cost, confidence, data boundary |
| 6 | **Human-in-the-Loop** | Approval queue with approve/reject + toast notifications |
| 7 | **Incident Response** | Automated kill → snapshot → lock → alert → log workflow |
| 8 | **Alert System** | Multi-channel dispatch (Dashboard + Webhook) |
| 9 | **Policy-as-Code** | YAML-based guardrails with evaluate/test API |
| 10 | **Kill Switch** | Real-time Kill / Pause / Unlock agent controls |
| 11 | **Agent Replay** | Forensic timeline with step-by-step event reconstruction |
| 12 | **Webhook Engine** | Slack, PagerDuty, Custom HTTP with async dispatch |
| 13 | **Compliance Reports** | On-demand reports with dept risk scores + JSON export |

### Security & Production

- ✅ JWT authentication (15min access + 7-day refresh tokens)
- ✅ Google OAuth 2.0 integration
- ✅ Role-Based Access Control (Admin / Operator / Viewer)
- ✅ bcrypt password hashing (bcrypt 5.x compatible)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- ✅ Per-IP rate limiting (configurable RPM)
- ✅ Structured logging with request IDs
- ✅ Global error handling with incident logging
- ✅ CORS configuration via environment variables
- ✅ Auto-refresh tokens (every 12 minutes client-side)

### Frontend UX

- ✅ 14 polished pages with live data
- ✅ Glassmorphism login/signup with animated backgrounds
- ✅ User menu with avatar, role badge, sign-out
- ✅ Demo credentials panel on login page
- ✅ 10-second auto-refresh with live indicators
- ✅ Mobile responsive with sidebar toggle
- ✅ Toast notification system
- ✅ Search & filter bars on all data pages
- ✅ Empty state handling
- ✅ Marketing landing page with pricing

---

## 🔐 Authentication & RBAC

### Roles & Permissions

| Feature | Admin | Operator | Viewer |
|---------|:-----:|:--------:|:------:|
| View Dashboard / Data | ✅ | ✅ | ✅ |
| Kill / Pause / Unlock agents | ✅ | ❌ | ❌ |
| Create / Delete policies | ✅ | ❌ | ❌ |
| Register new agents | ✅ | ✅ | ❌ |
| Approve / Reject HITL | ✅ | ✅ | ❌ |
| Manage webhooks | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ✅ |

### Auth Flow

1. User visits any protected page → redirected to `/login`
2. Login with email/password or Google → receives JWT tokens
3. Access token (15min) sent as `Authorization: Bearer` on every API call
4. Refresh token (7 days) used to get new access tokens automatically
5. Logout revokes refresh token server-side

---

## 🔑 API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/login` | Email/password login → JWT tokens |
| `POST` | `/api/auth/google` | Google OAuth login |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Revoke refresh token |
| `GET` | `/api/auth/me` | Get current user profile |
| `PUT` | `/api/auth/me` | Update profile |
| `POST` | `/api/auth/forgot-password` | Send reset token |
| `POST` | `/api/auth/reset-password` | Reset password |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents` | Register agent |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/{id}` | Get agent detail |
| `PUT` | `/api/agents/{id}` | Update agent |
| `DELETE` | `/api/agents/{id}` | Deactivate agent |

### Agent Controls
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents/{id}/kill` | Kill agent (Admin only) |
| `POST` | `/api/agents/{id}/pause` | Pause agent (Admin only) |
| `POST` | `/api/agents/{id}/unlock` | Unlock agent (Admin only) |

### Events & Governance
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/event` | Ingest event |
| `GET` | `/api/events` | List audit events |
| `GET` | `/api/violations` | List violations |
| `GET` | `/api/anomalies` | List anomalies |
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents/{id}/resolve` | Resolve incident |
| `GET` | `/api/approvals` | List approvals |
| `POST` | `/api/approvals/{id}/approve` | Approve HITL |
| `POST` | `/api/approvals/{id}/reject` | Reject HITL |
| `GET` | `/api/alerts` | List alerts |

### Intelligence
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/replay/{agent_id}` | Forensic replay timeline |
| `GET` | `/api/replay/compare/{a}/{b}` | Compare two agents |

### Policies
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/policies` | List YAML policies |
| `GET` | `/api/policies/{name}` | Get policy detail |
| `POST` | `/api/policies/evaluate` | Test a policy rule |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/webhooks` | List webhooks |
| `POST` | `/api/webhooks` | Create webhook |
| `DELETE` | `/api/webhooks/{id}` | Delete webhook |
| `POST` | `/api/webhooks/{id}/toggle` | Enable/disable |
| `POST` | `/api/webhooks/{id}/test` | Send test payload |
| `GET` | `/api/webhooks/deliveries` | Delivery log |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/stats` | Dashboard stats |
| `GET` | `/api/dashboard/health` | Agent health scores |
| `GET` | `/api/dashboard/costs` | Token cost data |
| `GET` | `/api/reports/compliance` | Compliance report |

---

## ⚙️ Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`:

```bash
cp backend/.env.example backend/.env
```

### Required for Production

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *dev secret* | **CHANGE THIS** — 256-bit secret for JWT signing |
| `DATABASE_URL` | `sqlite+aiosqlite:///./velyrion.db` | Use `postgresql+asyncpg://...` for production |
| `CORS_ORIGINS` | `*` | Lock to your domain: `https://yourdomain.com` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `GOOGLE_CLIENT_ID` | *(empty)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(empty)* | Google OAuth client secret |
| `RATE_LIMIT_RPM` | `300` | Max requests per minute per IP |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL for frontend |

---

## 📁 Project Structure

```
velyrion/
├── backend/
│   ├── main.py              # FastAPI entry + middleware + security headers
│   ├── auth.py              # JWT, bcrypt, RBAC dependencies
│   ├── database.py          # Async SQLAlchemy engine
│   ├── models.py            # ORM models (9 tables: User, RefreshToken, Agent, etc.)
│   ├── schemas.py           # Pydantic schemas
│   ├── seed.py              # Demo data + default users
│   ├── .env.example         # Environment variable template
│   ├── requirements.txt     # Python dependencies
│   ├── engines/             # Governance engines
│   │   ├── permission_engine.py
│   │   ├── anomaly_engine.py
│   │   ├── incident_engine.py
│   │   └── alert_engine.py
│   ├── routers/             # API endpoints (14 modules)
│   │   ├── auth.py          # Signup, login, OAuth, refresh
│   │   ├── agents.py        # Agent CRUD
│   │   ├── events.py        # Event logging
│   │   ├── violations.py    # Violation tracking
│   │   ├── anomalies.py     # Anomaly detection
│   │   ├── incidents.py     # Incident response
│   │   ├── approvals.py     # HITL approvals
│   │   ├── alerts.py        # Alert dispatch
│   │   ├── dashboard.py     # Dashboard analytics
│   │   ├── reports.py       # Compliance reports
│   │   ├── policies.py      # Policy-as-Code
│   │   ├── controls.py      # Kill/Pause/Unlock
│   │   ├── replay.py        # Forensic replay
│   │   └── webhooks.py      # Webhook management
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # 14 pages
│   │   │   ├── login/       # Login page
│   │   │   ├── signup/      # Signup page
│   │   │   ├── dashboard/   # Governance dashboard
│   │   │   ├── agents/      # Agent registry + controls
│   │   │   ├── events/      # Activity feed
│   │   │   ├── violations/  # Violations
│   │   │   ├── anomalies/   # Anomalies
│   │   │   ├── incidents/   # Incidents
│   │   │   ├── approvals/   # HITL approvals
│   │   │   ├── alerts/      # Alert center
│   │   │   ├── policies/    # Policy management
│   │   │   ├── replay/      # Forensic replay
│   │   │   ├── webhooks/    # Webhook integrations
│   │   │   └── reports/     # Compliance reports
│   │   ├── components/      # Sidebar, UserMenu, Layout, Toasts
│   │   └── lib/
│   │       ├── api.ts       # Typed API client with Bearer auth
│   │       └── auth.tsx     # AuthProvider, useAuth, usePermissions
│   └── Dockerfile
├── sdk/
│   ├── velyrion/            # Python SDK for agent instrumentation
│   │   ├── client.py        # wrap(), report(), kill-switch listener
│   │   ├── decorators.py    # @governed, @track
│   │   └── policy.py        # YAML policy evaluator
│   ├── pyproject.toml       # pip install config
│   └── README.md            # SDK usage docs
├── policies/                # YAML policy definitions
│   ├── finance-agents.yaml  # Finance guardrails (6 rules)
│   └── soc2-compliance.yaml # SOC2 compliance (6 rules)
├── docker-compose.yml
├── start.py                 # One-command startup script
├── Procfile                 # Heroku/Render deployment
└── README.md
```

---

## 🚢 Deployment

### Render / Railway

1. Create a **Web Service** for the backend:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Set environment variables from `.env.example`

2. Create a **Static Site** or **Web Service** for the frontend:
   - Build: `npm run build`
   - Start: `npm start`
   - Set `NEXT_PUBLIC_API_URL=https://your-backend-url.com`

3. Set `JWT_SECRET` to a strong random string:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

4. Set `CORS_ORIGINS` to your frontend domain.

### Docker

```bash
docker-compose up --build -d
```

### Vercel (Frontend) + Render (Backend)

1. Deploy `frontend/` to Vercel
2. Deploy `backend/` to Render
3. Set `NEXT_PUBLIC_API_URL` in Vercel env vars
4. Set all backend env vars in Render

---

## 🧪 Python SDK

Install the SDK in your AI application:

```python
from velyrion import VelyrionClient

client = VelyrionClient(
    api_url="https://your-velyrion-api.com",
    api_key="your-api-key"
)

# Wrap any agent for governance
agent = client.wrap(your_langchain_agent, agent_id="agent-001")

# Use decorators for function-level control
@client.governed(agent_id="agent-001")
def process_data(data):
    return analyze(data)
```

See [SDK README](sdk/README.md) for full documentation.

---

## 📋 Compliance Ready

VELYRION maps to the audit requirements of:
- **EU AI Act 2025** — Article 14 (human oversight), Article 13 (transparency)
- **SEC AI Oversight** — Audit trail requirements
- **SOC2** — Trust Services Criteria
- **GDPR** — Data processing records
- **HIPAA** — Activity logging for healthcare AI

---

## ⚠️ Pre-Deployment Checklist

- [ ] Change `JWT_SECRET` from default to a strong random string
- [ ] Set `CORS_ORIGINS` to your production domain (not `*`)
- [ ] Switch `DATABASE_URL` to PostgreSQL for production
- [ ] Change default user passwords (`admin123`, etc.)
- [ ] Set up Google OAuth credentials if using Google Sign-In
- [ ] Configure webhook URLs for Slack/PagerDuty
- [ ] Review and customize YAML policies in `policies/`
- [ ] Run `python seed.py` to create initial admin user
- [ ] Set up HTTPS (handled by Render/Vercel/Cloudflare)
- [ ] Enable database backups

---

## License

MIT
