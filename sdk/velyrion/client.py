"""
VelyrionClient — Core SDK client for agent governance.

Handles:
  - Event reporting to the VELYRION API
  - Agent wrapping (intercept tool calls)
  - Kill switch / heartbeat listener
  - Policy evaluation (local + remote)
  - Async support via AsyncVelyrionClient
  - Multi-framework integrations (OpenAI, LangChain, CrewAI, AutoGen,
    Anthropic, Google Gemini, Mistral)
"""

import json
import time
import uuid
import logging
import threading
import requests
from typing import Any, Callable, Optional
from functools import wraps

try:
    import httpx  # optional — required only for AsyncVelyrionClient
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

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

    # ── Context Manager ──────────────────────────────────────────────────

    def __enter__(self) -> "VelyrionClient":
        """Enter context — returns self for use in `with` blocks."""
        return self

    def __exit__(self, *args: Any) -> None:
        """Exit context — performs clean shutdown."""
        self.shutdown()

    # ── Retry Logic ──────────────────────────────────────────────────────

    def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        max_retries: int = 3,
        backoff_base: float = 1.0,
        **kwargs: Any,
    ) -> requests.Response:
        """
        Execute an HTTP request with exponential-backoff retry.

        Args:
            method: HTTP method ("GET", "POST", etc.).
            url: Fully-qualified URL.
            max_retries: Number of retry attempts (default 3).
            backoff_base: Initial delay in seconds; doubles each retry
                          (1 s → 2 s → 4 s by default).
            **kwargs: Forwarded to ``requests.request()``.

        Returns:
            The :class:`requests.Response` from the first successful attempt.

        Raises:
            The last exception encountered after all retries are exhausted.
        """
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                return requests.request(method, url, **kwargs)
            except (requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout) as exc:
                last_exc = exc
                if attempt < max_retries:
                    delay = backoff_base * (2 ** attempt)
                    logger.warning(
                        f"Request to {url} failed (attempt {attempt + 1}/{max_retries + 1}), "
                        f"retrying in {delay:.1f}s: {exc}"
                    )
                    time.sleep(delay)
        raise last_exc  # type: ignore[misc]

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
            r = self._request_with_retry(
                "POST",
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

        # CrewAI agent
        module = type(agent).__module__ or ""
        if "crewai" in module and hasattr(agent, "execute_task"):
            return self._wrap_crewai(agent, agent_id)

        # AutoGen agent
        if "autogen" in module and hasattr(agent, "generate_reply"):
            return self._wrap_autogen(agent, agent_id)

        # Anthropic client — has `messages` attribute with a `create` method
        if hasattr(agent, "messages") and hasattr(agent.messages, "create"):
            return self._wrap_anthropic(agent, agent_id)

        # Google Gemini model — module contains google.generativeai / genai
        if ("google.generativeai" in module or "genai" in module) and hasattr(agent, "generate_content"):
            return self._wrap_gemini(agent, agent_id)

        # Mistral client — module contains mistralai, has `chat` attribute
        if "mistralai" in module and hasattr(agent, "chat"):
            return self._wrap_mistral(agent, agent_id)

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

    # ── CrewAI Integration ────────────────────────────────────────────────

    def _wrap_crewai(self, agent: Any, agent_id: str) -> Any:
        """Wrap a CrewAI agent to report all task executions."""
        client = self
        original_execute = agent.execute_task

        @wraps(original_execute)
        def governed_execute(task, *args, **kwargs):
            start = time.time()
            task_desc = str(task)[:300]

            try:
                result = original_execute(task, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(result)[:500] if result else ""

                client.report(
                    agent_id=agent_id,
                    task=task_desc,
                    tool="crewai_agent",
                    output_data=output,
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
                    tool="crewai_agent",
                    output_data=f"ERROR: {e}",
                    confidence=0.1,
                    duration_ms=duration,
                )
                raise

        agent.execute_task = governed_execute
        logger.info(f"Wrapped CrewAI agent for {agent_id}")
        return agent

    # ── AutoGen Integration ──────────────────────────────────────────────

    def _wrap_autogen(self, agent: Any, agent_id: str) -> Any:
        """Wrap an AutoGen agent to report all reply generations."""
        client = self
        original_generate = agent.generate_reply

        @wraps(original_generate)
        def governed_generate(messages=None, *args, **kwargs):
            start = time.time()
            task_desc = ""
            if messages:
                last_msg = messages[-1] if isinstance(messages, list) else messages
                task_desc = str(last_msg.get("content", ""))[:300] if isinstance(last_msg, dict) else str(last_msg)[:300]

            try:
                result = original_generate(messages, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(result)[:500] if result else ""

                client.report(
                    agent_id=agent_id,
                    task=task_desc,
                    tool="autogen_agent",
                    output_data=output,
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
                    tool="autogen_agent",
                    output_data=f"ERROR: {e}",
                    confidence=0.1,
                    duration_ms=duration,
                )
                raise

        agent.generate_reply = governed_generate
        logger.info(f"Wrapped AutoGen agent for {agent_id}")
        return agent

    # ── Anthropic Integration ────────────────────────────────────────────

    def _wrap_anthropic(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap an Anthropic client to report all message creations.

        Intercepts ``client_obj.messages.create`` and performs:
          1. A *pre-check* report so VELYRION can block the call.
          2. The actual API call.
          3. A *post* report including output and token usage.

        Args:
            client_obj: An ``anthropic.Anthropic`` (or compatible) instance.
            agent_id: Unique agent identifier registered with VELYRION.

        Returns:
            The same client object with governance applied.
        """
        velyrion = self
        original_create = client_obj.messages.create

        @wraps(original_create)
        def governed_create(*args: Any, **kwargs: Any) -> Any:
            start = time.time()

            # Extract task from the last user message
            messages = kwargs.get("messages", args[0] if args else [])
            task = ""
            if messages and isinstance(messages, list):
                last_msg = messages[-1]
                content = last_msg.get("content", "") if isinstance(last_msg, dict) else str(last_msg)
                task = (str(content) if isinstance(content, str) else json.dumps(content))[:300]

            model = kwargs.get("model", "unknown")

            # Pre-check
            pre_result = velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"anthropic:{model}",
                input_data=json.dumps({"model": model})[:500],
                confidence=1.0,
                duration_ms=0,
                tokens=0,
            )
            if pre_result.get("blocked"):
                raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

            result = original_create(*args, **kwargs)
            duration = int((time.time() - start) * 1000)

            # Token usage
            tokens = 0
            if hasattr(result, "usage") and result.usage:
                input_tok = getattr(result.usage, "input_tokens", 0) or 0
                output_tok = getattr(result.usage, "output_tokens", 0) or 0
                tokens = input_tok + output_tok

            # Output text
            output = ""
            if hasattr(result, "content") and result.content:
                first_block = result.content[0] if isinstance(result.content, list) else result.content
                output = str(getattr(first_block, "text", first_block))[:500]

            velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"anthropic:{model}",
                output_data=output,
                confidence=0.9,
                duration_ms=duration,
                tokens=tokens,
                cost_usd=tokens * 0.000015,
            )
            return result

        client_obj.messages.create = governed_create
        logger.info(f"Wrapped Anthropic client for {agent_id}")
        return client_obj

    # ── Google Gemini Integration ────────────────────────────────────────

    def _wrap_gemini(self, model: Any, agent_id: str) -> Any:
        """
        Wrap a Google Gemini model to report all content generations.

        Intercepts ``model.generate_content`` and reports usage data
        extracted from ``response.usage_metadata``.

        Args:
            model: A ``google.generativeai.GenerativeModel`` instance.
            agent_id: Unique agent identifier registered with VELYRION.

        Returns:
            The same model with governance applied.
        """
        velyrion = self
        original_generate = model.generate_content

        @wraps(original_generate)
        def governed_generate(content: Any, *args: Any, **kwargs: Any) -> Any:
            start = time.time()

            # Extract task from content/prompt
            task = (str(content) if isinstance(content, str) else json.dumps(content, default=str))[:300]
            model_name = getattr(model, "model_name", "gemini")

            # Pre-check
            pre_result = velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"gemini:{model_name}",
                input_data=task[:500],
                confidence=1.0,
                duration_ms=0,
                tokens=0,
            )
            if pre_result.get("blocked"):
                raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

            result = original_generate(content, *args, **kwargs)
            duration = int((time.time() - start) * 1000)

            # Token usage from usage_metadata
            tokens = 0
            if hasattr(result, "usage_metadata") and result.usage_metadata:
                meta = result.usage_metadata
                prompt_tok = getattr(meta, "prompt_token_count", 0) or 0
                candidates_tok = getattr(meta, "candidates_token_count", 0) or 0
                tokens = prompt_tok + candidates_tok

            # Output text
            output = ""
            if hasattr(result, "text"):
                output = str(result.text)[:500]
            elif hasattr(result, "candidates") and result.candidates:
                output = str(result.candidates[0])[:500]

            velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"gemini:{model_name}",
                output_data=output,
                confidence=0.9,
                duration_ms=duration,
                tokens=tokens,
            )
            return result

        model.generate_content = governed_generate
        logger.info(f"Wrapped Google Gemini model for {agent_id}")
        return model

    # ── Mistral Integration ──────────────────────────────────────────────

    def _wrap_mistral(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap a Mistral client to report all chat completions.

        Intercepts ``client_obj.chat.complete`` following the same
        pre-check → execute → post-report pattern used by the OpenAI
        wrapper.

        Args:
            client_obj: A ``mistralai.Mistral`` (or compatible) instance.
            agent_id: Unique agent identifier registered with VELYRION.

        Returns:
            The same client with governance applied.
        """
        velyrion = self
        original_complete = client_obj.chat.complete

        @wraps(original_complete)
        def governed_complete(*args: Any, **kwargs: Any) -> Any:
            start = time.time()

            # Extract task from messages
            messages = kwargs.get("messages", args[0] if args else [])
            task = ""
            if messages and isinstance(messages, list):
                last_msg = messages[-1]
                task = str(last_msg.get("content", "") if isinstance(last_msg, dict) else last_msg)[:300]

            model_name = kwargs.get("model", "mistral")

            # Pre-check
            pre_result = velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"mistral:{model_name}",
                input_data=json.dumps({"model": model_name})[:500],
                confidence=1.0,
                duration_ms=0,
                tokens=0,
            )
            if pre_result.get("blocked"):
                raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

            result = original_complete(*args, **kwargs)
            duration = int((time.time() - start) * 1000)

            # Token usage
            tokens = 0
            cost = 0.0
            if hasattr(result, "usage") and result.usage:
                prompt_tok = getattr(result.usage, "prompt_tokens", 0) or 0
                completion_tok = getattr(result.usage, "completion_tokens", 0) or 0
                tokens = prompt_tok + completion_tok
                cost = tokens * 0.000002

            # Output
            output = ""
            if hasattr(result, "choices") and result.choices:
                choice = result.choices[0]
                if hasattr(choice, "message"):
                    output = str(getattr(choice.message, "content", ""))[:500]

            velyrion.report(
                agent_id=agent_id,
                task=task,
                tool=f"mistral:{model_name}",
                output_data=output,
                confidence=0.9,
                duration_ms=duration,
                tokens=tokens,
                cost_usd=cost,
            )
            return result

        client_obj.chat.complete = governed_complete
        logger.info(f"Wrapped Mistral client for {agent_id}")
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
            r = self._request_with_retry(
                "POST",
                f"{self.api_url}/api/agents",
                json=payload,
                headers=self._headers,
                timeout=self.timeout,
            )
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    # ── Batch Event Reporting ────────────────────────────────────────────

    def batch_report(self, events: list[dict]) -> list[dict]:
        """
        Report multiple governance events in a single API call.

        Each dict in *events* accepts the same keys as :meth:`report`:
          ``agent_id``, ``task``, ``tool``, ``data_sources``,
          ``input_data``, ``output_data``, ``confidence``,
          ``duration_ms``, ``tokens``, ``cost_usd``.

        Args:
            events: A list of event dicts.

        Returns:
            A list of result dicts — one per event — matching the shape
            returned by :meth:`report`.
        """
        payloads = []
        for evt in events:
            payloads.append({
                "agent_id": evt.get("agent_id", ""),
                "task_description": str(evt.get("task", ""))[:500],
                "tool_used": evt.get("tool", "unknown"),
                "data_sources_accessed": evt.get("data_sources") or [],
                "input_data": str(evt.get("input_data", ""))[:1000],
                "output_data": str(evt.get("output_data", ""))[:2000],
                "confidence_score": max(0.0, min(1.0, evt.get("confidence", 0.9))),
                "duration_ms": evt.get("duration_ms", 0),
                "token_cost": evt.get("tokens", 0),
                "compute_cost_usd": evt.get("cost_usd", 0.0),
            })

        try:
            r = self._request_with_retry(
                "POST",
                f"{self.api_url}/api/agent/events/batch",
                json={"events": payloads},
                headers=self._headers,
                timeout=self.timeout,
            )
            if r.status_code in (200, 201):
                return r.json().get("results", [])
            logger.error(f"Batch report failed: {r.status_code}")
            return [{"error": r.status_code}]
        except Exception as e:
            logger.error(f"Batch report error: {e}")
            return [{"error": str(e)}]

    # ── Shutdown ─────────────────────────────────────────────────────────

    def shutdown(self) -> None:
        """Cleanly shut down the SDK."""
        self._running = False
        logger.info("VELYRION SDK shut down")


# ═══════════════════════════════════════════════════════════════════════════
# AsyncVelyrionClient — async-first governance client
# ═══════════════════════════════════════════════════════════════════════════


class AsyncVelyrionClient:
    """
    Async counterpart of :class:`VelyrionClient`.

    Uses `httpx.AsyncClient` under the hood so every network call is
    non-blocking.  The public surface mirrors the sync client:

    * :meth:`report`           — report a single governance event
    * :meth:`health`           — async health check
    * :meth:`register_agent`   — async agent registration
    * :meth:`wrap`             — wrap async agents with governance

    Usage::

        async with AsyncVelyrionClient(api_url="http://localhost:8000") as v:
            await v.report(agent_id="a-1", task="summarise", tool="llm")

    Requires the optional ``httpx`` dependency::

        pip install httpx
    """

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        api_key: str = "",
        timeout: int = 10,
        block_on_violation: bool = True,
        log_level: str = "INFO",
    ) -> None:
        if not _HAS_HTTPX:
            raise ImportError(
                "httpx is required for AsyncVelyrionClient.  "
                "Install it with:  pip install httpx"
            )
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.block_on_violation = block_on_violation
        self._killed_agents: set[str] = set()
        self._client: Optional[httpx.AsyncClient] = None

        logging.basicConfig(level=getattr(logging, log_level.upper(), logging.INFO))

    # ── Internal helpers ─────────────────────────────────────────────────

    @property
    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            h["x-api-key"] = self.api_key
        return h

    async def _get_client(self) -> "httpx.AsyncClient":
        """Lazily initialise (and reuse) the underlying httpx client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers=self._headers,
                timeout=self.timeout,
            )
        return self._client

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        max_retries: int = 3,
        backoff_base: float = 1.0,
        **kwargs: Any,
    ) -> "httpx.Response":
        """
        Async HTTP request with exponential-backoff retry.

        Retries on connection and timeout errors up to *max_retries* times
        with delays of 1 s → 2 s → 4 s (by default).
        """
        import asyncio

        client = await self._get_client()
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                return await client.request(method, url, **kwargs)
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt < max_retries:
                    delay = backoff_base * (2 ** attempt)
                    logger.warning(
                        f"Async request to {url} failed (attempt {attempt + 1}/{max_retries + 1}), "
                        f"retrying in {delay:.1f}s: {exc}"
                    )
                    await asyncio.sleep(delay)
        raise last_exc  # type: ignore[misc]

    # ── Context Manager ──────────────────────────────────────────────────

    async def __aenter__(self) -> "AsyncVelyrionClient":
        await self._get_client()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.shutdown()

    # ── Health Check ─────────────────────────────────────────────────────

    async def health(self) -> dict:
        """Async health check against the VELYRION API."""
        try:
            r = await self._request_with_retry("GET", f"{self.api_url}/health")
            return r.json()
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}

    # ── Core: Report ─────────────────────────────────────────────────────

    async def report(
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
        Async version of :meth:`VelyrionClient.report`.

        Reports an agent action to VELYRION for governance evaluation.

        Returns:
            dict with keys: ``event_id``, ``risk_level``,
            ``violations_triggered``, ``blocked``.
        """
        if agent_id in self._killed_agents:
            raise AgentKilledException(f"Agent {agent_id} has been terminated by VELYRION")

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
            r = await self._request_with_retry(
                "POST",
                f"{self.api_url}/api/agent/event",
                json=payload,
            )

            if r.status_code in (200, 201):
                data = r.json()
                result = {
                    "event_id": data.get("event_id", ""),
                    "risk_level": data.get("risk_level", "LOW"),
                    "violations_triggered": 0,
                    "blocked": False,
                }
                logger.info(f"[{agent_id}] {tool} → Risk: {result['risk_level']}")
                return result

            elif r.status_code == 403:
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
        except Exception as e:
            logger.warning(f"[{agent_id}] VELYRION unreachable — action allowed (fail-open)")
            return {"error": str(e), "blocked": False}

    # ── Register Agent ───────────────────────────────────────────────────

    async def register_agent(
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
        """Async version of :meth:`VelyrionClient.register_agent`."""
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
            r = await self._request_with_retry(
                "POST",
                f"{self.api_url}/api/agents",
                json=payload,
            )
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    # ── Wrap (async agents) ──────────────────────────────────────────────

    def wrap(self, agent: Any, agent_id: str) -> Any:
        """
        Wrap an async agent/callable with VELYRION governance.

        Detects and wraps common async patterns:
          - Objects with an async ``run`` / ``invoke`` / ``execute`` method
          - Async callables (``__call__``)

        For synchronous agents, use :class:`VelyrionClient` instead.

        Returns the same agent, now governed.
        """
        import asyncio
        client = self

        for method_name in ["run", "invoke", "execute", "call", "__call__"]:
            attr = getattr(agent, method_name, None)
            if attr is None or not callable(attr):
                continue
            if not asyncio.iscoroutinefunction(attr):
                continue

            original = attr

            @wraps(original)
            async def governed_method(
                *args: Any,
                _orig: Any = original,
                _name: str = method_name,
                **kwargs: Any,
            ) -> Any:
                start = time.time()
                task_desc = str(args[0])[:200] if args else str(kwargs)[:200]

                try:
                    result = await _orig(*args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    await client.report(
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
                    await client.report(
                        agent_id=agent_id,
                        task=task_desc,
                        tool=_name,
                        output_data=f"ERROR: {e}",
                        confidence=0.2,
                        duration_ms=duration,
                    )
                    raise

            setattr(agent, method_name, governed_method)
            logger.info(f"Wrapped async {type(agent).__name__}.{method_name}() for agent {agent_id}")
            return agent

        logger.warning(
            f"Could not async-wrap {type(agent).__name__} — "
            f"no async run/invoke/execute method found"
        )
        return agent

    # ── Shutdown ─────────────────────────────────────────────────────────

    async def shutdown(self) -> None:
        """Close the underlying httpx client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
        logger.info("AsyncVelyrionClient shut down")
