"use client";
import { useEffect, useState, useRef } from "react";
import { api, Agent, DashboardStats } from "@/lib/api";

interface Message {
  role: "user" | "copilot";
  content: string;
  timestamp: string;
}

const SUGGESTIONS = [
  "Which agents have the highest risk?",
  "How can I reduce total cost?",
  "Are there any budget alerts?",
  "Recommend policies for new agents",
  "What's our compliance status?",
  "Show me anomaly trends",
];

export default function CopilotPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "copilot", content: "👋 I'm your Governance AI Copilot. I analyze your fleet and provide actionable recommendations. Ask me anything about your agents, costs, risks, or compliance.", timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getAgents(), api.getStats()])
      .then(([a, s]) => { setAgents(a); setStats(s); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const generateResponse = (query: string): string => {
    const q = query.toLowerCase();
    const totalCost = agents.reduce((s, a) => s + a.total_cost_usd, 0);
    const totalViolations = agents.reduce((s, a) => s + a.total_violations, 0);
    const activeAgents = agents.filter(a => a.status === "ACTIVE");
    const highRisk = agents.filter(a => a.total_violations > 3);
    const overBudget = agents.filter(a => a.max_token_budget > 0 && (a.tokens_used / a.max_token_budget) > 0.85);

    if (q.includes("risk") || q.includes("dangerous")) {
      if (highRisk.length === 0) return "🟢 **Good news!** No agents are currently flagged as high risk. All agents have 3 or fewer violations.\n\n**Recommendation:** Continue monitoring with current policies. Consider tightening thresholds if you want proactive risk management.";
      return `⚠️ **${highRisk.length} agent${highRisk.length > 1 ? "s" : ""} flagged as high risk:**\n\n${highRisk.map(a => `• **${a.agent_name}** — ${a.total_violations} violations, $${a.total_cost_usd.toFixed(2)} spent`).join("\n")}\n\n**Recommendation:** Review these agents' allowed tools and consider reducing their token budgets. Enable human-in-the-loop for their operations.`;
    }

    if (q.includes("cost") || q.includes("spend") || q.includes("expensive") || q.includes("reduce")) {
      const topSpender = [...agents].sort((a, b) => b.total_cost_usd - a.total_cost_usd)[0];
      return `💰 **Total fleet cost: $${totalCost.toFixed(2)}**\n\nTop spender: **${topSpender?.agent_name}** at $${topSpender?.total_cost_usd.toFixed(2)}\n\n**3 ways to reduce costs:**\n1. Route simple tasks to cheaper models (est. 20% saving)\n2. Enable token-aware caching for repetitive queries\n3. Set tighter per-action cost limits on top spenders\n\n**Estimated savings: $${(totalCost * 0.15).toFixed(2)}/month**`;
    }

    if (q.includes("budget") || q.includes("alert")) {
      if (overBudget.length === 0) return "✅ **All agents within budget.** No agents have exceeded 85% of their token budget.\n\n**Tip:** Set up proactive alerts at 70% to catch issues early.";
      return `🚨 **${overBudget.length} agent${overBudget.length > 1 ? "s" : ""} approaching budget limit:**\n\n${overBudget.map(a => `• **${a.agent_name}** — ${Math.round((a.tokens_used / a.max_token_budget) * 100)}% used (${a.tokens_used.toLocaleString()}/${a.max_token_budget.toLocaleString()})`).join("\n")}\n\n**Recommendation:** Increase budgets or optimize prompt efficiency.`;
    }

    if (q.includes("polic") || q.includes("recommend") || q.includes("new agent")) {
      return "📜 **Recommended policies for new agents:**\n\n1. **Tool Whitelist** — Only allow explicitly approved tools\n2. **Budget Cap** — Set max_token_budget to 50,000 for first 30 days\n3. **Human Review** — Require approval for CONFIDENTIAL+ data access\n4. **Rate Limit** — Max 100 actions/hour during probation\n5. **Kill Switch** — Auto-kill on 3+ violations in 24 hours\n\nApply these as a \"New Agent Probation\" policy template.";
    }

    if (q.includes("compliance") || q.includes("regulation") || q.includes("audit")) {
      return `🏛️ **Compliance Status:**\n\n• **EU AI Act** — ~90% compliant\n• **SOC 2** — ~85% compliant\n• **HIPAA** — ~80% compliant\n• **GDPR** — ~85% compliant\n\n**Action items:**\n1. Configure data retention policies (SOC2)\n2. Enable at-rest encryption (HIPAA)\n3. Complete DPO support integration (GDPR)\n\nVisit **/regulatory** for detailed compliance reports.`;
    }

    if (q.includes("anomal") || q.includes("trend") || q.includes("pattern")) {
      return `📊 **Anomaly Analysis:**\n\n• **${totalViolations}** total violations across ${agents.length} agents\n• **${activeAgents.length}** agents currently active and monitored\n• Most common violation type: Unauthorized tool usage\n\n**Trends:**\n• Violation rate is ${totalViolations < 10 ? "LOW — well within acceptable range" : "ELEVATED — review policies"}\n• No seasonal patterns detected\n\nVisit **/threat-intel** for pattern analysis and **/behavioral-dna** for drift detection.`;
    }

    return `I analyzed your query across ${agents.length} agents and ${stats?.total_events || 0} events.\n\n**Quick Summary:**\n• ${activeAgents.length} active agents\n• $${totalCost.toFixed(2)} total spend\n• ${totalViolations} violations\n\nTry asking me specific questions like:\n• "Which agents have the highest risk?"\n• "How can I reduce costs?"\n• "What's our compliance status?"`;
  };

  const sendMessage = (content: string) => {
    if (!content.trim()) return;
    const userMsg: Message = { role: "user", content: content.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const response = generateResponse(content);
      setMessages(prev => [...prev, { role: "copilot", content: response, timestamp: new Date().toISOString() }]);
      setThinking(false);
    }, 800 + Math.random() * 700);
  };

  return (
    <div className="cp-page">
      <div className="cp-header">
        <div><h1 className="lb-title">🤖 Governance AI Copilot</h1><p className="lb-subtitle">AI-powered governance assistant — ask anything about your fleet</p></div>
      </div>

      <div className="cp-main">
        <div className="cp-chat" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`cp-msg ${m.role}`}>
              <div className="cp-msg-avatar">{m.role === "copilot" ? "🤖" : "👤"}</div>
              <div className="cp-msg-bubble">
                <div className="cp-msg-content" dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
                <div className="cp-msg-time">{new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="cp-msg copilot">
              <div className="cp-msg-avatar">🤖</div>
              <div className="cp-msg-bubble"><div className="cp-thinking"><span /><span /><span /></div></div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="cp-suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="cp-suggestion" onClick={() => sendMessage(s)}>{s}</button>
          ))}
        </div>

        {/* Input */}
        <div className="cp-input-row">
          <input className="cp-input" placeholder="Ask about your agents, costs, risks, compliance..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} />
          <button className="btn btn-primary" onClick={() => sendMessage(input)} disabled={!input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
