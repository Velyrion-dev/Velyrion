"""
VELYRION SDK — Connect any AI agent to the Velyrion Governance Platform.

Usage:
    from velyrion_sdk import VelyrionAgent

    agent = VelyrionAgent(
        api_url="http://localhost:8000",
        agent_id="agent-001",
    )

    # Every tool call goes through Velyrion
    result = agent.execute(
        tool="database_query",
        task="Fetch user records",
        input_data="SELECT * FROM users",
    )

    if result.allowed:
        # Do the actual work
        ...
    else:
        print(f"BLOCKED: {result.reason}")
"""

import time
import uuid
import httpx
import json
from dataclasses import dataclass, field
from typing import Any
from datetime import datetime


@dataclass
class ExecutionResult:
    """Result of a governed execution."""
    allowed: bool
    event_id: str = ""
    risk_level: str = "LOW"
    reason: str = ""
    policy_result: str = "ALLOWED"
    duration_ms: int = 0
    token_cost: int = 0
    compute_cost_usd: float = 0.0


@dataclass
class AgentStatus:
    """Current agent status from platform."""
    status: str = "ACTIVE"
    should_kill: bool = False
    should_pause: bool = False


class VelyrionAgent:
    """
    Velyrion-governed AI agent wrapper.

    Every tool call is logged, policy-checked, and governed by the Velyrion platform.
    If the platform blocks an action, the agent stops before executing.
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        agent_id: str = "",
        agent_name: str = "",
        api_key: str = "",
        fail_mode: str = "closed",  # "closed" = stop if can't reach Velyrion, "open" = continue
        verbose: bool = True,
    ):
        self.api_url = api_url.rstrip("/")
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.api_key = api_key
        self.fail_mode = fail_mode
        self.verbose = verbose
        self.client = httpx.Client(timeout=10.0)
        self.session_events: list[dict] = []
        self.total_tokens = 0
        self.total_cost = 0.0
        self.total_actions = 0
        self.violations = 0

        self._headers = {"Content-Type": "application/json"}
        if api_key:
            self._headers["x-api-key"] = api_key

    def log(self, msg: str, level: str = "INFO"):
        if self.verbose:
            icon = {"INFO": "ℹ️", "WARN": "⚠️", "ERROR": "❌", "OK": "✅", "BLOCK": "🚫"}.get(level, "•")
            print(f"  {icon} [{self.agent_name or self.agent_id}] {msg}")

    # ── Core: Execute a governed action ──────────────────────────────────────

    def execute(
        self,
        tool: str,
        task: str,
        input_data: str = "",
        output_data: str = "",
        confidence: float = 0.95,
        token_cost: int = 100,
        human_in_loop: bool = False,
    ) -> ExecutionResult:
        """
        Execute a tool call through Velyrion governance.

        1. Check agent status (is it killed/paused?)
        2. Log the event to Velyrion
        3. If policy blocks it → return blocked result
        4. If allowed → return success (caller does actual work)
        """
        start = time.time()

        # Step 1: Check if agent is still alive
        status = self.check_status()
        if status.should_kill:
            self.log(f"KILLED by platform — cannot execute '{tool}'", "BLOCK")
            return ExecutionResult(allowed=False, reason="Agent has been killed by governance platform")
        if status.should_pause:
            self.log(f"PAUSED by platform — cannot execute '{tool}'", "BLOCK")
            return ExecutionResult(allowed=False, reason="Agent is paused pending review")

        # Step 2: Send event to Velyrion
        duration_ms = 0
        compute_cost = round(token_cost * 0.00001, 6)

        event_payload = {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name or self.agent_id,
            "task_description": task,
            "tool_used": tool,
            "input_data": input_data[:500],
            "output_data": output_data[:500],
            "confidence_score": confidence,
            "token_cost": token_cost,
            "compute_cost_usd": compute_cost,
            "duration_ms": 0,
            "human_in_loop": human_in_loop,
            "risk_level": self._assess_risk(tool, confidence, token_cost),
        }

        try:
            resp = self.client.post(
                f"{self.api_url}/api/agent/event",
                json=event_payload,
                headers=self._headers,
            )
            duration_ms = int((time.time() - start) * 1000)
            event_payload["duration_ms"] = duration_ms

            if resp.status_code in (200, 201):
                data = resp.json()
                event_id = data.get("event_id", "")
                risk = data.get("risk_level", "LOW")

                self.total_tokens += token_cost
                self.total_cost += compute_cost
                self.total_actions += 1
                self.session_events.append(event_payload)

                self.log(f"✓ {tool} — {task[:60]} ({risk}, {duration_ms}ms)", "OK")
                return ExecutionResult(
                    allowed=True, event_id=event_id, risk_level=risk,
                    policy_result="ALLOWED", duration_ms=duration_ms,
                    token_cost=token_cost, compute_cost_usd=compute_cost,
                )

            elif resp.status_code == 403:
                # Governance platform BLOCKED the action — this is working correctly
                data = resp.json()
                reason = data.get("detail", "Action blocked by policy")
                self.total_actions += 1
                self.violations += 1
                self.session_events.append({**event_payload, "blocked": True})

                self.log(f"BLOCKED: {tool} — {reason}", "BLOCK")
                return ExecutionResult(
                    allowed=False, risk_level="HIGH",
                    reason=reason, policy_result="BLOCKED",
                    duration_ms=duration_ms, token_cost=token_cost,
                    compute_cost_usd=compute_cost,
                )
            else:
                self.log(f"API error: {resp.status_code} — {resp.text[:100]}", "ERROR")
                return self._fail_result(tool, duration_ms)

        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            self.log(f"Connection error: {e}", "ERROR")
            return self._fail_result(tool, duration_ms)

    # ── Status Check ─────────────────────────────────────────────────────────

    def check_status(self) -> AgentStatus:
        """Check if this agent is still allowed to operate."""
        try:
            resp = self.client.get(
                f"{self.api_url}/api/agents/{self.agent_id}/status",
                headers=self._headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return AgentStatus(
                    status=data.get("status", "ACTIVE"),
                    should_kill=data.get("should_kill", False),
                    should_pause=data.get("should_pause", False),
                )
        except Exception:
            pass
        return AgentStatus()

    # ── Session Summary ──────────────────────────────────────────────────────

    def summary(self) -> dict:
        """Get session summary."""
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "total_actions": self.total_actions,
            "total_tokens": self.total_tokens,
            "total_cost_usd": round(self.total_cost, 4),
            "violations": self.violations,
            "events_logged": len(self.session_events),
        }

    def print_summary(self):
        """Print formatted session summary."""
        s = self.summary()
        print(f"\n{'='*50}")
        print(f"  SESSION SUMMARY — {s['agent_name']}")
        print(f"{'='*50}")
        print(f"  Actions:    {s['total_actions']}")
        print(f"  Tokens:     {s['total_tokens']:,}")
        print(f"  Cost:       ${s['total_cost_usd']:.4f}")
        print(f"  Violations: {s['violations']}")
        print(f"  Events:     {s['events_logged']}")
        print(f"{'='*50}\n")

    # ── Internal Helpers ─────────────────────────────────────────────────────

    def _assess_risk(self, tool: str, confidence: float, token_cost: int) -> str:
        """Local risk assessment before sending to server."""
        if confidence < 0.3:
            return "CRITICAL"
        if confidence < 0.5:
            return "HIGH"
        if tool in ("file_delete", "admin_access", "system_exec", "data_export"):
            return "HIGH"
        if token_cost > 5000:
            return "MEDIUM"
        return "LOW"

    def _fail_result(self, tool: str, duration_ms: int) -> ExecutionResult:
        """Handle failure based on fail_mode."""
        if self.fail_mode == "closed":
            self.log(f"FAIL-CLOSED: Blocking '{tool}' — cannot reach Velyrion", "BLOCK")
            return ExecutionResult(allowed=False, reason="Cannot reach governance platform (fail-closed)")
        else:
            self.log(f"FAIL-OPEN: Allowing '{tool}' — Velyrion unreachable (logging locally)", "WARN")
            self.session_events.append({"tool": tool, "status": "unmonitored"})
            return ExecutionResult(allowed=True, reason="Fail-open: unmonitored execution", duration_ms=duration_ms)

    def __del__(self):
        try:
            self.client.close()
        except Exception:
            pass
