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
    RESOLUTION = "RESOLUTION"


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


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ── Users & Auth ───────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)  # null for Google-only users
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    role: Mapped[str] = mapped_column(SAEnum(UserRole), default=UserRole.VIEWER)
    google_id: Mapped[str] = mapped_column(String(255), nullable=True, unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_login: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


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
    # Cryptographic audit chain — tamper-proof logging
    event_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    previous_hash: Mapped[str] = mapped_column(String(64), default="")


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


# ══════════════════════════════════════════════════════════════════════════════
#  MOAT FEATURE MODELS
# ══════════════════════════════════════════════════════════════════════════════

# ── 1. Governance Score ────────────────────────────────────────────────────────

class GovernanceScore(Base):
    __tablename__ = "governance_scores"

    score_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    overall_score: Mapped[int] = mapped_column(Integer, default=0)
    grade: Mapped[str] = mapped_column(String(4), default="C")
    certified: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_score: Mapped[int] = mapped_column(Integer, default=0)
    cost_efficiency_score: Mapped[int] = mapped_column(Integer, default=0)
    budget_discipline_score: Mapped[int] = mapped_column(Integer, default=0)
    reliability_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_profile_score: Mapped[int] = mapped_column(Integer, default=0)
    track_record_score: Mapped[int] = mapped_column(Integer, default=0)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 2. Threat Intelligence ────────────────────────────────────────────────────

class ThreatPattern(Base):
    __tablename__ = "threat_patterns"

    pattern_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    pattern_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(SAEnum(RiskLevel), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    affected_agents: Mapped[dict] = mapped_column(JSON, default=list)
    mitigation: Mapped[str] = mapped_column(Text, default="")
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 3. Behavioral DNA ─────────────────────────────────────────────────────────

class BehavioralProfile(Base):
    __tablename__ = "behavioral_profiles"

    profile_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    fingerprint: Mapped[str] = mapped_column(String(32), nullable=False)
    drift_score: Mapped[float] = mapped_column(Float, default=0.0)
    traits: Mapped[dict] = mapped_column(JSON, default=list)  # [{name, value, baseline, deviation, status}]
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 4. Regulatory Autopilot ───────────────────────────────────────────────────

class RegulatoryAssessment(Base):
    __tablename__ = "regulatory_assessments"

    assessment_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    regulation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    regulation_name: Mapped[str] = mapped_column(String(128), nullable=False)
    compliance_rate: Mapped[int] = mapped_column(Integer, default=0)
    requirements: Mapped[dict] = mapped_column(JSON, default=list)  # [{name, status, detail}]
    assessed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 5. Trust Registry ─────────────────────────────────────────────────────────

class TrustRegistryEntry(Base):
    __tablename__ = "trust_registry"

    entry_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    trust_score: Mapped[int] = mapped_column(Integer, default=50)
    tier: Mapped[str] = mapped_column(String(32), default="bronze")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[dict] = mapped_column(JSON, default=list)
    integrations: Mapped[int] = mapped_column(Integer, default=0)
    last_audit: Mapped[datetime] = mapped_column(DateTime, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 6. Trust Mesh ─────────────────────────────────────────────────────────────

class TrustAgreement(Base):
    __tablename__ = "trust_agreements"

    agreement_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    org_a: Mapped[str] = mapped_column(String(128), nullable=False)
    org_b: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    agent_count: Mapped[int] = mapped_column(Integer, default=0)
    shared_policies: Mapped[dict] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class CrossOrgEvent(Base):
    __tablename__ = "cross_org_events"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    from_org: Mapped[str] = mapped_column(String(128), nullable=False)
    from_agent: Mapped[str] = mapped_column(String(128), nullable=False)
    to_org: Mapped[str] = mapped_column(String(128), nullable=False)
    to_agent: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="governed")  # governed, blocked, pending


# ── 7. Insurance Scoring ──────────────────────────────────────────────────────

class InsuranceProfile(Base):
    __tablename__ = "insurance_profiles"

    profile_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=50)
    tier: Mapped[str] = mapped_column(String(32), default="moderate")
    premium_estimate: Mapped[float] = mapped_column(Float, default=1000.0)
    annual_savings: Mapped[float] = mapped_column(Float, default=0.0)
    factors: Mapped[dict] = mapped_column(JSON, default=list)  # [{name, impact, weight, detail}]
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 10. Simulation Sandbox ────────────────────────────────────────────────────

class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    run_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    scenario_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    grade: Mapped[str] = mapped_column(String(4), default="F")
    violations_triggered: Mapped[dict] = mapped_column(JSON, default=list)
    actions_simulated: Mapped[int] = mapped_column(Integer, default=0)
    cost_simulated: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(32), default="LOW")
    recommendations: Mapped[dict] = mapped_column(JSON, default=list)
    ran_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ── 11. War Room ──────────────────────────────────────────────────────────────

class WarRoomIncident(Base):
    __tablename__ = "war_room_incidents"

    incident_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    violation_id: Mapped[str] = mapped_column(String(64), nullable=True)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(SAEnum(RiskLevel), default=RiskLevel.MEDIUM)
    status: Mapped[str] = mapped_column(String(32), default="investigating")
    assignee: Mapped[str] = mapped_column(String(128), default="Unassigned")
    timeline: Mapped[dict] = mapped_column(JSON, default=list)
    notes: Mapped[dict] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


# ── 12. Multi-Agent Protocol ─────────────────────────────────────────────────

class AgentFlow(Base):
    __tablename__ = "agent_flows"

    flow_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    from_agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    to_agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="governed")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)


class InterAgentPolicy(Base):
    __tablename__ = "inter_agent_policies"

    policy_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    rule: Mapped[str] = mapped_column(Text, nullable=False)
    enforcement: Mapped[str] = mapped_column(String(32), default="enforced")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
