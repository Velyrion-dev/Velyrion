"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ShieldAlert,
  DollarSign,
  PiggyBank,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MinusCircle,
  PlusCircle
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Factor {
  name: string;
  impact: string;
  weight: number;
  detail: string;
}

interface InsuranceProfileRecord {
  profile_id: string;
  agent_id: string;
  risk_score: number;
  tier: string;
  premium_estimate: number;
  annual_savings: number;
  factors: Factor[];
  computed_at: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Low Risk" },
  moderate: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Moderate" },
  elevated: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Elevated" },
  high: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "High Risk" },
};

export default function InsuranceScoringPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profiles, setProfiles] = useState<InsuranceProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedAgents, fetchedProfiles] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getInsuranceProfiles().catch(() => []),
      ]);

      setAgents(fetchedAgents);
      setProfiles(fetchedProfiles);
      if (fetchedProfiles.length > 0 && !selectedAgentId) {
        setSelectedAgentId(fetchedProfiles[0].agent_id);
      }
    } catch (e) {
      console.error("Insurance scoring fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="is-page">
        <div className="lb-header">
          <h1 className="lb-title">AI Risk Insurance Scoring</h1>
          <p className="lb-subtitle">Querying actuarial risk models and underwriting profiles from database...</p>
        </div>
      </div>
    );
  }

  const selected = profiles.find(p => p.agent_id === selectedAgentId);
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);

  const totalPremiums = profiles.reduce((s, p) => s + p.premium_estimate, 0);
  const totalSavings = profiles.reduce((s, p) => s + p.annual_savings, 0);
  const avgRisk = profiles.length > 0
    ? Math.round(profiles.reduce((s, p) => s + p.risk_score, 0) / profiles.length)
    : 0;

  return (
    <div className="is-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">AI Risk Insurance Scoring</h1>
          <p className="lb-subtitle">Quantitative underwriting models powering AI liability insurance premiums and warranty coverage</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Actuarial Data">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <TrendingUp style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{avgRisk}</div>
            <div className="an-kpi-label">Fleet Underwriting Score</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">
            <DollarSign style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">${fmt(Math.round(totalPremiums))}</div>
            <div className="an-kpi-label">Est. Annual Premium</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <PiggyBank style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">${fmt(Math.round(totalSavings))}</div>
            <div className="an-kpi-label">Governance Discounts</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <ShieldAlert style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{profiles.filter(p => p.tier === "low").length}</div>
            <div className="an-kpi-label">Preferred Tier Agents</div>
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", marginTop: 20 }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--accent-green)", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>No Insurance Profiles Found</h3>
          <p style={{ margin: 0, fontSize: 13 }}>Registered agents will automatically be evaluated for risk underwriting.</p>
        </div>
      ) : (
        <div className="gs-main" style={{ marginTop: 24 }}>
          {/* Agent Risk List */}
          <div className="gs-scores-list">
            <div className="fr-sidebar-header">
              <span className="an-chart-title" style={{ margin: 0 }}>Underwritten Agents</span>
            </div>
            <div className="gs-agent-list">
              {profiles.map(p => {
                const ag = agents.find(a => a.agent_id === p.agent_id);
                const tc = TIER_CONFIG[p.tier] || TIER_CONFIG.moderate;
                return (
                  <button
                    key={p.agent_id}
                    className={`gs-agent-card ${selectedAgentId === p.agent_id ? "active" : ""}`}
                    onClick={() => setSelectedAgentId(p.agent_id)}
                  >
                    <div className="gs-agent-info">
                      <span className="gs-agent-name">{ag?.agent_name || p.agent_id}</span>
                      <span className="gs-agent-dept">${fmt(Math.round(p.premium_estimate))}/yr premium</span>
                    </div>
                    <span className="gs-score-pill" style={{ background: tc.bg, color: tc.color }}>
                      {p.risk_score} risk
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Risk Profile Detail */}
          {selected && (
            <div className="gs-detail">
              <div className="dna-header-card">
                <div className="dna-fingerprint-display" style={{ borderColor: `${(TIER_CONFIG[selected.tier] || TIER_CONFIG.moderate).color}40` }}>
                  <div className="dna-fp-label">ACTUARIAL RISK</div>
                  <div className="dna-fp-code" style={{ color: (TIER_CONFIG[selected.tier] || TIER_CONFIG.moderate).color, fontSize: 28 }}>
                    {selected.risk_score}
                  </div>
                </div>
                <div className="dna-header-info">
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                    {selectedAgent?.agent_name || selected.agent_id}
                  </h2>
                  <p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                    Department: {selectedAgent?.department || "Autonomous Fleet"}
                  </p>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <span className="fr-state-label">Calculated Premium</span>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-cyan)" }}>
                        ${fmt(Math.round(selected.premium_estimate))}/yr
                      </div>
                    </div>
                    <div>
                      <span className="fr-state-label">Platform Discount</span>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-green)" }}>
                        −${fmt(Math.round(selected.annual_savings))}/yr
                      </div>
                    </div>
                    <div>
                      <span className="fr-state-label">Risk Category</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: (TIER_CONFIG[selected.tier] || TIER_CONFIG.moderate).color, textTransform: "capitalize" }}>
                        {(TIER_CONFIG[selected.tier] || TIER_CONFIG.moderate).label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Factors */}
              <div className="an-chart-card">
                <div className="an-chart-title">Underwriting Factor Adjustments</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {(selected.factors || []).map((f, i) => (
                    <div key={i} className="dna-trait-row">
                      <div className="dna-trait-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {f.impact === "positive" ? (
                          <MinusCircle style={{ width: 16, height: 16, color: "var(--accent-green)", flexShrink: 0 }} />
                        ) : f.impact === "negative" ? (
                          <PlusCircle style={{ width: 16, height: 16, color: "var(--accent-red)", flexShrink: 0 }} />
                        ) : (
                          <CheckCircle2 style={{ width: 16, height: 16, color: "var(--text-muted)", flexShrink: 0 }} />
                        )}
                        <div>
                          <div className="dna-trait-name">{f.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.detail}</div>
                        </div>
                      </div>
                      <div className="dna-trait-right">
                        <span
                          className="dna-trait-dev"
                          style={{
                            color: f.impact === "positive" ? "#10b981" : f.impact === "negative" ? "#ef4444" : "var(--text-muted)",
                            fontWeight: 700
                          }}
                        >
                          {f.impact === "positive" ? `−${f.weight} pts` : f.impact === "negative" ? `+${f.weight} pts` : "0 pts"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
