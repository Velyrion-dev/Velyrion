# VELYRION Frontend — Governance Dashboard

> Next.js 16 + TypeScript + React 19 — The governance UI for VELYRION.

---

## Quick Start

```bash
npm install
npm run dev -- -p 3000
```

Open http://localhost:3000 → redirects to `/login`

---

## Requirements

- **Node.js** 18+
- **Backend API** running at `http://localhost:8000` (or set `NEXT_PUBLIC_API_URL`)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

For production (Vercel):
```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

---

## Authentication

The frontend uses JWT Bearer tokens stored in `localStorage`:

| Key | Purpose |
|-----|---------|
| `velyrion_access_token` | Short-lived access token (15 min) |
| `velyrion_refresh_token` | Long-lived refresh token (7 days) |
| `velyrion_user` | Cached user profile JSON |

Auto-refresh runs every 12 minutes via `AuthProvider`.

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@velyrion.com` | `admin123` |
| Operator | `operator@velyrion.com` | `operator123` |
| Viewer | `viewer@velyrion.com` | `viewer123` |

---

## Pages (14)

| Route | Page | Auth Required |
|-------|------|:-------------:|
| `/` | Marketing Landing Page | ❌ |
| `/login` | Login (email/password + Google) | ❌ |
| `/signup` | Registration with password strength meter | ❌ |
| `/dashboard` | Governance Dashboard (stats, health, costs) | ✅ |
| `/events` | Activity Feed (audit log) | ✅ |
| `/agents` | Agent Registry + Kill/Pause/Unlock controls | ✅ |
| `/policies` | Policy-as-Code viewer | ✅ |
| `/violations` | Violation log | ✅ |
| `/anomalies` | Anomaly detection | ✅ |
| `/incidents` | Incident response | ✅ |
| `/approvals` | Human-in-the-Loop queue | ✅ |
| `/alerts` | Alert center | ✅ |
| `/webhooks` | Webhook integrations | ✅ |
| `/replay` | Forensic agent replay | ✅ |
| `/reports` | Compliance reports | ✅ |

---

## RBAC — Role-Based UI Visibility

| UI Element | Admin | Operator | Viewer |
|------------|:-----:|:--------:|:------:|
| All dashboard data | ✅ | ✅ | ✅ |
| Kill / Pause / Unlock buttons | ✅ | ❌ | ❌ |
| Register Agent button | ✅ | ✅ | ❌ |
| Add / Delete / Toggle webhook | ✅ | ❌ | ❌ |
| Approve / Reject HITL | ✅ | ✅ | ❌ |

Use `usePermissions()` from `@/lib/auth`:

```tsx
import { usePermissions } from "@/lib/auth";

function MyComponent() {
  const { canKillAgents, isAdmin } = usePermissions();
  if (!canKillAgents) return <span>Read-only</span>;
  return <button>⛔ Kill</button>;
}
```

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout + AuthProvider wrapper
│   │   ├── globals.css       # Design system (1700+ lines)
│   │   ├── page.tsx          # Landing page (public)
│   │   ├── login/page.tsx    # Login page (public)
│   │   ├── signup/page.tsx   # Signup page (public)
│   │   ├── dashboard/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── events/page.tsx
│   │   ├── violations/page.tsx
│   │   ├── anomalies/page.tsx
│   │   ├── incidents/page.tsx
│   │   ├── approvals/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── policies/page.tsx
│   │   ├── replay/page.tsx
│   │   ├── webhooks/page.tsx
│   │   └── reports/page.tsx
│   ├── components/
│   │   ├── ConditionalLayout.tsx  # Auth guard + sidebar layout
│   │   ├── Sidebar.tsx            # Navigation + UserMenu
│   │   ├── UserMenu.tsx           # Avatar dropdown + sign out
│   │   └── ToastProvider.tsx      # Toast notification system
│   └── lib/
│       ├── api.ts            # Typed API client (40+ methods, auto Bearer)
│       └── auth.tsx          # AuthProvider, useAuth, usePermissions
├── next.config.ts
├── package.json
├── tsconfig.json
├── vercel.json               # Vercel deployment config
└── Dockerfile
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/auth.tsx` | AuthProvider context, JWT token management, auto-refresh, `useAuth()`, `usePermissions()` |
| `lib/api.ts` | 40+ typed API methods, auto-injects `Authorization: Bearer` header |
| `components/ConditionalLayout.tsx` | Redirects unauthenticated users to `/login`, shows loading spinner |
| `components/UserMenu.tsx` | Sidebar user avatar + role badge + dropdown (Profile, API Keys, Sign Out) |
| `globals.css` | Complete design system: variables, cards, tables, auth pages, user menu |

---

## Build & Deploy

### Development
```bash
npm run dev -- -p 3000
```

### Production Build
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
npx vercel --prod
```

Or connect GitHub repo → auto-deploys on push to `main`.

---

## Design System

All UI uses CSS custom properties defined in `globals.css`:

```css
--bg-primary: #0a0e1a;      /* Main background */
--bg-card: #1a1f35;          /* Card background */
--accent-cyan: #06b6d4;     /* Primary accent */
--accent-purple: #8b5cf6;   /* Secondary accent */
--accent-red: #ef4444;       /* Danger */
--accent-green: #22c55e;     /* Success */
--accent-yellow: #fbbf24;    /* Warning */
```

Font: **Inter** (Google Fonts) — weights 400–800.
