"use client";
import { useEffect, useState } from "react";
import { api, Alert } from "@/lib/api";

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_ICONS: Record<string, string> = {
  VIOLATION: "🛡️", ANOMALY: "⚠️", HITL_REQUIRED: "✋", INCIDENT: "🚨",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAlerts().then(setAlerts).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Alert Center</h1>
        <p>All system alerts — violations, anomalies, HITL requests, and incidents</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          [...Array(5)].map((_, i) => <div key={i} className="card"><div className="loading-shimmer" style={{ height: 60 }} /></div>)
        ) : alerts.map(a => (
          <div key={a.alert_id} className="card" style={{
            borderLeft: `3px solid ${
              a.risk_level === "CRITICAL" ? "var(--accent-red)" :
              a.risk_level === "HIGH" ? "var(--accent-orange)" :
              a.risk_level === "MEDIUM" ? "var(--accent-yellow)" : "var(--accent-green)"
            }`,
            padding: "16px 20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span className={`badge badge-${a.alert_type.toLowerCase().replace("hitl_required", "hitl")}`}>
                    {TYPE_ICONS[a.alert_type]} {a.alert_type.replace(/_/g, " ")}
                  </span>
                  <span className={`badge badge-${a.risk_level.toLowerCase()}`}>{a.risk_level}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginBottom: 4 }}>
                  {a.event_description}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Agent: <code style={{ color: "var(--accent-cyan)" }}>{a.agent_id}</code>
                  <span style={{ margin: "0 8px" }}>·</span>
                  Action: <span style={{ fontWeight: 600 }}>{a.action_taken}</span>
                  {a.human_action_required && (
                    <>
                      <span style={{ margin: "0 8px" }}>·</span>
                      <span style={{ color: "var(--accent-yellow)" }}>🔔 {a.human_action_required}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div className="timestamp">{formatTime(a.timestamp)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{a.channel}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
