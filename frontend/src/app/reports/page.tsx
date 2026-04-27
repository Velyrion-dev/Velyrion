"use client";
import { useEffect, useState } from "react";
import { api, ComplianceReport } from "@/lib/api";

export default function ReportsPage() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("2025-Q1");

  useEffect(() => {
    setLoading(true);
    api.getComplianceReport(period).then(setReport).finally(() => setLoading(false));
  }, [period]);

  if (loading || !report) {
    return (
      <div>
        <div className="page-header"><h1>Compliance Reports</h1></div>
        <div className="card"><div className="loading-shimmer" style={{ height: 400 }} /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Compliance Report</h1>
          <p>Organization-wide compliance posture and agent performance</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["2025-Q1", "2025-Q2", "2024-Q4"].map(p => (
            <button key={p} className={`btn ${p === period ? "btn-primary" : "btn-ghost"} btn-sm`} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Actions</div>
          <div className="stat-value">{report.total_agent_actions.toLocaleString()}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Policy Violations</div>
          <div className="stat-value">{Object.values(report.policy_violations).reduce((a, b) => a + b, 0)}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Human Interventions</div>
          <div className="stat-value">{report.human_interventions}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Compliance Rate</div>
          <div className="stat-value">
            {report.total_agent_actions > 0
              ? (100 - (Object.values(report.policy_violations).reduce((a, b) => a + b, 0) / report.total_agent_actions * 100)).toFixed(1)
              : "100"}%
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Violations by Severity */}
        <div className="card">
          <h3 className="section-title">🛡️ Violations Breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(report.policy_violations).map(([level, count]) => (
              <div key={level} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={`badge badge-${level}`} style={{ minWidth: 80, justifyContent: "center" }}>
                  {level.toUpperCase()}
                </span>
                <div style={{ flex: 1, height: 8, background: "rgba(100,116,139,0.15)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${Math.max((count / Math.max(...Object.values(report.policy_violations), 1)) * 100, count > 0 ? 5 : 0)}%`,
                    background: level === "critical" ? "var(--accent-red)" : level === "high" ? "var(--accent-orange)" : level === "medium" ? "var(--accent-yellow)" : "var(--accent-green)",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, minWidth: 30, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Risk */}
        <div className="card">
          <h3 className="section-title">🏢 Department Risk Scores</h3>
          {report.department_risk_scores.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No department data available</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {report.department_risk_scores.map(d => (
                <div key={d.department} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ minWidth: 130, fontWeight: 600, fontSize: 13 }}>{d.department}</span>
                  <div style={{ flex: 1, height: 8, background: "rgba(100,116,139,0.15)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${Math.min(d.risk_score, 100)}%`,
                      background: d.risk_score > 10 ? "var(--accent-red)" : d.risk_score > 5 ? "var(--accent-yellow)" : "var(--accent-green)",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 50, textAlign: "right", color: d.risk_score > 10 ? "var(--accent-red)" : d.risk_score > 5 ? "var(--accent-yellow)" : "var(--accent-green)" }}>
                    {d.risk_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        {/* Top Performing */}
        <div className="card">
          <h3 className="section-title">🏆 Top Performing Agents</h3>
          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Actions</th><th>Violations</th></tr></thead>
              <tbody>
                {report.top_performing_agents.map(a => (
                  <tr key={a.agent_id}>
                    <td className="cell-primary">{a.agent_name}</td>
                    <td>{a.actions}</td>
                    <td style={{ color: a.violations === 0 ? "var(--accent-green)" : "var(--accent-yellow)" }}>{a.violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost per Agent */}
        <div className="card">
          <h3 className="section-title">💰 Cost per Agent</h3>
          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Cost (USD)</th></tr></thead>
              <tbody>
                {report.cost_per_agent.sort((a, b) => b.cost_usd - a.cost_usd).map(a => (
                  <tr key={a.agent_id}>
                    <td className="cell-primary">{a.agent_name}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>${a.cost_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>📥 Export Report</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>Download compliance report as JSON for programmatic access</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `velyrion-compliance-${period}.json`; a.click();
          URL.revokeObjectURL(url);
        }}>
          Export JSON
        </button>
      </div>
    </div>
  );
}
