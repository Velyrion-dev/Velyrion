"use client";
import { useEffect, useState } from "react";
import { api, Agent, AgentCost } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Recommendation {
  agent: Agent;
  type: "budget_alert" | "overspend" | "idle" | "optimize";
  severity: "critical" | "warning" | "info";
  message: string;
  saving?: string;
}

export default function CostOptimizerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAgents(), api.getCosts()]).then(([a, c]) => { setAgents(a); setCosts(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="co-page"><div className="lb-header"><h1 className="lb-title">Cost Optimizer</h1><p className="lb-subtitle">Loading...</p></div></div>;

  const totalCost = agents.reduce((s, a) => s + (a.total_cost_usd || 0), 0);
  const totalTokens = agents.reduce((s, a) => s + (a.tokens_used || 0), 0);
  const totalBudget = agents.reduce((s, a) => s + (a.max_token_budget || 0), 0);
  const budgetUsage = totalBudget > 0 ? Math.round((totalTokens / totalBudget) * 100) : 0;

  // Generate recommendations
  const recommendations: Recommendation[] = [];

  agents.forEach(a => {
    const budgetPct = a.max_token_budget > 0 ? (a.tokens_used / a.max_token_budget) * 100 : 0;

    if (budgetPct >= 90) {
      recommendations.push({
        agent: a, type: "budget_alert", severity: "critical",
        message: `${a.agent_name} has used ${budgetPct.toFixed(0)}% of token budget — approaching limit!`,
      });
    } else if (budgetPct >= 75) {
      recommendations.push({
        agent: a, type: "budget_alert", severity: "warning",
        message: `${a.agent_name} has used ${budgetPct.toFixed(0)}% of budget — monitor closely.`,
      });
    }

    if (a.total_cost_usd > 100) {
      recommendations.push({
        agent: a, type: "overspend", severity: "warning",
        message: `${a.agent_name} has spent $${a.total_cost_usd.toFixed(2)} — consider reviewing task patterns.`,
        saving: `$${(a.total_cost_usd * 0.2).toFixed(2)}`,
      });
    }

    if (a.total_actions < 10 && a.status === "ACTIVE") {
      recommendations.push({
        agent: a, type: "idle", severity: "info",
        message: `${a.agent_name} is active but has only ${a.total_actions} actions — consider deactivating.`,
        saving: `$${a.total_cost_usd.toFixed(2)}`,
      });
    }

    const costPerAction = a.total_actions > 0 ? a.total_cost_usd / a.total_actions : 0;
    if (costPerAction > 0.05) {
      recommendations.push({
        agent: a, type: "optimize", severity: "info",
        message: `${a.agent_name} costs $${costPerAction.toFixed(4)}/action — above optimal threshold.`,
        saving: `$${((costPerAction - 0.01) * a.total_actions).toFixed(2)}`,
      });
    }
  });

  recommendations.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const potentialSavings = recommendations.filter(r => r.saving).reduce((s, r) => s + parseFloat(r.saving || "0"), 0);

  const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: "🚨" },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: "⚠️" },
    info: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", icon: "💡" },
  };

  // Top spenders
  const topSpenders = [...agents].sort((a, b) => b.total_cost_usd - a.total_cost_usd).slice(0, 6);
  const maxSpend = Math.max(...topSpenders.map(a => a.total_cost_usd), 0.01);

  return (
    <div className="co-page">
      <div className="lb-header">
        <h1 className="lb-title">💰 Cost Optimizer</h1>
        <p className="lb-subtitle">Budget alerts, spend analysis, and optimization recommendations</p>
      </div>

      {/* KPIs */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi green">
          <div className="an-kpi-icon">💰</div>
          <div className="an-kpi-data"><div className="an-kpi-value">${totalCost.toFixed(2)}</div><div className="an-kpi-label">Total Spend</div></div>
        </div>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">🪙</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{fmt(totalTokens)}</div><div className="an-kpi-label">Tokens Used</div></div>
        </div>
        <div className="an-kpi cyan">
          <div className="an-kpi-icon">📊</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{budgetUsage}%</div><div className="an-kpi-label">Budget Usage</div></div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">💡</div>
          <div className="an-kpi-data"><div className="an-kpi-value">${potentialSavings.toFixed(2)}</div><div className="an-kpi-label">Potential Savings</div></div>
        </div>
      </div>

      <div className="an-bottom-grid">
        {/* Recommendations */}
        <div className="an-chart-card">
          <div className="an-chart-title">🎯 Recommendations ({recommendations.length})</div>
          <div className="co-rec-list">
            {recommendations.length === 0 ? (
              <div className="an-empty">All agents are operating optimally! 🎉</div>
            ) : (
              recommendations.map((r, i) => {
                const sc = SEVERITY_CONFIG[r.severity];
                return (
                  <div key={i} className="co-rec-card" style={{ borderLeftColor: sc.color }}>
                    <div className="co-rec-top">
                      <span>{sc.icon}</span>
                      <span className="co-rec-type" style={{ color: sc.color, background: sc.bg }}>{r.type.replace("_", " ")}</span>
                      {r.saving && <span className="co-rec-saving">Save {r.saving}</span>}
                    </div>
                    <p className="co-rec-msg">{r.message}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Spenders */}
        <div className="an-chart-card">
          <div className="an-chart-title">🔥 Top Spenders</div>
          <div className="an-bar-chart">
            {topSpenders.map(a => (
              <div key={a.agent_id} className="an-bar-row">
                <div className="an-bar-label" title={a.agent_name}>{a.agent_name}</div>
                <div className="an-bar-track">
                  <div className="an-bar-fill orange" style={{ width: `${(a.total_cost_usd / maxSpend) * 100}%` }} />
                </div>
                <div className="an-bar-value">${a.total_cost_usd.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
