"""SQLAlchemy ORM models for VELYRION."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Float, Integer, Boolean, DateTime, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
import enum


# ── Enums ──────────────────────────────────────────────────────────────────────

class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnomalyType(str, enum.Enum):
    DURATION = "DURATION"
    API_FAILURE = "API_FAILURE"
    DATA_BOUNDARY = "DATA_BOUNDARY"
    CONFIDENCE = "CONFIDENCE"
    COST = "COST"


class AlertType(str, enum.Enum):
    VIOLATION = "VIOLATION"
    ANOMALY = "ANOMALY"
    HITL_REQUIRED = "HITL_REQUIRED"
    INCIDENT = "INCIDENT"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AgentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    DEACTIVATED = "DEACTIVATED"


class ResolutionStatus(str, enum.Enum):
    LOCKED_PENDING_REVIEW = "LOCKED_PENDING_REVIEW"
    RESOLVED = "RESOLVED"


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Agent Registry ─────────────────────────────────────────────────────────────

class Agent(Base):
    __tablename__ = "agents"

    agent_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_email: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(128), nullable=False)
    allowed_tools: Mapped[dict] = mapped_column(JSON, default=list)
    allowed_data_sources: Mapped[dict] = mapped_column(JSON, default=list)
    max_token_budget: Mapped[int] = mapped_column(Integer, default=100000)
    max_task_duration_seconds: Mapped[int] = mapped_column(Integer, default=300)
    requires_human_approval_for: Mapped[dict] = mapped_column(JSON, default=list)
    compliance_frameworks: Mapped[dict] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(
        SAEnum(AgentStatus), default=AgentStatus.ACTIVE
    )
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_actions: Mapped[int] = mapped_column(Integer, default=0)
    total_violations: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


# ── Audit Log (append-only) ───────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    tool_used: Mapped[str] = mapped_column(String(255), nullable=False)
    input_data: Mapped[str] = mapped_column(Text, default="")
    output_data: Mapped[str] = mapped_column(Text, default="")
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    token_cost: Mapped[int] = mapped_column(Integer, default=0)
    compute_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    human_in_loop: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_level: Mapped[str] = mapped_column(
        SAEnum(RiskLevel), default=RiskLevel.LOW
    )


# ── Violations ─────────────────────────────────────────────────────────────────

class Violation(Base):
    __tablename__ = "violations"

    violation_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(64), nullable=True)
    violation_type: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(SAEnum(RiskLevel), nullable=False)
    action_taken: Mapped[str] = mapped_column(String(255), default="BLOCKED")
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)


# ── Anomalies ──────────────────────────────────────────────────────────────────

class Anomaly(Base):
    __tablename__ = "anomalies"

    anomaly_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(64), nullable=True)
    anomaly_type: Mapped[str] = mapped_column(SAEnum(AnomalyType), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(SAEnum(RiskLevel), default=RiskLevel.MEDIUM)


# ── Incidents ──────────────────────────────────────────────────────────────────

class Incident(Base):
    __tablename__ = "incidents"

    incident_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    violation_type: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(
        SAEnum(RiskLevel), default=RiskLevel.CRITICAL
    )
    system_action: Mapped[str] = mapped_column(String(255), default="PROCESS_TERMINATED")
    agent_state_snapshot: Mapped[str] = mapped_column(Text, default="{}")
    resolution_status: Mapped[str] = mapped_column(
        SAEnum(ResolutionStatus), default=ResolutionStatus.LOCKED_PENDING_REVIEW
    )


# ── Approval Requests (HITL) ──────────────────────────────────────────────────

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    request_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    action_context: Mapped[str] = mapped_column(Text, default="{}")
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum(ApprovalStatus), default=ApprovalStatus.PENDING
    )
    reviewed_by: Mapped[str] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


# ── Alerts ─────────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    alert_type: Mapped[str] = mapped_column(SAEnum(AlertType), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_description: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(SAEnum(RiskLevel), nullable=False)
    action_taken: Mapped[str] = mapped_column(String(255), nullable=False)
    human_action_required: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(64), default="DASHBOARD")
    delivered: Mapped[bool] = mapped_column(Boolean, default=True)
