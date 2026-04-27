"""
VelyrionClient — Core SDK client for agent governance.

Handles:
  - Event reporting to the VELYRION API
  - Agent wrapping (intercept tool calls)
  - Kill switch / heartbeat listener
  - Policy evaluation (local + remote)
"""

import json
import time
import uuid
import logging
import threading
import requests
from typing import Any, Callable, Optional
from functools import wraps

logger = logging.getLogger("velyrion")


class AgentKilledException(Exception):
    """Raised when VELYRION kills an agent mid-execution."""
    pass


class ActionBlockedException(Exception):
    """Raised when VELYRION blocks an agent action."""
    def __init__(self, reason: str, violation_type: str = ""):
        self.reason = reason
        self.violation_type = violation_type
        super().__init__(f"Action blocked: {reason}")


class VelyrionClient:
    """
    VELYRION SDK Client — governs AI agent actions.

    Usage:
        v = Velyrion(api_url="http://localhost:8000")

        # Option 1: Wrap an entire agent
        agent = v.wrap(agent, agent_id="agent-001")

        # Option 2: Decorate individual functions
        @v.track(agent_id="agent-001", tool="database_query")
        def query_database(sql):
            return db.execute(sql)

        # Option 3: Manual reporting
        result = v.report(
            agent_id="agent-001",
            task="Analyze customer data",
            tool="database_query",
            confidence=0.92,
            tokens=450,
        )
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        api_key: str = "",
        timeout: int = 10,
        block_on_violation: bool = True,
        log_level: str = "INFO",
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.block_on_violation = block_on_violation
        self._killed_agents: set[str] = set()
        self._paused_agents: set[str] = set()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._running = True

        logging.basicConfig(level=getattr(logging, log_level.upper(), logging.INFO))

    # ── Headers ──────────────────────────────────────────────────────────

    @property
    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["x-api-key"] = self.api_key
        return h

    # ── Health Check ─────────────────────────────────────────────────────

    def health(self) -> dict:
        """Check if the VELYRION API is reachable."""
        try:
            r = requests.get(f"{self.api_url}/health", timeout=self.timeout)
            return r.json()
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}

    # ── Core: Report an Event ────────────────────────────────────────────

    def report(
        self,
        agent_id: str,
        task: str,
        tool: str = "unknown",
        data_sources: Optional[list[str]] = None,
        input_data: str = "",
        output_data: str = "",
        confidence: float = 0.9,
        duration_ms: int = 0,
        tokens: int = 0,
        cost_usd: float = 0.0,
    ) -> dict:
        """
        Report an agent action to VELYRION for governance evaluation.

        Returns:
            dict with keys: event_id, risk_level, violations_triggered, blocked
        """
        # Check if agent is killed
        if agent_id in self._killed_agents:
            raise AgentKilledException(f"Agent {agent_id} has been terminated by VELYRION")

        # Check if agent is paused
        if agent_id in self._paused_agents:
            logger.warning(f"Agent {agent_id} is paused — waiting for unlock...")
            while agent_id in self._paused_agents and self._running:
                time.sleep(1)

        payload = {
            "agent_id": agent_id,
            "task_description": task[:500],
            "tool_used": tool,
            "data_sources_accessed": data_sources or [],
            "input_data": input_data[:1000],
            "output_data": output_data[:2000],
            "confidence_score": max(0.0, min(1.0, confidence)),
            "duration_ms": duration_ms,
            "token_cost": tokens,
            "compute_cost_usd": cost_usd,
        }

        try:
            r = requests.post(
                f"{self.api_url}/api/agent/event",
                json=payload,
                headers=self._headers,
                timeout=self.timeout,
            )

            if r.status_code in (200, 201):
                data = r.json()
                result = {
                    "event_id": data.get("event_id", ""),
                    "risk_level": data.get("risk_level", "LOW"),
                    "violations_triggered": 0,
                    "blocked": False,
                }
                logger.info(
                    f"[{agent_id}] {tool} → Risk: {result['risk_level']}"
                )
                return result

            elif r.status_code == 403:
                # Action was blocked by VELYRION
                detail = r.json().get("detail", "Action blocked")
                logger.warning(f"[{agent_id}] BLOCKED: {detail}")

                if "locked" in detail.lower() or "CRITICAL" in detail:
                    self._killed_agents.add(agent_id)

                if self.block_on_violation:
                    raise ActionBlockedException(detail)

                return {
                    "event_id": "",
                    "risk_level": "CRITICAL",
                    "violations_triggered": 1,
                    "blocked": True,
                    "detail": detail,
                }

            else:
                logger.error(f"[{agent_id}] API error: {r.status_code}")
                return {"error": r.status_code, "blocked": False}

        except (AgentKilledException, ActionBlockedException):
            raise
        except requests.exceptions.ConnectionError:
            logger.warning(f"[{agent_id}] VELYRION unreachable — action allowed (fail-open)")
            return {"error": "connection_error", "blocked": False}
        except Exception as e:
            logger.error(f"[{agent_id}] SDK error: {e}")
            return {"error": str(e), "blocked": False}

    # ── Wrap: Instrument Any Agent ───────────────────────────────────────

    def wrap(self, agent: Any, agent_id: str) -> Any:
        """
        Wrap an agent object to automatically report all tool calls.

        Works with:
          - LangChain agents (AgentExecutor, RunnableSequence)
          - OpenAI client (chat.completions.create)
          - Any object with a .run(), .invoke(), or .execute() method

        Returns the same agent object, now governed by VELYRION.
        """
        client = self

        # LangChain AgentExecutor
        if hasattr(agent, "invoke") and hasattr(agent, "callbacks"):
            return self._wrap_langchain(agent, agent_id)

        # OpenAI client
        if hasattr(agent, "chat") and hasattr(agent.chat, "completions"):
            return self._wrap_openai(agent, agent_id)

        # Generic: wrap .run(), .invoke(), or .execute()
        for method_name in ["run", "invoke", "execute", "call", "__call__"]:
            if hasattr(agent, method_name) and callable(getattr(agent, method_name)):
                original = getattr(agent, method_name)

                @wraps(original)
                def governed_method(*args, _orig=original, _name=method_name, **kwargs):
                    start = time.time()
                    task_desc = str(args[0])[:200] if args else str(kwargs)[:200]

                    try:
                        result = _orig(*args, **kwargs)
                        duration = int((time.time() - start) * 1000)

                        client.report(
                            agent_id=agent_id,
                            task=task_desc,
                            tool=_name,
                            output_data=str(result)[:500],
                            confidence=0.85,
                            duration_ms=duration,
                        )
                        return result

                    except (AgentKilledException, ActionBlockedException):
                        raise
                    except Exception as e:
                        duration = int((time.time() - start) * 1000)
                        client.report(
                            agent_id=agent_id,
                            task=task_desc,
                            tool=_name,
                            output_data=f"ERROR: {e}",
                            confidence=0.2,
                            duration_ms=duration,
                        )
                        raise

                setattr(agent, method_name, governed_method)
                logger.info(f"Wrapped {type(agent).__name__}.{method_name}() for agent {agent_id}")
                return agent

        logger.warning(f"Could not wrap {type(agent).__name__} — no run/invoke/execute method found")
        return agent

    # ── LangChain Integration ────────────────────────────────────────────

    def _wrap_langchain(self, agent: Any, agent_id: str) -> Any:
        """Wrap a LangChain agent with VELYRION governance callbacks."""
        client = self
        original_invoke = agent.invoke

        @wraps(original_invoke)
        def governed_invoke(input_data, *args, **kwargs):
            start = time.time()
            task = str(input_data)[:300] if isinstance(input_data, str) else str(input_data.get("input", ""))[:300]

            try:
                result = original_invoke(input_data, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                # Extract output
                output = ""
                if isinstance(result, dict):
                    output = str(result.get("output", result.get("result", "")))[:500]
                else:
                    output = str(result)[:500]

                # Extract token usage if available
                tokens = 0
                if isinstance(result, dict) and "token_usage" in result:
                    tokens = result["token_usage"].get("total_tokens", 0)

                client.report(
                    agent_id=agent_id,
                    task=task,
                    tool="langchain_agent",
                    output_data=output,
                    confidence=0.85,
                    duration_ms=duration,
                    tokens=tokens,
                )
                return result

            except (AgentKilledException, ActionBlockedException):
                raise
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id,
                    task=task,
                    tool="langchain_agent",
                    output_data=f"ERROR: {e}",
                    confidence=0.1,
                    duration_ms=duration,
                )
                raise

        agent.invoke = governed_invoke
        logger.info(f"Wrapped LangChain agent for {agent_id}")
        return agent

    # ── OpenAI Integration ───────────────────────────────────────────────

    def _wrap_openai(self, client_obj: Any, agent_id: str) -> Any:
        """Wrap an OpenAI client to report all completions."""
        velyrion = self
        original_create = client_obj.chat.completions.create

        @wraps(original_create)
        def governed_create(*args, **kwargs):
            start = time.time()

            # Extract task from messages
            messages = kwargs.get("messages", args[0] if args else [])
            task = ""
            if messages:
                last_msg = messages[-1] if isinstance(messages, list) else messages
                task = str(last_msg.get("content", ""))[:300] if isinstance(last_msg, dict) else str(last_msg)[:300]

            model = kwargs.get("model", "unknown")
            tools = kwargs.get("tools", [])
            tool_names = [t.get("function", {}).get("name", "tool") for t in tools] if tools else []

            # Pre-check with VELYRION
            pre_result = velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"openai:{model}",
                input_data=json.dumps({"model": model, "tools": tool_names})[:500],
                confidence=1.0,
                duration_ms=0,
                tokens=0,
            )

            if pre_result.get("blocked"):
                raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

            # Execute the actual API call
            result = original_create(*args, **kwargs)
            duration = int((time.time() - start) * 1000)

            # Extract token usage
            tokens = 0
            cost = 0.0
            if hasattr(result, "usage") and result.usage:
                tokens = result.usage.total_tokens or 0
                cost = tokens * 0.00003  # approximate

            # Extract output
            output = ""
            if hasattr(result, "choices") and result.choices:
                choice = result.choices[0]
                if hasattr(choice, "message"):
                    output = str(choice.message.content or "")[:500]
                    if choice.message.tool_calls:
                        tool_call_names = [tc.function.name for tc in choice.message.tool_calls]
                        output = f"Tool calls: {tool_call_names}"

            velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"openai:{model}",
                output_data=output,
                confidence=0.9,
                duration_ms=duration,
                tokens=tokens,
                cost_usd=cost,
            )

            return result

        client_obj.chat.completions.create = governed_create
        logger.info(f"Wrapped OpenAI client for {agent_id}")
        return client_obj

    # ── Track: Decorator for Individual Functions ────────────────────────

    def track(
        self,
        agent_id: str,
        tool: str = "custom",
        data_sources: Optional[list[str]] = None,
    ):
        """
        Decorator to track individual function calls.

        @v.track(agent_id="agent-001", tool="database_query")
        def query_database(sql):
            return db.execute(sql)
        """
        client = self

        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                start = time.time()
                task = f"{func.__name__}({str(args)[:100]})"

                try:
                    result = func(*args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    client.report(
                        agent_id=agent_id,
                        task=task,
                        tool=tool,
                        data_sources=data_sources,
                        input_data=str(args)[:500],
                        output_data=str(result)[:500],
                        confidence=0.9,
                        duration_ms=duration,
                    )
                    return result

                except (AgentKilledException, ActionBlockedException):
                    raise
                except Exception as e:
                    duration = int((time.time() - start) * 1000)
                    client.report(
                        agent_id=agent_id,
                        task=task,
                        tool=tool,
                        output_data=f"ERROR: {e}",
                        confidence=0.1,
                        duration_ms=duration,
                    )
                    raise

            return wrapper
        return decorator

    # ── Kill Switch ──────────────────────────────────────────────────────

    def kill(self, agent_id: str):
        """Locally kill an agent (prevents further actions)."""
        self._killed_agents.add(agent_id)
        logger.warning(f"Agent {agent_id} KILLED locally")

    def pause(self, agent_id: str):
        """Pause an agent (blocks until unpaused)."""
        self._paused_agents.add(agent_id)
        logger.warning(f"Agent {agent_id} PAUSED")

    def unpause(self, agent_id: str):
        """Resume a paused agent."""
        self._paused_agents.discard(agent_id)
        logger.info(f"Agent {agent_id} RESUMED")

    def is_alive(self, agent_id: str) -> bool:
        """Check if an agent is allowed to act."""
        return agent_id not in self._killed_agents

    # ── Agent Registration ───────────────────────────────────────────────

    def register_agent(
        self,
        agent_id: str,
        agent_name: str,
        owner_email: str = "",
        department: str = "",
        allowed_tools: Optional[list[str]] = None,
        allowed_data_sources: Optional[list[str]] = None,
        max_token_budget: int = 500000,
        compliance_frameworks: Optional[list[str]] = None,
    ) -> dict:
        """Register a new agent with VELYRION."""
        payload = {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "owner_email": owner_email,
            "department": department,
            "allowed_tools": allowed_tools or [],
            "allowed_data_sources": allowed_data_sources or [],
            "max_token_budget": max_token_budget,
            "compliance_frameworks": compliance_frameworks or [],
        }
        try:
            r = requests.post(
                f"{self.api_url}/api/agents",
                json=payload,
                headers=self._headers,
                timeout=self.timeout,
            )
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    # ── Shutdown ─────────────────────────────────────────────────────────

    def shutdown(self):
        """Cleanly shut down the SDK."""
        self._running = False
        logger.info("VELYRION SDK shut down")
