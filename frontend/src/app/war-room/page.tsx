"use client";
import { useEffect, useState } from "react";
import { api, Violation, Agent } from "@/lib/api";

interface WarRoomIncident {
  id: string;
  violation: Violation;
  agent: Agent | undefined;
  status: "investigating" | "mitigating" | "resolved";
  severity: string;
  timeline: { time: string; action: string; actor: string }[];
  assignee: string;
  notes: string[];
}

const STATUS_CONFIG = {
  investigating: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "🔍 Investigating" },
  mitigating: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "🔧 Mitigating" },
  resolved: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "✅ Resolved" },
};

const TEAM = ["Security Lead", "DevOps Engineer", "ML Engineer", "Platform Admin"];

export default function WarRoomPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<WarRoomIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    Promise.all([api.getViolations(50), api.getAgents()])
      .then(([v, a]) => {
        setViolations(v); setAgents(a);
        const incs: WarRoomIncident[] = v.slice(0, 8).map((vi, i) => ({
          id: `wr-${i}`,
          violation: vi,
          agent: a.find(ag => ag.agent_id === vi.agent_id),
          status: i < 2 ? "investigating" : i < 5 ? "mitigating" : "resolved",
          severity: vi.severity,
          assignee: TEAM[i % TEAM.length],
          timeline: [
            { time: new Date(new Date(vi.created_at).getTime()).toISOString(), action: "Violation detected", actor: "System" },
            { time: new Date(new Date(vi.created_at).getTime() + 30000).toISOString(), action: "Incident created, team notified", actor: "Velyrion" },
            { time: new Date(new Date(vi.created_at).getTime() + 120000).toISOString(), action: `Assigned to ${TEAM[i % TEAM.length]}`, actor: "Auto-Router" },
          ],
          notes: [],
        }));
        setIncidents(incs);
        if (incs.length > 0) setSelectedId(incs[0].id);
        setLoading(false);
      }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="wr-page"><div className="lb-header"><h1 className="lb-title">War Room</h1><p className="lb-subtitle">Loading incidents...</p></div></div>;

  const selected = incidents.find(i => i.id === selectedId);
  const activeCount = incidents.filter(i => i.status !== "resolved").length;

  const updateStatus = (id: string, status: WarRoomIncident["status"]) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status, timeline: [...i.timeline, { time: new Date().toISOString(), action: `Status changed to ${status}`, actor: "You" }] } : i));
  };

  const addNote = () => {
    if (!noteInput.trim() || !selectedId) return;
    setIncidents(prev => prev.map(i => i.id === selectedId ? { ...i, notes: [...i.notes, noteInput], timeline: [...i.timeline, { time: new Date().toISOString(), action: `Note: ${noteInput}`, actor: "You" }] } : i));
    setNoteInput("");
  };

  const formatTime = (ts: string) => { try { return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); } catch { return ts; } };

  return (
    <div className="wr-page">
      <div className="wr-header">
        <div><h1 className="lb-title">🎮 Incident War Room</h1><p className="lb-subtitle">Real-time collaborative incident response</p></div>
        <div className="wr-active-badge">{activeCount > 0 ? `🔴 ${activeCount} Active Incident${activeCount > 1 ? "s" : ""}` : "🟢 All Clear"}</div>
      </div>

      <div className="gs-main">
        {/* Incident List */}
        <div className="gs-scores-list">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Incidents ({incidents.length})</span></div>
          <div className="gs-agent-list">
            {incidents.map(i => {
              const sc = STATUS_CONFIG[i.status];
              return (
                <button key={i.id} className={`gs-agent-card ${selectedId === i.id ? "active" : ""}`} onClick={() => setSelectedId(i.id)}>
                  <div className="gs-agent-info">
                    <span className="gs-agent-name">{i.violation.violation_type.replace(/_/g, " ")}</span>
                    <span className="gs-agent-dept">{i.agent?.agent_name || i.violation.agent_id}</span>
                  </div>
                  <span className="gs-score-pill" style={{ background: sc.bg, color: sc.color, fontSize: 9 }}>{i.status}</span>
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
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selected.violation.violation_type.replace(/_/g, " ")}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{selected.agent?.agent_name} • {selected.assignee}</p>
              </div>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {(["investigating", "mitigating", "resolved"] as const).map(s => (
                  <button key={s} className={`set-radio ${selected.status === s ? "active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => updateStatus(selected.id, s)}>{STATUS_CONFIG[s].label}</button>
                ))}
              </div>
            </div>

            <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="fr-state-item"><span className="fr-state-label">Severity</span><span className="fr-state-value" style={{ color: selected.severity === "CRITICAL" ? "#ef4444" : "#f59e0b" }}>{selected.severity}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Agent</span><span className="fr-state-value">{selected.agent?.agent_name || "—"}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Assignee</span><span className="fr-state-value">{selected.assignee}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Status</span><span className="fr-state-value" style={{ color: STATUS_CONFIG[selected.status].color, textTransform: "capitalize" }}>{selected.status}</span></div>
            </div>

            <div className="an-chart-card">
              <div className="an-chart-title">📋 Investigation Timeline</div>
              <div className="fr-timeline" style={{ paddingLeft: 20 }}>
                {selected.timeline.map((t, i) => (
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
              <div className="an-chart-title">📝 Notes</div>
              {selected.notes.map((n, i) => <div key={i} className="co-rec-card" style={{ borderLeftColor: "var(--accent-cyan)" }}><p className="co-rec-msg">{n}</p></div>)}
              <div className="cp-input-row" style={{ marginTop: 8 }}>
                <input className="cp-input" placeholder="Add investigation note..." value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} />
                <button className="btn btn-primary btn-sm" onClick={addNote}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
