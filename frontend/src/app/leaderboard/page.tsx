"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent, AgentHealth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Trophy,
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  RefreshCw,
  Cpu
} from "lucide-react";

// ── Helpers ──
const fmt = (n: number) => n.toLocaleString("en-US");
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

type SortKey = "efficiency" | "cost" | "violations" | "health" | "actions";

interface AgentRank {
  agent: Agent;
  health: number;
  efficiency: number; // actions per violation
  costPerAction: number;
  riskScore: number;
}

const RISK_CATEGORIES = ["Cost", "Violations", "Budget", "Anomalies"];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [healthData, setHealthData] = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("efficiency");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getHealth().catch(() => []),
      ]);
      setAgents(a);
      setHealthData(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="lb-page">
        <div className="lb-header">
          <h1 className="lb-title">Agent Leaderboard</h1>
          <p className="lb-subtitle">Querying fleet benchmarks and reliability rankings...</p>
        </div>
        <div className="an-kpi-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="an-kpi blue">
              <div className="loading-shimmer" style={{ height: 50 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Compute Rankings ──
  const rankings: AgentRank[] = agents.map(agent => {
    const h = healthData.find(x => x.agent_id === agent.agent_id);
    const health = h?.health_score ?? 75;
    const violations = agent.total_violations || 0;
    const actions = agent.total_actions || 0;
    const cost = agent.total_cost_usd || 0;
    const efficiency = violations === 0 ? actions * 10 : Math.round(actions / violations);
    const costPerAction = actions > 0 ? cost / actions : 0;
    const budgetPct = agent.max_token_budget > 0 ? (agent.tokens_used / agent.max_token_budget) * 100 : 0;
    const riskScore = Math.min(100, Math.round(violations * 15 + (budgetPct > 80 ? 25 : 0) + (cost > 50 ? 20 : 0)));

    return { agent, health, efficiency, costPerAction, riskScore };
  });

  // ── Sort ──
  const sorted = [...rankings].sort((a, b) => {
    let diff = 0;
    if (sortBy === "efficiency") diff = b.efficiency - a.efficiency;
    else if (sortBy === "cost") diff = a.costPerAction - b.costPerAction;
    else if (sortBy === "violations") diff = a.agent.total_violations - b.agent.total_violations;
    else if (sortBy === "health") diff = b.health - a.health;
    else if (sortBy === "actions") diff = b.agent.total_actions - a.agent.total_actions;
    return sortDir === "asc" ? -diff : diff;
  });

  const podium = [...rankings].sort((a, b) => b.efficiency - a.efficiency).slice(0, 3);

  // ── Department Summary ──
  const deptMap: Record<string, { agents: number; avgHealth: number; totalActions: number; totalViolations: number }> = {};
  rankings.forEach(r => {
    const d = r.agent.department || "Other";
    if (!deptMap[d]) deptMap[d] = { agents: 0, avgHealth: 0, totalActions: 0, totalViolations: 0 };
    deptMap[d].agents++;
    deptMap[d].avgHealth += r.health;
    deptMap[d].totalActions += r.agent.total_actions;
    deptMap[d].totalViolations += r.agent.total_violations;
  });
  const departments = Object.entries(deptMap)
    .map(([name, data]) => ({ name, ...data, avgHealth: Math.round(data.avgHealth / data.agents) }))
    .sort((a, b) => b.avgHealth - a.avgHealth);

  const getHeatColor = (val: number, max: number) => {
    const pct = max > 0 ? val / max : 0;
    if (pct >= 0.75) return { bg: "rgba(239,68,68,0.2)", color: "#ef4444" };
    if (pct >= 0.5) return { bg: "rgba(249,115,22,0.2)", color: "#f97316" };
    if (pct >= 0.25) return { bg: "rgba(245,158,11,0.2)", color: "#f59e0b" };
    return { bg: "rgba(16,185,129,0.15)", color: "#10b981" };
  };

  const maxViolations = Math.max(...rankings.map(r => r.agent.total_violations), 1);
  const maxCost = Math.max(...rankings.map(r => r.agent.total_cost_usd), 0.01);
  const maxBudget = 100;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const activeAgents = agents.filter(a => a.status === "ACTIVE").length;
  const avgHealth = rankings.length > 0 ? Math.round(rankings.reduce((s, r) => s + r.health, 0) / rankings.length) : 0;
  const totalViolations = agents.reduce((s, a) => s + a.total_violations, 0);
  const bestAgent = podium[0];

  return (
    <div className="lb-page">
      {/* Header */}
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Agent Leaderboard</h1>
          <p className="lb-subtitle">Performance rankings, uptime health, and operational efficiency across your fleet</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Rankings">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* KPIs */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{activeAgents}/{agents.length}</div>
            <div className="an-kpi-label">Active / Total</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <Activity style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{avgHealth}%</div>
            <div className="an-kpi-label">Avg Health Score</div>
          </div>
        </div>
        <div className="an-kpi red">
          <div className="an-kpi-icon">
            <AlertTriangle style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{totalViolations}</div>
            <div className="an-kpi-label">Total Violations</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <Trophy style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value" style={{ fontSize: 16 }}>{bestAgent?.agent.agent_name || "—"}</div>
            <div className="an-kpi-label">Top Performer</div>
          </div>
        </div>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="lb-podium-section">
          <h2 className="lb-section-title">Efficiency Champions</h2>
          <div className="lb-podium">
            {podium.map((r, i) => (
              <div key={r.agent.agent_id} className={`lb-podium-card rank-${i + 1}`}>
                <div className="lb-medal">
                  <span style={{ fontSize: 13, fontWeight: 900, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#d97706" }}>
                    #{i + 1}
                  </span>
                </div>
                <div className="lb-podium-name">{r.agent.agent_name}</div>
                <div className="lb-podium-dept">{r.agent.department}</div>
                <div className="lb-podium-score">{fmtCompact(r.efficiency)}</div>
                <div className="lb-podium-label">actions per violation</div>
                <div className="lb-podium-stats">
                  <span>Health: {r.health}%</span>
                  <span>Spend: ${r.agent.total_cost_usd.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings Table */}
      <div className="lb-table-section">
        <h2 className="lb-section-title">Full Fleet Rankings</h2>
        <div className="an-table-wrap">
          <table className="an-table lb-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Agent</th>
                <th>Department</th>
                <th>Status</th>
                <th className="lb-sortable" onClick={() => toggleSort("actions")}>
                  Actions {sortBy === "actions" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="lb-sortable" onClick={() => toggleSort("efficiency")}>
                  Efficiency {sortBy === "efficiency" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="lb-sortable" onClick={() => toggleSort("cost")}>
                  Cost/Action {sortBy === "cost" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="lb-sortable" onClick={() => toggleSort("violations")}>
                  Violations {sortBy === "violations" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="lb-sortable" onClick={() => toggleSort("health")}>
                  Health {sortBy === "health" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const healthColor = r.health >= 80 ? "var(--accent-green)" : r.health >= 50 ? "var(--accent-yellow)" : "var(--accent-red)";
                return (
                  <tr key={r.agent.agent_id}>
                    <td style={{ fontWeight: 800, color: i < 3 ? "var(--accent-yellow)" : "var(--text-muted)" }}>
                      #{i + 1}
                    </td>
                    <td className="an-table-dept">{r.agent.agent_name}</td>
                    <td>{r.agent.department}</td>
                    <td><span className={`mc-agent-status ${r.agent.status}`}>{r.agent.status}</span></td>
                    <td>{fmt(r.agent.total_actions)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtCompact(r.efficiency)}</td>
                    <td>${r.costPerAction.toFixed(4)}</td>
                    <td>
                      <span className={`badge ${r.agent.total_violations > 5 ? "badge-critical" : r.agent.total_violations > 0 ? "badge-medium" : "badge-low"}`}>
                        {r.agent.total_violations}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="an-budget-bar" style={{ width: 60 }}>
                          <div className="an-budget-fill" style={{ width: `${r.health}%`, background: healthColor }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: healthColor }}>{r.health}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Risk Heatmap + Department Comparison */}
      <div className="an-bottom-grid">
        {/* Risk Heatmap */}
        <div className="an-chart-card">
          <div className="an-chart-title">Risk Exposure Heatmap</div>
          <div className="an-table-wrap">
            <table className="an-table lb-heat">
              <thead>
                <tr>
                  <th>Agent</th>
                  {RISK_CATEGORIES.map(c => <th key={c} style={{ textAlign: "center" }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 10).map(r => {
                  const budgetPct = r.agent.max_token_budget > 0 ? (r.agent.tokens_used / r.agent.max_token_budget) * 100 : 0;
                  const cells = [
                    { val: r.agent.total_cost_usd, max: maxCost },
                    { val: r.agent.total_violations, max: maxViolations },
                    { val: budgetPct, max: maxBudget },
                    { val: r.riskScore, max: 100 },
                  ];
                  return (
                    <tr key={r.agent.agent_id}>
                      <td className="an-table-dept">{r.agent.agent_name}</td>
                      {cells.map((c, i) => {
                        const h = getHeatColor(c.val, c.max);
                        return (
                          <td key={i} style={{ textAlign: "center" }}>
                            <span className="lb-heat-cell" style={{ background: h.bg, color: h.color }}>
                              {i === 0 ? `$${c.val.toFixed(2)}` : i === 2 ? `${c.val.toFixed(0)}%` : c.val}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Comparison */}
        <div className="an-chart-card">
          <div className="an-chart-title">Department Risk Rankings</div>
          <div className="lb-dept-list">
            {departments.map((d, i) => (
              <div key={d.name} className="lb-dept-card">
                <div className="lb-dept-rank">#{i + 1}</div>
                <div className="lb-dept-info">
                  <div className="lb-dept-name">{d.name}</div>
                  <div className="lb-dept-stats">
                    <span>{d.agents} agents</span>
                    <span>•</span>
                    <span>{fmt(d.totalActions)} actions</span>
                    <span>•</span>
                    <span>{d.totalViolations} violations</span>
                  </div>
                </div>
                <div className="lb-dept-health">
                  <div className="an-budget-bar" style={{ width: 50 }}>
                    <div
                      className="an-budget-fill"
                      style={{
                        width: `${d.avgHealth}%`,
                        background: d.avgHealth >= 80 ? "var(--accent-green)" : d.avgHealth >= 50 ? "var(--accent-yellow)" : "var(--accent-red)"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: d.avgHealth >= 80 ? "var(--accent-green)" : d.avgHealth >= 50 ? "var(--accent-yellow)" : "var(--accent-red)" }}>
                    {d.avgHealth}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
