"use client";
import { useEffect, useState } from "react";
import { api, Agent, AuditEvent, AgentHealth } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface DNAProfile {
  agent: Agent;
  health: number;
  traits: { name: string; value: number; baseline: number; deviation: number; status: "normal" | "warning" | "anomaly" }[];
  fingerprint: string;
  driftScore: number;
  lastUpdated: string;
}

function generateFingerprint(agent: Agent): string {
  const parts = [
    agent.agent_name.slice(0, 3).toUpperCase(),
    Math.abs(hashCode(agent.agent_id) % 9999).toString().padStart(4, "0"),
    agent.department?.slice(0, 2).toUpperCase() || "XX",
    Math.abs(hashCode(agent.agent_id + "salt") % 99).toString().padStart(2, "0"),
  ];
  return parts.join("-");
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) { hash = ((hash << 5) - hash) + s.charCodeAt(i); hash |= 0; }
  return hash;
}

function buildDNA(agent: Agent, health: AgentHealth | undefined, events: AuditEvent[]): DNAProfile {
  const agentEvents = events.filter(e => e.agent_id === agent.agent_id);
  const healthScore = health?.health_score ?? 70;

  const avgTokenCost = agentEvents.length > 0 ? agentEvents.reduce((s, e) => s + e.token_cost, 0) / agentEvents.length : 0;
  const avgDuration = agentEvents.length > 0 ? agentEvents.reduce((s, e) => s + e.duration_ms, 0) / agentEvents.length : 0;
  const avgConfidence = agentEvents.length > 0 ? agentEvents.reduce((s, e) => s + e.confidence_score, 0) / agentEvents.length : 0.9;
  const costPerAction = agent.total_actions > 0 ? agent.total_cost_usd / agent.total_actions : 0;
  const violationRate = agent.total_actions > 0 ? (agent.total_violations / agent.total_actions) * 100 : 0;
  const uniqueTools = new Set(agentEvents.map(e => e.tool_used)).size;

  // Simulated baselines (in production these would come from historical averages)
  const seed = Math.abs(hashCode(agent.agent_id));
  const jitter = (n: number) => n * (0.8 + (seed % 40) / 100);

  const traits = [
    { name: "Avg Token Cost", value: Math.round(avgTokenCost), baseline: Math.round(jitter(avgTokenCost * 0.9)), unit: "tokens" },
    { name: "Avg Duration", value: Math.round(avgDuration), baseline: Math.round(jitter(avgDuration * 0.85)), unit: "ms" },
    { name: "Avg Confidence", value: Math.round(avgConfidence * 100), baseline: Math.round(jitter(avgConfidence * 100 * 0.95)), unit: "%" },
    { name: "Cost per Action", value: Math.round(costPerAction * 10000) / 100, baseline: Math.round(jitter(costPerAction * 10000 * 0.9)) / 100, unit: "¢" },
    { name: "Violation Rate", value: Math.round(violationRate * 100) / 100, baseline: Math.round(jitter(violationRate * 100 * 0.7)) / 100, unit: "%" },
    { name: "Tool Diversity", value: uniqueTools, baseline: Math.max(1, Math.round(jitter(uniqueTools * 0.9))), unit: "tools" },
    { name: "Health Score", value: healthScore, baseline: Math.round(jitter(healthScore * 1.05)), unit: "pts" },
    { name: "Action Volume", value: agent.total_actions, baseline: Math.round(jitter(agent.total_actions * 0.95)), unit: "actions" },
  ].map(t => {
    const deviation = t.baseline > 0 ? Math.abs((t.value - t.baseline) / t.baseline) * 100 : 0;
    return {
      name: t.name,
      value: t.value,
      baseline: t.baseline,
      deviation: Math.round(deviation),
      status: (deviation > 30 ? "anomaly" : deviation > 15 ? "warning" : "normal") as DNAProfile["traits"][0]["status"],
    };
  });

  const driftScore = Math.round(traits.reduce((s, t) => s + t.deviation, 0) / traits.length);

  return {
    agent,
    health: healthScore,
    traits,
    fingerprint: generateFingerprint(agent),
    driftScore,
    lastUpdated: new Date().toISOString(),
  };
}

const STATUS_COLORS = { normal: "#10b981", warning: "#f59e0b", anomaly: "#ef4444" };

export default function BehavioralDNAPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [healthData, setHealthData] = useState<AgentHealth[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getAgents(), api.getHealth(), api.getEvents(500)])
      .then(([a, h, e]) => { setAgents(a); setHealthData(h); setEvents(e); if (a.length > 0) setSelectedId(a[0].agent_id); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="dna-page"><div className="lb-header"><h1 className="lb-title">Behavioral DNA</h1><p className="lb-subtitle">Analyzing behavioral signatures...</p></div></div>;

  const profiles = agents.map(a => buildDNA(a, healthData.find(h => h.agent_id === a.agent_id), events));
  const selected = profiles.find(p => p.agent.agent_id === selectedId);
  const anomalyCount = profiles.filter(p => p.driftScore > 20).length;
  const avgDrift = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.driftScore, 0) / profiles.length) : 0;

  return (
    <div className="dna-page">
      <div className="lb-header">
        <h1 className="lb-title">🧠 Behavioral DNA Fingerprinting</h1>
        <p className="lb-subtitle">Unique behavioral signatures — detect drift, compromise, and anomalies</p>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue"><div className="an-kpi-icon">🧬</div><div className="an-kpi-data"><div className="an-kpi-value">{agents.length}</div><div className="an-kpi-label">Profiles</div></div></div>
        <div className="an-kpi green"><div className="an-kpi-icon">✅</div><div className="an-kpi-data"><div className="an-kpi-value">{agents.length - anomalyCount}</div><div className="an-kpi-label">Normal</div></div></div>
        <div className="an-kpi red"><div className="an-kpi-icon">⚠️</div><div className="an-kpi-data"><div className="an-kpi-value">{anomalyCount}</div><div className="an-kpi-label">Drifting</div></div></div>
        <div className="an-kpi purple"><div className="an-kpi-icon">📊</div><div className="an-kpi-data"><div className="an-kpi-value">{avgDrift}%</div><div className="an-kpi-label">Avg Drift</div></div></div>
      </div>

      <div className="gs-main">
        {/* Agent List */}
        <div className="gs-scores-list">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Agent Profiles</span></div>
          <div className="gs-agent-list">
            {profiles.map(p => {
              const driftColor = p.driftScore > 20 ? "#ef4444" : p.driftScore > 10 ? "#f59e0b" : "#10b981";
              return (
                <button key={p.agent.agent_id} className={`gs-agent-card ${selectedId === p.agent.agent_id ? "active" : ""}`} onClick={() => setSelectedId(p.agent.agent_id)}>
                  <span style={{ fontSize: 16 }}>🧬</span>
                  <div className="gs-agent-info">
                    <span className="gs-agent-name">{p.agent.agent_name}</span>
                    <span className="gs-agent-dept" style={{ fontFamily: "monospace", letterSpacing: 1 }}>{p.fingerprint}</span>
                  </div>
                  <span className="gs-score-pill" style={{ background: `${driftColor}20`, color: driftColor }}>{p.driftScore}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <div className="gs-detail">
            <div className="dna-header-card">
              <div className="dna-fingerprint-display">
                <div className="dna-fp-label">BEHAVIORAL FINGERPRINT</div>
                <div className="dna-fp-code">{selected.fingerprint}</div>
              </div>
              <div className="dna-header-info">
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selected.agent.agent_name}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{selected.agent.department} • Drift: <span style={{ color: selected.driftScore > 20 ? "#ef4444" : selected.driftScore > 10 ? "#f59e0b" : "#10b981", fontWeight: 800 }}>{selected.driftScore}%</span></p>
              </div>
            </div>

            <div className="an-chart-card">
              <div className="an-chart-title">Behavioral Traits — Current vs Baseline</div>
              {selected.traits.map(t => (
                <div key={t.name} className="dna-trait-row">
                  <div className="dna-trait-left">
                    <span className="dna-trait-dot" style={{ background: STATUS_COLORS[t.status] }} />
                    <span className="dna-trait-name">{t.name}</span>
                  </div>
                  <div className="dna-trait-right">
                    <span className="dna-trait-val">{t.value}</span>
                    <span className="dna-trait-vs">vs</span>
                    <span className="dna-trait-base">{t.baseline}</span>
                    <span className="dna-trait-dev" style={{ color: STATUS_COLORS[t.status] }}>
                      {t.deviation > 0 ? `↕ ${t.deviation}%` : "—"}
                    </span>
                    <span className="dna-trait-status" style={{ background: `${STATUS_COLORS[t.status]}20`, color: STATUS_COLORS[t.status] }}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
