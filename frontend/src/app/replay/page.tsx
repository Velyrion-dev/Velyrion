"use client";
import { useEffect, useState } from "react";
import { api, Agent, AuditEvent } from "@/lib/api";

interface ReplayData {
  session: {
    agent_id: string; agent_name: string; total_events: number;
    total_tokens: number; total_cost_usd: number; avg_confidence: number;
    risk_breakdown: Record<string, number>; first_event: string; last_event: string;
  };
  timeline: AuditEvent[];
  violations: { violation_id: number; type: string; description: string; severity: string; action_taken: string; created_at: string }[];
  anomalies: { anomaly_id: number; type: string; description: string; risk_level: string; detected_at: string }[];
}

function formatTS(ts: string) {
  const d = new Date(ts);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

export default function ReplayPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => { api.getAgents().then(setAgents); }, []);

  const loadReplay = async (agentId: string) => {
    setSelectedAgent(agentId);
    setLoading(true);
    setReplay(null);
    setPlayingIdx(-1);
    try {
      const data = await api.getAgentReplay(agentId);
      setReplay(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  // Auto-play: step through timeline
  useEffect(() => {
    if (!isPlaying || !replay) return;
    if (playingIdx >= replay.timeline.length - 1) { setIsPlaying(false); return; }
    const timer = setTimeout(() => setPlayingIdx(i => i + 1), 800);
    return () => clearTimeout(timer);
  }, [isPlaying, playingIdx, replay]);

  const startReplay = () => { setPlayingIdx(0); setIsPlaying(true); };
  const stopReplay = () => setIsPlaying(false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🔍 Agent Replay & Forensics</h1>
          <p>Step-by-step investigation of any agent&apos;s complete action history</p>
        </div>
      </div>

      {/* Agent Selector */}
      <div className="search-bar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <select className="filter-select" value={selectedAgent} onChange={e => loadReplay(e.target.value)}
          style={{ minWidth: 250 }}>
          <option value="">Select an agent to replay...</option>
          {agents.map(a => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.agent_name} ({a.agent_id}) — {a.status}
            </option>
          ))}
        </select>
        {replay && !isPlaying && (
          <button className="btn btn-success btn-sm" onClick={startReplay}>▶ Play Replay</button>
        )}
        {isPlaying && (
          <button className="btn btn-ghost btn-sm" onClick={stopReplay}>⏸ Pause</button>
        )}
        {replay && (
          <span className="timestamp">{replay.timeline.length} events · {replay.violations.length} violations</span>
        )}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading forensic data...</div>}

      {replay && (
        <>
          {/* Session Summary Cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Events</div>
              <div className="stat-value">{replay.session.total_events}</div>
            </div>
            <div className="stat-card" style={{ borderColor: "var(--accent-cyan)" }}>
              <div className="stat-label">Total Tokens</div>
              <div className="stat-value">{replay.session.total_tokens.toLocaleString()}</div>
            </div>
            <div className="stat-card" style={{ borderColor: "var(--accent-green)" }}>
              <div className="stat-label">Avg Confidence</div>
              <div className="stat-value">{(replay.session.avg_confidence * 100).toFixed(0)}%</div>
            </div>
            <div className="stat-card" style={{ borderColor: "var(--accent-yellow)" }}>
              <div className="stat-label">Total Cost</div>
              <div className="stat-value">${replay.session.total_cost_usd.toFixed(2)}</div>
            </div>
          </div>

          {/* Risk Breakdown */}
          <div className="card" style={{ padding: 16, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>📊 Risk Distribution</h3>
            <div style={{ display: "flex", gap: 16 }}>
              {Object.entries(replay.session.risk_breakdown).map(([level, count]) => (
                <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`badge badge-${level.toLowerCase()}`}>{level}</span>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Forensic Timeline */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>🕐 Forensic Timeline — {replay.session.agent_name}</h3>
            </div>
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {replay.timeline.map((event, idx) => {
                const isActive = playingIdx === idx;
                const isPast = playingIdx > idx;
                const isExpanded = expandedEvent === String(event.event_id);

                return (
                  <div key={event.event_id}
                    onClick={() => setExpandedEvent(isExpanded ? null : String(event.event_id))}
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border-color)",
                      cursor: "pointer",
                      background: isActive ? "rgba(99, 102, 241, 0.15)" : isPast ? "rgba(99, 102, 241, 0.05)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--accent-purple)" : "3px solid transparent",
                      transition: "all 0.3s ease",
                      opacity: playingIdx >= 0 && !isPast && !isActive ? 0.3 : 1,
                    }}>
                    {/* Event Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace", minWidth: 50 }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 130 }}>
                          {formatTS(event.timestamp)}
                        </span>
                        <code style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--accent-cyan)" }}>
                          {event.tool_used}
                        </code>
                        <span style={{ fontSize: 13, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {event.task_description}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: event.confidence_score >= 0.8 ? "var(--accent-green)" : event.confidence_score >= 0.6 ? "var(--accent-yellow)" : "var(--accent-red)" }}>
                          {(event.confidence_score * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{event.duration_ms}ms</span>
                        <span className={`badge badge-${event.risk_level.toLowerCase()}`}>{event.risk_level}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 12, padding: 16, background: "var(--bg-primary)",
                        borderRadius: 8, border: "1px solid var(--border-color)",
                      }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
                          <div>
                            <strong style={{ color: "var(--accent-cyan)" }}>Input:</strong>
                            <pre style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "var(--text-muted)", fontSize: 11, maxHeight: 120, overflow: "auto" }}>
                              {event.input_data || "(none)"}
                            </pre>
                          </div>
                          <div>
                            <strong style={{ color: "var(--accent-green)" }}>Output:</strong>
                            <pre style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "var(--text-muted)", fontSize: 11, maxHeight: 120, overflow: "auto" }}>
                              {event.output_data || "(none)"}
                            </pre>
                          </div>
                        </div>
                        <div style={{ marginTop: 12, display: "flex", gap: 24, fontSize: 12, color: "var(--text-muted)" }}>
                          <span>🔑 Event ID: {event.event_id}</span>
                          <span>🪙 Tokens: {event.token_cost.toLocaleString()}</span>
                          <span>💰 Cost: ${event.compute_cost_usd.toFixed(4)}</span>
                          <span>🧑 HITL: {event.human_in_loop ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Violations & Anomalies */}
          {(replay.violations.length > 0 || replay.anomalies.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
              {replay.violations.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 12 }}>🚨 Violations ({replay.violations.length})</h3>
                  {replay.violations.map((v) => (
                    <div key={v.violation_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-color)", fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className={`badge badge-${v.severity.toLowerCase()}`}>{v.severity}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{v.action_taken}</span>
                      </div>
                      <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>{v.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {replay.anomalies.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 12 }}>⚠️ Anomalies ({replay.anomalies.length})</h3>
                  {replay.anomalies.map((a) => (
                    <div key={a.anomaly_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-color)", fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className={`badge badge-${a.risk_level.toLowerCase()}`}>{a.risk_level}</span>
                        <span style={{ color: "var(--accent-yellow)" }}>{a.type}</span>
                      </div>
                      <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>{a.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!replay && !loading && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h3>Select an agent to begin forensic replay</h3>
          <p>Step through every action, inspect inputs/outputs, and identify incidents.</p>
        </div>
      )}
    </div>
  );
}
