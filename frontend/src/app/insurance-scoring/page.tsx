"use client";
import { useEffect, useState } from "react";
import { api, Agent } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface RiskProfile {
  agent: Agent;
  riskScore: number;
  premiumEstimate: number;
  tier: "low" | "moderate" | "elevated" | "high";
  factors: { name: string; impact: "positive" | "negative" | "neutral"; weight: number; detail: string }[];
  annualSavings: number;
}

const TIER_CONFIG = {
  low: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Low Risk", discount: 40 },
  moderate: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Moderate", discount: 20 },
  elevated: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Elevated", discount: 5 },
  high: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "High Risk", discount: 0 },
};

function computeRisk(agent: Agent): RiskProfile {
  const factors: RiskProfile["factors"] = [];
  let riskScore = 50;

  // Violation history
  if (agent.total_violations === 0) { riskScore -= 15; factors.push({ name: "Clean Record", impact: "positive", weight: 15, detail: "Zero violations — excellent compliance history" }); }
  else if (agent.total_violations <= 3) { riskScore += 5; factors.push({ name: "Minor Violations", impact: "negative", weight: 5, detail: `${agent.total_violations} violations on record` }); }
  else { riskScore += 20; factors.push({ name: "Violation History", impact: "negative", weight: 20, detail: `${agent.total_violations} violations — significant risk factor` }); }

  // Budget utilization
  const budgetPct = agent.max_token_budget > 0 ? (agent.tokens_used / agent.max_token_budget) * 100 : 50;
  if (budgetPct < 60) { riskScore -= 10; factors.push({ name: "Conservative Budget", impact: "positive", weight: 10, detail: `Only ${budgetPct.toFixed(0)}% budget used` }); }
  else if (budgetPct > 90) { riskScore += 15; factors.push({ name: "Budget Strain", impact: "negative", weight: 15, detail: `${budgetPct.toFixed(0)}% budget consumed` }); }
  else { factors.push({ name: "Budget Utilization", impact: "neutral", weight: 0, detail: `${budgetPct.toFixed(0)}% — within normal range` }); }

  // Action volume (proven track record)
  if (agent.total_actions >= 1000) { riskScore -= 10; factors.push({ name: "Proven Track Record", impact: "positive", weight: 10, detail: `${fmt(agent.total_actions)} governed actions` }); }
  else if (agent.total_actions < 50) { riskScore += 5; factors.push({ name: "Limited History", impact: "negative", weight: 5, detail: "Insufficient action history for full assessment" }); }
  else { factors.push({ name: "Moderate History", impact: "neutral", weight: 0, detail: `${fmt(agent.total_actions)} actions` }); }

  // Status
  if (agent.status === "ACTIVE") { riskScore -= 5; factors.push({ name: "Active & Monitored", impact: "positive", weight: 5, detail: "Agent actively monitored by governance platform" }); }
  else { riskScore += 10; factors.push({ name: "Inactive/Locked", impact: "negative", weight: 10, detail: `Agent status: ${agent.status}` }); }

  // Cost efficiency
  const costPerAction = agent.total_actions > 0 ? agent.total_cost_usd / agent.total_actions : 0;
  if (costPerAction < 0.01) { riskScore -= 5; factors.push({ name: "Cost Efficient", impact: "positive", weight: 5, detail: `$${costPerAction.toFixed(4)}/action — highly efficient` }); }
  else if (costPerAction > 0.1) { riskScore += 10; factors.push({ name: "High Cost", impact: "negative", weight: 10, detail: `$${costPerAction.toFixed(4)}/action — above threshold` }); }

  riskScore = Math.max(5, Math.min(95, riskScore));
  const tier: RiskProfile["tier"] = riskScore <= 25 ? "low" : riskScore <= 50 ? "moderate" : riskScore <= 75 ? "elevated" : "high";
  const basePremium = 1000;
  const premiumEstimate = Math.round(basePremium * (riskScore / 50));
  const discount = TIER_CONFIG[tier].discount;
  const annualSavings = Math.round(basePremium * (discount / 100));

  return { agent, riskScore, premiumEstimate, tier, factors, annualSavings };
}

export default function InsuranceScoringPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.getAgents().then(a => { setAgents(a); if (a.length > 0) setSelectedId(a[0].agent_id); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="is-page"><div className="lb-header"><h1 className="lb-title">Insurance Scoring</h1><p className="lb-subtitle">Loading risk data...</p></div></div>;

  const profiles = agents.map(computeRisk).sort((a, b) => a.riskScore - b.riskScore);
  const selected = profiles.find(p => p.agent.agent_id === selectedId);
  const totalPremiums = profiles.reduce((s, p) => s + p.premiumEstimate, 0);
  const totalSavings = profiles.reduce((s, p) => s + p.annualSavings, 0);
  const avgRisk = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.riskScore, 0) / profiles.length) : 0;

  const IMPACT_ICONS = { positive: "✅", negative: "❌", neutral: "➖" };

  return (
    <div className="is-page">
      <div className="lb-header">
        <h1 className="lb-title">🛡️ AI Risk Insurance Scoring</h1>
        <p className="lb-subtitle">Risk assessment powering AI liability insurance premiums</p>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue"><div className="an-kpi-icon">📊</div><div className="an-kpi-data"><div className="an-kpi-value">{avgRisk}</div><div className="an-kpi-label">Avg Risk Score</div></div></div>
        <div className="an-kpi yellow"><div className="an-kpi-icon">💰</div><div className="an-kpi-data"><div className="an-kpi-value">${fmt(totalPremiums)}</div><div className="an-kpi-label">Est. Premiums/yr</div></div></div>
        <div className="an-kpi green"><div className="an-kpi-icon">💡</div><div className="an-kpi-data"><div className="an-kpi-value">${fmt(totalSavings)}</div><div className="an-kpi-label">Velyrion Savings</div></div></div>
        <div className="an-kpi purple"><div className="an-kpi-icon">🛡️</div><div className="an-kpi-data"><div className="an-kpi-value">{profiles.filter(p => p.tier === "low").length}</div><div className="an-kpi-label">Low Risk Agents</div></div></div>
      </div>

      <div className="gs-main">
        <div className="gs-scores-list">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Risk Profiles</span></div>
          <div className="gs-agent-list">
            {profiles.map(p => {
              const tc = TIER_CONFIG[p.tier];
              return (
                <button key={p.agent.agent_id} className={`gs-agent-card ${selectedId === p.agent.agent_id ? "active" : ""}`} onClick={() => setSelectedId(p.agent.agent_id)}>
                  <span style={{ fontSize: 14 }}>🛡️</span>
                  <div className="gs-agent-info">
                    <span className="gs-agent-name">{p.agent.agent_name}</span>
                    <span className="gs-agent-dept">${p.premiumEstimate}/yr</span>
                  </div>
                  <span className="gs-score-pill" style={{ background: tc.bg, color: tc.color }}>{p.riskScore}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="gs-detail">
            <div className="dna-header-card">
              <div className="dna-fingerprint-display" style={{ borderColor: `${TIER_CONFIG[selected.tier].color}40` }}>
                <div className="dna-fp-label">RISK SCORE</div>
                <div className="dna-fp-code" style={{ color: TIER_CONFIG[selected.tier].color, fontSize: 28 }}>{selected.riskScore}</div>
              </div>
              <div className="dna-header-info">
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selected.agent.agent_name}</h2>
                <p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>{selected.agent.department}</p>
                <div style={{ display: "flex", gap: 16 }}>
                  <div><span className="fr-state-label">Premium</span><div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-cyan)" }}>${selected.premiumEstimate}/yr</div></div>
                  <div><span className="fr-state-label">Savings</span><div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-green)" }}>${selected.annualSavings}/yr</div></div>
                  <div><span className="fr-state-label">Tier</span><div style={{ fontSize: 14, fontWeight: 800, color: TIER_CONFIG[selected.tier].color, textTransform: "capitalize" }}>{TIER_CONFIG[selected.tier].label}</div></div>
                </div>
              </div>
            </div>

            <div className="an-chart-card">
              <div className="an-chart-title">Risk Factor Analysis</div>
              {selected.factors.map((f, i) => (
                <div key={i} className="dna-trait-row">
                  <div className="dna-trait-left">
                    <span>{IMPACT_ICONS[f.impact]}</span>
                    <div>
                      <div className="dna-trait-name">{f.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{f.detail}</div>
                    </div>
                  </div>
                  <div className="dna-trait-right">
                    <span className="dna-trait-dev" style={{ color: f.impact === "positive" ? "#10b981" : f.impact === "negative" ? "#ef4444" : "var(--text-muted)" }}>
                      {f.impact === "positive" ? `−${f.weight}` : f.impact === "negative" ? `+${f.weight}` : "0"}
                    </span>
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
