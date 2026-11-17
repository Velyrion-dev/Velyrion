"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { useAuth, usePermissions } from "@/lib/auth";
import {
  ShieldAlert,
  Clock,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Lock,
  MessageSquare,
  Activity
} from "lucide-react";

interface WarRoomIncident {
  incident_id: string;
  violation_id: string | null;
  agent_id: string;
  title: string;
  severity: string;
  status: string;
  assignee: string;
  timeline: { time: string; action: string; actor: string }[];
  notes: { content: string; author: string; time: string }[];
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  investigating: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Investigating" },
  mitigating: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Mitigating" },
  resolved: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Resolved" },
};

export default function WarRoomPage() {
  const { user } = useAuth();
  const { isAdmin, isOperator, canResolveIncidents } = usePermissions();
  const canModify = canResolveIncidents || isAdmin || isOperator;

  const [incidents, setIncidents] = useState<WarRoomIncident[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedIncidents, fetchedAgents] = await Promise.all([
        api.getWarRoomIncidents().catch(() => []),
        api.getAgents().catch(() => []),
      ]);

      setAgents(fetchedAgents);

      if (fetchedIncidents.length === 0) {
        // Attempt auto-creation from violations if no war room incidents exist yet
        try {
          const autoRes = await api.autoCreateWarRoomIncidents();
          if (autoRes.created > 0) {
            const fresh = await api.getWarRoomIncidents();
            setIncidents(fresh);
            if (fresh.length > 0) setSelectedId(fresh[0].incident_id);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
      }

      setIncidents(fetchedIncidents);
      if (fetchedIncidents.length > 0 && !selectedId) {
        setSelectedId(fetchedIncidents[0].incident_id);
      }
    } catch (e) {
      console.error("Failed to load war room data:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selected = incidents.find(i => i.incident_id === selectedId);
  const activeCount = incidents.filter(i => i.status !== "resolved").length;

  const handleUpdateStatus = async (status: string) => {
    if (!selectedId || !canModify) return;
    setActionLoading(true);
    try {
      await api.updateWarRoomStatus(selectedId, status);
      setFeedbackMsg(`Incident status updated to ${status}`);
      setTimeout(() => setFeedbackMsg(""), 3000);
      await loadData();
    } catch (err: unknown) {
      setFeedbackMsg(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedId || !canModify) return;
    setActionLoading(true);
    try {
      await api.addWarRoomNote(selectedId, noteInput.trim(), user?.name || "Operator");
      setNoteInput("");
      setFeedbackMsg("Note added to investigation timeline");
      setTimeout(() => setFeedbackMsg(""), 3000);
      await loadData();
    } catch (err: unknown) {
      setFeedbackMsg(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <div className="wr-page">
        <div className="lb-header">
          <h1 className="lb-title">Incident War Room</h1>
          <p className="lb-subtitle">Loading live war room incidents from backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wr-page">
      <div className="wr-header">
        <div>
          <h1 className="lb-title">Incident War Room</h1>
          <p className="lb-subtitle">Real-time collaborative incident triage and mitigation</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {feedbackMsg && (
            <span style={{ fontSize: 12, color: "var(--accent-cyan)", background: "rgba(6,182,212,0.1)", padding: "4px 10px", borderRadius: 4 }}>
              {feedbackMsg}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Incidents">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
          <div className="wr-active-badge">
            {activeCount > 0 ? `${activeCount} Active Incident${activeCount > 1 ? "s" : ""}` : "All Clear"}
          </div>
        </div>
      </div>

      {!canModify && (
        <div style={{ padding: "8px 14px", background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <Lock style={{ width: 14, height: 14 }} />
          <span>Viewer mode: Read-only access to war room investigations. Incident resolution and notes require Operator or Admin privileges.</span>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--accent-green)", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>No Active Incidents</h3>
          <p style={{ margin: 0, fontSize: 13 }}>All agent operations are within normal governance parameters.</p>
        </div>
      ) : (
        <div className="gs-main">
          {/* Incident List */}
          <div className="gs-scores-list">
            <div className="fr-sidebar-header">
              <span className="an-chart-title" style={{ margin: 0 }}>Incidents ({incidents.length})</span>
            </div>
            <div className="gs-agent-list">
              {incidents.map(i => {
                const sc = STATUS_CONFIG[i.status] || { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: i.status };
                const agent = agents.find(a => a.agent_id === i.agent_id);
                return (
                  <button
                    key={i.incident_id}
                    className={`gs-agent-card ${selectedId === i.incident_id ? "active" : ""}`}
                    onClick={() => setSelectedId(i.incident_id)}
                  >
                    <div className="gs-agent-info">
                      <span className="gs-agent-name">{i.title}</span>
                      <span className="gs-agent-dept">{agent?.agent_name || i.agent_id}</span>
                    </div>
                    <span className="gs-score-pill" style={{ background: sc.bg, color: sc.color, fontSize: 9 }}>
                      {sc.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* War Room Panel */}
          {selected && (
            <div className="gs-detail">
              <div className="dna-header-card">
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selected.title}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    Agent: {agents.find(a => a.agent_id === selected.agent_id)?.agent_name || selected.agent_id} • Assignee: {selected.assignee}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  {(["investigating", "mitigating", "resolved"] as const).map(s => (
                    <button
                      key={s}
                      disabled={!canModify || actionLoading}
                      className={`set-radio ${selected.status === s ? "active" : ""}`}
                      style={{ fontSize: 11, padding: "4px 10px", opacity: !canModify ? 0.6 : 1 }}
                      onClick={() => handleUpdateStatus(s)}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="fr-state-item">
                  <span className="fr-state-label">Severity</span>
                  <span className="fr-state-value" style={{ color: selected.severity === "CRITICAL" ? "#ef4444" : "#f59e0b" }}>
                    {selected.severity}
                  </span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Agent</span>
                  <span className="fr-state-value">
                    {agents.find(a => a.agent_id === selected.agent_id)?.agent_name || selected.agent_id}
                  </span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Assignee</span>
                  <span className="fr-state-value">{selected.assignee}</span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Status</span>
                  <span className="fr-state-value" style={{ color: STATUS_CONFIG[selected.status]?.color || "#94a3b8", textTransform: "capitalize" }}>
                    {selected.status}
                  </span>
                </div>
              </div>

              <div className="an-chart-card">
                <div className="an-chart-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock style={{ width: 14, height: 14 }} />
                  <span>Investigation Timeline</span>
                </div>
                <div className="fr-timeline" style={{ paddingLeft: 20 }}>
                  {(selected.timeline || []).map((t, i) => (
                    <div key={i} className="fr-tl-node" style={{ cursor: "default" }}>
                      <div className="fr-tl-line" />
                      <div className="fr-tl-dot" style={{ background: "var(--accent-cyan)" }} />
                      <div className="fr-tl-content" style={{ marginLeft: 8 }}>
                        <div className="fr-tl-time">{formatTime(t.time)}</div>
                        <div className="fr-tl-task">{t.action}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>by {t.actor}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="an-chart-card">
                <div className="an-chart-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MessageSquare style={{ width: 14, height: 14 }} />
                  <span>Investigation Notes ({(selected.notes || []).length})</span>
                </div>
                {(selected.notes || []).map((n, i) => (
                  <div key={i} className="co-rec-card" style={{ borderLeftColor: "var(--accent-cyan)", marginBottom: 8 }}>
                    <p className="co-rec-msg">{n.content}</p>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {n.author} • {formatTime(n.time)}
                    </span>
                  </div>
                ))}

                {canModify ? (
                  <div className="cp-input-row" style={{ marginTop: 12 }}>
                    <input
                      className="cp-input"
                      placeholder="Add investigation note..."
                      value={noteInput}
                      disabled={actionLoading}
                      onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddNote()}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={actionLoading || !noteInput.trim()}>
                      <Send style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    Note creation restricted to Operator and Admin roles.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
