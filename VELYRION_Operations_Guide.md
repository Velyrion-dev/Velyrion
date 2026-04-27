# VELYRION — Operations Guide

> Day-to-day operations, monitoring, maintenance, and incident response procedures.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Authentication & User Management](#2-authentication--user-management)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Agent Management](#4-agent-management)
5. [Policy-as-Code Engine](#5-policy-as-code-engine)
6. [Webhook & Alerting](#6-webhook--alerting)
7. [Incident Response Procedures](#7-incident-response-procedures)
8. [Monitoring & Health Checks](#8-monitoring--health-checks)
9. [Database Operations](#9-database-operations)
10. [SDK Integration Guide](#10-sdk-integration-guide)
11. [API Authentication](#11-api-authentication)
12. [Backup & Recovery](#12-backup--recovery)
13. [Scaling & Performance](#13-scaling--performance)
14. [Security Operations](#14-security-operations)
15. [Common Operations Runbook](#15-common-operations-runbook)

---

## 1. System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              CLIENT LAYER                     │
                    │                                              │
                    │   Browser (Next.js)    Python SDK             │
                    │   ┌──────────┐         ┌──────────┐         │
                    │   │ Login    │         │ wrap()   │          │
                    │   │ Dashboard│         │ @governed│          │
                    │   │ Agents   │         │ @track   │          │
                    │   └────┬─────┘         └────┬─────┘         │
                    └────────┼────────────────────┼────────────────┘
                             │ JWT Bearer         │ API Key
                    ┌────────┴────────────────────┴────────────────┐
                    │              API LAYER (FastAPI)              │
                    │                                              │
                    │  Auth │ Agents │ Events │ Controls │ Webhooks│
                    │  ─────┼────────┼────────┼──────────┼─────── │
                    │  Policies │ Replay │ Reports │ Alerts       │
                    └────────────────────┬─────────────────────────┘
                                         │
                    ┌────────────────────┴─────────────────────────┐
                    │              ENGINE LAYER                     │
                    │                                              │
                    │  Permission │ Anomaly │ Incident │ Alert     │
                    │  Engine     │ Engine  │ Engine   │ Engine    │
                    └────────────────────┬─────────────────────────┘
                                         │
                    ┌────────────────────┴─────────────────────────┐
                    │              DATA LAYER                       │
                    │                                              │
                    │  SQLite (dev) / PostgreSQL (prod)            │
                    │  9 tables: User, RefreshToken, Agent,        │
                    │  AuditLog, Violation, Anomaly, Incident,     │
                    │  ApprovalRequest, Alert                      │
                    └──────────────────────────────────────────────┘
```

### Key URLs

| Service | Local | Production |
|---------|-------|------------|
| Frontend | http://localhost:3000 | https://your-app.vercel.app |
| Backend API | http://localhost:8000 | https://your-api.railway.app |
| API Docs | http://localhost:8000/docs | https://your-api.railway.app/docs |
| Health Check | http://localhost:8000/health | https://your-api.railway.app/health |

---

## 2. Authentication & User Management

### Token Lifecycle

```
Login → Access Token (15 min) + Refresh Token (7 days)
         │
         ├─ Every API call: Authorization: Bearer <access_token>
         │
         ├─ Every 12 min: Client auto-refreshes access token
         │
         └─ Logout: Refresh token revoked server-side
```

### Default Accounts

| Role | Email | Password | Change On First Login |
|------|-------|----------|:---------------------:|
| Admin | admin@velyrion.ai | admin123 | **YES** |
| Operator | operator@velyrion.ai | operator123 | **YES** |
| Viewer | viewer@velyrion.ai | viewer123 | **YES** |

### Create New Users

**Via API:**
```bash
curl -X POST https://your-api/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@company.com",
    "password": "SecurePassword123!"
  }'
```

**Via UI:** Navigate to `/signup` and fill the registration form.

> **Note:** New users are assigned the `VIEWER` role by default. An admin must manually update the role in the database to promote to `OPERATOR` or `ADMIN`.

### Password Reset Flow

1. User clicks "Forgot password?" on login page
2. System generates a reset token (logged to console in dev, email in prod)
3. User submits new password with the reset token
4. All existing refresh tokens for that user are revoked

---

## 3. Role-Based Access Control (RBAC)

### Permission Matrix

| Action | Admin | Operator | Viewer |
|--------|:-----:|:--------:|:------:|
| View dashboard & all data | ✅ | ✅ | ✅ |
| View agent details | ✅ | ✅ | ✅ |
| View audit logs & events | ✅ | ✅ | ✅ |
| View compliance reports | ✅ | ✅ | ✅ |
| View forensic replay | ✅ | ✅ | ✅ |
| Register new agents | ✅ | ✅ | ❌ |
| Approve / Reject HITL requests | ✅ | ✅ | ❌ |
| Export reports | ✅ | ✅ | ❌ |
| Kill / Pause / Unlock agents | ✅ | ❌ | ❌ |
| Create / Delete policies | ✅ | ❌ | ❌ |
| Create / Delete / Toggle webhooks | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

### Backend Enforcement

Protected endpoints use the `require_role()` dependency:

```python
from auth import require_role
from models import UserRole

@router.post("/agents/{agent_id}/kill")
async def kill_agent(
    agent_id: str,
    user: User = Depends(require_role(UserRole.ADMIN))
):
    ...
```

### Frontend Enforcement

UI components use the `usePermissions()` hook:

```tsx
import { usePermissions } from "@/lib/auth";

function AgentControls() {
  const { canKillAgents } = usePermissions();
  
  if (!canKillAgents) return <span>Read-only</span>;
  return <button>⛔ Kill Agent</button>;
}
```

---

## 4. Agent Management

### Agent Lifecycle

```
REGISTERED → ACTIVE → PAUSED → ACTIVE (resume)
                ↓
              LOCKED (kill) → ACTIVE (unlock)
```

### Agent Controls

| Action | API Call | Who Can Do It |
|--------|---------|:-------------:|
| **Kill** (emergency stop) | `POST /api/agents/{id}/kill` | Admin |
| **Pause** (temporary halt) | `POST /api/agents/{id}/pause` | Admin |
| **Unlock** (resume) | `POST /api/agents/{id}/unlock` | Admin |

### Kill Switch — How It Works

1. Admin clicks **⛔ Kill** on agents page
2. Backend sets agent status to `LOCKED`
3. If SDK is connected, agent receives kill signal via heartbeat
4. An `AGENT_KILLED` event is logged to audit trail
5. Agent cannot perform any actions until unlocked

### Register a New Agent

```bash
curl -X POST https://your-api/api/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "DataProcessor v2",
    "owner_email": "team@company.com",
    "department": "Engineering",
    "allowed_tools": ["database_query", "api_call"],
    "allowed_data_sources": ["postgres_main"],
    "max_token_budget": 500000,
    "max_task_duration_seconds": 600,
    "compliance_frameworks": ["SOC2", "GDPR"]
  }'
```

---

## 5. Policy-as-Code Engine

### Policy File Format

Policies are defined in YAML files in the `policies/` directory:

```yaml
# policies/finance-agents.yaml
name: Finance Agent Guardrails
version: "1.0"
description: Rules for agents accessing financial data

rules:
  - id: max-transaction
    description: Reject transactions above $10,000
    condition: "event.amount > 10000"
    action: BLOCK
    severity: CRITICAL

  - id: require-approval
    description: Flag high-value operations for review
    condition: "event.amount > 5000"
    action: FLAG
    severity: HIGH
```

### Policy Operations

| Action | API | Description |
|--------|-----|-------------|
| List policies | `GET /api/policies` | All loaded YAML policies |
| View policy | `GET /api/policies/{name}` | Single policy with rules |
| Test a rule | `POST /api/policies/evaluate` | Dry-run evaluation |

### Adding a New Policy

1. Create a YAML file in `policies/` directory
2. Follow the schema: `name`, `version`, `description`, `rules[]`
3. Each rule needs: `id`, `description`, `condition`, `action`, `severity`
4. Restart the backend — policies are loaded on startup

---

## 6. Webhook & Alerting

### Supported Channels

| Channel | Use Case | URL Format |
|---------|----------|------------|
| **Slack** | Team notifications | `https://hooks.slack.com/services/T.../B.../xxx` |
| **PagerDuty** | Critical incident alerts | `https://events.pagerduty.com/v2/enqueue` |
| **Custom HTTP** | Any endpoint | `https://your-api.com/webhook` |

### Webhook Events

| Event Type | Trigger |
|------------|---------|
| `VIOLATION` | Policy violation detected |
| `INCIDENT` | Incident created or escalated |
| `ANOMALY` | Anomalous agent behavior |
| `HITL_REQUIRED` | Human approval needed |

### Severity Filtering

Each webhook can filter by severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

Example: Only send `CRITICAL` + `HIGH` alerts to PagerDuty:

```bash
curl -X POST https://your-api/api/webhooks \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PagerDuty Critical Alerts",
    "url": "https://events.pagerduty.com/v2/enqueue",
    "channel": "pagerduty",
    "events": ["INCIDENT", "VIOLATION"],
    "severity_filter": ["CRITICAL", "HIGH"]
  }'
```

### Testing Webhooks

```bash
curl -X POST https://your-api/api/webhooks/{id}/test \
  -H "Authorization: Bearer <admin-token>"
# → {"success": true, "message": "Test payload sent"}
```

### Webhook Delivery Monitoring

```bash
curl https://your-api/api/webhooks/deliveries?limit=20 \
  -H "Authorization: Bearer <token>"
```

Dashboard: `/webhooks` page shows delivery success rates and failure counts.

---

## 7. Incident Response Procedures

### Automated Incident Flow

When a critical event is detected:

```
1. Anomaly/Violation detected
   ↓
2. Incident Engine evaluates severity
   ↓
3. If CRITICAL: auto-create Incident
   ↓
4. Agent auto-killed + locked
   ↓
5. State snapshot captured
   ↓
6. Alert dispatched (dashboard + webhooks)
   ↓
7. Audit log entry created
   ↓
8. Human review required → HITL queue
```

### Manual Incident Response

1. **Identify** — Check `/alerts` page for new critical alerts
2. **Contain** — Kill the agent from `/agents` page (⛔ Kill button)
3. **Investigate** — Use `/replay` page for forensic timeline
4. **Remediate** — Update policy or agent config
5. **Resolve** — Mark incident as resolved via `/incidents` page
6. **Post-mortem** — Export compliance report from `/reports`

### Resolving an Incident

```bash
curl -X POST https://your-api/api/incidents/{id}/resolve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"resolution_notes": "Root cause: excessive API calls. Fixed rate limit."}'
```

---

## 8. Monitoring & Health Checks

### Health Endpoint

```bash
curl https://your-api/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "2.0.0",
  "timestamp": "2026-04-12T14:00:00Z"
}
```

### Key Metrics to Monitor

| Metric | Where to Check | Healthy Range |
|--------|---------------|---------------|
| API response time | `X-Response-Time` header | < 200ms |
| Error rate | Railway logs | < 1% |
| Active agents | `/api/dashboard/stats` | Matches expected |
| Webhook success rate | `/webhooks` page | > 95% |
| Token cost | Dashboard | Within budget |
| Database size | Railway metrics | Growth < 10%/week |

### Log Format

All backend logs follow structured JSON format:

```
2026-04-12 14:00:00 | INFO  | velyrion | [req-abc123] POST /api/auth/login — 200 — 45ms
2026-04-12 14:00:01 | WARN  | velyrion | [req-def456] Rate limit approached for 192.168.1.1
2026-04-12 14:00:02 | ERROR | velyrion | [req-ghi789] Unhandled exception in /api/agents
```

### Setting Up External Monitoring

**Uptime monitoring** (recommended):
- [UptimeRobot](https://uptimerobot.com) — Free, monitors `/health`
- [Better Uptime](https://betteruptime.com) — Status pages

**Error tracking** (optional):
- Sentry: Add `sentry-sdk[fastapi]` to requirements
- Datadog: Use their Python APM agent

---

## 9. Database Operations

### View Database Stats

```bash
# SQLite
sqlite3 velyrion.db "SELECT name, COUNT(*) FROM sqlite_master WHERE type='table' GROUP BY type;"

# Count records
sqlite3 velyrion.db "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'agents', COUNT(*) FROM agents UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;"
```

### Re-seed Database

```bash
# Delete existing data and re-seed
rm velyrion.db
python seed.py
```

### Promote User Role (Direct DB)

```bash
# SQLite
sqlite3 velyrion.db "UPDATE users SET role='ADMIN' WHERE email='jane@company.com';"

# PostgreSQL
psql $DATABASE_URL -c "UPDATE users SET role='ADMIN' WHERE email='jane@company.com';"
```

---

## 10. SDK Integration Guide

### Installation

```bash
pip install ./sdk
# or from your repo:
pip install git+https://github.com/YOUR_USERNAME/velyrion.git#subdirectory=sdk
```

### Basic Usage

```python
from velyrion import VelyrionClient

client = VelyrionClient(
    api_url="https://your-api.railway.app",
    api_key="your-api-key"
)

# Wrap any agent for automatic governance
governed_agent = client.wrap(
    your_agent,
    agent_id="agent-001"
)

# Use decorators
@client.governed(agent_id="agent-002")
def process_data(data):
    return analyze(data)

@client.track(agent_id="agent-002")
def call_api(url):
    return requests.get(url)
```

### Kill Switch Integration

The SDK includes a heartbeat that checks for kill signals:

```python
# Automatic — wrap() includes built-in heartbeat
agent = client.wrap(your_agent, agent_id="agent-001")

# Manual check
if client.is_killed("agent-001"):
    print("Agent has been killed — stopping execution")
    sys.exit(1)
```

---

## 11. API Authentication

### Browser Authentication (JWT)

```
POST /api/auth/login
Body: {"email": "...", "password": "..."}
Response: {"access_token": "eyJ...", "refresh_token": "eyJ..."}

All subsequent requests:
Headers: Authorization: Bearer <access_token>
```

### SDK / Machine Authentication (API Key)

```
Headers: x-api-key: <your-api-key>
```

Set `VELYRION_API_KEY` environment variable to enable.

### Token Refresh

```
POST /api/auth/refresh
Body: {"refresh_token": "eyJ..."}
Response: {"access_token": "new-eyJ...", "refresh_token": "new-eyJ..."}
```

Client auto-refreshes every 12 minutes. Manual refresh needed only if both tokens expire.

---

## 12. Backup & Recovery

### SQLite Backups

```bash
# Simple file copy
cp velyrion.db velyrion.db.backup.$(date +%Y%m%d)

# Automated daily backup (cron)
0 2 * * * cp /app/velyrion.db /backups/velyrion.db.$(date +\%Y\%m\%d)
```

### PostgreSQL Backups

```bash
# Full dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260412.sql
```

### Railway Automatic Backups

Railway PostgreSQL includes automatic daily backups with 7-day retention on paid plans.

---

## 13. Scaling & Performance

### Current Capacity (Single Instance)

| Metric | Capacity |
|--------|----------|
| Concurrent users | ~100 |
| API requests/min | 300 (rate limited) |
| Events/second | ~50 |
| Database size | Up to 1 GB (SQLite) |

### Scaling Strategies

| Bottleneck | Solution |
|------------|----------|
| API throughput | Increase `RATE_LIMIT_RPM`, add workers: `uvicorn --workers 4` |
| Database | Switch from SQLite to PostgreSQL |
| Concurrent users | Deploy frontend to CDN (Vercel does this automatically) |
| Event ingestion | Add Redis queue for async processing |
| Storage | Implement log rotation / archival policy |

---

## 14. Security Operations

### Security Headers (Auto-applied)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `X-Request-ID` | UUID | Trace requests across logs |
| `X-Response-Time` | `45ms` | Performance monitoring |

### Rotating JWT Secret

1. Generate new secret: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Update `JWT_SECRET` env var in Railway
3. Redeploy backend
4. All existing sessions are invalidated — users must re-login

### Revoking All Sessions

```bash
# Delete all refresh tokens (forces everyone to re-login)
sqlite3 velyrion.db "DELETE FROM refresh_tokens;"
# or PostgreSQL:
psql $DATABASE_URL -c "DELETE FROM refresh_tokens;"
```

### Blocking a User

```bash
# Lock out a specific user
sqlite3 velyrion.db "DELETE FROM refresh_tokens WHERE user_id='<user_id>';"
```

---

## 15. Common Operations Runbook

### ▶️ Start the System (Local)

```bash
python start.py
# Or manually:
cd backend && uvicorn main:app --port 8000 --reload
cd frontend && npm run dev -- -p 3000
```

### 🔄 Reset Demo Data

```bash
cd backend
rm velyrion.db
python seed.py
```

### 👤 Add Admin User via CLI

```bash
python -c "
import asyncio
from database import engine, async_session, Base
from models import User, UserRole
from auth import hash_password

async def add():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as db:
        user = User(
            user_id='user-custom-admin',
            email='newadmin@company.com',
            name='New Admin',
            password_hash=hash_password('StrongPassword123!'),
            role=UserRole.ADMIN,
            email_verified=True,
        )
        db.add(user)
        await db.commit()
        print('Admin user created')

asyncio.run(add())
"
```

### 📊 Generate Compliance Report

```bash
curl https://your-api/api/reports/compliance \
  -H "Authorization: Bearer <token>" | python -m json.tool
```

### 🧪 Send Test Event via SDK

```bash
cd backend
python simulate.py http://localhost:8000
# Sends continuous events simulating real agent activity
```

### 🔍 Forensic Investigation

1. Go to `/replay` page
2. Select the agent to investigate
3. View step-by-step timeline of all actions
4. Click on any event for full detail (inputs, outputs, timestamps)
5. Use `/replay/compare/{agent_a}/{agent_b}` to compare agent behavior

### 🚨 Emergency: Kill All Agents

```bash
curl https://your-api/api/agents -H "Authorization: Bearer <admin-token>" | \
  python -c "
import json, sys, requests
agents = json.load(sys.stdin)
for a in agents:
    if a['status'] == 'ACTIVE':
        r = requests.post(f'https://your-api/api/agents/{a[\"agent_id\"]}/kill',
            json={'reason': 'Emergency shutdown'},
            headers={'Authorization': 'Bearer <admin-token>'})
        print(f'Killed {a[\"agent_name\"]}: {r.status_code}')
"
```
