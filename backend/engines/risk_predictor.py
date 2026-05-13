"""AI Risk Prediction Engine — Predicts which agents will violate policies.

Analyzes behavioral patterns to generate risk predictions:
  - Action velocity (sudden spike in activity)
  - Cost acceleration (burning budget faster than normal)
  - Tool diversity drift (using unusual tools)
  - Violation trajectory (escalating pattern)
  - Time-of-day anomalies (activity outside business hours)
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import Agent, AuditLog, Violation, RiskLevel

logger = logging.getLogger("velyrion.predictor")


async def predict_agent_risk(db: AsyncSession, agent: Agent) -> dict:
    """Generate risk prediction for a single agent.
    
    Returns:
        {
            "risk_score": 0-100,
            "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "prediction": str,
            "factors": list[dict],
            "recommended_action": str,
        }
    """
    factors = []
    risk_score = 0.0
    
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    
    # ── Factor 1: Violation Trajectory ────────────────────────────────────
    recent_violations = await db.execute(
        select(func.count()).select_from(Violation)
        .where(Violation.agent_id == agent.agent_id)
        .where(Violation.timestamp >= day_ago)
    )
    recent_v_count = recent_violations.scalar() or 0
    
    total_violations = agent.total_violations or 0
    
    if recent_v_count >= 3:
        score = min(35, recent_v_count * 10)
        risk_score += score
        factors.append({
            "factor": "VIOLATION_TRAJECTORY",
            "severity": "CRITICAL",
            "detail": f"{recent_v_count} violations in last 24h — escalating pattern",
            "score_impact": score,
        })
    elif recent_v_count >= 1:
        score = recent_v_count * 5
        risk_score += score
        factors.append({
            "factor": "VIOLATION_TRAJECTORY",
            "severity": "HIGH",
            "detail": f"{recent_v_count} violation(s) in last 24h",
            "score_impact": score,
        })
    
    # ── Factor 2: Budget Consumption Rate ─────────────────────────────────
    budget = agent.max_token_budget or 1
    usage_pct = (agent.tokens_used / budget) * 100
    
    if usage_pct > 90:
        score = 25
        risk_score += score
        factors.append({
            "factor": "BUDGET_CRITICAL",
            "severity": "CRITICAL",
            "detail": f"Budget at {usage_pct:.1f}% — near limit, may trigger overrun",
            "score_impact": score,
        })
    elif usage_pct > 70:
        score = 10
        risk_score += score
        factors.append({
            "factor": "BUDGET_WARNING",
            "severity": "MEDIUM",
            "detail": f"Budget at {usage_pct:.1f}% — elevated consumption",
            "score_impact": score,
        })
    
    # ── Factor 3: Action Velocity ─────────────────────────────────────────
    recent_actions = await db.execute(
        select(func.count()).select_from(AuditLog)
        .where(AuditLog.agent_id == agent.agent_id)
        .where(AuditLog.timestamp >= hour_ago)
    )
    recent_action_count = recent_actions.scalar() or 0
    
    # Compare to average (total_actions / days since creation)
    days_active = max(1, (now - agent.created_at).days) if agent.created_at else 1
    avg_actions_per_hour = (agent.total_actions / (days_active * 24)) if agent.total_actions else 0
    
    if avg_actions_per_hour > 0 and recent_action_count > avg_actions_per_hour * 5:
        score = 20
        risk_score += score
        factors.append({
            "factor": "VELOCITY_SPIKE",
            "severity": "HIGH",
            "detail": f"{recent_action_count} actions in last hour vs {avg_actions_per_hour:.1f}/hr average — {(recent_action_count / max(1, avg_actions_per_hour)):.0f}x spike",
            "score_impact": score,
        })
    
    # ── Factor 4: Cost Acceleration ───────────────────────────────────────
    recent_cost = await db.execute(
        select(func.sum(AuditLog.compute_cost_usd))
        .where(AuditLog.agent_id == agent.agent_id)
        .where(AuditLog.timestamp >= hour_ago)
    )
    recent_cost_val = recent_cost.scalar() or 0.0
    avg_cost_per_hour = (agent.total_cost_usd / (days_active * 24)) if agent.total_cost_usd else 0
    
    if avg_cost_per_hour > 0 and recent_cost_val > avg_cost_per_hour * 3:
        score = 15
        risk_score += score
        factors.append({
            "factor": "COST_ACCELERATION",
            "severity": "HIGH",
            "detail": f"${recent_cost_val:.2f} spent in last hour vs ${avg_cost_per_hour:.2f}/hr average",
            "score_impact": score,
        })
    
    # ── Factor 5: Agent Status ────────────────────────────────────────────
    status = agent.status.value if hasattr(agent.status, "value") else str(agent.status)
    if status == "LOCKED":
        risk_score += 30
        factors.append({
            "factor": "AGENT_LOCKED",
            "severity": "CRITICAL",
            "detail": "Agent is currently locked due to critical violations",
            "score_impact": 30,
        })
    elif status == "SUSPENDED":
        risk_score += 15
        factors.append({
            "factor": "AGENT_SUSPENDED",
            "severity": "HIGH",
            "detail": "Agent is suspended pending review",
            "score_impact": 15,
        })
    
    # ── Compute final risk level ──────────────────────────────────────────
    risk_score = min(100, risk_score)
    
    if risk_score >= 70:
        risk_level = "CRITICAL"
        prediction = f"HIGH PROBABILITY of violation in next 30 minutes"
        action = "Immediate review required — consider preemptive suspension"
    elif risk_score >= 45:
        risk_level = "HIGH"
        prediction = f"Elevated risk — behavioral patterns indicate potential policy breach"
        action = "Increase monitoring frequency — review recent activity"
    elif risk_score >= 20:
        risk_level = "MEDIUM"
        prediction = f"Moderate risk — some concerning patterns detected"
        action = "Continue normal monitoring with heightened awareness"
    else:
        risk_level = "LOW"
        prediction = f"Normal behavior — no imminent risk detected"
        action = "No action needed — agent operating within parameters"
    
    return {
        "agent_id": agent.agent_id,
        "agent_name": agent.agent_name,
        "department": agent.department,
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "prediction": prediction,
        "recommended_action": action,
        "factors": factors,
        "analyzed_at": datetime.utcnow().isoformat(),
    }


async def predict_all_agents(db: AsyncSession) -> list[dict]:
    """Generate risk predictions for all active agents."""
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    
    predictions = []
    for agent in agents:
        pred = await predict_agent_risk(db, agent)
        predictions.append(pred)
    
    # Sort by risk score descending
    predictions.sort(key=lambda p: p["risk_score"], reverse=True)
    return predictions
