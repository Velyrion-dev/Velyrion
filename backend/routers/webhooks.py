"""Webhook & Alerting Router — Slack, Email, and custom webhook integrations."""

import asyncio
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Alert
from pydantic import BaseModel

logger = logging.getLogger("velyrion.webhooks")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# ── In-memory webhook config (in production, store in DB) ────────────────

_webhook_configs: list[dict] = []


class WebhookConfig(BaseModel):
    name: str
    url: str
    channel: str = "custom"  # slack, email, pagerduty, custom
    events: list[str] = ["VIOLATION", "INCIDENT", "ANOMALY", "HITL_REQUIRED"]
    severity_filter: list[str] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    enabled: bool = True
    headers: dict[str, str] = {}
    slack_channel: str = ""  # For Slack: #ai-governance


class WebhookConfigResponse(BaseModel):
    id: int
    name: str
    url: str
    channel: str
    events: list[str]
    severity_filter: list[str]
    enabled: bool
    deliveries: int
    failures: int


class WebhookTestResult(BaseModel):
    success: bool
    status_code: int | None = None
    message: str


class WebhookDeliveryLog(BaseModel):
    webhook_name: str
    event_type: str
    status: str
    response_code: int | None = None
    timestamp: str


# ── Track delivery stats ────────────────────────────────────────────────

_delivery_stats: dict[int, dict] = {}  # webhook_id -> {deliveries, failures}


# ── CRUD Endpoints ──────────────────────────────────────────────────────

@router.get("", response_model=list[WebhookConfigResponse])
async def list_webhooks():
    """List all configured webhooks."""
    result = []
    for i, wh in enumerate(_webhook_configs):
        stats = _delivery_stats.get(i, {"deliveries": 0, "failures": 0})
        result.append(WebhookConfigResponse(
            id=i,
            name=wh["name"],
            url=wh["url"],
            channel=wh["channel"],
            events=wh["events"],
            severity_filter=wh["severity_filter"],
            enabled=wh["enabled"],
            deliveries=stats["deliveries"],
            failures=stats["failures"],
        ))
    return result


@router.post("", status_code=201, response_model=WebhookConfigResponse)
async def create_webhook(config: WebhookConfig):
    """Register a new webhook endpoint."""
    idx = len(_webhook_configs)
    _webhook_configs.append(config.model_dump())
    _delivery_stats[idx] = {"deliveries": 0, "failures": 0}

    logger.info(f"Webhook registered: {config.name} → {config.url}")

    return WebhookConfigResponse(
        id=idx,
        name=config.name,
        url=config.url,
        channel=config.channel,
        events=config.events,
        severity_filter=config.severity_filter,
        enabled=config.enabled,
        deliveries=0,
        failures=0,
    )


@router.put("/{webhook_id}", response_model=WebhookConfigResponse)
async def update_webhook(webhook_id: int, config: WebhookConfig):
    """Update a webhook configuration."""
    if webhook_id < 0 or webhook_id >= len(_webhook_configs):
        raise HTTPException(404, "Webhook not found")

    _webhook_configs[webhook_id] = config.model_dump()
    stats = _delivery_stats.get(webhook_id, {"deliveries": 0, "failures": 0})

    return WebhookConfigResponse(
        id=webhook_id, **config.model_dump(),
        deliveries=stats["deliveries"], failures=stats["failures"],
    )


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: int):
    """Delete a webhook."""
    if webhook_id < 0 or webhook_id >= len(_webhook_configs):
        raise HTTPException(404, "Webhook not found")

    name = _webhook_configs[webhook_id]["name"]
    _webhook_configs[webhook_id]["enabled"] = False
    _webhook_configs[webhook_id]["name"] = f"[DELETED] {name}"
    return {"message": f"Webhook '{name}' deleted"}


@router.post("/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: int):
    """Enable/disable a webhook."""
    if webhook_id < 0 or webhook_id >= len(_webhook_configs):
        raise HTTPException(404, "Webhook not found")

    current = _webhook_configs[webhook_id]["enabled"]
    _webhook_configs[webhook_id]["enabled"] = not current
    status = "enabled" if not current else "disabled"
    return {"message": f"Webhook {status}", "enabled": not current}


# ── Test a webhook ──────────────────────────────────────────────────────

@router.post("/{webhook_id}/test", response_model=WebhookTestResult)
async def test_webhook(webhook_id: int):
    """Send a test payload to verify webhook connectivity."""
    if webhook_id < 0 or webhook_id >= len(_webhook_configs):
        raise HTTPException(404, "Webhook not found")

    wh = _webhook_configs[webhook_id]
    test_payload = _build_payload(
        channel=wh["channel"],
        event_type="TEST",
        agent_id="test-agent",
        agent_name="Test Agent",
        description="🧪 VELYRION webhook test — if you see this, integration is working!",
        severity="LOW",
        action_taken="TEST_DELIVERY",
    )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                wh["url"],
                json=test_payload,
                headers=wh.get("headers", {}),
            )
        success = 200 <= r.status_code < 300
        return WebhookTestResult(
            success=success,
            status_code=r.status_code,
            message="Test delivered successfully!" if success else f"Webhook returned {r.status_code}",
        )
    except httpx.TimeoutException:
        return WebhookTestResult(success=False, message="Webhook timed out (10s)")
    except Exception as e:
        return WebhookTestResult(success=False, message=f"Connection error: {str(e)}")


# ── Dispatch to all matching webhooks ───────────────────────────────────

async def dispatch_webhooks(
    event_type: str,
    agent_id: str,
    agent_name: str,
    description: str,
    severity: str,
    action_taken: str,
):
    """
    Fire webhooks for a governance event.
    Called by the alert engine when alerts are created.
    """
    matching = []
    for i, wh in enumerate(_webhook_configs):
        if not wh.get("enabled", True):
            continue
        if event_type not in wh.get("events", []):
            continue
        if severity not in wh.get("severity_filter", []):
            continue
        matching.append((i, wh))

    if not matching:
        return

    # Fire all webhooks concurrently
    tasks = [
        _send_webhook(i, wh, event_type, agent_id, agent_name, description, severity, action_taken)
        for i, wh in matching
    ]
    await asyncio.gather(*tasks, return_exceptions=True)


async def _send_webhook(
    idx: int, wh: dict,
    event_type: str, agent_id: str, agent_name: str,
    description: str, severity: str, action_taken: str,
):
    """Send a single webhook delivery."""
    payload = _build_payload(
        channel=wh["channel"],
        event_type=event_type,
        agent_id=agent_id,
        agent_name=agent_name,
        description=description,
        severity=severity,
        action_taken=action_taken,
    )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                wh["url"],
                json=payload,
                headers=wh.get("headers", {}),
            )

        if idx not in _delivery_stats:
            _delivery_stats[idx] = {"deliveries": 0, "failures": 0}

        if 200 <= r.status_code < 300:
            _delivery_stats[idx]["deliveries"] += 1
            logger.info(f"Webhook '{wh['name']}' delivered: {event_type} [{severity}]")
        else:
            _delivery_stats[idx]["failures"] += 1
            logger.warning(f"Webhook '{wh['name']}' failed: HTTP {r.status_code}")

    except Exception as e:
        if idx not in _delivery_stats:
            _delivery_stats[idx] = {"deliveries": 0, "failures": 0}
        _delivery_stats[idx]["failures"] += 1
        logger.error(f"Webhook '{wh['name']}' error: {e}")


def _build_payload(
    channel: str, event_type: str, agent_id: str, agent_name: str,
    description: str, severity: str, action_taken: str,
) -> dict:
    """Build the webhook payload based on channel type."""
    from datetime import datetime, timezone

    base = {
        "source": "VELYRION",
        "event_type": event_type,
        "agent_id": agent_id,
        "agent_name": agent_name,
        "description": description,
        "severity": severity,
        "action_taken": action_taken,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Slack format
    if channel == "slack":
        emoji = {"CRITICAL": "🚨", "HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(severity, "ℹ️")
        return {
            "text": f"{emoji} *VELYRION Alert* — {event_type}",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"{emoji} VELYRION: {event_type}", "emoji": True},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Agent:*\n{agent_name} (`{agent_id}`)"},
                        {"type": "mrkdwn", "text": f"*Severity:*\n{severity}"},
                        {"type": "mrkdwn", "text": f"*Action:*\n{action_taken}"},
                        {"type": "mrkdwn", "text": f"*Time:*\n{base['timestamp'][:19]}"},
                    ],
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Details:*\n{description}"},
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View Dashboard"},
                            "url": "https://velyrion.com/dashboard",
                        },
                    ],
                },
            ],
        }

    # PagerDuty format
    if channel == "pagerduty":
        pd_severity = {"CRITICAL": "critical", "HIGH": "error", "MEDIUM": "warning", "LOW": "info"}.get(severity, "info")
        return {
            "routing_key": "",  # Set in headers or URL
            "event_action": "trigger",
            "payload": {
                "summary": f"VELYRION: {event_type} — {agent_name} ({severity})",
                "source": "velyrion",
                "severity": pd_severity,
                "custom_details": base,
            },
        }

    # Generic / custom webhook
    return base


# ── Get recent webhook deliveries from alerts table ─────────────────────

@router.get("/deliveries")
async def get_deliveries(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get recent alert deliveries (used as webhook delivery log)."""
    stmt = select(Alert).order_by(Alert.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    alerts = result.scalars().all()

    return [
        {
            "alert_id": a.alert_id,
            "type": a.alert_type.value if hasattr(a.alert_type, "value") else str(a.alert_type),
            "agent_id": a.agent_id,
            "description": a.event_description,
            "severity": a.risk_level.value if hasattr(a.risk_level, "value") else str(a.risk_level),
            "channel": a.channel,
            "delivered": a.delivered,
            "timestamp": a.timestamp.isoformat(),
        }
        for a in alerts
    ]
