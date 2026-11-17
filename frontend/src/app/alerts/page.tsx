"use client";
import { useEffect, useState } from "react";
import { api, Alert } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  Flame,
  CheckCircle2,
  RefreshCw,
  Clock
} from "lucide-react";

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.getAlerts().then(setAlerts).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "VIOLATION":
        return <ShieldAlert style={{ width: 14, height: 14, color: "var(--accent-red)" }} />;
      case "ANOMALY":
        return <AlertTriangle style={{ width: 14, height: 14, color: "var(--accent-yellow)" }} />;
      case "HITL_REQUIRED":
        return <UserCheck style={{ width: 14, height: 14, color: "var(--accent-purple)" }} />;
      case "INCIDENT":
        return <Flame style={{ width: 14, height: 14, color: "var(--accent-orange)" }} />;
      default:
        return <ShieldAlert style={{ width: 14, height: 14 }} />;
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Alert Center</h1>
          <p>Real-time system alerts — policy violations, behavioral anomalies, HITL escalations, and critical incidents</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Alerts">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="card">
              <div className="loading-shimmer" style={{ height: 60 }} />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle2 style={{ width: 36, height: 36, color: "var(--accent-green)", margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>All Clear — No Active Alerts</h3>
            <p style={{ margin: 0, fontSize: 13 }}>All autonomous agent actions are within safe operating bounds.</p>
          </div>
        ) : (
          alerts.map(a => (
            <div
              key={a.alert_id}
              className="card"
              style={{
                borderLeft: `4px solid ${
                  a.risk_level === "CRITICAL"
                    ? "var(--accent-red)"
                    : a.risk_level === "HIGH"
                    ? "var(--accent-orange)"
                    : a.risk_level === "MEDIUM"
                    ? "var(--accent-yellow)"
                    : "var(--accent-green)"
                }`,
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      className={`badge badge-${a.alert_type.toLowerCase().replace("hitl_required", "hitl")}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {getAlertIcon(a.alert_type)}
                      <span>{a.alert_type.replace(/_/g, " ")}</span>
                    </span>
                    <span className={`badge badge-${(a.risk_level || "low").toLowerCase()}`}>
                      {a.risk_level}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, marginBottom: 6 }}>
                    {a.event_description}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span>
                      Agent: <code style={{ color: "var(--accent-cyan)" }}>{a.agent_id}</code>
                    </span>
                    <span>·</span>
                    <span>Action: <strong>{a.action_taken}</strong></span>
                    {a.human_action_required && (
                      <>
                        <span>·</span>
                        <span style={{ color: "var(--accent-yellow)", fontWeight: 600 }}>
                          Requires: {a.human_action_required}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="timestamp" style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock style={{ width: 12, height: 12 }} />
                  <span>{formatTime(a.timestamp)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
