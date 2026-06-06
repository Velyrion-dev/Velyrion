"use client";
import { useEffect, useState } from "react";
import { api, Agent, AuditEvent, Violation } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444",
};

interface ForensicEvent extends AuditEvent {
  isRoot?: boolean;
}

export default function ForensicsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [timeline, setTimeline] = useState<ForensicEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ForensicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [v, e, a] = await Promise.all([
          api.getViolations(100), api.getEvents(200), api.getAgents(),
        ]);
        setViolations(v); setEvents(e); setAgents(a);
        if (v.length > 0) selectViolation(v[0], e);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectViolation = (v: Violation, allEvents?: AuditEvent[]) => {
    setSelectedViolation(v);
    setSelectedEvent(null);
    const evts = allEvents || events;

    // Find events from the same agent around the violation time
    const violationTime = new Date(v.created_at).getTime();
    const windowMs = 10 * 60 * 1000; // 10 minutes before

    const related = evts
      .filter(e => {
        if (e.agent_id !== v.agent_id) return false;
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= violationTime - windowMs && eventTime <= violationTime + 60000;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(e => ({
        ...e,
        isRoot: new Date(e.timestamp).getTime() >= violationTime - 5000 && new Date(e.timestamp).getTime() <= violationTime + 5000,
      }));

    setTimeline(related);
  };

  const getAgent = (agentId: string) => agents.find(a => a.agent_id === agentId);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch { return ts; }
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
  };

  const exportReport = () => {
    if (!selectedViolation) return;
    setExportLoading(true);
    const report = {
      investigation: {
        violation: selectedViolation,
        agent: getAgent(selectedViolation.agent_id),
        timeline: timeline,
        generated_at: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forensic-report-${selectedViolation.violation_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportLoading(false), 500);
  };

  if (loading) {
    return (
      <div className="fr-page">
        <div className="lb-header"><h1 className="lb-title">Incident Forensics</h1><p className="lb-subtitle">Loading investigation data...</p></div>
      </div>
    );
  }

  const agent = selectedViolation ? getAgent(selectedViolation.agent_id) : null;

  return (
    <div className="fr-page">
      {/* Header */}
      <div className="fr-header">
        <div>
          <h1 className="lb-title">🔍 Incident Forensics</h1>
          <p className="lb-subtitle">Deep investigation into violations and incidents</p>
        </div>
        {selectedViolation && (
          <button className="btn btn-primary btn-sm" onClick={exportReport} disabled={exportLoading}>
            {exportLoading ? "⏳ Exporting..." : "📥 Export Report"}
          </button>
        )}
      </div>

      <div className="fr-main">
        {/* Incident Selector */}
        <div className="fr-sidebar">
          <div className="fr-sidebar-header">
            <span className="an-chart-title" style={{ margin: 0 }}>Violations ({violations.length})</span>
          </div>
          <div className="fr-incident-list">
            {violations.length === 0 ? (
              <div className="an-empty">No violations to investigate 🎉</div>
            ) : (
              violations.map(v => (
                <button
                  key={v.violation_id}
                  className={`fr-incident-card ${selectedViolation?.violation_id === v.violation_id ? "active" : ""}`}
                  onClick={() => selectViolation(v)}
                >
                  <div className="fr-incident-top">
                    <span className="fr-incident-type">{v.violation_type}</span>
                    <span className="mc-feed-risk" style={{ fontSize: 9 }}>{v.severity}</span>
                  </div>
                  <div className="fr-incident-agent">{v.agent_name || v.agent_id}</div>
                  <div className="fr-incident-time">{formatDate(v.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Investigation Panel */}
        <div className="fr-investigation">
          {!selectedViolation ? (
            <div className="an-empty" style={{ padding: 60 }}>Select a violation to investigate</div>
          ) : (
            <>
              {/* Violation Summary */}
              <div className="fr-summary">
                <div className="fr-summary-badge" style={{ background: `${RISK_COLORS[selectedViolation.severity] || RISK_COLORS.MEDIUM}20`, color: RISK_COLORS[selectedViolation.severity] || RISK_COLORS.MEDIUM }}>
                  {selectedViolation.severity}
                </div>
                <h2 className="fr-summary-title">{selectedViolation.violation_type}</h2>
                <p className="fr-summary-desc">{selectedViolation.description}</p>
                <div className="fr-summary-meta">
                  <span>🤖 {selectedViolation.agent_name || selectedViolation.agent_id}</span>
                  <span>•</span>
                  <span>🕐 {formatDate(selectedViolation.created_at)}</span>
                  {agent && <><span>•</span><span>🏢 {agent.department}</span></>}
                </div>
              </div>

              {/* Agent State at Time */}
              {agent && (
                <div className="fr-agent-state">
                  <div className="an-chart-title">Agent State Snapshot</div>
                  <div className="fr-state-grid">
                    <div className="fr-state-item">
                      <span className="fr-state-label">Status</span>
                      <span className={`mc-agent-status ${agent.status}`}>{agent.status}</span>
                    </div>
                    <div className="fr-state-item">
                      <span className="fr-state-label">Total Actions</span>
                      <span className="fr-state-value">{fmt(agent.total_actions)}</span>
                    </div>
                    <div className="fr-state-item">
                      <span className="fr-state-label">Total Violations</span>
                      <span className="fr-state-value" style={{ color: "var(--accent-red)" }}>{agent.total_violations}</span>
                    </div>
                    <div className="fr-state-item">
                      <span className="fr-state-label">Budget Used</span>
                      <span className="fr-state-value">{fmt(agent.tokens_used)} / {fmt(agent.max_token_budget)}</span>
                    </div>
                    <div className="fr-state-item">
                      <span className="fr-state-label">Cost</span>
                      <span className="fr-state-value">${agent.total_cost_usd.toFixed(2)}</span>
                    </div>
                    <div className="fr-state-item">
                      <span className="fr-state-label">Allowed Tools</span>
                      <span className="fr-state-value" style={{ fontSize: 11 }}>{agent.allowed_tools?.join(", ") || "All"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Timeline */}
              <div className="fr-timeline-section">
                <div className="an-chart-title">Event Timeline ({timeline.length} events)</div>
                {timeline.length === 0 ? (
                  <div className="an-empty">No related events found in the 10-minute window</div>
                ) : (
                  <div className="fr-timeline">
                    {timeline.map((event, i) => (
                      <div
                        key={event.event_id || i}
                        className={`fr-tl-node ${event.isRoot ? "root" : ""} ${selectedEvent?.event_id === event.event_id ? "selected" : ""}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="fr-tl-line" />
                        <div className="fr-tl-dot" style={{ background: RISK_COLORS[event.risk_level] || RISK_COLORS.LOW }} />
                        <div className="fr-tl-content">
                          <div className="fr-tl-time">{formatTime(event.timestamp)}</div>
                          <div className="fr-tl-task">{event.task_description}</div>
                          <div className="fr-tl-meta">
                            <span className="mc-feed-risk" style={{ fontSize: 9 }}>{event.risk_level}</span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>🔧 {event.tool_used}</span>
                            {event.token_cost > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>🪙 {event.token_cost}</span>}
                          </div>
                          {event.isRoot && <div className="fr-tl-root-badge">⚡ ROOT CAUSE</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Event Detail */}
              {selectedEvent && (
                <div className="fr-detail">
                  <div className="an-chart-title">Event Detail — {selectedEvent.event_id}</div>
                  <div className="fr-detail-grid">
                    <div className="fr-detail-item"><span className="fr-detail-label">Task</span><span className="fr-detail-value">{selectedEvent.task_description}</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Tool</span><span className="fr-detail-value">{selectedEvent.tool_used}</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Risk</span><span className="fr-detail-value" style={{ color: RISK_COLORS[selectedEvent.risk_level] }}>{selectedEvent.risk_level}</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Confidence</span><span className="fr-detail-value">{(selectedEvent.confidence_score * 100).toFixed(0)}%</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Duration</span><span className="fr-detail-value">{selectedEvent.duration_ms}ms</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Tokens</span><span className="fr-detail-value">{fmt(selectedEvent.token_cost)}</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Cost</span><span className="fr-detail-value">${selectedEvent.compute_cost_usd.toFixed(4)}</span></div>
                    <div className="fr-detail-item"><span className="fr-detail-label">Human-in-Loop</span><span className="fr-detail-value">{selectedEvent.human_in_loop ? "✅ Yes" : "❌ No"}</span></div>
                  </div>
                  {selectedEvent.input_data && (
                    <div className="fr-detail-data">
                      <div className="fr-detail-label">Input Data</div>
                      <pre className="fr-detail-pre">{selectedEvent.input_data}</pre>
                    </div>
                  )}
                  {selectedEvent.output_data && (
                    <div className="fr-detail-data">
                      <div className="fr-detail-label">Output Data</div>
                      <pre className="fr-detail-pre">{selectedEvent.output_data}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
