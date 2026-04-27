# VELYRION — Deployment Guide

> Complete guide to deploying VELYRION from local development to production.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Deploy Backend to Railway](#3-deploy-backend-to-railway)
4. [Deploy Frontend to Vercel](#4-deploy-frontend-to-vercel)
5. [Docker Deployment](#5-docker-deployment)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Google OAuth Setup](#7-google-oauth-setup)
8. [Database Configuration](#8-database-configuration)
9. [SSL & Domain Configuration](#9-ssl--domain-configuration)
10. [Pre-Deployment Security Checklist](#10-pre-deployment-security-checklist)
11. [Post-Deployment Verification](#11-post-deployment-verification)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 18+ | Frontend build |
| Git | 2.x | Version control |
| Docker | 24+ | Container deployment (optional) |

---

## 2. Local Development Setup

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Section 6](#6-environment-variables-reference) for all options).

### Initialize Database & Seed Data

```bash
python seed.py
```

Output:
```
  → 3 users (admin/operator/viewer)
✓ Database seeded successfully!
  → 8 agents
  → 80 audit log events
  → 8 violations
  → 6 anomalies
  → 1 incident
  → 5 approval requests
  → 7 alerts
```

### Start Backend Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: http://localhost:8000/health

### Frontend

```bash
cd frontend
npm install
npm run dev -- -p 3000
```

Verify: http://localhost:3000 → redirects to `/login`

### One-Command Start (Dev)

```bash
python start.py
```

Starts both backend (8000) and frontend (3000) + runs seed if needed.

---

## 3. Deploy Backend to Railway

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "VELYRION v2.0 — production ready"
git remote add origin https://github.com/YOUR_USERNAME/velyrion.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) → Sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `velyrion` repository
4. Set configuration:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 3: Set Environment Variables

In Railway → your service → **Variables** tab:

```
JWT_SECRET=<generate-with-command-below>
DATABASE_URL=sqlite+aiosqlite:///./velyrion.db
CORS_ORIGINS=https://your-frontend.vercel.app
RATE_LIMIT_RPM=300
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

Generate a secure JWT secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4: Deploy

Click **Deploy** → Wait 2-3 minutes. Railway provides a URL:
```
https://velyrion-production-xxxx.up.railway.app
```

### Step 5: Seed Production Database

```bash
# Option A: Railway CLI
railway link
railway run python seed.py

# Option B: Add to Dockerfile (already included)
# The Dockerfile runs seed.py during build
```

### Step 6: Verify

```bash
curl https://YOUR-RAILWAY-URL/health
# Expected: {"status": "healthy", "database": "connected"}

curl https://YOUR-RAILWAY-URL/docs
# Opens Swagger UI
```

---

## 4. Deploy Frontend to Vercel

### Step 1: Import Project

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New"** → **"Project"**
3. Import your `velyrion` repository
4. Set configuration:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)

### Step 2: Set Environment Variables

```
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

### Step 3: Deploy

Click **Deploy** → Wait 2-3 minutes. Vercel provides a URL:
```
https://velyrion.vercel.app
```

### Step 4: Update Backend CORS

Go back to **Railway → Variables** and update:
```
CORS_ORIGINS=https://velyrion.vercel.app
```

Redeploy the backend service for changes to take effect.

---

## 5. Docker Deployment

### Development

```bash
docker-compose up --build
```

### Production

```bash
docker-compose -f docker-compose.yml up -d --build
```

### Individual Services

```bash
# Backend only
cd backend
docker build -t velyrion-api .
docker run -p 8000:8000 \
  -e JWT_SECRET=your-secret \
  -e DATABASE_URL=sqlite+aiosqlite:///./velyrion.db \
  velyrion-api

# Frontend only
cd frontend
docker build -t velyrion-ui .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://your-api:8000 \
  velyrion-ui
```

---

## 6. Environment Variables Reference

### Backend Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `JWT_SECRET` | **YES** | `velyrion-dev-secret...` | 256-bit secret for JWT signing. **MUST CHANGE for production.** |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token lifetime in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime in days |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./velyrion.db` | Database connection string |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed frontend origins |
| `RATE_LIMIT_RPM` | No | `300` | Max requests per minute per IP |
| `GOOGLE_CLIENT_ID` | No | *(empty)* | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | No | *(empty)* | Google OAuth 2.0 Client Secret |
| `VELYRION_API_KEY` | No | *(empty)* | Legacy API key for SDK/machine auth |

### Frontend Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `NEXT_PUBLIC_API_URL` | **YES** | `http://localhost:8000` | Backend API base URL |

---

## 7. Google OAuth Setup

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set Application Type: **Web application**

### Step 2: Configure Redirect URIs

| Setting | Value |
|---------|-------|
| **Authorized JavaScript Origins** | `https://velyrion.vercel.app` |
| **Authorized Redirect URIs** | `https://velyrion.vercel.app/login` |

For local development, also add:
- Origins: `http://localhost:3000`
- Redirects: `http://localhost:3000/login`

### Step 3: Set Environment Variables

```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

---

## 8. Database Configuration

### Development (SQLite)

```
DATABASE_URL=sqlite+aiosqlite:///./velyrion.db
```

### Production (PostgreSQL)

```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/velyrion
```

#### Railway PostgreSQL Add-on

1. In Railway → your project → **"+ New"** → **"Database"** → **PostgreSQL**
2. Railway auto-provides `DATABASE_URL` — link it to your backend service
3. Update backend requirements if using PostgreSQL:
   ```
   pip install asyncpg
   ```

#### External PostgreSQL (Supabase, Neon, etc.)

1. Get the connection string from your provider
2. Set `DATABASE_URL` in Railway/Vercel env vars
3. Ensure the string starts with `postgresql+asyncpg://`

---

## 9. SSL & Domain Configuration

### Automatic SSL

Railway and Vercel provide **automatic HTTPS** on their default domains.

### Custom Domain

#### Vercel (Frontend)

1. Vercel → your project → **Settings → Domains**
2. Add `app.yourdomain.com`
3. Add DNS records as instructed (CNAME or A record)

#### Railway (Backend)

1. Railway → your service → **Settings → Networking → Custom Domain**
2. Add `api.yourdomain.com`
3. Add CNAME record: `api.yourdomain.com` → your Railway domain

After adding custom domains, update:
- `CORS_ORIGINS` → `https://app.yourdomain.com`
- `NEXT_PUBLIC_API_URL` → `https://api.yourdomain.com`

---

## 10. Pre-Deployment Security Checklist

| # | Check | Critical? | How to Verify |
|---|-------|:---------:|---------------|
| 1 | `JWT_SECRET` changed from default | **YES** | `echo $JWT_SECRET` — should be 64+ char hex |
| 2 | `CORS_ORIGINS` set to your domain | **YES** | Not `*` in production |
| 3 | Default passwords changed | **YES** | Login, change via profile |
| 4 | HTTPS enabled | **YES** | Visit URL — should show 🔒 |
| 5 | Rate limiting active | Recommended | `RATE_LIMIT_RPM=300` |
| 6 | Database backups configured | Recommended | Provider dashboard |
| 7 | Google OAuth credentials secured | If used | Not in source code |
| 8 | `.env` not committed to Git | **YES** | Check `.gitignore` |

---

## 11. Post-Deployment Verification

### API Health

```bash
curl https://api.yourdomain.com/health
# → {"status": "healthy", "database": "connected"}
```

### Auth Flow

```bash
# Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velyrion.ai","password":"admin123"}'
# → {"access_token": "eyJ...", "refresh_token": "eyJ...", "user": {...}}

# Access protected endpoint
curl https://api.yourdomain.com/api/agents \
  -H "Authorization: Bearer eyJ..."
# → [list of agents]
```

### Frontend

1. Visit `https://app.yourdomain.com` → should redirect to `/login`
2. Login with `admin@velyrion.ai` / `admin123`
3. Verify dashboard loads with data
4. Check sidebar user menu shows "Admin User / ADMIN"
5. Verify Kill/Pause buttons visible (admin) or hidden (viewer)

### Security Headers

```bash
curl -I https://api.yourdomain.com/health
# Check for:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Referrer-Policy: strict-origin-when-cross-origin
```

---

## 12. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Login returns 401 | Wrong JWT_SECRET or expired token | Verify JWT_SECRET matches, clear localStorage |
| CORS errors in browser | CORS_ORIGINS doesn't match frontend URL | Set exact frontend URL (with https://, no trailing /) |
| Google OAuth fails | Wrong redirect URIs | Check Google Console — URIs must match exactly |
| Database empty after deploy | seed.py not run | `railway run python seed.py` |
| 500 errors | Python exception | Check Railway logs → Deployments → View Logs |
| Frontend blank page | Wrong API URL | Check `NEXT_PUBLIC_API_URL` env var in Vercel |
| Slow cold starts | Railway free tier sleep | Upgrade to paid plan or use `railway up --detach` |
| bcrypt errors | Wrong bcrypt version | Ensure `bcrypt>=4.0.0` in requirements.txt |
| Token refresh fails | Refresh token expired/revoked | Clear localStorage, login again |
| Rate limit hit | Too many requests | Increase `RATE_LIMIT_RPM` or add to allowlist |
