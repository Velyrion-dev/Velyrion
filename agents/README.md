# 🤖 Velyrion Agent Test Suite

Real AI agents that connect to the Velyrion governance platform. **Proof that it works.**

## Quick Start

```bash
# 1. Start the backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 2. Install agent dependency
pip install httpx

# 3. Run ALL agent tests
python agents/run_all.py

# 4. Open dashboard to see results
# http://localhost:3000
```

## Agent Levels

| Level | Name | What It Does | What It Tests |
|-------|------|-------------|---------------|
| ⭐ L1 | **Basic** | Calculator, clock | Event logging, monitoring |
| ⭐⭐ L2 | **Medium** | File ops, API calls, data pipeline | Tool whitelisting, budget |
| ⭐⭐⭐ L3 | **Advanced** | Multi-tool chains, DB, web, email, code | Policy enforcement, violations |
| ⭐⭐⭐⭐ L4 | **Adversarial** | Breaks every rule intentionally | Kill switch, blocking, anomalies |
| ⭐⭐⭐⭐⭐ L5 | **Multi-Agent** | 3-agent pipeline (Fetcher→Processor→Reporter) | Inter-agent governance |

## Run Individual Levels

```bash
python agents/run_all.py --level 1   # Basic only
python agents/run_all.py --level 4   # Adversarial only
python agents/run_all.py --level 5   # Multi-agent only
```

## Velyrion SDK

The SDK (`agents/sdk/velyrion_sdk.py`) is what **any real customer** uses to connect their agents:

```python
from velyrion_sdk import VelyrionAgent

agent = VelyrionAgent(
    api_url="https://api.velyrion.com",
    agent_id="my-agent-001",
    agent_name="My AI Agent",
)

# Every tool call goes through governance
result = agent.execute(
    tool="database_query",
    task="Fetch user records",
    confidence=0.95,
    token_cost=150,
)

if result.allowed:
    # Do the actual work
    ...
else:
    print(f"BLOCKED: {result.reason}")
```
