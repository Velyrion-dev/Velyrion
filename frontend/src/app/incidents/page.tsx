"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Incident } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const { toast } = useToast();

  const reload = useCallback(() => {
    api.getIncidents().then(setIncidents).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await api.resolveIncident(id);
      toast("Incident resolved — agent unlocked", "success");
      await reload();
    } catch {
      toast("Failed to resolve incident", "error");
    } finally { setResolving(null); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Incident Response Log</h1>
        <p>Critical security incidents — automated response, immutable audit trail</p>
      </div>

      {loading && (
        <div className="card"><div className="loading-shimmer" style={{ height: 120 }} /></div>
      )}

      {incidents.length === 0 && !loading && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ color: "var(--accent-green)", marginBottom: 8 }}>No Incidents</h3>
          <p style={{ color: "var(--text-muted)" }}>No critical incidents to report. System operating normally.</p>
        </div>
      )}

      {incidents.map(inc => (
        <div key={inc.incident_id} className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${inc.resolution_status === "RESOLVED" ? "var(--accent-green)" : "var(--accent-red)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span className="badge badge-critical">🚨 CRITICAL INCIDENT</span>
                <span className={`badge badge-${inc.resolution_status === "RESOLVED" ? "approved" : "pending"}`}>{inc.resolution_status.replace(/_/g, " ")}</span>
              </div>
              <div className="timestamp">{formatTime(inc.timestamp)}</div>
            </div>
            {inc.resolution_status !== "RESOLVED" && (
              <button className="btn btn-success" onClick={() => handleResolve(inc.incident_id)}
                disabled={resolving === inc.incident_id}>
                {resolving === inc.incident_id ? "Resolving..." : "✓ Resolve & Unlock Agent"}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Agent ID</div>
              <code style={{ color: "var(--accent-cyan)", fontSize: 13 }}>{inc.agent_id}</code>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Violation Type</div>
              <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>{inc.violation_type.replace(/_/g, " ")}</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>System Action</div>
              <span style={{ color: "var(--accent-orange)", fontWeight: 600 }}>{inc.system_action}</span>
            </div>
          </div>

          <details style={{ cursor: "pointer" }}>
            <summary style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>View Agent State Snapshot</summary>
            <pre style={{ marginTop: 8, padding: 12, borderRadius: 8, background: "var(--bg-secondary)", fontSize: 11, color: "var(--accent-cyan)", overflow: "auto", maxHeight: 200 }}>
              {JSON.stringify(JSON.parse(inc.agent_state_snapshot || "{}"), null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
