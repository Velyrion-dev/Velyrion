"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent, AgentCost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DollarSign,
  Coins,
  TrendingUp,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Recommendation {
  agent: Agent;
  type: "budget_alert" | "overspend" | "idle" | "optimize";
  severity: "critical" | "warning" | "info";
  message: string;
  saving?: string;
}

export default function CostOptimizerPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getCosts().catch(() => []),
      ]);
      setAgents(a);
      setCosts(c);
    } catch (e) {
      console.error("Cost data error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="co-page">
        <div className="lb-header">
          <h1 className="lb-title">Cost Optimizer</h1>
          <p className="lb-subtitle">Querying token consumption metrics and spend telemetry...</p>
        </div>
      </div>
    );
  }

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
        agent: a,
        type: "budget_alert",
        severity: "critical",
        message: `${a.agent_name} has consumed ${budgetPct.toFixed(0)}% of allocated token budget — imminent exhaustion.`,
      });
    } else if (budgetPct >= 75) {
      recommendations.push({
        agent: a,
        type: "budget_alert",
        severity: "warning",
        message: `${a.agent_name} has consumed ${budgetPct.toFixed(0)}% of token budget — threshold warning.`,
      });
    }

    if (a.total_cost_usd > 100) {
      recommendations.push({
        agent: a,
        type: "overspend",
        severity: "warning",
        message: `${a.agent_name} has accumulated $${a.total_cost_usd.toFixed(2)} in model inference spend.`,
        saving: `$${(a.total_cost_usd * 0.2).toFixed(2)}`,
      });
    }

    if (a.total_actions < 10 && a.status === "ACTIVE") {
      recommendations.push({
        agent: a,
        type: "idle",
        severity: "info",
        message: `${a.agent_name} is active with only ${a.total_actions} actions — evaluate decommissioning.`,
        saving: `$${a.total_cost_usd.toFixed(2)}`,
      });
    }

    const costPerAction = a.total_actions > 0 ? a.total_cost_usd / a.total_actions : 0;
    if (costPerAction > 0.05) {
      recommendations.push({
        agent: a,
        type: "optimize",
        severity: "info",
        message: `${a.agent_name} incurs $${costPerAction.toFixed(4)}/action — prompt caching or smaller model routing recommended.`,
        saving: `$${((costPerAction - 0.01) * a.total_actions).toFixed(2)}`,
      });
    }
  });

  recommendations.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const potentialSavings = recommendations
    .filter(r => r.saving)
    .reduce((s, r) => s + parseFloat((r.saving || "$0").replace("$", "")), 0);

  const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
    critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    info: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  };

  const topSpenders = [...agents].sort((a, b) => b.total_cost_usd - a.total_cost_usd).slice(0, 6);
  const maxSpend = Math.max(...topSpenders.map(a => a.total_cost_usd), 0.01);

  return (
    <div className="co-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Cost Optimizer</h1>
          <p className="lb-subtitle">Autonomous spend telemetry, budget pacing alerts, and token consumption analytics</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Cost Analytics">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* KPIs */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <DollarSign style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">${totalCost.toFixed(2)}</div>
            <div className="an-kpi-label">Cumulative Spend</div>
          </div>
        </div>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Coins style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{fmt(totalTokens)}</div>
            <div className="an-kpi-label">Tokens Consumed</div>
          </div>
        </div>
        <div className="an-kpi cyan">
          <div className="an-kpi-icon">
            <TrendingUp style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{budgetUsage}%</div>
            <div className="an-kpi-label">Fleet Budget Utilization</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">
            <PiggyBank style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">${potentialSavings.toFixed(2)}</div>
            <div className="an-kpi-label">Estimated Monthly Savings</div>
          </div>
        </div>
      </div>

      <div className="an-bottom-grid">
        {/* Recommendations */}
        <div className="an-chart-card">
          <div className="an-chart-title">Cost Optimization Recommendations ({recommendations.length})</div>
          <div className="co-rec-list">
            {recommendations.length === 0 ? (
              <div className="an-empty">
                <CheckCircle2 style={{ width: 24, height: 24, color: "var(--accent-green)", margin: "0 auto 8px" }} />
                All active agents are operating within target token and cost efficiency parameters.
              </div>
            ) : (
              recommendations.map((r, i) => {
                const sc = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.info;
                return (
                  <div key={i} className="co-rec-card" style={{ borderLeftColor: sc.color }}>
                    <div className="co-rec-top">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {r.severity === "critical" ? (
                          <AlertTriangle style={{ width: 14, height: 14, color: sc.color }} />
                        ) : (
                          <Info style={{ width: 14, height: 14, color: sc.color }} />
                        )}
                        <span className="co-rec-type" style={{ color: sc.color, background: sc.bg, textTransform: "capitalize" }}>
                          {r.type.replace("_", " ")}
                        </span>
                      </div>
                      {r.saving && <span className="co-rec-saving">Est. Savings: {r.saving}</span>}
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
          <div className="an-chart-title">Top Inference Spenders</div>
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
