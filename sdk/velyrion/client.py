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

        Works with 19+ frameworks:
          - OpenAI / Azure OpenAI (chat.completions.create)
          - Anthropic Claude (messages.create)
          - Google Gemini (generate_content)
          - Mistral (chat.complete)
          - Cohere (chat / generate)
          - LangChain (invoke with callbacks)
          - LangGraph (compiled graph invoke/stream)
          - LlamaIndex (query / chat engines)
          - CrewAI (execute_task)
          - AutoGen (generate_reply)
          - Semantic Kernel (invoke / invoke_prompt)
          - Haystack (pipeline.run)
          - PydanticAI (run / run_sync)
          - Agno / Phidata (run / chat)
          - OpenAI Swarm (swarm.run)
          - Smolagents (CodeAgent.run)
          - AWS Bedrock (invoke_model / invoke_agent)
          - Google Vertex AI (generate_content / predict)
          - HuggingFace Transformers (pipeline / generate)
          - Ollama / vLLM / Groq / Together / Fireworks / DeepSeek
          - Any object with run(), invoke(), execute(), or __call__()

        Returns the same agent object, now governed by VELYRION.
        """
        client = self
        module = type(agent).__module__ or ""
        cls_name = type(agent).__name__.lower()

        # ─── Cloud LLM APIs ──────────────────────────────────────────

        # OpenAI / Azure OpenAI client
        if hasattr(agent, "chat") and hasattr(agent.chat, "completions"):
            # Detect Azure vs standard OpenAI
            if "azure" in module.lower() or "azure" in cls_name:
                return self._wrap_azure_openai(agent, agent_id)
            return self._wrap_openai(agent, agent_id)

        # Anthropic client
        if hasattr(agent, "messages") and hasattr(agent.messages, "create"):
            return self._wrap_anthropic(agent, agent_id)

        # Google Gemini (google.generativeai)
        if ("google.generativeai" in module or "genai" in module) and hasattr(agent, "generate_content"):
            return self._wrap_gemini(agent, agent_id)

        # Google Vertex AI
        if "vertexai" in module or "google.cloud.aiplatform" in module:
            return self._wrap_vertex_ai(agent, agent_id)

        # Mistral client
        if "mistralai" in module and hasattr(agent, "chat"):
            return self._wrap_mistral(agent, agent_id)

        # Cohere client
        if "cohere" in module and (hasattr(agent, "chat") or hasattr(agent, "generate")):
            return self._wrap_cohere(agent, agent_id)

        # AWS Bedrock runtime
        if hasattr(agent, "invoke_model") or (hasattr(agent, "meta") and "bedrock" in str(getattr(agent, "meta", {}))):
            return self._wrap_bedrock(agent, agent_id)

        # Ollama native client
        if "ollama" in module:
            return self._wrap_ollama(agent, agent_id)

        # ─── Agent Frameworks ────────────────────────────────────────

        # LangGraph compiled graph (check BEFORE LangChain — LangGraph also has invoke)
        if "langgraph" in module and hasattr(agent, "invoke"):
            return self._wrap_langgraph(agent, agent_id)

        # LangChain AgentExecutor / RunnableSequence
        if hasattr(agent, "invoke") and hasattr(agent, "callbacks"):
            return self._wrap_langchain(agent, agent_id)

        # CrewAI agent
        if "crewai" in module and hasattr(agent, "execute_task"):
            return self._wrap_crewai(agent, agent_id)

        # AutoGen agent
        if "autogen" in module and hasattr(agent, "generate_reply"):
            return self._wrap_autogen(agent, agent_id)

        # Semantic Kernel
        if "semantic_kernel" in module and (hasattr(agent, "invoke") or hasattr(agent, "invoke_prompt")):
            return self._wrap_semantic_kernel(agent, agent_id)

        # LlamaIndex query/chat engine
        if "llama_index" in module or "llamaindex" in module:
            return self._wrap_llamaindex(agent, agent_id)

        # Haystack pipeline
        if "haystack" in module and hasattr(agent, "run"):
            return self._wrap_haystack(agent, agent_id)

        # PydanticAI agent
        if "pydantic_ai" in module and (hasattr(agent, "run") or hasattr(agent, "run_sync")):
            return self._wrap_pydantic_ai(agent, agent_id)

        # Agno / Phidata agent
        if ("agno" in module or "phi" in module) and hasattr(agent, "run"):
            return self._wrap_agno(agent, agent_id)

        # OpenAI Swarm
        if "swarm" in module and hasattr(agent, "run"):
            return self._wrap_swarm(agent, agent_id)

        # Smolagents (HuggingFace)
        if "smolagents" in module and hasattr(agent, "run"):
            return self._wrap_smolagents(agent, agent_id)

        # HuggingFace Transformers pipeline or model
        if "transformers" in module:
            return self._wrap_huggingface(agent, agent_id)

        # ─── OpenAI-Compatible Clients ───────────────────────────────
        # Together, Groq, Fireworks, DeepSeek, vLLM, LiteLLM, Anyscale
        # all use the OpenAI SDK interface
        if hasattr(agent, "chat") and hasattr(getattr(agent, "chat", None), "completions"):
            return self._wrap_openai(agent, agent_id)

        # ─── Generic Fallback ────────────────────────────────────────
        # Wrap any object with run(), invoke(), execute(), or call()
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

        logger.warning(f"Could not wrap {type(agent).__name__} — no known method found")
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

    # ── AWS Bedrock Integration ──────────────────────────────────────────

    def _wrap_bedrock(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap an AWS Bedrock runtime client to report all model invocations.

        Intercepts ``invoke_model`` and ``invoke_agent`` calls.
        Works with ``boto3.client('bedrock-runtime')``.

        Args:
            client_obj: A ``boto3`` bedrock-runtime client.
            agent_id: Unique agent identifier.

        Returns:
            The same client with governance applied.
        """
        velyrion = self

        if hasattr(client_obj, "invoke_model"):
            original_invoke = client_obj.invoke_model

            @wraps(original_invoke)
            def governed_invoke_model(**kwargs: Any) -> Any:
                start = time.time()
                model_id = kwargs.get("modelId", "bedrock-model")
                body = kwargs.get("body", "")
                task = str(body)[:300] if isinstance(body, str) else "bedrock invocation"

                pre_result = velyrion.report(
                    agent_id=agent_id,
                    task=task,
                    tool=f"bedrock:{model_id}",
                    input_data=str(body)[:500],
                    confidence=1.0, duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = original_invoke(**kwargs)
                duration = int((time.time() - start) * 1000)

                response_body = ""
                if "body" in result:
                    try:
                        response_body = result["body"].read().decode("utf-8")
                        result["body"] = type(result["body"])(response_body.encode())
                    except Exception:
                        response_body = str(result)[:500]

                velyrion.report(
                    agent_id=agent_id,
                    task=task,
                    tool=f"bedrock:{model_id}",
                    output_data=response_body[:500],
                    confidence=0.9, duration_ms=duration,
                )
                return result

            client_obj.invoke_model = governed_invoke_model

        if hasattr(client_obj, "invoke_agent"):
            original_invoke_agent = client_obj.invoke_agent

            @wraps(original_invoke_agent)
            def governed_invoke_agent(**kwargs: Any) -> Any:
                start = time.time()
                agent_alias = kwargs.get("agentAliasId", "bedrock-agent")
                input_text = kwargs.get("inputText", "")

                pre_result = velyrion.report(
                    agent_id=agent_id,
                    task=str(input_text)[:300],
                    tool=f"bedrock-agent:{agent_alias}",
                    input_data=str(input_text)[:500],
                    confidence=1.0, duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = original_invoke_agent(**kwargs)
                duration = int((time.time() - start) * 1000)

                velyrion.report(
                    agent_id=agent_id,
                    task=str(input_text)[:300],
                    tool=f"bedrock-agent:{agent_alias}",
                    output_data=str(result)[:500],
                    confidence=0.85, duration_ms=duration,
                )
                return result

            client_obj.invoke_agent = governed_invoke_agent

        logger.info(f"Wrapped AWS Bedrock client for {agent_id}")
        return client_obj

    # ── Azure OpenAI Integration ─────────────────────────────────────────

    def _wrap_azure_openai(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap an Azure OpenAI client to report all completions.

        Uses the same pattern as OpenAI since Azure OpenAI SDK extends it.
        Works with ``openai.AzureOpenAI``.

        Args:
            client_obj: An ``openai.AzureOpenAI`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same client with governance applied.
        """
        return self._wrap_openai(client_obj, agent_id)

    # ── Google Vertex AI Integration ─────────────────────────────────────

    def _wrap_vertex_ai(self, model: Any, agent_id: str) -> Any:
        """
        Wrap a Google Vertex AI model to report all predictions.

        Works with ``vertexai.generative_models.GenerativeModel``
        and ``vertexai.language_models.TextGenerationModel``.

        Args:
            model: A Vertex AI model instance.
            agent_id: Unique agent identifier.

        Returns:
            The same model with governance applied.
        """
        velyrion = self

        # Vertex AI GenerativeModel uses generate_content
        if hasattr(model, "generate_content"):
            original_generate = model.generate_content

            @wraps(original_generate)
            def governed_generate(contents: Any, *args: Any, **kwargs: Any) -> Any:
                start = time.time()
                task = str(contents)[:300]
                model_name = getattr(model, "_model_name", "vertex-ai")

                pre_result = velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"vertex:{model_name}",
                    input_data=task[:500], confidence=1.0,
                    duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = original_generate(contents, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                tokens = 0
                if hasattr(result, "usage_metadata"):
                    meta = result.usage_metadata
                    tokens = (getattr(meta, "prompt_token_count", 0) or 0) + \
                             (getattr(meta, "candidates_token_count", 0) or 0)

                output = str(getattr(result, "text", result))[:500]

                velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"vertex:{model_name}",
                    output_data=output, confidence=0.9,
                    duration_ms=duration, tokens=tokens,
                )
                return result

            model.generate_content = governed_generate

        # Vertex AI TextGenerationModel uses predict
        elif hasattr(model, "predict"):
            original_predict = model.predict

            @wraps(original_predict)
            def governed_predict(prompt: str, *args: Any, **kwargs: Any) -> Any:
                start = time.time()
                pre_result = velyrion.report(
                    agent_id=agent_id, task=prompt[:300],
                    tool="vertex:text-model", input_data=prompt[:500],
                    confidence=1.0, duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = original_predict(prompt, *args, **kwargs)
                duration = int((time.time() - start) * 1000)
                output = str(getattr(result, "text", result))[:500]

                velyrion.report(
                    agent_id=agent_id, task=prompt[:300],
                    tool="vertex:text-model", output_data=output,
                    confidence=0.9, duration_ms=duration,
                )
                return result

            model.predict = governed_predict

        logger.info(f"Wrapped Google Vertex AI model for {agent_id}")
        return model

    # ── LangGraph Integration ────────────────────────────────────────────

    def _wrap_langgraph(self, graph: Any, agent_id: str) -> Any:
        """
        Wrap a LangGraph compiled graph to report all state transitions.

        Works with ``langgraph.graph.StateGraph`` compiled graphs
        (``CompiledGraph.invoke``).

        Args:
            graph: A compiled LangGraph instance.
            agent_id: Unique agent identifier.

        Returns:
            The same graph with governance applied.
        """
        client = self
        original_invoke = graph.invoke

        @wraps(original_invoke)
        def governed_invoke(state: Any, *args: Any, **kwargs: Any) -> Any:
            start = time.time()
            task = str(state)[:300]

            try:
                result = original_invoke(state, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                # LangGraph returns state dicts
                output = str(result)[:500] if result else ""

                client.report(
                    agent_id=agent_id, task=task,
                    tool="langgraph", output_data=output,
                    confidence=0.85, duration_ms=duration,
                )
                return result
            except (AgentKilledException, ActionBlockedException):
                raise
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id, task=task,
                    tool="langgraph", output_data=f"ERROR: {e}",
                    confidence=0.1, duration_ms=duration,
                )
                raise

        graph.invoke = governed_invoke

        # Also wrap stream if available (LangGraph streaming)
        if hasattr(graph, "stream"):
            original_stream = graph.stream

            @wraps(original_stream)
            def governed_stream(state: Any, *args: Any, **kwargs: Any):
                start = time.time()
                task = str(state)[:300]
                chunks = []

                for chunk in original_stream(state, *args, **kwargs):
                    chunks.append(str(chunk)[:200])
                    yield chunk

                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id, task=task,
                    tool="langgraph:stream",
                    output_data="; ".join(chunks[-3:])[:500],
                    confidence=0.85, duration_ms=duration,
                )

            graph.stream = governed_stream

        logger.info(f"Wrapped LangGraph for {agent_id}")
        return graph

    # ── LlamaIndex Integration ───────────────────────────────────────────

    def _wrap_llamaindex(self, engine: Any, agent_id: str) -> Any:
        """
        Wrap a LlamaIndex query engine or chat engine.

        Works with ``QueryEngine.query()``, ``ChatEngine.chat()``,
        and ``AgentRunner.chat()``/``AgentRunner.query()``.

        Args:
            engine: A LlamaIndex engine or agent runner.
            agent_id: Unique agent identifier.

        Returns:
            The same engine with governance applied.
        """
        client = self

        for method_name in ["query", "chat", "aquery", "achat"]:
            if not hasattr(engine, method_name):
                continue
            original = getattr(engine, method_name)

            @wraps(original)
            def governed(input_data: Any, *args: Any, _orig=original, _name=method_name, **kwargs: Any) -> Any:
                start = time.time()
                task = str(input_data)[:300]

                try:
                    result = _orig(input_data, *args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    output = str(getattr(result, "response", result))[:500]
                    sources = []
                    if hasattr(result, "source_nodes"):
                        sources = [str(n.node.metadata.get("file_name", ""))
                                   for n in result.source_nodes[:5]]

                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"llamaindex:{_name}",
                        data_sources=sources if sources else None,
                        output_data=output,
                        confidence=0.85, duration_ms=duration,
                    )
                    return result
                except (AgentKilledException, ActionBlockedException):
                    raise
                except Exception as e:
                    duration = int((time.time() - start) * 1000)
                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"llamaindex:{_name}",
                        output_data=f"ERROR: {e}",
                        confidence=0.1, duration_ms=duration,
                    )
                    raise

            setattr(engine, method_name, governed)

        logger.info(f"Wrapped LlamaIndex engine for {agent_id}")
        return engine

    # ── Haystack Integration ─────────────────────────────────────────────

    def _wrap_haystack(self, pipeline: Any, agent_id: str) -> Any:
        """
        Wrap a Haystack pipeline to report all runs.

        Works with ``haystack.Pipeline.run()``.

        Args:
            pipeline: A Haystack Pipeline instance.
            agent_id: Unique agent identifier.

        Returns:
            The same pipeline with governance applied.
        """
        client = self
        original_run = pipeline.run

        @wraps(original_run)
        def governed_run(data: Any = None, *args: Any, **kwargs: Any) -> Any:
            start = time.time()
            task = str(data)[:300] if data else "haystack pipeline"

            try:
                result = original_run(data, *args, **kwargs) if data else original_run(*args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(result)[:500]

                client.report(
                    agent_id=agent_id, task=task,
                    tool="haystack_pipeline",
                    output_data=output,
                    confidence=0.85, duration_ms=duration,
                )
                return result
            except (AgentKilledException, ActionBlockedException):
                raise
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id, task=task,
                    tool="haystack_pipeline",
                    output_data=f"ERROR: {e}",
                    confidence=0.1, duration_ms=duration,
                )
                raise

        pipeline.run = governed_run
        logger.info(f"Wrapped Haystack pipeline for {agent_id}")
        return pipeline

    # ── Semantic Kernel Integration ──────────────────────────────────────

    def _wrap_semantic_kernel(self, kernel: Any, agent_id: str) -> Any:
        """
        Wrap a Microsoft Semantic Kernel instance.

        Intercepts ``kernel.invoke()`` and ``kernel.invoke_prompt()``.

        Args:
            kernel: A ``semantic_kernel.Kernel`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same kernel with governance applied.
        """
        client = self

        for method_name in ["invoke", "invoke_prompt"]:
            if not hasattr(kernel, method_name):
                continue
            original = getattr(kernel, method_name)

            @wraps(original)
            def governed(
                *args: Any, _orig=original, _name=method_name, **kwargs: Any
            ) -> Any:
                start = time.time()
                task = str(args[0])[:300] if args else str(kwargs)[:300]

                try:
                    result = _orig(*args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    output = str(result)[:500]

                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"semantic_kernel:{_name}",
                        output_data=output,
                        confidence=0.85, duration_ms=duration,
                    )
                    return result
                except (AgentKilledException, ActionBlockedException):
                    raise
                except Exception as e:
                    duration = int((time.time() - start) * 1000)
                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"semantic_kernel:{_name}",
                        output_data=f"ERROR: {e}",
                        confidence=0.1, duration_ms=duration,
                    )
                    raise

            setattr(kernel, method_name, governed)

        logger.info(f"Wrapped Semantic Kernel for {agent_id}")
        return kernel

    # ── Cohere Integration ───────────────────────────────────────────────

    def _wrap_cohere(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap a Cohere client to report all chat/generate calls.

        Works with ``cohere.Client`` — intercepts ``.chat()`` and
        ``.generate()``.

        Args:
            client_obj: A ``cohere.Client`` or ``cohere.ClientV2`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same client with governance applied.
        """
        velyrion = self

        for method_name in ["chat", "generate", "chat_stream"]:
            if not hasattr(client_obj, method_name):
                continue
            original = getattr(client_obj, method_name)

            @wraps(original)
            def governed(
                *args: Any, _orig=original, _name=method_name, **kwargs: Any
            ) -> Any:
                start = time.time()
                message = kwargs.get("message", kwargs.get("prompt", str(args[0]) if args else ""))
                task = str(message)[:300]
                model = kwargs.get("model", "cohere")

                pre_result = velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"cohere:{model}:{_name}",
                    input_data=task[:500], confidence=1.0,
                    duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = _orig(*args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(getattr(result, "text", result))[:500]
                tokens = 0
                if hasattr(result, "meta") and hasattr(result.meta, "billed_units"):
                    billed = result.meta.billed_units
                    tokens = (getattr(billed, "input_tokens", 0) or 0) + \
                             (getattr(billed, "output_tokens", 0) or 0)

                velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"cohere:{model}:{_name}",
                    output_data=output, confidence=0.9,
                    duration_ms=duration, tokens=tokens,
                )
                return result

            setattr(client_obj, method_name, governed)

        logger.info(f"Wrapped Cohere client for {agent_id}")
        return client_obj

    # ── Ollama / vLLM / OpenAI-compatible Integration ────────────────────

    def _wrap_ollama(self, client_obj: Any, agent_id: str) -> Any:
        """
        Wrap an Ollama client or any OpenAI-compatible local server.

        Works with ``ollama.Client`` (``chat``, ``generate``),
        and OpenAI-compatible clients (Together, Groq, Fireworks, DeepSeek,
        vLLM, LiteLLM, Anyscale).

        For OpenAI-compatible clients, use ``_wrap_openai()`` directly — they
        all share the same ``chat.completions.create`` interface.

        Args:
            client_obj: An ``ollama.Client`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same client with governance applied.
        """
        velyrion = self

        # Native Ollama client
        for method_name in ["chat", "generate"]:
            if not hasattr(client_obj, method_name):
                continue
            original = getattr(client_obj, method_name)

            @wraps(original)
            def governed(
                *args: Any, _orig=original, _name=method_name, **kwargs: Any
            ) -> Any:
                start = time.time()
                model = kwargs.get("model", "ollama-local")
                prompt = kwargs.get("prompt", "")
                messages = kwargs.get("messages", [])
                task = str(prompt or messages)[:300]

                pre_result = velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"ollama:{model}:{_name}",
                    input_data=task[:500], confidence=1.0,
                    duration_ms=0, tokens=0,
                )
                if pre_result.get("blocked"):
                    raise ActionBlockedException(pre_result.get("detail", "Blocked by VELYRION"))

                result = _orig(*args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = ""
                tokens = 0
                if isinstance(result, dict):
                    output = str(result.get("message", {}).get("content",
                                 result.get("response", "")))[:500]
                    tokens = result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
                else:
                    output = str(result)[:500]

                velyrion.report(
                    agent_id=agent_id, task=task,
                    tool=f"ollama:{model}:{_name}",
                    output_data=output, confidence=0.9,
                    duration_ms=duration, tokens=tokens,
                )
                return result

            setattr(client_obj, method_name, governed)

        logger.info(f"Wrapped Ollama/local client for {agent_id}")
        return client_obj

    # ── HuggingFace Transformers Integration ─────────────────────────────

    def _wrap_huggingface(self, pipeline_or_model: Any, agent_id: str) -> Any:
        """
        Wrap a HuggingFace Transformers pipeline or model.

        Works with ``transformers.pipeline()`` objects and any model
        with a ``generate()`` or ``__call__()`` method.

        Args:
            pipeline_or_model: A HF pipeline or model instance.
            agent_id: Unique agent identifier.

        Returns:
            The same object with governance applied.
        """
        client = self

        # HuggingFace pipelines are callable
        if callable(pipeline_or_model) and hasattr(pipeline_or_model, "task"):
            original_call = pipeline_or_model.__class__.__call__

            @wraps(original_call)
            def governed_call(self_obj: Any, *args: Any, **kwargs: Any) -> Any:
                start = time.time()
                task = str(args[0])[:300] if args else str(kwargs)[:300]

                result = original_call(self_obj, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(result)[:500]

                client.report(
                    agent_id=agent_id, task=task,
                    tool=f"huggingface:{getattr(pipeline_or_model, 'task', 'pipeline')}",
                    output_data=output, confidence=0.85,
                    duration_ms=duration,
                )
                return result

            pipeline_or_model.__class__.__call__ = governed_call
            logger.info(f"Wrapped HuggingFace pipeline for {agent_id}")
            return pipeline_or_model

        # Model with generate()
        if hasattr(pipeline_or_model, "generate"):
            original_generate = pipeline_or_model.generate

            @wraps(original_generate)
            def governed_generate(*args: Any, **kwargs: Any) -> Any:
                start = time.time()
                result = original_generate(*args, **kwargs)
                duration = int((time.time() - start) * 1000)

                client.report(
                    agent_id=agent_id,
                    task="model.generate()",
                    tool="huggingface:generate",
                    output_data=str(result)[:500],
                    confidence=0.85, duration_ms=duration,
                )
                return result

            pipeline_or_model.generate = governed_generate

        logger.info(f"Wrapped HuggingFace model for {agent_id}")
        return pipeline_or_model

    # ── PydanticAI Integration ───────────────────────────────────────────

    def _wrap_pydantic_ai(self, agent: Any, agent_id: str) -> Any:
        """
        Wrap a PydanticAI agent to report all runs.

        Works with ``pydantic_ai.Agent`` — intercepts ``.run()``
        and ``.run_sync()``.

        Args:
            agent: A ``pydantic_ai.Agent`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same agent with governance applied.
        """
        client = self

        for method_name in ["run", "run_sync", "run_stream"]:
            if not hasattr(agent, method_name):
                continue
            original = getattr(agent, method_name)

            @wraps(original)
            def governed(
                prompt: Any = None, *args: Any,
                _orig=original, _name=method_name, **kwargs: Any
            ) -> Any:
                start = time.time()
                task = str(prompt)[:300] if prompt else str(kwargs)[:300]

                try:
                    result = _orig(prompt, *args, **kwargs) if prompt else _orig(*args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    output = str(getattr(result, "data", result))[:500]

                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"pydantic_ai:{_name}",
                        output_data=output, confidence=0.85,
                        duration_ms=duration,
                    )
                    return result
                except (AgentKilledException, ActionBlockedException):
                    raise
                except Exception as e:
                    duration = int((time.time() - start) * 1000)
                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"pydantic_ai:{_name}",
                        output_data=f"ERROR: {e}",
                        confidence=0.1, duration_ms=duration,
                    )
                    raise

            setattr(agent, method_name, governed)

        logger.info(f"Wrapped PydanticAI agent for {agent_id}")
        return agent

    # ── Agno (Phidata) Integration ───────────────────────────────────────

    def _wrap_agno(self, agent: Any, agent_id: str) -> Any:
        """
        Wrap an Agno (formerly Phidata) agent to report all runs.

        Works with ``agno.Agent`` and ``phi.agent.Agent`` —
        intercepts ``.run()`` and ``.print_response()``.

        Args:
            agent: An Agno/Phidata agent instance.
            agent_id: Unique agent identifier.

        Returns:
            The same agent with governance applied.
        """
        client = self

        for method_name in ["run", "print_response", "chat"]:
            if not hasattr(agent, method_name):
                continue
            original = getattr(agent, method_name)

            @wraps(original)
            def governed(
                message: Any = None, *args: Any,
                _orig=original, _name=method_name, **kwargs: Any
            ) -> Any:
                start = time.time()
                task = str(message)[:300] if message else str(kwargs)[:300]

                try:
                    result = _orig(message, *args, **kwargs) if message else _orig(*args, **kwargs)
                    duration = int((time.time() - start) * 1000)

                    output = str(getattr(result, "content", result))[:500]

                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"agno:{_name}",
                        output_data=output, confidence=0.85,
                        duration_ms=duration,
                    )
                    return result
                except (AgentKilledException, ActionBlockedException):
                    raise
                except Exception as e:
                    duration = int((time.time() - start) * 1000)
                    client.report(
                        agent_id=agent_id, task=task,
                        tool=f"agno:{_name}",
                        output_data=f"ERROR: {e}",
                        confidence=0.1, duration_ms=duration,
                    )
                    raise

            setattr(agent, method_name, governed)

        logger.info(f"Wrapped Agno/Phidata agent for {agent_id}")
        return agent

    # ── OpenAI Swarm Integration ─────────────────────────────────────────

    def _wrap_swarm(self, swarm: Any, agent_id: str) -> Any:
        """
        Wrap an OpenAI Swarm client.

        Works with ``swarm.Swarm`` — intercepts ``.run()``.

        Args:
            swarm: A ``swarm.Swarm`` instance.
            agent_id: Unique agent identifier.

        Returns:
            The same Swarm with governance applied.
        """
        client = self
        original_run = swarm.run

        @wraps(original_run)
        def governed_run(agent: Any = None, messages: Any = None, *args: Any, **kwargs: Any) -> Any:
            start = time.time()
            task = str(messages[-1].get("content", ""))[:300] if messages else "swarm run"

            try:
                result = original_run(agent, messages, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = ""
                if hasattr(result, "messages") and result.messages:
                    output = str(result.messages[-1].get("content", ""))[:500]

                client.report(
                    agent_id=agent_id, task=task,
                    tool="openai_swarm",
                    output_data=output, confidence=0.85,
                    duration_ms=duration,
                )
                return result
            except (AgentKilledException, ActionBlockedException):
                raise
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id, task=task,
                    tool="openai_swarm",
                    output_data=f"ERROR: {e}",
                    confidence=0.1, duration_ms=duration,
                )
                raise

        swarm.run = governed_run
        logger.info(f"Wrapped OpenAI Swarm for {agent_id}")
        return swarm

    # ── Smolagents (HuggingFace) Integration ─────────────────────────────

    def _wrap_smolagents(self, agent: Any, agent_id: str) -> Any:
        """
        Wrap a HuggingFace Smolagents agent.

        Works with ``smolagents.CodeAgent`` and ``smolagents.ToolCallingAgent``
        — intercepts ``.run()``.

        Args:
            agent: A smolagents agent instance.
            agent_id: Unique agent identifier.

        Returns:
            The same agent with governance applied.
        """
        client = self
        original_run = agent.run

        @wraps(original_run)
        def governed_run(task_str: str, *args: Any, **kwargs: Any) -> Any:
            start = time.time()
            task = str(task_str)[:300]

            try:
                result = original_run(task_str, *args, **kwargs)
                duration = int((time.time() - start) * 1000)

                output = str(result)[:500]

                client.report(
                    agent_id=agent_id, task=task,
                    tool="smolagents",
                    output_data=output, confidence=0.85,
                    duration_ms=duration,
                )
                return result
            except (AgentKilledException, ActionBlockedException):
                raise
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                client.report(
                    agent_id=agent_id, task=task,
                    tool="smolagents",
                    output_data=f"ERROR: {e}",
                    confidence=0.1, duration_ms=duration,
                )
                raise

        agent.run = governed_run
        logger.info(f"Wrapped Smolagents for {agent_id}")
        return agent

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
