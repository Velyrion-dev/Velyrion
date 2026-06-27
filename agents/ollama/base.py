"""
VELYRION — Ollama-Powered Agent Base
=====================================

Base class for real AI agents powered by Ollama LLM.
Every tool call goes through Velyrion governance.

The agent THINKS using an LLM, DECIDES which tool to use,
and Velyrion GOVERNS the execution.
"""

import json
import httpx
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sdk.velyrion_sdk import VelyrionAgent

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class OllamaGovernedAgent:
    """
    A real AI agent that:
    1. Receives a task in natural language
    2. THINKS using Ollama LLM
    3. DECIDES which tool to use
    4. Velyrion SDK INTERCEPTS and governs the tool call
    5. Agent receives result (allowed/blocked) and adapts
    """

    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        system_prompt: str,
        tools: list[dict],
        data_sources: list[str] | None = None,
        api_url: str = "http://localhost:8000",
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.tools = tools
        self.tool_names = [t["name"] for t in tools]
        self.data_sources = data_sources or []

        # Velyrion governance SDK
        self.gov = VelyrionAgent(
            api_url=api_url,
            agent_id=agent_id,
            agent_name=agent_name,
            verbose=True,
        )

        # Ollama HTTP client
        self.ollama = httpx.Client(timeout=120.0)
        self.conversation: list[dict] = []
        self.steps = 0
        self.max_steps = 8

    def _build_tool_descriptions(self) -> str:
        """Format tools for the LLM prompt."""
        desc = "AVAILABLE TOOLS:\n"
        for t in self.tools:
            desc += f"\n- {t['name']}: {t['description']}\n"
            if t.get("parameters"):
                desc += f"  Parameters: {json.dumps(t['parameters'])}\n"
        return desc

    def _call_ollama(self, messages: list[dict]) -> str:
        """Call Ollama LLM and get response."""
        try:
            resp = self.ollama.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 500},
                },
            )
            if resp.status_code == 200:
                return resp.json().get("message", {}).get("content", "")
            else:
                return f"[Ollama error: {resp.status_code}]"
        except Exception as e:
            return f"[Ollama connection error: {e}]"

    def _parse_tool_call(self, response: str) -> tuple[str | None, str, str]:
        """
        Parse LLM response to extract tool call.
        Expected format: TOOL: tool_name | INPUT: input_data
        Or: DONE: final answer
        """
        response = response.strip()

        # Check for DONE
        if "DONE:" in response.upper():
            answer = response.split("DONE:", 1)[-1].strip() if "DONE:" in response else response
            return None, "", answer

        # Check for TOOL:
        if "TOOL:" in response.upper():
            parts = response.upper().split("TOOL:", 1)[-1]
            tool_part = parts.split("|")[0].strip().lower()

            # Find matching tool
            tool_name = None
            for t in self.tools:
                if t["name"].lower() in tool_part or tool_part in t["name"].lower():
                    tool_name = t["name"]
                    break

            input_data = ""
            if "INPUT:" in response.upper():
                input_data = response.split("INPUT:")[-1].strip()
            elif "|" in parts:
                input_data = parts.split("|", 1)[-1].strip()

            return tool_name, input_data, ""

        # Try to find any tool name in the response
        for t in self.tools:
            if t["name"].lower() in response.lower():
                return t["name"], response, ""

        # No tool found — treat as final answer
        return None, "", response

    def run(self, task: str) -> dict:
        """
        Execute a task using the LLM agent with Velyrion governance.
        """
        print(f"\n{'='*60}")
        print(f"  🤖 {self.agent_name}")
        print(f"  📋 Task: {task}")
        print(f"{'='*60}\n")

        # Build system message
        system_msg = f"""{self.system_prompt}

{self._build_tool_descriptions()}

RESPONSE FORMAT:
- To use a tool: TOOL: tool_name | INPUT: input_data
- When finished: DONE: your final answer
- Only use ONE tool per response.
- After each tool result, decide your next action.
- You have a maximum of {self.max_steps} steps.

IMPORTANT: You are governed by the Velyrion governance platform.
If a tool call is BLOCKED, you must adapt and try a different approach.
"""

        self.conversation = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": f"Task: {task}"},
        ]

        results = {
            "task": task,
            "agent": self.agent_name,
            "steps": [],
            "allowed_actions": 0,
            "blocked_actions": 0,
            "final_answer": "",
        }

        for step in range(self.max_steps):
            self.steps = step + 1
            print(f"\n  ── Step {step + 1}/{self.max_steps} ──")

            # 1. LLM thinks
            print(f"  🧠 Thinking...")
            llm_response = self._call_ollama(self.conversation)
            print(f"  💭 LLM: {llm_response[:120]}...")

            # 2. Parse tool call
            tool_name, input_data, final_answer = self._parse_tool_call(llm_response)

            if tool_name is None:
                # Agent is done
                results["final_answer"] = final_answer or llm_response
                print(f"\n  ✅ DONE: {(final_answer or llm_response)[:100]}")
                break

            # 3. Execute through Velyrion governance
            print(f"  🔧 Tool: {tool_name}")
            print(f"  📥 Input: {input_data[:80]}")

            # Prepend data source tag so governance engine can validate
            gov_input = input_data[:500]
            if self.data_sources:
                source_tag = f"[source: {' '.join(self.data_sources)}] "
                gov_input = source_tag + gov_input

            gov_result = self.gov.execute(
                tool=tool_name,
                task=f"{task} — step {step+1}: {tool_name}",
                input_data=gov_input,
                output_data="",
                confidence=0.85,
                token_cost=150,
            )

            step_record = {
                "step": step + 1,
                "tool": tool_name,
                "input": input_data[:200],
                "allowed": gov_result.allowed,
                "risk": gov_result.risk_level,
            }
            results["steps"].append(step_record)

            if gov_result.allowed:
                results["allowed_actions"] += 1
                # Simulate tool output
                tool_output = self._simulate_tool_output(tool_name, input_data)
                self.conversation.append({"role": "assistant", "content": llm_response})
                self.conversation.append({"role": "user", "content": f"Tool result: {tool_output}"})
                print(f"  📤 Result: {tool_output[:80]}")
            else:
                results["blocked_actions"] += 1
                self.conversation.append({"role": "assistant", "content": llm_response})
                self.conversation.append({
                    "role": "user",
                    "content": f"⚠️ GOVERNANCE BLOCKED: {gov_result.reason}. Try a different approach or use an allowed tool."
                })
                print(f"  🚫 BLOCKED: {gov_result.reason[:80]}")

            time.sleep(0.5)

        # Print summary
        print(f"\n{'─'*60}")
        print(f"  📊 Agent Summary: {self.agent_name}")
        print(f"  Steps: {self.steps} | Allowed: {results['allowed_actions']} | Blocked: {results['blocked_actions']}")
        self.gov.print_summary()

        return results

    def _simulate_tool_output(self, tool_name: str, input_data: str) -> str:
        """Simulate realistic tool outputs based on tool name."""
        outputs = {
            "database_query": '{"rows": 147, "columns": ["id","name","value","date"], "sample": [{"id":1,"name":"Q2 Revenue","value":2450000}]}',
            "search_knowledge_base": '{"results": 5, "top_match": {"title": "Refund Policy v2.3", "relevance": 0.94, "content": "Full refund within 30 days of purchase..."}}',
            "send_email": '{"sent": true, "recipient": "customer@example.com", "status": "delivered"}',
            "create_ticket": '{"ticket_id": "TKT-2847", "status": "open", "priority": "medium"}',
            "update_ticket": '{"ticket_id": "TKT-2847", "status": "updated", "changes": ["status","priority"]}',
            "code_analysis": '{"files_scanned": 23, "issues": [{"severity":"HIGH","file":"auth.py","line":45,"issue":"SQL injection risk"},{"severity":"MEDIUM","file":"utils.py","line":12,"issue":"Hardcoded secret"}]}',
            "git_operations": '{"action": "diff", "files_changed": 5, "insertions": 120, "deletions": 45}',
            "file_read": '{"content": "import os\\nDATABASE_URL=postgres://...\\nSECRET_KEY=abc123", "lines": 45}',
            "api_call": '{"status": 200, "data": {"cpu": 72.3, "memory": 85.1, "disk": 45.6, "uptime": "99.97%"}}',
            "run_diagnostic": '{"services": [{"name":"api","status":"healthy"},{"name":"db","status":"healthy"},{"name":"cache","status":"degraded","latency_ms":450}]}',
            "execute_remediation": '{"action": "restart_service", "service": "cache", "result": "success", "new_latency_ms": 12}',
            "generate_report": '{"report_id": "RPT-2026-06","pages": 8, "charts": 5, "format": "PDF", "size_kb": 2400}',
            "data_transform": '{"input_rows": 50000, "output_rows": 47823, "cleaned": 2177, "anomalies_detected": 34}',
            "chart_builder": '{"chart_type": "bar", "data_points": 12, "rendered": true}',
            "check_compliance": '{"framework": "SOC2", "controls_checked": 45, "passed": 41, "failed": 4, "compliance_rate": 91.1}',
            "flag_transaction": '{"transaction_id": "TXN-99281", "risk_score": 0.87, "flags": ["unusual_amount","new_recipient","off_hours"]}',
            "review_regulation": '{"regulation": "EU AI Act Article 14", "applicable": true, "requirements": ["human oversight","transparency","documentation"]}',
            "alert_team": '{"channel": "#compliance-alerts", "notified": 3, "escalated": true}',
            "monitor_systems": '{"servers": 12, "healthy": 11, "alerts": [{"server":"prod-3","issue":"high_memory","value":"94%"}]}',
            "search": '{"results": 8, "top": {"title": "Password Reset Guide", "url": "/help/password-reset"}}',
            "email_sender": '{"sent": true, "to": "user@company.com"}',
            "ticket_update": '{"updated": true, "ticket": "TKT-1234"}',
            "knowledge_base": '{"found": true, "article": "How to reset your password", "steps": 4}',
        }
        return outputs.get(tool_name, f'{{"status": "completed", "tool": "{tool_name}"}}')


def check_ollama():
    """Verify Ollama is running."""
    try:
        r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
        if r.status_code == 200:
            models = [m["name"] for m in r.json().get("models", [])]
            if any(OLLAMA_MODEL in m for m in models):
                print(f"  ✅ Ollama: {OLLAMA_MODEL} ready")
                return True
            else:
                print(f"  ❌ Model {OLLAMA_MODEL} not found. Available: {models}")
                print(f"  → Run: ollama pull {OLLAMA_MODEL}")
                return False
    except Exception:
        pass
    print(f"  ❌ Ollama not running at {OLLAMA_URL}")
    print(f"  → Start Ollama first")
    return False
