"use client";
import { useEffect, useState } from "react";
import { api, Anomaly } from "@/lib/api";

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_ICONS: Record<string, string> = {
  DURATION: "⏱️", API_FAILURE: "🔌", DATA_BOUNDARY: "🔒", CONFIDENCE: "📉", COST: "💸",
};

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnomalies().then(setAnomalies).finally(() => setLoading(false));
  }, []);

  const typeCounts = anomalies.reduce<Record<string, number>>((acc, a) => {
    acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1; return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1>Anomaly Detection Feed</h1>
        <p>Behavioral anomalies flagged across all AI agent activity</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {["DURATION", "API_FAILURE", "DATA_BOUNDARY", "CONFIDENCE", "COST"].map(t => (
          <div key={t} className="stat-card yellow">
            <div className="stat-label">{TYPE_ICONS[t]} {t.replace("_", " ")}</div>
            <div className="stat-value">{typeCounts[t] || 0}</div>
          </div>
        ))}
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>Timestamp</th><th>Agent</th><th>Type</th><th>Description</th><th>Risk Level</th></tr></thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <tr key={i}><td colSpan={5}><div className="loading-shimmer" /></td></tr>)
            ) : anomalies.map(a => (
              <tr key={a.anomaly_id}>
                <td className="timestamp">{formatTime(a.timestamp)}</td>
                <td><code style={{ fontSize: 11, color: "var(--accent-cyan)" }}>{a.agent_id}</code></td>
                <td>
                  <span className="badge badge-anomaly">{TYPE_ICONS[a.anomaly_type]} {a.anomaly_type.replace("_", " ")}</span>
                </td>
                <td style={{ maxWidth: 400, fontSize: 12 }}>{a.description}</td>
                <td><span className={`badge badge-${a.risk_level.toLowerCase()}`}>{a.risk_level}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
