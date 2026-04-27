"""
Policy — Local policy evaluation for offline/fast governance.

Loads YAML policy files and evaluates them against agent actions locally,
before sending to the VELYRION API for remote evaluation.
"""

import yaml
import logging
from typing import Any, Optional
from pathlib import Path

logger = logging.getLogger("velyrion")


class PolicyViolation:
    """A policy rule that was violated."""
    def __init__(self, rule_name: str, action: str, severity: str, message: str):
        self.rule_name = rule_name
        self.action = action  # BLOCK, WARN, REQUIRE_APPROVAL, KILL
        self.severity = severity
        self.message = message

    def __repr__(self):
        return f"PolicyViolation({self.rule_name}: {self.action} [{self.severity}])"


class Policy:
    """
    Load and evaluate YAML-based governance policies.

    Usage:
        policy = Policy.from_file("policies/finance-agents.yaml")
        violations = policy.evaluate(agent_id="agent-002", tool="admin_console", tokens=5000)
    """

    def __init__(self, name: str, version: str, agents: list[str], rules: list[dict]):
        self.name = name
        self.version = version
        self.agents = agents  # Which agent IDs this policy applies to
        self.rules = rules

    @classmethod
    def from_file(cls, path: str) -> "Policy":
        """Load a policy from a YAML file."""
        with open(path, "r") as f:
            data = yaml.safe_load(f)

        policy_data = data.get("policy", data)
        return cls(
            name=policy_data.get("name", "unnamed"),
            version=policy_data.get("version", "1.0"),
            agents=policy_data.get("agents", ["*"]),
            rules=policy_data.get("rules", []),
        )

    @classmethod
    def from_dict(cls, data: dict) -> "Policy":
        """Create a policy from a dictionary."""
        policy_data = data.get("policy", data)
        return cls(
            name=policy_data.get("name", "unnamed"),
            version=policy_data.get("version", "1.0"),
            agents=policy_data.get("agents", ["*"]),
            rules=policy_data.get("rules", []),
        )

    def applies_to(self, agent_id: str) -> bool:
        """Check if this policy applies to the given agent."""
        return "*" in self.agents or agent_id in self.agents

    def evaluate(
        self,
        agent_id: str,
        tool: str = "",
        task: str = "",
        confidence: float = 1.0,
        tokens: int = 0,
        duration_ms: int = 0,
        cost_usd: float = 0.0,
        data_sources: Optional[list[str]] = None,
        allowed_tools: Optional[list[str]] = None,
        allowed_data_sources: Optional[list[str]] = None,
        max_token_budget: int = 999999999,
        actions_last_hour: int = 0,
        **extra_context,
    ) -> list[PolicyViolation]:
        """
        Evaluate all rules against the given action context.
        Returns a list of PolicyViolation for each rule that fails.
        """
        if not self.applies_to(agent_id):
            return []

        violations = []
        context = {
            "agent_id": agent_id,
            "tool_used": tool,
            "task": task.lower(),
            "confidence_score": confidence,
            "token_cost": tokens,
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "data_sources": data_sources or [],
            "allowed_tools": allowed_tools or [],
            "allowed_data_sources": allowed_data_sources or [],
            "max_token_budget": max_token_budget,
            "actions_last_hour": actions_last_hour,
            **extra_context,
        }

        for rule in self.rules:
            if self._evaluate_condition(rule.get("condition", ""), context):
                violations.append(PolicyViolation(
                    rule_name=rule.get("name", "unnamed_rule"),
                    action=rule.get("action", "WARN"),
                    severity=rule.get("severity", "MEDIUM"),
                    message=rule.get("message", f"Policy rule '{rule.get('name')}' violated"),
                ))

        return violations

    def _evaluate_condition(self, condition: str, context: dict) -> bool:
        """
        Evaluate a policy condition string.

        Supported operators:
          - NOT IN, IN (list membership)
          - >, <, >=, <=, == (comparison)
          - contains (substring match)
          - AND, OR (logical combination)
        """
        if not condition:
            return False

        condition = condition.strip()

        # Handle AND
        if " AND " in condition:
            parts = condition.split(" AND ")
            return all(self._evaluate_condition(p.strip(), context) for p in parts)

        # Handle OR
        if " OR " in condition:
            parts = condition.split(" OR ")
            return any(self._evaluate_condition(p.strip(), context) for p in parts)

        # Resolve variable references
        try:
            # "tool_used NOT IN agent.allowed_tools"
            if " NOT IN " in condition:
                left, right = condition.split(" NOT IN ", 1)
                left_val = self._resolve(left.strip(), context)
                right_val = self._resolve(right.strip(), context)
                if isinstance(right_val, list):
                    return left_val not in right_val
                return str(left_val) not in str(right_val)

            # "tool_used IN agent.allowed_tools"
            if " IN " in condition:
                left, right = condition.split(" IN ", 1)
                left_val = self._resolve(left.strip(), context)
                right_val = self._resolve(right.strip(), context)
                if isinstance(right_val, list):
                    return left_val in right_val
                return str(left_val) in str(right_val)

            # "task contains 'transaction'"
            if " contains " in condition:
                left, right = condition.split(" contains ", 1)
                left_val = str(self._resolve(left.strip(), context)).lower()
                right_val = right.strip().strip("'\"").lower()
                return right_val in left_val

            # Comparison operators
            for op in [">=", "<=", "!=", ">", "<", "=="]:
                if f" {op} " in condition:
                    left, right = condition.split(f" {op} ", 1)
                    left_val = self._resolve(left.strip(), context)
                    right_val = self._resolve(right.strip(), context)

                    # Type coercion
                    try:
                        left_val = float(left_val)
                        right_val = float(right_val)
                    except (ValueError, TypeError):
                        left_val = str(left_val)
                        right_val = str(right_val)

                    if op == ">": return left_val > right_val
                    if op == "<": return left_val < right_val
                    if op == ">=": return left_val >= right_val
                    if op == "<=": return left_val <= right_val
                    if op == "==": return left_val == right_val
                    if op == "!=": return left_val != right_val

        except Exception as e:
            logger.debug(f"Policy condition eval error: {condition} → {e}")
            return False

        return False

    def _resolve(self, ref: str, context: dict) -> Any:
        """Resolve a variable reference from the context."""
        # Direct context lookup
        if ref in context:
            return context[ref]

        # Dotted notation: "agent.allowed_tools"
        if ref.startswith("agent."):
            key = ref.replace("agent.", "")
            if key in context:
                return context[key]

        # Numeric literal
        try:
            return float(ref)
        except ValueError:
            pass

        # String literal
        if ref.startswith("'") or ref.startswith('"'):
            return ref.strip("'\"")

        return ref

    def to_dict(self) -> dict:
        """Serialize policy to dict."""
        return {
            "policy": {
                "name": self.name,
                "version": self.version,
                "agents": self.agents,
                "rules": self.rules,
            }
        }

    def to_yaml(self) -> str:
        """Serialize policy to YAML string."""
        return yaml.dump(self.to_dict(), default_flow_style=False)
