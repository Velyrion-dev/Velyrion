"use client";
import { useEffect, useState } from "react";
import { api, Agent, AgentHealth, Violation, AuditEvent } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

// ── Scoring Algorithm ──
interface ScoreDimension {
  name: string;
  icon: string;
  score: number;       // 0-100
  weight: number;      // 0-1
  description: string;
  color: string;
}

interface AgentScore {
  agent: Agent;
  overall: number;
  grade: string;
  gradeColor: string;
  certified: boolean;
  dimensions: ScoreDimension[];
}

const GRADE_MAP: { min: number; grade: string; color: string; label: string }[] = [
  { min: 95, grade: "A+", color: "#10b981", label: "Exceptional" },
  { min: 90, grade: "A", color: "#34d399", label: "Excellent" },
  { min: 85, grade: "A-", color: "#6ee7b7", label: "Very Good" },
  { min: 80, grade: "B+", color: "#3b82f6", label: "Good" },
  { min: 75, grade: "B", color: "#60a5fa", label: "Above Average" },
  { min: 70, grade: "B-", color: "#93c5fd", label: "Average" },
  { min: 60, grade: "C", color: "#f59e0b", label: "Below Average" },
  { min: 50, grade: "D", color: "#f97316", label: "Poor" },
  { min: 0, grade: "F", color: "#ef4444", label: "Critical" },
];

function getGrade(score: number) {
  return GRADE_MAP.find(g => score >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];
}

function computeScore(agent: Agent, health: AgentHealth | undefined, violations: Violation[], events: AuditEvent[]): AgentScore {
  const agentViolations = violations.filter(v => v.agent_id === agent.agent_id);
  const agentEvents = events.filter(e => e.agent_id === agent.agent_id);
  const healthScore = health?.health_score ?? 70;

  // Dimension 1: Compliance (violations per 100 actions)
  const violationRate = agent.total_actions > 0 ? (agent.total_violations / agent.total_actions) * 100 : 0;
  const complianceScore = Math.max(0, Math.min(100, 100 - violationRate * 50));

  // Dimension 2: Cost Efficiency
  const costPerAction = agent.total_actions > 0 ? agent.total_cost_usd / agent.total_actions : 0;
  const costScore = costPerAction <= 0.001 ? 100 : costPerAction <= 0.01 ? 85 : costPerAction <= 0.05 ? 70 : costPerAction <= 0.1 ? 50 : 30;

  // Dimension 3: Budget Discipline
  const budgetPct = agent.max_token_budget > 0 ? (agent.tokens_used / agent.max_token_budget) * 100 : 50;
  const budgetScore = budgetPct <= 50 ? 100 : budgetPct <= 70 ? 85 : budgetPct <= 85 ? 70 : budgetPct <= 95 ? 50 : 20;

  // Dimension 4: Health & Reliability
  const reliabilityScore = healthScore;

  // Dimension 5: Risk Profile
  const criticalViolations = agentViolations.filter(v => v.severity === "CRITICAL").length;
  const highViolations = agentViolations.filter(v => v.severity === "HIGH").length;
  const riskPenalty = criticalViolations * 20 + highViolations * 10;
  const riskScore = Math.max(0, 100 - riskPenalty);

  // Dimension 6: Activity Volume (more actions = more proven)
  const activityScore = agent.total_actions >= 10000 ? 100 : agent.total_actions >= 1000 ? 85 : agent.total_actions >= 100 ? 70 : agent.total_actions >= 10 ? 50 : 20;

  const dimensions: ScoreDimension[] = [
    { name: "Compliance", icon: "🛡️", score: Math.round(complianceScore), weight: 0.25, description: "Policy adherence & violation rate", color: "#3b82f6" },
    { name: "Cost Efficiency", icon: "💰", score: Math.round(costScore), weight: 0.15, description: "Cost per action optimization", color: "#10b981" },
    { name: "Budget Discipline", icon: "📊", score: Math.round(budgetScore), weight: 0.15, description: "Token budget utilization", color: "#8b5cf6" },
    { name: "Reliability", icon: "❤️", score: Math.round(reliabilityScore), weight: 0.20, description: "Health score & uptime", color: "#f59e0b" },
    { name: "Risk Profile", icon: "⚡", score: Math.round(riskScore), weight: 0.15, description: "Severity of past violations", color: "#ef4444" },
    { name: "Proven Track Record", icon: "📈", score: Math.round(activityScore), weight: 0.10, description: "Volume of governed actions", color: "#06b6d4" },
  ];

  const overall = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0));
  const grade = getGrade(overall);

  return {
    agent,
    overall,
    grade: grade.grade,
    gradeColor: grade.color,
    certified: overall >= 80,
    dimensions,
  };
}

export default function GovernanceScorePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [healthData, setHealthData] = useState<AgentHealth[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getAgents(), api.getHealth(), api.getViolations(200), api.getEvents(500)])
      .then(([a, h, v, e]) => { setAgents(a); setHealthData(h); setViolations(v); setEvents(e); if (a.length > 0) setSelectedAgent(a[0].agent_id); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="gs-page"><div className="lb-header"><h1 className="lb-title">Governance Score</h1><p className="lb-subtitle">Computing scores...</p></div></div>;

  const scores = agents.map(a => computeScore(a, healthData.find(h => h.agent_id === a.agent_id), violations, events));
  scores.sort((a, b) => b.overall - a.overall);

  const fleetAvg = scores.length > 0 ? Math.round(scores.reduce((s, sc) => s + sc.overall, 0) / scores.length) : 0;
  const certifiedCount = scores.filter(s => s.certified).length;
  const fleetGrade = getGrade(fleetAvg);
  const selected = scores.find(s => s.agent.agent_id === selectedAgent);

  return (
    <div className="gs-page">
      <div className="gs-header">
        <div>
          <h1 className="lb-title">📜 Governance Score™</h1>
          <p className="lb-subtitle">Trust certification for every AI agent in your fleet</p>
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="gs-fleet-banner">
        <div className="gs-fleet-score-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={fleetGrade.color} strokeWidth="8"
              strokeDasharray={`${(fleetAvg / 100) * 327} 327`}
              strokeLinecap="round" transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dasharray 1s ease" }} />
          </svg>
          <div className="gs-fleet-score-inner">
            <div className="gs-fleet-score-num" style={{ color: fleetGrade.color }}>{fleetAvg}</div>
            <div className="gs-fleet-score-label">Fleet Score</div>
          </div>
        </div>
        <div className="gs-fleet-info">
          <div className="gs-fleet-grade" style={{ color: fleetGrade.color }}>
            Grade: {fleetGrade.grade} — {fleetGrade.label}
          </div>
          <div className="gs-fleet-stats">
            <div className="gs-fleet-stat">
              <span className="gs-fleet-stat-val">{agents.length}</span>
              <span className="gs-fleet-stat-label">Total Agents</span>
            </div>
            <div className="gs-fleet-stat">
              <span className="gs-fleet-stat-val" style={{ color: "var(--accent-green)" }}>{certifiedCount}</span>
              <span className="gs-fleet-stat-label">Certified ✓</span>
            </div>
            <div className="gs-fleet-stat">
              <span className="gs-fleet-stat-val" style={{ color: "var(--accent-red)" }}>{agents.length - certifiedCount}</span>
              <span className="gs-fleet-stat-label">Uncertified</span>
            </div>
          </div>
        </div>
      </div>

      <div className="gs-main">
        {/* Agent Scores List */}
        <div className="gs-scores-list">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Agent Scores</span></div>
          <div className="gs-agent-list">
            {scores.map((s, i) => (
              <button
                key={s.agent.agent_id}
                className={`gs-agent-card ${selectedAgent === s.agent.agent_id ? "active" : ""}`}
                onClick={() => setSelectedAgent(s.agent.agent_id)}
              >
                <span className="gs-rank">#{i + 1}</span>
                <div className="gs-agent-info">
                  <span className="gs-agent-name">{s.agent.agent_name}</span>
                  <span className="gs-agent-dept">{s.agent.department}</span>
                </div>
                <div className="gs-score-pill" style={{ background: `${s.gradeColor}20`, color: s.gradeColor }}>
                  {s.overall} {s.grade}
                </div>
                {s.certified && <span className="gs-cert-badge" title="Velyrion Certified">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Score Detail */}
        {selected && (
          <div className="gs-detail">
            {/* Score Header */}
            <div className="gs-detail-header">
              <div className="gs-detail-ring">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle cx="70" cy="70" r="60" fill="none" stroke={selected.gradeColor} strokeWidth="10"
                    strokeDasharray={`${(selected.overall / 100) * 377} 377`}
                    strokeLinecap="round" transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dasharray 1s ease" }} />
                </svg>
                <div className="gs-detail-ring-inner">
                  <div className="gs-detail-score" style={{ color: selected.gradeColor }}>{selected.overall}</div>
                  <div className="gs-detail-grade" style={{ color: selected.gradeColor }}>{selected.grade}</div>
                </div>
              </div>
              <div className="gs-detail-info">
                <h2 className="gs-detail-name">{selected.agent.agent_name}</h2>
                <p className="gs-detail-dept">{selected.agent.department} • {selected.agent.status}</p>
                {selected.certified ? (
                  <div className="gs-cert-full">
                    <span className="gs-cert-icon">✓</span>
                    <div>
                      <div className="gs-cert-title">Velyrion Certified™</div>
                      <div className="gs-cert-sub">This agent meets governance standards</div>
                    </div>
                  </div>
                ) : (
                  <div className="gs-cert-full uncertified">
                    <span className="gs-cert-icon">✗</span>
                    <div>
                      <div className="gs-cert-title">Not Certified</div>
                      <div className="gs-cert-sub">Score must be ≥80 for certification</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="gs-dimensions">
              <div className="an-chart-title">Score Breakdown</div>
              {selected.dimensions.map(d => (
                <div key={d.name} className="gs-dim-row">
                  <div className="gs-dim-left">
                    <span className="gs-dim-icon">{d.icon}</span>
                    <div>
                      <div className="gs-dim-name">{d.name}</div>
                      <div className="gs-dim-desc">{d.description}</div>
                    </div>
                  </div>
                  <div className="gs-dim-right">
                    <div className="gs-dim-bar">
                      <div className="gs-dim-fill" style={{ width: `${d.score}%`, background: d.color }} />
                    </div>
                    <span className="gs-dim-score" style={{ color: d.color }}>{d.score}</span>
                    <span className="gs-dim-weight">{(d.weight * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="gs-quick-stats">
              <div className="gs-qs-item"><span className="gs-qs-val">{fmt(selected.agent.total_actions)}</span><span className="gs-qs-label">Actions</span></div>
              <div className="gs-qs-item"><span className="gs-qs-val">{selected.agent.total_violations}</span><span className="gs-qs-label">Violations</span></div>
              <div className="gs-qs-item"><span className="gs-qs-val">${selected.agent.total_cost_usd.toFixed(2)}</span><span className="gs-qs-label">Total Cost</span></div>
              <div className="gs-qs-item"><span className="gs-qs-val">{fmt(selected.agent.tokens_used)}</span><span className="gs-qs-label">Tokens</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
