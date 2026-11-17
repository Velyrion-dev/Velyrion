"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Violation, AuditEvent, Agent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Activity,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Flame,
  ShieldCheck
} from "lucide-react";

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

interface ThreatFeedItem {
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState<ThreatPattern[]>([]);
  const [feed, setFeed] = useState<ThreatFeedItem[]>([]);
  const [hourlyCounts, setHourlyCounts] = useState<number[]>(Array(24).fill(0));
  const [selectedPattern, setSelectedPattern] = useState<ThreatPattern | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [backendPatterns, backendFeed, backendHourly] = await Promise.all([
        api.getThreatPatterns().catch(() => []),
        api.getThreatFeed(30).catch(() => []),
        api.getThreatHourly().catch(() => ({ hours: Array(24).fill(0) })),
      ]);

      if (backendPatterns && backendPatterns.length > 0) {
        const mapped: ThreatPattern[] = backendPatterns.map(p => ({
          id: p.pattern_id,
          type: p.pattern_type,
          severity: (p.severity as ThreatPattern["severity"]) || "MEDIUM",
          description: p.description,
          occurrences: p.occurrences,
          affectedAgents: p.affected_agents || [],
          firstSeen: p.first_seen,
          lastSeen: p.last_seen,
          mitigation: p.mitigation,
        }));
        setPatterns(mapped);
      } else {
        // Fallback to violation parsing if patterns table is empty
        const vList = await api.getViolations(100).catch(() => []);
        const pMap: Record<string, ThreatPattern> = {};
        vList.forEach(v => {
          const k = v.violation_type;
          if (!pMap[k]) {
            pMap[k] = {
              id: `tp-${k}`,
              type: v.violation_type,
              severity: (v.severity as ThreatPattern["severity"]) || "MEDIUM",
              description: v.description,
              occurrences: 0,
              affectedAgents: [],
              firstSeen: v.created_at,
              lastSeen: v.created_at,
              mitigation: getMitigation(v.violation_type),
            };
          }
          pMap[k].occurrences++;
          const ag = v.agent_name || v.agent_id;
          if (!pMap[k].affectedAgents.includes(ag)) pMap[k].affectedAgents.push(ag);
        });
        setPatterns(Object.values(pMap));
      }

      if (backendFeed && backendFeed.length > 0) {
        setFeed(
          backendFeed.map(f => ({
            timestamp: f.timestamp,
            type: f.type,
            agent: f.agent_id,
            severity: f.severity,
            detail: f.detail,
          }))
        );
      } else {
        const vList = await api.getViolations(20).catch(() => []);
        setFeed(
          vList.map(v => ({
            timestamp: v.created_at,
            type: v.violation_type,
            agent: v.agent_name || v.agent_id,
            severity: v.severity,
            detail: v.description,
          }))
        );
      }

      if (backendHourly?.hours && backendHourly.hours.length === 24) {
        setHourlyCounts(backendHourly.hours);
      }
    } catch (e) {
      console.error("Threat intel fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="ti-page">
        <div className="lb-header">
          <h1 className="lb-title">Threat Intelligence Network</h1>
          <p className="lb-subtitle">Querying security telemetry and behavioral threat vectors...</p>
        </div>
      </div>
    );
  }

  const criticalCount = patterns.filter(p => p.severity === "CRITICAL").reduce((s, p) => s + p.occurrences, 0);
  const highCount = patterns.filter(p => p.severity === "HIGH").reduce((s, p) => s + p.occurrences, 0);
  const totalThreats = patterns.reduce((s, p) => s + p.occurrences, 0);
  const affectedAgentCount = new Set(patterns.flatMap(p => p.affectedAgents)).size;
  const maxHour = Math.max(...hourlyCounts, 1);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div className="ti-page">
      <div className="ti-header">
        <div>
          <h1 className="lb-title">Threat Intelligence Network</h1>
          <p className="lb-subtitle">Cross-fleet threat pattern analysis, heuristic anomalies, and active mitigations</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Intelligence Feed">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
          <div className="ti-shield">
            <div className="ti-shield-icon">
              {criticalCount === 0 ? (
                <ShieldCheck style={{ width: 22, height: 22, color: "var(--accent-green)" }} />
              ) : (
                <ShieldAlert style={{ width: 22, height: 22, color: "var(--accent-red)" }} />
              )}
            </div>
            <div className="ti-shield-text">
              <div className="ti-shield-status">
                {criticalCount === 0 ? "Fleet Protected" : `${criticalCount} Critical Threats`}
              </div>
              <div className="ti-shield-sub">{fmt(totalThreats)} threats detected</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi red">
          <div className="an-kpi-icon">
            <ShieldAlert style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{criticalCount}</div>
            <div className="an-kpi-label">Critical Incidents</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">
            <AlertTriangle style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{highCount}</div>
            <div className="an-kpi-label">High Severity</div>
          </div>
        </div>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Activity style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{patterns.length}</div>
            <div className="an-kpi-label">Unique Patterns</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{affectedAgentCount}</div>
            <div className="an-kpi-label">Agents Affected</div>
          </div>
        </div>
      </div>

      <div className="an-bottom-grid">
        {/* Threat Patterns */}
        <div className="an-chart-card">
          <div className="an-chart-title">Detected Patterns ({patterns.length})</div>
          <div className="ti-pattern-list">
            {patterns.length === 0 ? (
              <div className="an-empty">No active threat patterns detected — all agents compliant.</div>
            ) : (
              patterns.map(p => {
                const sc = SEVERITY_CONFIG[p.severity] || SEVERITY_CONFIG.MEDIUM;
                return (
                  <div
                    key={p.id}
                    className={`ti-pattern-card ${selectedPattern?.id === p.id ? "active" : ""}`}
                    onClick={() => setSelectedPattern(p)}
                  >
                    <div className="ti-pattern-top">
                      <span className="ti-pattern-severity" style={{ background: sc.bg, color: sc.color }}>
                        {p.severity}
                      </span>
                      <span className="ti-pattern-count">{p.occurrences}x</span>
                    </div>
                    <div className="ti-pattern-type">{p.type.replace(/_/g, " ")}</div>
                    <div className="ti-pattern-agents">
                      {p.affectedAgents.length} agent{p.affectedAgents.length > 1 ? "s" : ""} affected
                    </div>
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
              <div className="an-chart-title">Pattern Analysis & Remediation</div>
              <div className="ti-detail">
                <div className="ti-detail-header">
                  <span
                    className="ti-pattern-severity"
                    style={{
                      background: (SEVERITY_CONFIG[selectedPattern.severity] || SEVERITY_CONFIG.MEDIUM).bg,
                      color: (SEVERITY_CONFIG[selectedPattern.severity] || SEVERITY_CONFIG.MEDIUM).color,
                      fontSize: 12,
                      padding: "4px 14px",
                    }}
                  >
                    {selectedPattern.severity}
                  </span>
                  <h3 className="ti-detail-type">{selectedPattern.type.replace(/_/g, " ")}</h3>
                </div>
                <p className="ti-detail-desc">{selectedPattern.description}</p>
                <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Occurrences</span>
                    <span className="fr-state-value">{selectedPattern.occurrences}</span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Agents Affected</span>
                    <span className="fr-state-value">{selectedPattern.affectedAgents.length}</span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">First Seen</span>
                    <span className="fr-state-value">{formatTime(selectedPattern.firstSeen)}</span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Last Seen</span>
                    <span className="fr-state-value">{formatTime(selectedPattern.lastSeen)}</span>
                  </div>
                </div>
                <div className="ti-mitigation">
                  <div className="ti-mitigation-title">Recommended Mitigation</div>
                  <p className="ti-mitigation-text">{selectedPattern.mitigation}</p>
                </div>
                <div className="ti-affected">
                  <div className="fr-state-label">Affected Agents</div>
                  <div className="ti-agent-chips">
                    {selectedPattern.affectedAgents.map(a => (
                      <span key={a} className="ti-agent-chip">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="an-chart-title">Live Threat Ingestion Feed</div>
              <div className="ti-feed">
                {feed.length === 0 ? (
                  <div className="an-empty">No recent threat events logged.</div>
                ) : (
                  feed.map((f, i) => (
                    <div key={i} className="ti-feed-item">
                      <span className="mc-feed-risk" style={{ fontSize: 9 }}>
                        {f.severity}
                      </span>
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
        <div className="an-chart-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock style={{ width: 14, height: 14 }} />
          <span>Threat Vector Activity by Hour (UTC)</span>
        </div>
        <div className="ti-hour-grid">
          {hourlyCounts.map((c, h) => {
            const pct = (c / maxHour) * 100;
            const color =
              pct > 75
                ? "var(--accent-red)"
                : pct > 50
                ? "var(--accent-orange)"
                : pct > 25
                ? "var(--accent-yellow)"
                : "var(--accent-green)";
            return (
              <div key={h} className="ti-hour-col">
                <div className="ti-hour-bar-wrap">
                  <div className="ti-hour-bar" style={{ height: `${Math.max(pct, 6)}%`, background: color }} />
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
