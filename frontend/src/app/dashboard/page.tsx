"use client";
import { useEffect, useState } from "react";
import { api, DashboardStats, AgentHealth, AgentCost } from "@/lib/api";

function HealthBar({ score }: { score: number }) {
  const cls = score >= 90 ? "health-excellent" : score >= 70 ? "health-good" : score >= 50 ? "health-fair" : score >= 30 ? "health-poor" : "health-critical";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="health-bar-bg" style={{ width: 120 }}>
        <div className={`health-bar-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: score >= 70 ? "var(--accent-green)" : score >= 50 ? "var(--accent-yellow)" : "var(--accent-red)" }}>
        {score}
      </span>
    </div>
  );
}

function CostBar({ pct }: { pct: number }) {
  const color = pct > 100 ? "var(--accent-red)" : pct > 75 ? "var(--accent-yellow)" : "var(--accent-cyan)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="cost-bar-bg" style={{ flex: 1 }}>
        <div className="cost-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 42, textAlign: "right" }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getHealth(), api.getCosts()])
      .then(([s, h, c]) => { setStats(s); setHealth(h); setCosts(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div>
        <div className="page-header"><h1>Dashboard</h1><p>Loading governance overview...</p></div>
        <div className="stats-grid">{[...Array(6)].map((_, i) => <div key={i} className="stat-card" style={{ height: 110 }}><div className="loading-shimmer" /></div>)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Governance Dashboard</h1>
        <p>Real-time overview of all AI agent activity across your organization</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Agents</div>
          <div className="stat-value">{stats.total_agents}</div>
          <div className="stat-subtitle">{stats.active_agents} active · {stats.locked_agents} locked</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{stats.total_events.toLocaleString()}</div>
          <div className="stat-subtitle">{stats.events_last_24h} in last 24h</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Violations</div>
          <div className="stat-value">{stats.total_violations}</div>
          <div className="stat-subtitle">{stats.violations_by_severity?.CRITICAL || 0} critical · {stats.violations_by_severity?.HIGH || 0} high</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Anomalies</div>
          <div className="stat-value">{stats.total_anomalies}</div>
          <div className="stat-subtitle">Detected across all agents</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value">{stats.pending_approvals}</div>
          <div className="stat-subtitle">Awaiting human review</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-label">Total Cost</div>
          <div className="stat-value">${stats.total_cost_usd.toFixed(2)}</div>
          <div className="stat-subtitle">Cumulative compute spend</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid-2">
        {/* Agent Health */}
        <div className="card">
          <h3 className="section-title">🏥 Agent Health Scores</h3>
          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Health</th><th>Status</th></tr></thead>
              <tbody>
                {health.slice(0, 8).map(h => (
                  <tr key={h.agent_id}>
                    <td className="cell-primary">{h.agent_name}</td>
                    <td><HealthBar score={h.health_score} /></td>
                    <td><span className={`badge badge-${h.status.toLowerCase()}`}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Costs */}
        <div className="card">
          <h3 className="section-title">💰 Token Cost Monitor</h3>
          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Budget Usage</th><th>Cost</th></tr></thead>
              <tbody>
                {costs.map(c => (
                  <tr key={c.agent_id}>
                    <td className="cell-primary">{c.agent_name}</td>
                    <td style={{ minWidth: 180 }}><CostBar pct={c.budget_usage_pct} /></td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>${c.total_cost_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Violations Breakdown */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">🛡️ Violations by Severity</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {Object.entries(stats.violations_by_severity || {}).map(([level, count]) => (
            <div key={level} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", background: "var(--bg-secondary)", borderRadius: 10, minWidth: 150 }}>
              <span className={`badge badge-${level.toLowerCase()}`}>{level}</span>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Status */}
      <div className="card">
        <h3 className="section-title">📋 Compliance Posture</h3>
        <div className="compliance-item">
          <span className="compliance-label">SOC2</span>
          <div className="compliance-bar-bg"><div className="compliance-bar-fill" style={{ width: "92%" }} /></div>
          <span className="compliance-pct">92%</span>
        </div>
        <div className="compliance-item">
          <span className="compliance-label">GDPR</span>
          <div className="compliance-bar-bg"><div className="compliance-bar-fill" style={{ width: "88%" }} /></div>
          <span className="compliance-pct">88%</span>
        </div>
        <div className="compliance-item">
          <span className="compliance-label">HIPAA</span>
          <div className="compliance-bar-bg"><div className="compliance-bar-fill" style={{ width: "95%" }} /></div>
          <span className="compliance-pct">95%</span>
        </div>
      </div>
    </div>
  );
}
