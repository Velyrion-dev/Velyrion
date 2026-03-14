"""Alert Engine — dispatches alerts to configured channels."""

from sqlalchemy.ext.asyncio import AsyncSession
from models import Alert, AlertType, RiskLevel


async def dispatch_alert(
    db: AsyncSession,
    alert_type: AlertType,
    agent_id: str,
    event_description: str,
    risk_level: RiskLevel,
    action_taken: str,
    human_action_required: str = "",
    channel: str = "DASHBOARD",
) -> Alert:
    """
    Create and dispatch an alert. In MVP, all alerts are stored in DB
    and visible via the dashboard. Stubs exist for email/Slack/webhook.
    """
    alert = Alert(
        alert_type=alert_type,
        agent_id=agent_id,
        event_description=event_description,
        risk_level=risk_level,
        action_taken=action_taken,
        human_action_required=human_action_required,
        channel=channel,
        delivered=True,
    )

    db.add(alert)
    await db.flush()

    # ── Stub: External channel delivery ──
    if channel == "EMAIL":
        _send_email_stub(agent_id, event_description)
    elif channel == "SLACK":
        _send_slack_stub(agent_id, event_description)
    elif channel == "WEBHOOK":
        _send_webhook_stub(agent_id, event_description)

    return alert


def _send_email_stub(agent_id: str, message: str) -> None:
    """Stub: Send alert via email (SMTP integration placeholder)."""
    pass


def _send_slack_stub(agent_id: str, message: str) -> None:
    """Stub: Send alert via Slack webhook (integration placeholder)."""
    pass


def _send_webhook_stub(agent_id: str, message: str) -> None:
    """Stub: Send alert via generic webhook (integration placeholder)."""
    pass
