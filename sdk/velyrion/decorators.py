"""
Decorators for quick function-level governance.

Usage:
    from velyrion import governed, track

    @governed(agent_id="agent-001", api_url="http://localhost:8000")
    def my_agent_task(query):
        return llm.generate(query)

    @track(agent_id="agent-001", tool="database")
    def query_db(sql):
        return db.execute(sql)
"""

import time
import functools
import logging
from typing import Optional, Callable

logger = logging.getLogger("velyrion")

# Global client instance (lazy-initialized)
_global_client = None


def _get_client(api_url: str = "http://localhost:8000", api_key: str = ""):
    """Get or create a global VelyrionClient."""
    global _global_client
    if _global_client is None:
        from velyrion.client import VelyrionClient
        _global_client = VelyrionClient(api_url=api_url, api_key=api_key)
    return _global_client


def governed(
    agent_id: str,
    tool: str = "auto",
    api_url: str = "http://localhost:8000",
    api_key: str = "",
    block_on_violation: bool = True,
):
    """
    Decorator — wraps any function with VELYRION governance.

    @governed(agent_id="agent-001")
    def analyze_data(query):
        return llm.generate(query)
    """
    def decorator(func: Callable) -> Callable:
        tool_name = tool if tool != "auto" else func.__name__

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            client = _get_client(api_url, api_key)
            start = time.time()
            task = f"{func.__name__}({str(args)[:100]})"

            try:
                result = func(*args, **kwargs)
                duration = int((time.time() - start) * 1000)

                response = client.report(
                    agent_id=agent_id,
                    task=task,
                    tool=tool_name,
                    input_data=str(args)[:500],
                    output_data=str(result)[:500],
                    confidence=0.85,
                    duration_ms=duration,
                )

                if response.get("blocked") and block_on_violation:
                    from velyrion.client import ActionBlockedException
                    raise ActionBlockedException(response.get("detail", "Blocked"))

                return result

            except Exception as e:
                duration = int((time.time() - start) * 1000)
                if not isinstance(e, Exception.__class__):
                    client.report(
                        agent_id=agent_id,
                        task=task,
                        tool=tool_name,
                        output_data=f"ERROR: {e}",
                        confidence=0.1,
                        duration_ms=duration,
                    )
                raise

        return wrapper
    return decorator


def track(
    agent_id: str,
    tool: str = "custom",
    data_sources: Optional[list[str]] = None,
    api_url: str = "http://localhost:8000",
    api_key: str = "",
):
    """
    Lightweight decorator — tracks function calls without blocking.

    @track(agent_id="agent-001", tool="database_query")
    def query(sql):
        return db.execute(sql)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            client = _get_client(api_url, api_key)
            start = time.time()

            result = func(*args, **kwargs)
            duration = int((time.time() - start) * 1000)

            # Fire-and-forget (don't block on governance response)
            try:
                client.report(
                    agent_id=agent_id,
                    task=f"{func.__name__}()",
                    tool=tool,
                    data_sources=data_sources,
                    input_data=str(args)[:300],
                    output_data=str(result)[:300],
                    confidence=0.9,
                    duration_ms=duration,
                )
            except Exception:
                pass  # Never block the original function

            return result

        return wrapper
    return decorator
