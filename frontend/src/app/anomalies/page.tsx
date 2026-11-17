"use client";
import { useEffect, useState } from "react";
import { api, Anomaly } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Clock,
  AlertTriangle,
  Database,
  Sparkles,
  DollarSign,
  Activity,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function AnomaliesPage() {
  const { user } = useAuth();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.getAnomalies().then(setAnomalies).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const typeCounts = anomalies.reduce<Record<string, number>>((acc, a) => {
    acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1;
    return acc;
  }, {});

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "DURATION":
        return <Clock style={{ width: 14, height: 14, color: "var(--accent-yellow)" }} />;
      case "API_FAILURE":
        return <AlertTriangle style={{ width: 14, height: 14, color: "var(--accent-red)" }} />;
      case "DATA_BOUNDARY":
        return <Database style={{ width: 14, height: 14, color: "var(--accent-purple)" }} />;
      case "CONFIDENCE":
        return <Sparkles style={{ width: 14, height: 14, color: "var(--accent-cyan)" }} />;
      case "COST":
        return <DollarSign style={{ width: 14, height: 14, color: "var(--accent-green)" }} />;
      default:
        return <Activity style={{ width: 14, height: 14 }} />;
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Anomaly Detection Feed</h1>
          <p>Statistical and behavioral anomalies flagged across all autonomous agent executions</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Anomaly Feed">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {["DURATION", "API_FAILURE", "DATA_BOUNDARY", "CONFIDENCE", "COST"].map(t => (
          <div key={t} className="stat-card yellow">
            <div className="stat-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {getTypeIcon(t)}
              <span>{t.replace("_", " ")}</span>
            </div>
            <div className="stat-value">{typeCounts[t] || 0}</div>
          </div>
        ))}
      </div>

      <div className="data-table-wrapper" style={{ marginTop: 20 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Agent ID</th>
              <th>Anomaly Vector</th>
              <th>Behavioral Diagnostic</th>
              <th>Risk Severity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5}><div className="loading-shimmer" /></td>
                </tr>
              ))
            ) : anomalies.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  <CheckCircle2 style={{ width: 24, height: 24, color: "var(--accent-green)", margin: "0 auto 8px" }} />
                  No active anomalies detected across fleet operations.
                </td>
              </tr>
            ) : (
              anomalies.map(a => (
                <tr key={a.anomaly_id}>
                  <td className="timestamp">{formatTime(a.timestamp)}</td>
                  <td>
                    <code style={{ fontSize: 11, color: "var(--accent-cyan)" }}>{a.agent_id}</code>
                  </td>
                  <td>
                    <span className="badge badge-anomaly" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {getTypeIcon(a.anomaly_type)}
                      <span>{a.anomaly_type.replace("_", " ")}</span>
                    </span>
                  </td>
                  <td style={{ maxWidth: 420, fontSize: 12 }}>{a.description}</td>
                  <td>
                    <span className={`badge badge-${(a.risk_level || "low").toLowerCase()}`}>
                      {a.risk_level}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
