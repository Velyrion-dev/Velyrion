"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Violation } from "@/lib/api";

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const reload = useCallback(() => {
    api.getViolations().then(setViolations).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    if (!autoRefresh) return;
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload, autoRefresh]);

  const filtered = violations.filter(v => {
    const matchSearch = !search ||
      v.violation_type.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()) ||
      v.agent_id.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = !severityFilter || v.severity === severityFilter;
    const matchStatus = !statusFilter || (statusFilter === "open" ? !v.resolved : v.resolved);
    return matchSearch && matchSeverity && matchStatus;
  });

  const critical = violations.filter(v => v.severity === "CRITICAL").length;
  const high = violations.filter(v => v.severity === "HIGH").length;
  const unresolved = violations.filter(v => !v.resolved).length;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Violation Alert Panel</h1>
          <p>Policy violations detected across all AI agent activity</p>
        </div>
        <button className={`btn ${autoRefresh ? "btn-success" : "btn-ghost"} btn-sm`} onClick={() => setAutoRefresh(!autoRefresh)}>
          {autoRefresh ? "⏸ Pause" : "▶ Resume"}
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card red">
          <div className="stat-label">Total Violations</div>
          <div className="stat-value">{violations.length}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Critical</div>
          <div className="stat-value">{critical}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">High Severity</div>
          <div className="stat-value">{high}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Unresolved</div>
          <div className="stat-value">{unresolved}</div>
        </div>
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Search by type, description, agent..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
          <option value="">All Severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="timestamp">{filtered.length} violations</span>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Timestamp</th><th>Agent ID</th><th>Type</th><th>Description</th><th>Severity</th><th>Action</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <tr key={i}><td colSpan={7}><div className="loading-shimmer" /></td></tr>)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                ✅ {search || severityFilter || statusFilter ? "No violations match your filters" : "No violations — all agents operating within policy"}
              </td></tr>
            ) : filtered.map(v => (
              <tr key={v.violation_id}>
                <td className="timestamp">{formatTime(v.timestamp)}</td>
                <td><code style={{ fontSize: 11, color: "var(--accent-cyan)" }}>{v.agent_id}</code></td>
                <td className="cell-primary" style={{ fontSize: 12 }}>{v.violation_type.replace(/_/g, " ")}</td>
                <td style={{ maxWidth: 300, fontSize: 12 }}>{v.description}</td>
                <td><span className={`badge badge-${v.severity.toLowerCase()}`}>{v.severity}</span></td>
                <td><span style={{ fontSize: 11, fontWeight: 600, color: v.action_taken === "BLOCKED" ? "var(--accent-red)" : "var(--accent-yellow)" }}>{v.action_taken}</span></td>
                <td>
                  <span className="pulse-dot" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: v.resolved ? "var(--accent-green)" : "var(--accent-red)", marginRight: 6 }} />
                  {v.resolved ? "Resolved" : "Open"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
