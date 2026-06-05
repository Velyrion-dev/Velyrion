"use client";
import { useEffect, useState } from "react";
import { api, Agent, AgentHealth, AgentCost, DashboardStats, Violation, AuditEvent } from "@/lib/api";

// ── Types ──
interface RiskBucket { level: string; count: number; color: string; }

const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444",
};

// Format numbers with US locale (1,099,678 not 10,99,678)
const fmt = (n: number) => n.toLocaleString("en-US");
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a, h, c, v, e] = await Promise.all([
          api.getStats(), api.getAgents(), api.getHealth(),
          api.getCosts(), api.getViolations(100), api.getEvents(100),
        ]);
        setStats(s); setAgents(a); setHealth(h); setCosts(c); setViolations(v); setEvents(e);
      } catch (err) { console.error("Analytics load failed:", err); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="an-page">
        <div className="page-header"><h1>Analytics & Intelligence</h1><p>Loading analytics data...</p></div>
        <div className="stats-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="stat-card"><div className="loading-shimmer" style={{ height: 60 }} /></div>)}</div>
      </div>
    );
  }

  // ── Computed Data ──
  const totalCost = agents.reduce((sum, a) => sum + (a.total_cost_usd || 0), 0);
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokens_used || 0), 0);
  const totalActions = agents.reduce((sum, a) => sum + (a.total_actions || 0), 0);
  const avgHealthScore = health.length > 0 ? Math.round(health.reduce((s, h) => s + h.health_score, 0) / health.length) : 0;

  // Risk distribution
  const riskBuckets: RiskBucket[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(level => ({
    level,
    count: events.filter(e => e.risk_level === level).length,
    color: RISK_COLORS[level],
  }));
  const totalRiskEvents = riskBuckets.reduce((s, b) => s + b.count, 0);

  // Top cost agents
  const topCostAgents = [...agents].sort((a, b) => (b.total_cost_usd || 0) - (a.total_cost_usd || 0)).slice(0, 8);
  const maxCost = Math.max(...topCostAgents.map(a => a.total_cost_usd || 0), 0.01);

  // Top violation agents
  const topViolationAgents = [...agents].sort((a, b) => (b.total_violations || 0) - (a.total_violations || 0)).slice(0, 8);
  const maxViolations = Math.max(...topViolationAgents.map(a => a.total_violations || 0), 1);

  // Violation types
  const violationTypes: Record<string, number> = {};
  violations.forEach(v => { violationTypes[v.violation_type] = (violationTypes[v.violation_type] || 0) + 1; });
  const sortedViolationTypes = Object.entries(violationTypes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxViolationType = Math.max(...sortedViolationTypes.map(([, c]) => c), 1);

  // Department breakdown
  const deptData: Record<string, { actions: number; cost: number; violations: number; agents: number }> = {};
  agents.forEach(a => {
    const d = a.department || "Unknown";
    if (!deptData[d]) deptData[d] = { actions: 0, cost: 0, violations: 0, agents: 0 };
    deptData[d].actions += a.total_actions || 0;
    deptData[d].cost += a.total_cost_usd || 0;
    deptData[d].violations += a.total_violations || 0;
    deptData[d].agents += 1;
  });
  const departments = Object.entries(deptData).sort((a, b) => b[1].cost - a[1].cost);

  // Budget utilization
  const budgetAgents = costs.filter(c => c.max_token_budget > 0).sort((a, b) => b.budget_usage_pct - a.budget_usage_pct).slice(0, 8);

  // Export CSV
  const exportCSV = () => {
    const rows = [["Agent ID", "Agent Name", "Department", "Status", "Actions", "Tokens Used", "Cost (USD)", "Violations"]];
    agents.forEach(a => rows.push([a.agent_id, a.agent_name, a.department, a.status, String(a.total_actions), String(a.tokens_used), a.total_cost_usd.toFixed(4), String(a.total_violations)]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `velyrion-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <div>
          <h1 className="an-title">Analytics & Intelligence</h1>
          <p className="an-subtitle">Real-time insights across your agent fleet</p>
        </div>
        <button className="btn btn-primary" onClick={exportCSV} style={{ gap: 6 }}>📥 Export CSV</button>
      </div>

      {/* KPI Row */}
      <div className="an-kpi-row">
        <div className="an-kpi blue">
          <div className="an-kpi-icon">⚡</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{fmtCompact(totalActions)}</div>
            <div className="an-kpi-label">Total Actions</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">🪙</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{fmtCompact(totalTokens)}</div>
            <div className="an-kpi-label">Tokens Used</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">💰</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">${totalCost.toFixed(2)}</div>
            <div className="an-kpi-label">Total Cost</div>
          </div>
        </div>
        <div className="an-kpi cyan">
          <div className="an-kpi-icon">🛡️</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{stats?.total_violations || 0}</div>
            <div className="an-kpi-label">Violations</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">❤️</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{avgHealthScore}%</div>
            <div className="an-kpi-label">Avg Health</div>
          </div>
        </div>
        <div className="an-kpi red">
          <div className="an-kpi-icon">🤖</div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{stats?.active_agents || 0}/{stats?.total_agents || 0}</div>
            <div className="an-kpi-label">Active Agents</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="an-charts-grid">
        {/* Risk Distribution */}
        <div className="an-chart-card">
          <div className="an-chart-title">Risk Distribution</div>
          <div className="an-donut-container">
            <div className="an-donut" style={{
              background: totalRiskEvents > 0
                ? `conic-gradient(${riskBuckets.map((b, i) => {
                    const start = riskBuckets.slice(0, i).reduce((s, x) => s + (x.count / totalRiskEvents) * 360, 0);
                    const end = start + (b.count / totalRiskEvents) * 360;
                    return `${b.color} ${start}deg ${end}deg`;
                  }).join(", ")})`
                : "var(--border-subtle)"
            }}>
              <div className="an-donut-center">
                <div className="an-donut-total">{totalRiskEvents}</div>
                <div className="an-donut-label">Events</div>
              </div>
            </div>
            <div className="an-donut-legend">
              {riskBuckets.map(b => (
                <div key={b.level} className="an-legend-item">
                  <span className="an-legend-dot" style={{ background: b.color }} />
                  <span className="an-legend-text">{b.level}</span>
                  <span className="an-legend-count">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost per Agent */}
        <div className="an-chart-card">
          <div className="an-chart-title">Cost per Agent (USD)</div>
          <div className="an-bar-chart">
            {topCostAgents.map(a => (
              <div key={a.agent_id} className="an-bar-row">
                <div className="an-bar-label" title={a.agent_name}>{a.agent_name}</div>
                <div className="an-bar-track">
                  <div className="an-bar-fill green" style={{ width: `${((a.total_cost_usd || 0) / maxCost) * 100}%` }} />
                </div>
                <div className="an-bar-value">${(a.total_cost_usd || 0).toFixed(2)}</div>
              </div>
            ))}
            {topCostAgents.length === 0 && <div className="an-empty">No cost data yet</div>}
          </div>
        </div>

        {/* Violations per Agent */}
        <div className="an-chart-card">
          <div className="an-chart-title">Violations per Agent</div>
          <div className="an-bar-chart">
            {topViolationAgents.filter(a => a.total_violations > 0).map(a => (
              <div key={a.agent_id} className="an-bar-row">
                <div className="an-bar-label" title={a.agent_name}>{a.agent_name}</div>
                <div className="an-bar-track">
                  <div className="an-bar-fill red" style={{ width: `${(a.total_violations / maxViolations) * 100}%` }} />
                </div>
                <div className="an-bar-value">{a.total_violations}</div>
              </div>
            ))}
            {topViolationAgents.filter(a => a.total_violations > 0).length === 0 && <div className="an-empty">No violations 🎉</div>}
          </div>
        </div>

        {/* Violation Types */}
        <div className="an-chart-card">
          <div className="an-chart-title">Top Violation Types</div>
          <div className="an-bar-chart">
            {sortedViolationTypes.map(([type, count]) => (
              <div key={type} className="an-bar-row">
                <div className="an-bar-label" title={type}>{type}</div>
                <div className="an-bar-track">
                  <div className="an-bar-fill orange" style={{ width: `${(count / maxViolationType) * 100}%` }} />
                </div>
                <div className="an-bar-value">{count}</div>
              </div>
            ))}
            {sortedViolationTypes.length === 0 && <div className="an-empty">No violations recorded</div>}
          </div>
        </div>
      </div>

      {/* Department & Budget Row */}
      <div className="an-bottom-grid">
        {/* Department Breakdown */}
        <div className="an-chart-card">
          <div className="an-chart-title">Department Breakdown</div>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr><th>Department</th><th>Agents</th><th>Actions</th><th>Cost</th><th>Violations</th></tr>
              </thead>
              <tbody>
                {departments.map(([dept, data]) => (
                  <tr key={dept}>
                    <td className="an-table-dept">{dept}</td>
                    <td>{data.agents}</td>
                    <td>{fmt(data.actions)}</td>
                    <td>${data.cost.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${data.violations > 5 ? "badge-critical" : data.violations > 0 ? "badge-medium" : "badge-low"}`}>
                        {data.violations}
                      </span>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && <tr><td colSpan={5} className="an-empty">No department data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="an-chart-card">
          <div className="an-chart-title">Token Budget Utilization</div>
          <div className="an-budget-list">
            {budgetAgents.map(a => {
              const pct = Math.min(a.budget_usage_pct, 100);
              const color = pct >= 90 ? "var(--accent-red)" : pct >= 70 ? "var(--accent-orange)" : pct >= 50 ? "var(--accent-yellow)" : "var(--accent-green)";
              return (
                <div key={a.agent_id} className="an-budget-item">
                  <div className="an-budget-top">
                    <span className="an-budget-name">{a.agent_name}</span>
                    <span className="an-budget-pct" style={{ color }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="an-budget-bar">
                    <div className="an-budget-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="an-budget-detail">
                    {fmt(a.tokens_used)} / {fmt(a.max_token_budget)} tokens
                  </div>
                </div>
              );
            })}
            {budgetAgents.length === 0 && <div className="an-empty">No budget data available</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
