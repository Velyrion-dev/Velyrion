"""Permission & Violation Engine — validates agent actions against registered profiles."""

from sqlalchemy.ext.asyncio import AsyncSession
from models import Agent, Violation, RiskLevel, AgentStatus
from schemas import EventCreate


async def check_permissions(
    db: AsyncSession, agent: Agent, event: EventCreate
) -> list[Violation]:
    """
    Validate an incoming event against the agent's registered permission profile.
    Returns a list of Violation model instances (unsaved) for any checks that fail.
    """
    violations: list[Violation] = []

    # 1. Agent locked/deactivated check
    if agent.status == AgentStatus.LOCKED:
        violations.append(Violation(
            agent_id=agent.agent_id,
            violation_type="LOCKED_AGENT_ACTION",
            description=f"Locked agent '{agent.agent_name}' attempted action. Agent is locked pending review.",
            severity=RiskLevel.CRITICAL,
            action_taken="BLOCKED",
        ))
        return violations  # Critical — don't check further

    if agent.status == AgentStatus.DEACTIVATED:
        violations.append(Violation(
            agent_id=agent.agent_id,
            violation_type="DEACTIVATED_AGENT_ACTION",
            description=f"Deactivated agent '{agent.agent_name}' attempted action.",
            severity=RiskLevel.HIGH,
            action_taken="BLOCKED",
        ))
        return violations

    # 2. Tool permission check
    if agent.allowed_tools and event.tool_used not in agent.allowed_tools:
        violations.append(Violation(
            agent_id=agent.agent_id,
            violation_type="TOOL_PERMISSION_DENIED",
            description=f"Agent '{agent.agent_name}' used tool '{event.tool_used}' outside allowed tools: {agent.allowed_tools}",
            severity=RiskLevel.MEDIUM,
            action_taken="BLOCKED",
        ))

    # 3. Data source permission check (check input data for data source refs)
    if agent.allowed_data_sources:
        input_lower = event.input_data.lower()
        for source in agent.allowed_data_sources:
            pass  # Allowed sources are OK
        # Check if input references unlisted sources (simplified heuristic)
        if event.tool_used.lower() in ["database_query", "api_call", "file_read"]:
            # Tool implies data access — flag if no data source matches
            source_match = any(
                src.lower() in input_lower for src in agent.allowed_data_sources
            )
            if not source_match and event.input_data:
                violations.append(Violation(
                    agent_id=agent.agent_id,
                    violation_type="DATA_SOURCE_PERMISSION_DENIED",
                    description=f"Agent '{agent.agent_name}' accessed data not in allowed sources: {agent.allowed_data_sources}",
                    severity=RiskLevel.HIGH,
                    action_taken="BLOCKED",
                ))

    # 4. Token budget check
    projected_usage = agent.tokens_used + event.token_cost
    if projected_usage > agent.max_token_budget:
        violations.append(Violation(
            agent_id=agent.agent_id,
            violation_type="TOKEN_BUDGET_EXCEEDED",
            description=f"Agent '{agent.agent_name}' token usage ({projected_usage}) exceeds budget ({agent.max_token_budget})",
            severity=RiskLevel.MEDIUM,
            action_taken="BLOCKED",
        ))

    # 5. Task duration check
    if event.duration_ms > agent.max_task_duration_seconds * 1000:
        violations.append(Violation(
            agent_id=agent.agent_id,
            violation_type="TASK_DURATION_EXCEEDED",
            description=f"Agent '{agent.agent_name}' task duration ({event.duration_ms}ms) exceeds max ({agent.max_task_duration_seconds * 1000}ms)",
            severity=RiskLevel.LOW,
            action_taken="FLAGGED",
        ))

    return violations


def has_critical_violation(violations: list[Violation]) -> bool:
    """Check if any violation is CRITICAL severity."""
    return any(v.severity == RiskLevel.CRITICAL for v in violations)


def has_blocking_violation(violations: list[Violation]) -> bool:
    """Check if any violation requires blocking the action."""
    return any(v.action_taken == "BLOCKED" for v in violations)
