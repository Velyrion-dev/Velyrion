"""VELYRION — Agent Governance & Audit Intelligence System — FastAPI Backend.

Production-grade entry point with structured logging, error handling,
API key authentication, rate limiting, and CORS.
"""

import os
import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_db

from routers import agents, events, violations, anomalies, incidents, approvals, alerts, dashboard, reports, policies, controls, replay, webhooks
from routers import auth as auth_router

# ── Structured Logging ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("velyrion")

# ── Configuration ───────────────────────────────────────────────────────────────

API_KEY = os.getenv("VELYRION_API_KEY", "")  # Optional — empty means no auth
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "300"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("VELYRION starting up — initializing database")
    await init_db()
    logger.info("Database initialized — system operational")
    yield
    logger.info("VELYRION shutting down")


app = FastAPI(
    title="VELYRION",
    description="Agent Governance & Audit Intelligence System — https://velyrion.ai",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware: CORS ────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Middleware: Request ID + Logging ────────────────────────────────────────────

rate_limit_store: dict[str, list[float]] = {}


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    # Generate request ID
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting (per-IP, sliding window)
    now = time.time()
    window = rate_limit_store.get(client_ip, [])
    window = [t for t in window if now - t < 60]
    if len(window) >= RATE_LIMIT_RPM:
        logger.warning(f"[{request_id}] Rate limit exceeded for {client_ip}")
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )
    window.append(now)
    rate_limit_store[client_ip] = window

    # API key auth (only for /api/ endpoints, skip docs)
    if API_KEY and request.url.path.startswith("/api/"):
        auth_header = request.headers.get("x-api-key", "")
        if auth_header != API_KEY:
            logger.warning(f"[{request_id}] Unauthorized API access attempt from {client_ip}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Set x-api-key header."},
            )

    # Process request
    try:
        response: Response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000)
        logger.error(f"[{request_id}] {request.method} {request.url.path} — ERROR in {duration_ms}ms: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "request_id": request_id,
            },
        )

    # Log completed request
    duration_ms = round((time.time() - start_time) * 1000)
    log_fn = logger.info if response.status_code < 400 else logger.warning
    log_fn(f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)")

    # Add response headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── Global Exception Handler ───────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. This incident has been logged.",
            "status_code": 500,
        },
    )


# ── Mount Routers ──────────────────────────────────────────────────────────────

app.include_router(agents.router)
app.include_router(events.router)
app.include_router(violations.router)
app.include_router(anomalies.router)
app.include_router(incidents.router)
app.include_router(approvals.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(policies.router)
app.include_router(controls.router)
app.include_router(replay.router)
app.include_router(webhooks.router)
app.include_router(auth_router.router)


# ── System Endpoints ───────────────────────────────────────────────────────────

@app.get("/", tags=["system"])
async def root():
    return {
        "system": "VELYRION",
        "version": "1.0.0",
        "description": "Agent Governance & Audit Intelligence System",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime": "operational",
    }
