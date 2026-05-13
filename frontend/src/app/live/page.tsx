"use client";
import { useEffect, useState, useRef } from "react";
import { api, WS_URL } from "@/lib/api";

interface LiveEvent {
  type: string;
  sequence: number;
  timestamp: string;
  data: {
    event_id?: string;
    agent_id: string;
    agent_name?: string;
    task_description?: string;
    tool_used?: string;
    risk_level?: string;
    token_cost?: number;
    event_hash?: string;
    violation_type?: string;
    description?: string;
    severity?: string;
    action_taken?: string;
    anomaly_type?: string;
    reason?: string;
  };
}

interface ChainEntry {
  event_id: string;
  timestamp: string;
  agent_id: string;
  agent_name: string;
  task: string;
  risk_level: string;
  event_hash: string;
  previous_hash: string;
  hash_linked: boolean;
}

interface Prediction {
  agent_id: string;
  agent_name: string;
  department: string;
  risk_score: number;
  risk_level: string;
  prediction: string;
  recommended_action: string;
  factors: { factor: string; severity: string; detail: string; score_impact: number }[];
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ff3b5c",
  HIGH: "#ff6b35",
  MEDIUM: "#ffc107",
  LOW: "#00e5a0",
};

const EVENT_ICONS: Record<string, string> = {
  AUDIT_EVENT: "📋",
  VIOLATION: "🚫",
  ANOMALY: "⚠️",
  AGENT_LOCKED: "🔒",
  CONNECTED: "🟢",
  PONG: "💓",
};

export default function LiveFeedPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [chainStatus, setChainStatus] = useState<{ chain_integrity: string; total_events: number; verified_events: number; merkle_root: string | null } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load predictions & chain on mount
  useEffect(() => {
    api.getPredictions().then(setPredictions).catch((_e) => { /* silent */ });
    api.getAuditChain(15).then(setChain).catch((_e) => { /* silent */ });
    api.verifyAuditChain().then(setChainStatus).catch((_e) => { /* silent */ });
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    function connect() {
      if (!alive) return;
      try {
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (alive) reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => { try { ws?.close(); } catch (_e) { /* */ } };
        ws.onmessage = (msg) => {
          try {
            const event: LiveEvent = JSON.parse(msg.data);
            if (event.type === "PONG") return;
            setEvents((prev) => [...prev.slice(-200), event]);
          } catch (_e) { /* ignore parse errors */ }
        };
      } catch (_e) {
        setConnected(false);
        if (alive) reconnectTimer = setTimeout(connect, 5000);
      }
    }
    connect();
    const pingInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
    }, 30000);
    return () => {
      alive = false;
      clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch (_e) { /* */ }
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const riskColor = (level: string) => SEVERITY_COLORS[level] || "#8b95a5";

  return (
    <div>
      <div className="page-header">
        <h1>🔴 Live Feed</h1>
        <p>Real-time WebSocket stream — events, violations, and anomalies as they happen</p>
      </div>

      {/* Connection Status + Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="stat-card" style={{ flex: "1 1 200px", padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`pulse-dot ${connected ? "pulse-green" : "pulse-red"}`} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{connected ? "CONNECTED" : "RECONNECTING..."}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            WebSocket · {events.length} events received
          </div>
        </div>
        <button
          className={`btn ${autoScroll ? "btn-primary" : "btn-ghost"} btn-sm`}
          onClick={() => setAutoScroll(!autoScroll)}
          style={{ alignSelf: "center" }}
        >
          {autoScroll ? "⬇ Auto-Scroll ON" : "⬇ Auto-Scroll OFF"}
        </button>
        <button
          className={`btn ${soundEnabled ? "btn-primary" : "btn-ghost"} btn-sm`}
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{ alignSelf: "center" }}
        >
          {soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF"}
        </button>
      </div>

      <div className="grid-2">
        {/* Live Event Stream */}
        <div className="card" style={{ minHeight: 500 }}>
          <h3 className="section-title">⚡ Real-Time Event Stream</h3>
          <div
            ref={feedRef}
            style={{
              maxHeight: 450,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {events.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📡</div>
                <div>Waiting for events...</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>Run the live agent simulator to see real-time events</div>
              </div>
            ) : (
              events.map((e, i) => (
                <div
                  key={i}
                  style={{
                    padding: "6px 10px",
                    borderLeft: `3px solid ${riskColor(e.data.risk_level || e.data.severity || "LOW")}`,
                    marginBottom: 4,
                    background: e.type === "VIOLATION" || e.type === "AGENT_LOCKED"
                      ? "rgba(255,59,92,0.06)"
                      : "var(--bg-secondary)",
                    borderRadius: "0 6px 6px 0",
                    animation: "fadeIn 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{EVENT_ICONS[e.type] || "📋"}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`badge badge-${(e.data.risk_level || e.data.severity || "low").toLowerCase()}`} style={{ fontSize: 9, padding: "1px 6px" }}>
                      {e.type}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--accent-cyan)" }}>
                      {e.data.agent_name || e.data.agent_id}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", marginLeft: 26, fontSize: 11 }}>
                    {e.data.task_description || e.data.description || e.data.violation_type || ""}
                    {e.data.event_hash && (
                      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                        🔗 {e.data.event_hash}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Predictions + Chain */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* AI Risk Predictions */}
          <div className="card">
            <h3 className="section-title">🧠 AI Risk Predictions</h3>
            {predictions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 20, textAlign: "center" }}>Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {predictions.slice(0, 6).map((p) => (
                  <div key={p.agent_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, borderLeft: `3px solid ${riskColor(p.risk_level)}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.agent_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.prediction}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: riskColor(p.risk_level) }}>{p.risk_score}</div>
                      <span className={`badge badge-${p.risk_level.toLowerCase()}`} style={{ fontSize: 9 }}>{p.risk_level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cryptographic Audit Chain */}
          <div className="card">
            <h3 className="section-title">🔗 Cryptographic Audit Chain</h3>
            {chainStatus && (
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ padding: "6px 14px", background: chainStatus.chain_integrity === "VERIFIED" ? "rgba(0,229,160,0.1)" : "rgba(255,59,92,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 700, color: chainStatus.chain_integrity === "VERIFIED" ? "var(--accent-green)" : "var(--accent-red)" }}>
                  {chainStatus.chain_integrity === "VERIFIED" ? "✅" : "⚠️"} {chainStatus.chain_integrity}
                </div>
                <div style={{ padding: "6px 14px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 11 }}>
                  {chainStatus.total_events} events
                </div>
                {chainStatus.merkle_root && (
                  <div style={{ padding: "6px 14px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 10, fontFamily: "monospace" }}>
                    Root: {chainStatus.merkle_root.slice(0, 16)}...
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              {chain.slice(0, 8).map((c, i) => (
                <div key={c.event_id} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
                  <span style={{ color: c.hash_linked ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {c.hash_linked ? "🔗" : "⛓️‍💥"}
                  </span>
                  <span style={{ color: "var(--accent-purple)", minWidth: 110 }}>{c.event_hash}</span>
                  <span style={{ color: "var(--text-muted)" }}>←</span>
                  <span style={{ color: "var(--text-muted)", minWidth: 110 }}>{c.previous_hash}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.agent_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
