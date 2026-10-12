"""Base Agent Framework — All Velyrion agents inherit from this.

Uses Google Gemini API (free tier) for LLM capabilities.
Auto-reports all actions to the Velyrion governance platform.
"""

import os
import json
import time
import uuid
import logging
from datetime import datetime
from typing import Optional
from abc import ABC, abstractmethod

import google.generativeai as genai
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


class VelyrionReporter:
    """Reports agent actions/events to the Velyrion governance platform."""

    def __init__(self, agent_id: str, agent_name: str):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.api_url = os.getenv("VELYRION_API_URL", "")
        self.token = os.getenv("VELYRION_API_TOKEN", "")
        self.enabled = bool(self.api_url and self.token)

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def report_event(self, action: str, details: dict = None, severity: str = "INFO"):
        """Report an action/event to Velyrion."""
        if not self.enabled:
            return
        try:
            requests.post(
                f"{self.api_url}/api/events",
                json={
                    "agent_id": self.agent_id,
                    "event_type": action,
                    "severity": severity,
                    "details": json.dumps(details or {}),
                    "timestamp": datetime.utcnow().isoformat(),
                },
                headers=self._headers(),
                timeout=5,
            )
        except Exception:
            pass  # Don't crash the agent if reporting fails

    def report_violation(self, rule: str, details: str = ""):
        """Report a policy violation to Velyrion."""
        if not self.enabled:
            return
        try:
            requests.post(
                f"{self.api_url}/api/violations",
                json={
                    "agent_id": self.agent_id,
                    "rule_violated": rule,
                    "details": details,
                    "severity": "HIGH",
                },
                headers=self._headers(),
                timeout=5,
            )
        except Exception:
            pass


class BaseAgent(ABC):
    """Base class for all Velyrion-governed AI agents."""

    def __init__(self, agent_name: str, agent_id: str = None):
        self.agent_name = agent_name
        self.agent_id = agent_id or f"agent-{uuid.uuid4().hex[:8]}"
        self.logger = logging.getLogger(agent_name)
        self.reporter = VelyrionReporter(self.agent_id, agent_name)
        self.conversation_history = []
        self.total_tokens_used = 0
        self.actions_taken = 0
        self.start_time = time.time()

        # Initialize Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your-gemini-api-key-here":
            self.logger.warning("⚠ GEMINI_API_KEY not set — agent will use mock responses")
            self.model = None
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                system_instruction=self.get_system_prompt(),
            )
            self.chat = self.model.start_chat(history=[])

        self.logger.info(f"🤖 {agent_name} initialized (ID: {self.agent_id})")

    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the agent's system prompt."""
        pass

    @abstractmethod
    def get_tools(self) -> list[dict]:
        """Return the agent's available tools/capabilities."""
        pass

    def think(self, user_input: str) -> str:
        """Send a message to the agent and get a response."""
        self.actions_taken += 1

        # Report to Velyrion
        self.reporter.report_event("AGENT_QUERY", {
            "input_preview": user_input[:200],
            "action_count": self.actions_taken,
        })

        if not self.model:
            # Mock response when no API key
            response_text = self._mock_response(user_input)
        else:
            try:
                response = self.chat.send_message(user_input)
                response_text = response.text
                # Track tokens
                if hasattr(response, "usage_metadata"):
                    self.total_tokens_used += getattr(response.usage_metadata, "total_token_count", 0)
            except Exception as e:
                self.logger.error(f"Gemini error: {e}")
                response_text = f"⚠ Agent error: {str(e)}"
                self.reporter.report_event("AGENT_ERROR", {"error": str(e)}, severity="HIGH")

        self.conversation_history.append({"role": "user", "content": user_input})
        self.conversation_history.append({"role": "assistant", "content": response_text})

        return response_text

    def _mock_response(self, user_input: str) -> str:
        """Fallback response when no Gemini API key is configured."""
        return (
            f"🤖 [{self.agent_name}] Mock response (set GEMINI_API_KEY for real AI)\n\n"
            f"I received your message: \"{user_input[:100]}...\"\n\n"
            f"Tools available: {', '.join(t['name'] for t in self.get_tools())}\n"
            f"Actions taken this session: {self.actions_taken}"
        )

    def get_status(self) -> dict:
        """Get agent health/status info."""
        uptime = time.time() - self.start_time
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "status": "ACTIVE",
            "uptime_seconds": round(uptime),
            "total_tokens_used": self.total_tokens_used,
            "actions_taken": self.actions_taken,
            "conversation_length": len(self.conversation_history),
            "tools": [t["name"] for t in self.get_tools()],
        }

    def reset(self):
        """Reset conversation history."""
        self.conversation_history = []
        if self.model:
            self.chat = self.model.start_chat(history=[])
        self.logger.info(f"🔄 {self.agent_name} conversation reset")
