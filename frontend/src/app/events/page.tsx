"use client";
import { useEffect, useState, useCallback } from "react";
import { api, AuditEvent } from "@/lib/api";

function formatTime(ts: string) {
  const d = new Date(ts);
  const mon = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${h}:${m}:${s}`;
}

function formatClock(d: Date) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const reload = useCallback(() => {
    api.getEvents(200).then(data => {
      setEvents(data);
      setLastUpdate(new Date());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    if (!autoRefresh) return;
    const interval = setInterval(reload, 10000);
    return () => clearInterval(interval);
  }, [reload, autoRefresh]);

  const filtered = events.filter(e => {
    const matchSearch = !search ||
      e.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      e.task_description.toLowerCase().includes(search.toLowerCase()) ||
      e.tool_used.toLowerCase().includes(search.toLowerCase());
    const matchRisk = !riskFilter || e.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Live Activity Feed</h1>
          <p>Real-time audit trail of all agent actions across your organization</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {autoRefresh && (
            <div className="live-indicator">
              <span className="live-dot" />
              Live
            </div>
          )}
          <button
            className={`btn ${autoRefresh ? "btn-success" : "btn-ghost"} btn-sm`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search by agent, task, or tool..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="">All Risk Levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <span className="timestamp" suppressHydrationWarning>
          {filtered.length} events{lastUpdate ? ` · Updated ${formatClock(lastUpdate)}` : ""}
        </span>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Agent</th>
              <th>Task</th>
              <th>Tool</th>
              <th>Confidence</th>
              <th>Duration</th>
              <th>Tokens</th>
              <th>Risk</th>
              <th>HITL</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => <tr key={i}><td colSpan={9}><div className="loading-shimmer" /></td></tr>)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                {search || riskFilter ? "No events match your filters" : "No events recorded yet"}
              </td></tr>
            ) : filtered.map(e => (
              <tr key={e.event_id}>
                <td className="timestamp">{formatTime(e.timestamp)}</td>
                <td className="cell-primary">{e.agent_name}</td>
                <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.task_description}</td>
                <td><code style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--accent-cyan)" }}>{e.tool_used}</code></td>
                <td>
                  <span style={{
                    fontWeight: 700,
                    color: e.confidence_score >= 0.8 ? "var(--accent-green)" : e.confidence_score >= 0.6 ? "var(--accent-yellow)" : "var(--accent-red)",
                  }}>
                    {(e.confidence_score * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{e.duration_ms}ms</td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{e.token_cost.toLocaleString()}</td>
                <td><span className={`badge badge-${e.risk_level.toLowerCase()}`}>{e.risk_level}</span></td>
                <td>{e.human_in_loop && <span className="badge badge-hitl">HITL</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
