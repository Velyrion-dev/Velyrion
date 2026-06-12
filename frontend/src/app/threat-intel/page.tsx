"use client";
import { useEffect, useState } from "react";
import { api, Violation, AuditEvent, Agent } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface ThreatPattern {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  occurrences: number;
  affectedAgents: string[];
  firstSeen: string;
  lastSeen: string;
  mitigation: string;
}

interface ThreatFeed {
  timestamp: string;
  type: string;
  agent: string;
  severity: string;
  detail: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  HIGH: { color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  MEDIUM: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  LOW: { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

export default function ThreatIntelPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<ThreatPattern | null>(null);

  useEffect(() => {
    Promise.all([api.getViolations(200), api.getEvents(500), api.getAgents()])
      .then(([v, e, a]) => { setViolations(v); setEvents(e); setAgents(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ti-page"><div className="lb-header"><h1 className="lb-title">Threat Intelligence</h1><p className="lb-subtitle">Scanning threat patterns...</p></div></div>;

  // ── Build Threat Patterns from real data ──
  const patternMap: Record<string, ThreatPattern> = {};

  violations.forEach(v => {
    const key = v.violation_type;
    if (!patternMap[key]) {
      patternMap[key] = {
        id: `tp-${key}`,
        type: v.violation_type,
        severity: v.severity as ThreatPattern["severity"],
        description: v.description,
        occurrences: 0,
        affectedAgents: [],
        firstSeen: v.created_at,
        lastSeen: v.created_at,
        mitigation: getMitigation(v.violation_type),
      };
    }
    patternMap[key].occurrences++;
    if (!patternMap[key].affectedAgents.includes(v.agent_name || v.agent_id)) {
      patternMap[key].affectedAgents.push(v.agent_name || v.agent_id);
    }
    if (new Date(v.created_at) < new Date(patternMap[key].firstSeen)) patternMap[key].firstSeen = v.created_at;
    if (new Date(v.created_at) > new Date(patternMap[key].lastSeen)) patternMap[key].lastSeen = v.created_at;
  });

  const patterns = Object.values(patternMap).sort((a, b) => {
    const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return sevOrder[a.severity] - sevOrder[b.severity] || b.occurrences - a.occurrences;
  });

  // ── Live Threat Feed ──
  const feed: ThreatFeed[] = violations.slice(0, 20).map(v => ({
    timestamp: v.created_at,
    type: v.violation_type,
    agent: v.agent_name || v.agent_id,
    severity: v.severity,
    detail: v.description,
  }));

  // ── Stats ──
  const totalThreats = violations.length;
  const criticalCount = violations.filter(v => v.severity === "CRITICAL").length;
  const highCount = violations.filter(v => v.severity === "HIGH").length;
  const uniquePatterns = patterns.length;
  const affectedAgentCount = new Set(violations.map(v => v.agent_id)).size;

  // ── Threat Heatmap by hour ──
  const hourCounts: number[] = Array(24).fill(0);
  violations.forEach(v => {
    try { hourCounts[new Date(v.created_at).getHours()]++; } catch {}
  });
  const maxHour = Math.max(...hourCounts, 1);

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ts; }
  };

  return (
    <div className="ti-page">
      <div className="ti-header">
        <div>
          <h1 className="lb-title">🧬 Threat Intelligence Network</h1>
          <p className="lb-subtitle">Cross-fleet threat pattern analysis and mitigation</p>
        </div>
        <div className="ti-shield">
          <div className="ti-shield-icon">🛡️</div>
          <div className="ti-shield-text">
            <div className="ti-shield-status">{criticalCount === 0 ? "Fleet Protected" : `${criticalCount} Critical Threats`}</div>
            <div className="ti-shield-sub">{fmt(totalThreats)} total threats analyzed</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi red"><div className="an-kpi-icon">🚨</div><div className="an-kpi-data"><div className="an-kpi-value">{criticalCount}</div><div className="an-kpi-label">Critical</div></div></div>
        <div className="an-kpi yellow"><div className="an-kpi-icon">⚠️</div><div className="an-kpi-data"><div className="an-kpi-value">{highCount}</div><div className="an-kpi-label">High Risk</div></div></div>
        <div className="an-kpi blue"><div className="an-kpi-icon">🔍</div><div className="an-kpi-data"><div className="an-kpi-value">{uniquePatterns}</div><div className="an-kpi-label">Patterns Found</div></div></div>
        <div className="an-kpi purple"><div className="an-kpi-icon">🤖</div><div className="an-kpi-data"><div className="an-kpi-value">{affectedAgentCount}</div><div className="an-kpi-label">Agents Affected</div></div></div>
      </div>

      <div className="an-bottom-grid">
        {/* Threat Patterns */}
        <div className="an-chart-card">
          <div className="an-chart-title">🔍 Detected Patterns ({patterns.length})</div>
          <div className="ti-pattern-list">
            {patterns.length === 0 ? (
              <div className="an-empty">No threat patterns detected — fleet is clean! 🎉</div>
            ) : (
              patterns.map(p => {
                const sc = SEVERITY_CONFIG[p.severity];
                return (
                  <div key={p.id} className={`ti-pattern-card ${selectedPattern?.id === p.id ? "active" : ""}`} onClick={() => setSelectedPattern(p)}>
                    <div className="ti-pattern-top">
                      <span className="ti-pattern-severity" style={{ background: sc.bg, color: sc.color }}>{p.severity}</span>
                      <span className="ti-pattern-count">{p.occurrences}x</span>
                    </div>
                    <div className="ti-pattern-type">{p.type.replace(/_/g, " ")}</div>
                    <div className="ti-pattern-agents">{p.affectedAgents.length} agent{p.affectedAgents.length > 1 ? "s" : ""} affected</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pattern Detail or Threat Feed */}
        <div className="an-chart-card">
          {selectedPattern ? (
            <>
              <div className="an-chart-title">Pattern Analysis</div>
              <div className="ti-detail">
                <div className="ti-detail-header">
                  <span className="ti-pattern-severity" style={{ background: SEVERITY_CONFIG[selectedPattern.severity].bg, color: SEVERITY_CONFIG[selectedPattern.severity].color, fontSize: 12, padding: "4px 14px" }}>{selectedPattern.severity}</span>
                  <h3 className="ti-detail-type">{selectedPattern.type.replace(/_/g, " ")}</h3>
                </div>
                <p className="ti-detail-desc">{selectedPattern.description}</p>
                <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <div className="fr-state-item"><span className="fr-state-label">Occurrences</span><span className="fr-state-value">{selectedPattern.occurrences}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">Agents Affected</span><span className="fr-state-value">{selectedPattern.affectedAgents.length}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">First Seen</span><span className="fr-state-value">{formatTime(selectedPattern.firstSeen)}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">Last Seen</span><span className="fr-state-value">{formatTime(selectedPattern.lastSeen)}</span></div>
                </div>
                <div className="ti-mitigation">
                  <div className="ti-mitigation-title">💡 Recommended Mitigation</div>
                  <p className="ti-mitigation-text">{selectedPattern.mitigation}</p>
                </div>
                <div className="ti-affected">
                  <div className="fr-state-label">Affected Agents</div>
                  <div className="ti-agent-chips">{selectedPattern.affectedAgents.map(a => <span key={a} className="ti-agent-chip">{a}</span>)}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="an-chart-title">🔴 Live Threat Feed</div>
              <div className="ti-feed">
                {feed.length === 0 ? (
                  <div className="an-empty">No recent threats</div>
                ) : (
                  feed.map((f, i) => (
                    <div key={i} className="ti-feed-item">
                      <span className="mc-feed-risk" style={{ fontSize: 9 }}>{f.severity}</span>
                      <span className="ti-feed-type">{f.type.replace(/_/g, " ")}</span>
                      <span className="ti-feed-agent">{f.agent}</span>
                      <span className="ti-feed-time">{formatTime(f.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Threat Activity by Hour */}
      <div className="an-chart-card">
        <div className="an-chart-title">⏰ Threat Activity by Hour (UTC)</div>
        <div className="ti-hour-grid">
          {hourCounts.map((c, h) => {
            const pct = (c / maxHour) * 100;
            const color = pct > 75 ? "var(--accent-red)" : pct > 50 ? "var(--accent-orange)" : pct > 25 ? "var(--accent-yellow)" : "var(--accent-green)";
            return (
              <div key={h} className="ti-hour-col">
                <div className="ti-hour-bar-wrap">
                  <div className="ti-hour-bar" style={{ height: `${Math.max(pct, 4)}%`, background: color }} />
                </div>
                <span className="ti-hour-label">{String(h).padStart(2, "0")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getMitigation(type: string): string {
  const mitigations: Record<string, string> = {
    UNAUTHORIZED_TOOL: "Restrict the agent's allowed_tools list in the Agent Registry. Add the tool to the blocked list or update the agent's permission profile.",
    TOKEN_BUDGET_EXCEEDED: "Increase the agent's max_token_budget or optimize its prompts to reduce token consumption. Consider implementing token-aware caching.",
    DATA_SOURCE_VIOLATION: "Update the agent's data_access_level to match required sources, or restrict access to sensitive databases. Implement data masking.",
    CONFIDENCE_TOO_LOW: "Review the agent's model configuration. Consider upgrading to a more capable model or improving prompt engineering for this task type.",
    RATE_LIMIT_VIOLATION: "Implement exponential backoff in the agent's retry logic. Add request queuing to prevent burst traffic.",
    COST_THRESHOLD_EXCEEDED: "Set tighter cost limits per action. Implement cost-aware routing to cheaper models for simple tasks.",
  };
  return mitigations[type] || "Review the violation pattern and update the agent's governance policy accordingly. Consider adding specific rules to prevent recurrence.";
}
