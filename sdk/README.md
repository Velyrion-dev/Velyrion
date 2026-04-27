# VELYRION SDK

**AI Agent Governance in 2 Lines of Code.**

VELYRION is the firewall for AI agents. It sits in the execution path of every agent action — monitoring, evaluating, and enforcing governance policies in real-time.

---

## Install

```bash
pip install velyrion
# or from source:
pip install ./sdk
# or from Git:
pip install git+https://github.com/YOUR_USERNAME/velyrion.git#subdirectory=sdk
```

---

## Quick Start

### Option 1: Wrap Any Agent (2 Lines)

```python
from velyrion import Velyrion

v = Velyrion(api_url="http://localhost:8000")
agent = v.wrap(your_agent, agent_id="agent-001")  # That's it.
agent.run("Analyze customer data")  # Every action is now governed
```

### Option 2: Decorate Functions

```python
from velyrion import governed, track

@governed(agent_id="agent-001", tool="database_query")
def query_database(sql):
    return db.execute(sql)

@track(agent_id="agent-001")
def call_external_api(url):
    return requests.get(url)
```

### Option 3: OpenAI Integration

```python
from openai import OpenAI
from velyrion import Velyrion

client = OpenAI()
v = Velyrion()
client = v.wrap(client, agent_id="agent-001")

# Every completion is now governed
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Find customer emails"}]
)
```

### Option 4: LangChain Integration

```python
from langchain.agents import AgentExecutor
from velyrion import Velyrion

v = Velyrion()
agent = AgentExecutor(agent=..., tools=...)
agent = v.wrap(agent, agent_id="agent-001")
agent.invoke({"input": "Analyze Q4 report"})
```

---

## Configuration

```python
v = Velyrion(
    api_url="https://your-velyrion-api.com",  # Backend URL
    api_key="your-api-key",                    # Optional: API key auth
    block_on_violation=True,                   # Block or just log violations
    heartbeat_interval=10,                     # Kill-switch check frequency (sec)
    fail_open=True,                            # Allow action if API unreachable
)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `api_url` | `http://localhost:8000` | VELYRION backend URL |
| `api_key` | `None` | API key for machine-to-machine auth |
| `block_on_violation` | `False` | If `True`, raises exception on violations |
| `heartbeat_interval` | `10` | Seconds between kill-switch checks |
| `fail_open` | `True` | Allow actions when API is unreachable |

---

## Authentication

The SDK supports two auth modes:

### API Key (Recommended for SDK)

```python
v = Velyrion(api_url="https://api.yourdomain.com", api_key="your-key")
```

Set `VELYRION_API_KEY` on the backend to enable.

### JWT Token (Advanced)

```python
v = Velyrion(api_url="https://api.yourdomain.com")
v.authenticate(email="operator@velyrion.ai", password="password")
```

---

## Policy-as-Code (YAML)

Define governance rules in version-controlled YAML files:

```yaml
# policies/finance.yaml
name: "Finance Agent Guardrails"
version: "1.0"
description: "Rules for agents handling financial data"

rules:
  - id: block-unauthorized-tools
    description: "Block unauthorized tools"
    condition: "tool_used NOT IN agent.allowed_tools"
    action: BLOCK
    severity: HIGH

  - id: kill-low-confidence
    description: "Kill agent on low confidence"
    condition: "confidence_score < 0.3"
    action: KILL
    severity: CRITICAL

  - id: flag-high-value
    description: "Flag high-value operations"
    condition: "event.amount > 5000"
    action: FLAG
    severity: MEDIUM
```

### Evaluate Policies

```python
from velyrion import Policy

policy = Policy.from_file("policies/finance.yaml")

# Evaluate against an event
violations = policy.evaluate(
    agent_id="agent-002",
    tool="admin_console",
    data={"amount": 15000}
)

for v in violations:
    print(f"{v.rule_id}: {v.action} [{v.severity}]")
# → block-unauthorized-tools: BLOCK [HIGH]
# → flag-high-value: FLAG [MEDIUM]
```

### Remote Policy Evaluation

```python
# Evaluate using server-side policies
result = v.evaluate_policy(
    policy_name="finance-agents",
    agent_id="agent-002",
    tool="payment_processor",
    data={"amount": 50000}
)
```

---

## Event Reporting

Report agent actions to the governance platform:

```python
v.report(
    agent_id="agent-001",
    task="Process customer refund",
    tool="payment_api",
    input_data={"customer_id": "C-1234", "amount": 500},
    output_data={"status": "success", "transaction_id": "TX-789"},
    tokens_used=1500,
    confidence_score=0.92,
    duration_seconds=2.3,
)
```

---

## Kill Switch

### How It Works

1. Dashboard admin clicks **⛔ Kill** on an agent
2. Backend sets agent status to `LOCKED`
3. SDK heartbeat detects the kill signal (within `heartbeat_interval` seconds)
4. Next `report()` or `wrap()` call raises `AgentKilledException`
5. Agent is prevented from taking any further actions

### Handling Kill Signals

```python
from velyrion import Velyrion
from velyrion.client import AgentKilledException

v = Velyrion()

try:
    v.report(agent_id="agent-008", task="Process payment")
except AgentKilledException as e:
    print(f"Agent killed: {e}")
    # Clean up, save state, exit gracefully
    cleanup_resources()
    sys.exit(1)
```

### Manual Kill Check

```python
if v.is_killed("agent-008"):
    print("Agent has been terminated — stopping execution")
    sys.exit(1)
```

### Programmatic Kill (Admin)

```python
v.kill("agent-008", reason="Suspicious activity detected")
```

---

## Action Blocking

When `block_on_violation=True`, the SDK blocks actions that violate policies:

```python
from velyrion import Velyrion
from velyrion.client import ActionBlockedException

v = Velyrion(block_on_violation=True)

try:
    v.report(
        agent_id="agent-008",
        task="Wire $50K to offshore account",
        tool="payment_processor"
    )
except ActionBlockedException as e:
    print(f"Blocked: {e.reason}")
    # → "Blocked: Agent used tool 'payment_processor' outside allowed tools"
    print(f"Severity: {e.severity}")
    # → "CRITICAL"
```

---

## Fail-Open Design

By default, if the VELYRION API is unreachable, the SDK **allows actions to proceed** (`fail_open=True`). This prevents governance downtime from blocking your AI application.

```python
# Fail-open (default): action proceeds if API is down
v = Velyrion(fail_open=True)

# Fail-closed: action is blocked if API is down
v = Velyrion(fail_open=False)
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VELYRION_API_URL` | Backend URL (overrides constructor) |
| `VELYRION_API_KEY` | API key (overrides constructor) |
| `VELYRION_AGENT_ID` | Default agent ID |
| `VELYRION_FAIL_OPEN` | `true` / `false` |

---

## Dashboard Integration

All events reported via the SDK appear in real-time on the VELYRION dashboard:

| SDK Action | Dashboard Page |
|------------|---------------|
| `v.report()` | Activity Feed (`/events`) |
| Policy violation | Violations (`/violations`) |
| Anomaly detected | Anomalies (`/anomalies`) |
| `v.kill()` | Incidents (`/incidents`) |
| HITL required | Approvals (`/approvals`) |
| Webhook triggered | Webhooks (`/webhooks`) |

---

## Forensic Replay

Every action reported through the SDK is stored and can be replayed for forensic analysis:

```
Dashboard → Agent Replay → Select Agent → View Timeline
```

Each event shows:
- Timestamp
- Tool used
- Input / Output data
- Token usage
- Confidence score
- Duration
- Any violations triggered

---

## Requirements

- Python 3.10+
- `httpx` (HTTP client)
- `pyyaml` (Policy parsing)

---

## Project Structure

```
sdk/
├── velyrion/
│   ├── __init__.py       # Public API exports
│   ├── client.py         # VelyrionClient — wrap(), report(), kill(), heartbeat
│   ├── decorators.py     # @governed, @track decorators
│   └── policy.py         # YAML policy loading + evaluation
├── pyproject.toml        # Package config
└── README.md             # This file
```

---

## Full Example

```python
import asyncio
from velyrion import Velyrion

async def main():
    # Initialize
    v = Velyrion(
        api_url="https://api.velyrion.ai",
        api_key="vly_prod_xxxx",
        block_on_violation=True,
    )

    # Register + wrap your agent
    agent = v.wrap(my_langchain_agent, agent_id="finance-bot-v2")

    # Run with governance
    try:
        result = await agent.ainvoke({"input": "Process Q4 refunds"})
        print(f"Result: {result}")
    except Exception as e:
        print(f"Governance blocked: {e}")

asyncio.run(main())
```
