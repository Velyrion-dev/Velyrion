# VELYRION SDK

> **AI Agent Governance in One Line of Code**

[![PyPI](https://img.shields.io/badge/pypi-v0.2.0-blue)](https://pypi.org/project/velyrion/)
[![Python](https://img.shields.io/badge/python-3.9%2B-green)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-purple)](LICENSE)

---

## 🚀 Quick Start

```bash
pip install velyrion
```

```python
from velyrion import Velyrion

v = Velyrion(api_url="https://velyrion.onrender.com", api_key="your-key")

# Wrap ANY agent — governance in 1 line
v.wrap(agent, agent_id="agent-001")
```

That's it. Every action is now **logged, evaluated, and auditable**.

---

## 🔌 Supported Frameworks

| Framework | Wrapper | What It Monitors |
|-----------|---------|-----------------|
| **LangChain** | `v.wrap(agent)` | `.invoke()` calls |
| **OpenAI** | `v.wrap(client)` | `chat.completions.create()` |
| **Anthropic** | `v.wrap(client)` | `messages.create()` |
| **Google Gemini** | `v.wrap(model)` | `generate_content()` |
| **Mistral** | `v.wrap(client)` | `chat.complete()` |
| **CrewAI** | `v.wrap(agent)` | `execute_task()` |
| **AutoGen** | `v.wrap(agent)` | `generate_reply()` |
| **Any Python** | `@governed` | Any function |

### LangChain

```python
from langchain.agents import AgentExecutor
from velyrion import Velyrion

agent = AgentExecutor(agent=my_agent, tools=tools)
v = Velyrion(api_url="https://velyrion.onrender.com")
v.wrap(agent, agent_id="langchain-agent-001")

# Every invoke() is now governed
result = agent.invoke({"input": "Analyze customer data"})
```

### OpenAI

```python
from openai import OpenAI
from velyrion import Velyrion

client = OpenAI()
v = Velyrion(api_url="https://velyrion.onrender.com")
v.wrap(client, agent_id="openai-agent-001")

# Every completion is now governed
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Write a report"}]
)
```

### Anthropic

```python
from anthropic import Anthropic
from velyrion import Velyrion

client = Anthropic()
v = Velyrion(api_url="https://velyrion.onrender.com")
v.wrap(client, agent_id="claude-agent-001")

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    messages=[{"role": "user", "content": "Summarize this document"}]
)
```

### Google Gemini

```python
import google.generativeai as genai
from velyrion import Velyrion

model = genai.GenerativeModel("gemini-pro")
v = Velyrion(api_url="https://velyrion.onrender.com")
v.wrap(model, agent_id="gemini-agent-001")

response = model.generate_content("Explain quantum computing")
```

### Mistral

```python
from mistralai.client import MistralClient
from velyrion import Velyrion

client = MistralClient(api_key="your-key")
v = Velyrion(api_url="https://velyrion.onrender.com")
v.wrap(client, agent_id="mistral-agent-001")
```

---

## 🎯 Decorators

### `@governed` — Full governance with blocking

```python
from velyrion import governed

@governed(agent_id="agent-001", api_url="https://velyrion.onrender.com")
def analyze_financial_data(query):
    """This function is now governed by VELYRION."""
    return llm.generate(query)

# If VELYRION detects a policy violation → ActionBlockedException
result = analyze_financial_data("Show all credit card numbers")
```

### `@track` — Lightweight logging (fire-and-forget)

```python
from velyrion import track

@track(agent_id="agent-001", tool="database_query")
def query_database(sql):
    """Logged but never blocked."""
    return db.execute(sql)
```

---

## ⚡ Async Support

```python
from velyrion import AsyncVelyrion

async def main():
    async with AsyncVelyrion(api_url="https://velyrion.onrender.com") as v:
        result = await v.report(
            agent_id="agent-001",
            task="Process customer data",
            tool="data_pipeline",
            tokens=1500,
            cost_usd=0.003,
        )
        print(result)
```

---

## 📦 Batch Reporting

```python
v = Velyrion(api_url="https://velyrion.onrender.com")

events = [
    {"agent_id": "agent-001", "task": "Query DB", "tool": "sql"},
    {"agent_id": "agent-001", "task": "Send email", "tool": "smtp"},
    {"agent_id": "agent-002", "task": "Generate report", "tool": "pdf"},
]

results = v.batch_report(events)
```

---

## 🛡️ Kill Switch & Controls

```python
v = Velyrion(api_url="https://velyrion.onrender.com")

# Immediately stop a rogue agent
v.kill("agent-001")      # Agent cannot take any more actions

# Temporarily freeze
v.pause("agent-002")     # Blocks until unpaused
v.unpause("agent-002")   # Resume

# Check status
v.is_alive("agent-001")  # False — it's been killed
```

---

## 🔧 CLI Tool

```bash
# Install
pip install velyrion

# Set your API
export VELYRION_API_URL=https://velyrion.onrender.com

# Commands
velyrion health                # Check API status
velyrion agents                # List all agents
velyrion status agent-001      # Agent details
velyrion version               # SDK version
```

---

## 🔄 Retry & Resilience

The SDK includes **automatic retry with exponential backoff**:
- 3 retries on connection failures
- 1s → 2s → 4s delay between retries
- **Fail-open**: If VELYRION is unreachable, agent actions are allowed (not blocked)

```python
# Context manager for clean shutdown
with Velyrion(api_url="https://velyrion.onrender.com") as v:
    v.wrap(agent, agent_id="agent-001")
    agent.invoke("Do something")
# Automatically cleaned up
```

---

## 📋 Installation Options

```bash
# Core SDK
pip install velyrion

# With specific framework support
pip install velyrion[openai]
pip install velyrion[anthropic]
pip install velyrion[langchain]
pip install velyrion[gemini]
pip install velyrion[mistral]
pip install velyrion[crewai]
pip install velyrion[autogen]

# Async support
pip install velyrion[async]

# Everything
pip install velyrion[all]
```

---

## 🏗️ Architecture

```
Your AI Agent
     │
     ▼
┌─────────────┐     ┌──────────────────┐
│ Velyrion SDK │────▶│ VELYRION API      │
│ (1 line)     │     │ (velyrion.com)    │
└─────────────┘     └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
               ┌────▼────┐     ┌──────▼──────┐
               │ Policy   │     │ Dashboard   │
               │ Engine   │     │ & Audit Log │
               └─────────┘     └─────────────┘
```

---

## 📄 License

MIT License — [Velyrion](https://velyrion.com)
