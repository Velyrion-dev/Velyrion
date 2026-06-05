"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import api, { Agent, DashboardStats } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";
const WS_URL = API_BASE.replace("https://", "wss://").replace("http://", "ws://") + "/ws/events";

// ── Types ──
interface LiveEvent {
  type: string;
  sequence?: number;
  timestamp: string;
  data: Record<string, string | number | boolean | undefined>;
}

interface AlertBanner {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  type: string;
}

interface TimelineBucket {
  minute: number;
  count: number;
  avgRisk: string;
}

// ── Constants ──
const RISK_COLORS: Record<string, string> = {
  LOW: "var(--accent-green)",
  MEDIUM: "var(--accent-yellow)",
  HIGH: "var(--accent-orange)",
  CRITICAL: "var(--accent-red)",
};

const EVENT_ICONS: Record<string, string> = {
  AUDIT_EVENT: "📋",
  VIOLATION: "🚫",
  ANOMALY: "⚠️",
  AGENT_LOCKED: "🔒",
  CONNECTED: "🟢",
};

const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// ── Helper ──
function getMostCommonRisk(risks: string[]): string {
  const counts: Record<string, number> = {};
  for (const r of risks) counts[r] = (counts[r] || 0) + 1;
  let max = 0;
  let result = "LOW";
  for (const [risk, count] of Object.entries(counts)) {
    if (count > max) { max = count; result = risk; }
  }
  return result;
}

export default function MissionControlPage() {
  // ── State ──
  const [agents, setAgents] = useState<Agent[]>([]);
  const [, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertBanner, setAlertBanner] = useState<AlertBanner | null>(null);
  const [eventsPerHour, setEventsPerHour] = useState(0);
  const [violationsToday, setViolationsToday] = useState(0);
  const [costToday, setCostToday] = useState(0);
  const [riskDist, setRiskDist] = useState({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [alertedAgents, setAlertedAgents] = useState<Set<string>>(new Set());

  const feedRef = useRef<HTMLDivElement>(null);
  const eventCountRef = useRef(0);
  const timelineRef = useRef<Map<number, { count: number; risks: string[] }>>(new Map());
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Sound Effect ──
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore audio errors */ }
  }, [soundEnabled]);

  // ── Handle Incoming Event ──
  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === "CONNECTED") return;

    // Add to feed
    setEvents(prev => [event, ...prev].slice(0, 150));

    // Update counters
    eventCountRef.current++;
    setEventsPerHour(prev => prev + 1);

    // Track cost
    if (event.data.compute_cost_usd) {
      setCostToday(prev => prev + Number(event.data.compute_cost_usd || 0));
    }

    // Track risk distribution
    const risk = String(event.data.risk_level || event.data.severity || "LOW");
    setRiskDist(prev => ({ ...prev, [risk]: (prev[risk as keyof typeof prev] || 0) + 1 }));

    // Track timeline
    const minute = Math.floor(Date.now() / 60000);
    const bucket = timelineRef.current.get(minute) || { count: 0, risks: [] };
    bucket.count++;
    bucket.risks.push(risk);
    timelineRef.current.set(minute, bucket);

    // Cleanup old buckets (keep 30 min)
    const cutoff = minute - 30;
    for (const [k] of timelineRef.current) {
      if (k < cutoff) timelineRef.current.delete(k);
    }

    // Update timeline state
    const now = Math.floor(Date.now() / 60000);
    const bars: TimelineBucket[] = [];
    for (let i = 29; i >= 0; i--) {
      const m = now - i;
      const b = timelineRef.current.get(m);
      if (b) {
        const avgRisk = getMostCommonRisk(b.risks);
        bars.push({ minute: m, count: b.count, avgRisk });
      } else {
        bars.push({ minute: m, count: 0, avgRisk: "LOW" });
      }
    }
    setTimeline(bars);

    // Handle violations
    if (event.type === "VIOLATION" || event.type === "AGENT_LOCKED") {
      setViolationsToday(prev => prev + 1);
      const agentId = String(event.data.agent_id || "");
      const agentName = String(event.data.agent_name || event.data.agent_id || "Unknown");
      setAlertedAgents(prev => new Set(prev).add(agentId));

      // Show alert banner
      setAlertBanner({
        id: String(event.data.violation_id || event.data.event_id || Date.now()),
        agentId,
        agentName,
        message: String(event.data.description || event.data.reason || "Critical violation detected"),
        type: event.type,
      });

      playAlert();

      // Auto-dismiss after 8 seconds
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlertBanner(null), 8000);

      // Remove alert glow after 10 seconds
      setTimeout(() => {
        setAlertedAgents(prev => {
          const next = new Set(prev);
          next.delete(agentId);
          return next;
        });
      }, 10000);
    }

    // Auto-scroll feed
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [playAlert]);

  // ── Fetch Initial Data ──
  useEffect(() => {
    const load = async () => {
      try {
        const [agentsData, statsData] = await Promise.all([
          api.getAgents(),
          api.getStats(),
        ]);
        setAgents(agentsData);
        setStats(statsData);
        setEventsPerHour(statsData.events_last_24h || 0);
        setViolationsToday(statsData.total_violations || 0);
        setCostToday(statsData.total_cost_usd || 0);
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── WebSocket Connection ──
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          setConnected(true);
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send("ping");
          }, 30000);
        };

        ws.onmessage = (msg) => {
          if (msg.data === "PONG") return;
          try {
            const event: LiveEvent = JSON.parse(msg.data);
            handleEvent(event);
          } catch { /* ignore parse errors */ }
        };

        ws.onclose = () => {
          setConnected(false);
          clearInterval(pingTimer);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agent Controls ──
  const handleKill = async (agentId: string) => {
    try {
      await api.killAgent(agentId, "Killed from Mission Control");
      setAgents(prev => prev.map(a => a.agent_id === agentId ? { ...a, status: "LOCKED" } : a));
    } catch (e) { console.error(e); }
  };

  const handlePause = async (agentId: string) => {
    try {
      await api.pauseAgent(agentId, "Paused from Mission Control");
      setAgents(prev => prev.map(a => a.agent_id === agentId ? { ...a, status: "LOCKED" } : a));
    } catch (e) { console.error(e); }
  };

  const handleResume = async (agentId: string) => {
    try {
      await api.unlockAgent(agentId, "Resumed from Mission Control");
      setAgents(prev => prev.map(a => a.agent_id === agentId ? { ...a, status: "ACTIVE" } : a));
    } catch (e) { console.error(e); }
  };

  // ── Helpers ──
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch { return ts; }
  };

  const getHealthScore = (agent: Agent) => {
    const violations = agent.total_violations || 0;
    const budgetRatio = agent.max_token_budget > 0 ? agent.tokens_used / agent.max_token_budget : 0;
    return Math.max(0, 100 - Math.min(violations * 5, 50) - Math.max(0, (budgetRatio - 1) * 30));
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "var(--accent-green)";
    if (score >= 60) return "var(--accent-cyan)";
    if (score >= 40) return "var(--accent-yellow)";
    if (score >= 20) return "var(--accent-orange)";
    return "var(--accent-red)";
  };

  const totalRiskEvents = Object.values(riskDist).reduce((a, b) => a + b, 0);
  const activeAgents = agents.filter(a => a.status === "ACTIVE").length;
  const maxTimeline = Math.max(...timeline.map(t => t.count), 1);

  return (
    <div className="mc-page">
      {/* ── Critical Alert Banner ── */}
      {alertBanner && (
        <div className="mc-alert-banner">
          <div className="mc-alert-banner-content">
            <span className="mc-alert-banner-icon">🚨</span>
            <span className="mc-alert-banner-text">
              <span className="mc-alert-banner-agent">{alertBanner.agentName}</span>
              {" — "}{alertBanner.message}
            </span>
          </div>
          <div className="mc-alert-banner-actions">
            <button className="mc-alert-banner-btn" onClick={() => handleKill(alertBanner.agentId)}>Kill Agent</button>
            <button className="mc-alert-banner-btn dismiss" onClick={() => setAlertBanner(null)}>✕</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="mc-header">
        <div className="mc-header-left">
          <h1 className="mc-header-title">MISSION CONTROL</h1>
          <div className="mc-live-badge">
            <span className="mc-live-dot" />
            {connected ? "LIVE" : "RECONNECTING"}
          </div>
        </div>
        <div className="mc-header-right">
          <div className="mc-header-stat">
            <span className="mc-header-stat-value">{activeAgents}</span>
            <span className="mc-header-stat-label">Active Agents</span>
          </div>
          <div className="mc-header-stat">
            <span className="mc-header-stat-value">{events.length}</span>
            <span className="mc-header-stat-label">Events Captured</span>
          </div>
          <button
            className={`mc-sound-btn ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute alerts" : "Enable alert sounds"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {/* ── Stats Row ── */}
      <div className="mc-stats-row">
        <div className="mc-stat-card blue">
          <div className="mc-stat-value">{eventsPerHour.toLocaleString()}</div>
          <div className="mc-stat-label">Events Tracked</div>
          <div className="mc-stat-delta up">↑ Live</div>
        </div>
        <div className="mc-stat-card red">
          <div className="mc-stat-value">{violationsToday}</div>
          <div className="mc-stat-label">Violations</div>
          {violationsToday > 0 && <div className="mc-stat-delta down">⚠ Active</div>}
        </div>
        <div className="mc-stat-card green">
          <div className="mc-stat-value">${costToday.toFixed(2)}</div>
          <div className="mc-stat-label">Cost Today</div>
        </div>
        <div className="mc-stat-card orange">
          <div className="mc-stat-label" style={{ marginBottom: 8 }}>Risk Distribution</div>
          <div className="mc-risk-bars">
            {RISK_ORDER.map(r => {
              const count = riskDist[r as keyof typeof riskDist];
              const pct = totalRiskEvents > 0 ? (count / totalRiskEvents) * 100 : 0;
              return (
                <div
                  key={r}
                  className="mc-risk-bar"
                  style={{ height: `${Math.max(pct, 8)}%`, background: RISK_COLORS[r] }}
                  title={`${r}: ${count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {RISK_ORDER.map(r => (
              <span key={r} style={{ fontSize: 9, color: RISK_COLORS[r], fontWeight: 600 }}>
                {r.charAt(0)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Grid: Agents + Feed ── */}
      <div className="mc-main-grid">
        {/* Agent Cards */}
        <div className="mc-agents-section">
          <div className="mc-agents-header">
            <span className="mc-agents-title">Agent Fleet ({agents.length})</span>
          </div>
          <div className="mc-agents-grid">
            {agents.map(agent => {
              const health = getHealthScore(agent);
              const isAlerted = alertedAgents.has(agent.agent_id);
              return (
                <div
                  key={agent.agent_id}
                  className={`mc-agent-card status-${agent.status} ${isAlerted ? "alert" : ""}`}
                >
                  <div className="mc-agent-top">
                    <div>
                      <div className="mc-agent-name">{agent.agent_name}</div>
                      <div className="mc-agent-dept">{agent.department}</div>
                    </div>
                    <span className={`mc-agent-status ${agent.status}`}>{agent.status}</span>
                  </div>
                  <div className="mc-agent-metrics">
                    <div className="mc-agent-metric">
                      <div className="mc-agent-metric-value">{agent.total_actions}</div>
                      <div className="mc-agent-metric-label">Actions</div>
                    </div>
                    <div className="mc-agent-metric">
                      <div className="mc-agent-metric-value">${agent.total_cost_usd.toFixed(2)}</div>
                      <div className="mc-agent-metric-label">Cost</div>
                    </div>
                    <div className="mc-agent-metric">
                      <div className="mc-agent-metric-value">{agent.total_violations}</div>
                      <div className="mc-agent-metric-label">Violations</div>
                    </div>
                  </div>
                  <div className="mc-agent-health-bar">
                    <div
                      className="mc-agent-health-fill"
                      style={{ width: `${health}%`, background: getHealthColor(health) }}
                    />
                  </div>
                  <div className="mc-agent-controls">
                    {agent.status === "ACTIVE" ? (
                      <>
                        <button className="mc-agent-btn kill" onClick={() => handleKill(agent.agent_id)}>🛑 Kill</button>
                        <button className="mc-agent-btn pause" onClick={() => handlePause(agent.agent_id)}>⏸ Pause</button>
                      </>
                    ) : agent.status === "LOCKED" ? (
                      <button className="mc-agent-btn resume" onClick={() => handleResume(agent.agent_id)}>▶ Resume</button>
                    ) : (
                      <button className="mc-agent-btn" disabled>Deactivated</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Feed */}
        <div className="mc-feed-panel">
          <div className="mc-feed-header">
            <span className="mc-feed-title">Live Event Stream</span>
            <span className="mc-feed-count">{events.length} events</span>
          </div>
          <div className="mc-feed-list" ref={feedRef}>
            {events.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Waiting for events...
                <br />
                <span style={{ fontSize: 11 }}>Events will appear here in real-time</span>
              </div>
            ) : (
              events.map((event, i) => {
                const risk = String(event.data.risk_level || event.data.severity || "LOW");
                return (
                  <div key={`${event.sequence || i}-${event.timestamp}`} className={`mc-feed-item risk-${risk}`}>
                    <span className="mc-feed-icon">{EVENT_ICONS[event.type] || "📋"}</span>
                    <div className="mc-feed-content">
                      <div className="mc-feed-agent">
                        {String(event.data.agent_name || event.data.agent_id || "System")}
                      </div>
                      <div className="mc-feed-task">
                        {String(event.data.task_description || event.data.description || event.data.message || event.type)}
                      </div>
                      <div className="mc-feed-meta">
                        <span className="mc-feed-time">{formatTime(event.timestamp)}</span>
                        <span className={`mc-feed-risk ${risk}`}>{risk}</span>
                        {event.data.tool_used && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {String(event.data.tool_used)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Activity Timeline ── */}
      <div className="mc-timeline">
        <div className="mc-timeline-header">
          <span className="mc-timeline-title">Activity Timeline (Last 30 Minutes)</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {eventCountRef.current} events this session
          </span>
        </div>
        <div className="mc-timeline-bars">
          {timeline.length > 0 ? (
            timeline.map((bucket, i) => (
              <div
                key={i}
                className={`mc-timeline-bar ${bucket.count === 0 ? "empty" : bucket.avgRisk.toLowerCase()}`}
                style={{ height: bucket.count > 0 ? `${(bucket.count / maxTimeline) * 100}%` : undefined }}
                title={`${bucket.count} events`}
              />
            ))
          ) : (
            Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="mc-timeline-bar empty" />
            ))
          )}
        </div>
        <div className="mc-timeline-labels">
          <span className="mc-timeline-label">30m ago</span>
          <span className="mc-timeline-label">20m ago</span>
          <span className="mc-timeline-label">10m ago</span>
          <span className="mc-timeline-label">Now</span>
        </div>
      </div>
    </div>
  );
}
