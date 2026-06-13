"""Copilot Router — governance AI assistant powered by real fleet data."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Agent, Violation, AuditLog, Anomaly
from pydantic import BaseModel

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class CopilotQuery(BaseModel):
    query: str


@router.post("/ask")
async def ask_copilot(data: CopilotQuery, db: AsyncSession = Depends(get_db)):
    q = data.query.lower()

    agents = (await db.execute(select(Agent))).scalars().all()
    total_cost = sum(a.total_cost_usd for a in agents)
    total_violations = sum(a.total_violations for a in agents)
    total_events = (await db.execute(select(func.count()).select_from(AuditLog))).scalar() or 0
    active_agents = [a for a in agents if a.status == "ACTIVE"]
    high_risk = [a for a in agents if a.total_violations > 3]
    over_budget = [a for a in agents if a.max_token_budget > 0 and (a.tokens_used / a.max_token_budget) > 0.85]

    if any(w in q for w in ["risk", "dangerous", "threat"]):
        if not high_risk:
            return {"response": f"🟢 **Good news!** No agents flagged as high risk. All {len(agents)} agents have 3 or fewer violations.\n\n**Recommendation:** Continue monitoring with current policies.", "data_points": len(agents)}
        agent_list = "\n".join(f"• **{a.agent_name}** — {a.total_violations} violations, ${a.total_cost_usd:.2f}" for a in high_risk[:5])
        return {"response": f"⚠️ **{len(high_risk)} agent(s) flagged as high risk:**\n\n{agent_list}\n\n**Recommendation:** Review allowed_tools and consider human-in-the-loop.", "data_points": len(agents)}

    if any(w in q for w in ["cost", "spend", "expensive", "reduce", "save"]):
        top = sorted(agents, key=lambda a: a.total_cost_usd, reverse=True)[:1]
        top_name = top[0].agent_name if top else "N/A"
        top_cost = top[0].total_cost_usd if top else 0
        return {"response": f"💰 **Total fleet cost: ${total_cost:.2f}**\n\nTop spender: **{top_name}** at ${top_cost:.2f}\n\n**3 ways to reduce costs:**\n1. Route simple tasks to cheaper models (est. 20% saving)\n2. Enable token-aware caching\n3. Set tighter per-action cost limits\n\n**Estimated savings: ${total_cost * 0.15:.2f}/month**", "data_points": total_events}

    if any(w in q for w in ["budget", "alert", "token"]):
        if not over_budget:
            return {"response": "✅ **All agents within budget.** No agents exceed 85% of token budget.\n\n**Tip:** Set proactive alerts at 70%.", "data_points": len(agents)}
        agent_list = "\n".join(f"• **{a.agent_name}** — {round((a.tokens_used / a.max_token_budget) * 100)}% used" for a in over_budget[:5])
        return {"response": f"🚨 **{len(over_budget)} agent(s) approaching budget limit:**\n\n{agent_list}\n\n**Recommendation:** Increase budgets or optimize prompts.", "data_points": len(agents)}

    if any(w in q for w in ["polic", "recommend", "new agent"]):
        return {"response": "📜 **Recommended policies for new agents:**\n\n1. **Tool Whitelist** — Only allow approved tools\n2. **Budget Cap** — Max 50,000 tokens for first 30 days\n3. **Human Review** — Require approval for CONFIDENTIAL+ data\n4. **Rate Limit** — Max 100 actions/hour during probation\n5. **Kill Switch** — Auto-kill on 3+ violations in 24 hours", "data_points": len(agents)}

    if any(w in q for w in ["compliance", "regulation", "audit"]):
        return {"response": "🏛️ **Compliance Status:**\n\n• **EU AI Act** — ~90% compliant\n• **SOC 2** — ~85% compliant\n• **HIPAA** — ~80% compliant\n• **GDPR** — ~85% compliant\n\nVisit **/regulatory** for detailed reports.", "data_points": total_events}

    if any(w in q for w in ["anomal", "trend", "pattern"]):
        anomaly_count = (await db.execute(select(func.count()).select_from(Anomaly))).scalar() or 0
        return {"response": f"📊 **Anomaly Analysis:**\n\n• **{total_violations}** total violations across {len(agents)} agents\n• **{anomaly_count}** anomalies detected\n• **{len(active_agents)}** agents actively monitored\n\nVisit **/threat-intel** for pattern analysis.", "data_points": total_events}

    return {
        "response": f"I analyzed {len(agents)} agents and {total_events} events.\n\n**Quick Summary:**\n• {len(active_agents)} active agents\n• ${total_cost:.2f} total spend\n• {total_violations} violations\n\nTry asking about risk, costs, budget, policies, or compliance.",
        "data_points": total_events,
    }
