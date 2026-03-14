"""Pydantic schemas for VELYRION API request/response models."""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Agent ──────────────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    agent_name: str
    owner_email: str
    department: str
    allowed_tools: list[str] = []
    allowed_data_sources: list[str] = []
    max_token_budget: int = 100000
    max_task_duration_seconds: int = 300
    requires_human_approval_for: list[str] = []
    compliance_frameworks: list[str] = []


class AgentUpdate(BaseModel):
    agent_name: Optional[str] = None
    owner_email: Optional[str] = None
    department: Optional[str] = None
    allowed_tools: Optional[list[str]] = None
    allowed_data_sources: Optional[list[str]] = None
    max_token_budget: Optional[int] = None
    max_task_duration_seconds: Optional[int] = None
    requires_human_approval_for: Optional[list[str]] = None
    compliance_frameworks: Optional[list[str]] = None


class AgentResponse(BaseModel):
    agent_id: str
    agent_name: str
    owner_email: str
    department: str
    allowed_tools: list[str]
    allowed_data_sources: list[str]
    max_token_budget: int
    max_task_duration_seconds: int
    requires_human_approval_for: list[str]
    compliance_frameworks: list[str]
    status: str
    tokens_used: int
    total_cost_usd: float
    total_actions: int
    total_violations: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Event / Audit Log ──────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    agent_id: str
    agent_name: str = ""
    task_description: str
    tool_used: str
    input_data: str = ""
    output_data: str = ""
    confidence_score: float = Field(1.0, ge=0.0, le=1.0)
    duration_ms: int = 0
    token_cost: int = 0
    compute_cost_usd: float = 0.0
    human_in_loop: bool = False


class EventResponse(BaseModel):
    event_id: str
    timestamp: datetime
    agent_id: str
    agent_name: str
    task_description: str
    tool_used: str
    input_data: str
    output_data: str
    confidence_score: float
    duration_ms: int
    token_cost: int
    compute_cost_usd: float
    human_in_loop: bool
    risk_level: str

    class Config:
        from_attributes = True


# ── Violation ──────────────────────────────────────────────────────────────────

class ViolationResponse(BaseModel):
    violation_id: str
    timestamp: datetime
    agent_id: str
    event_id: Optional[str]
    violation_type: str
    description: str
    severity: str
    action_taken: str
    resolved: bool

    class Config:
        from_attributes = True


# ── Anomaly ────────────────────────────────────────────────────────────────────

class AnomalyResponse(BaseModel):
    anomaly_id: str
    timestamp: datetime
    agent_id: str
    event_id: Optional[str]
    anomaly_type: str
    description: str
    risk_level: str

    class Config:
        from_attributes = True


# ── Incident ───────────────────────────────────────────────────────────────────

class IncidentResponse(BaseModel):
    incident_id: str
    timestamp: datetime
    agent_id: str
    violation_type: str
    severity: str
    system_action: str
    agent_state_snapshot: str
    resolution_status: str

    class Config:
        from_attributes = True


# ── Approval Request ───────────────────────────────────────────────────────────

class ApprovalRequestResponse(BaseModel):
    request_id: str
    timestamp: datetime
    agent_id: str
    task_description: str
    action_context: str
    reason: str
    status: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApprovalDecision(BaseModel):
    reviewed_by: str = "system_admin"


# ── Alert ──────────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    alert_id: str
    timestamp: datetime
    alert_type: str
    agent_id: str
    event_description: str
    risk_level: str
    action_taken: str
    human_action_required: str
    channel: str
    delivered: bool

    class Config:
        from_attributes = True


# ── Dashboard ──────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_agents: int = 0
    active_agents: int = 0
    locked_agents: int = 0
    total_events: int = 0
    total_violations: int = 0
    total_anomalies: int = 0
    total_incidents: int = 0
    pending_approvals: int = 0
    total_cost_usd: float = 0.0
    violations_by_severity: dict = {}
    events_last_24h: int = 0


class AgentHealthScore(BaseModel):
    agent_id: str
    agent_name: str
    health_score: float = Field(ge=0.0, le=100.0)
    total_actions: int
    total_violations: int
    total_cost_usd: float
    status: str


class AgentCostData(BaseModel):
    agent_id: str
    agent_name: str
    tokens_used: int
    max_token_budget: int
    total_cost_usd: float
    budget_usage_pct: float


# ── Compliance Report ──────────────────────────────────────────────────────────

class ComplianceReport(BaseModel):
    report_period: str
    total_agent_actions: int = 0
    policy_violations: dict = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    human_interventions: int = 0
    cost_per_agent: list[dict] = []
    top_performing_agents: list[dict] = []
    underperforming_agents: list[dict] = []
    department_risk_scores: list[dict] = []
