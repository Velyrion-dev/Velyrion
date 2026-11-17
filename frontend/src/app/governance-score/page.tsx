"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { usePermissions } from "@/lib/auth";
import {
  ShieldCheck,
  Award,
  Activity,
  TrendingUp,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  DollarSign,
  Cpu
} from "lucide-react";

interface ScoreDimension {
  name: string;
  icon?: string;
  score: number;
  weight: number;
  description: string;
  color: string;
}

interface GovernanceScoreRecord {
  score_id: string;
  agent_id: string;
  overall_score: number;
  grade: string;
  certified: boolean;
  dimensions: ScoreDimension[];
  computed_at: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "#10b981",
  "A": "#34d399",
  "A-": "#6ee7b7",
  "B+": "#3b82f6",
  "B": "#60a5fa",
  "B-": "#93c5fd",
  "C": "#f59e0b",
  "D": "#f97316",
  "F": "#ef4444",
};

export default function GovernanceScorePage() {
  const { isAdmin, isOperator, canConfigurePolicies } = usePermissions();
  const canRecompute = canConfigurePolicies || isAdmin || isOperator;

  const [scores, setScores] = useState<GovernanceScoreRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const loadScores = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedScores, fetchedAgents] = await Promise.all([
        api.getGovernanceScores().catch(() => []),
        api.getAgents().catch(() => []),
      ]);

      setAgents(fetchedAgents);

      if (fetchedScores.length === 0 && fetchedAgents.length > 0) {
        // First-time compute
        try {
          await api.recomputeGovernanceScores();
          const fresh = await api.getGovernanceScores();
          setScores(fresh);
          if (fresh.length > 0) setSelectedAgentId(fresh[0].agent_id);
          setLoading(false);
          return;
        } catch {
          // ignore
        }
      }

      setScores(fetchedScores);
      if (fetchedScores.length > 0 && !selectedAgentId) {
        setSelectedAgentId(fetchedScores[0].agent_id);
      }
    } catch (e) {
      console.error("Failed to load governance scores:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const handleRecompute = async () => {
    if (!canRecompute || recomputing) return;
    setRecomputing(true);
    try {
      const res = await api.recomputeGovernanceScores();
      setFeedback(`Successfully recomputed ${res.recomputed} agent scores`);
      setTimeout(() => setFeedback(""), 4000);
      await loadScores();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to recompute scores");
    } finally {
      setRecomputing(false);
    }
  };

  const getDimensionIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "compliance":
        return <ShieldCheck style={{ width: 14, height: 14, color: "#3b82f6" }} />;
      case "cost efficiency":
        return <DollarSign style={{ width: 14, height: 14, color: "#10b981" }} />;
      case "budget discipline":
        return <Zap style={{ width: 14, height: 14, color: "#8b5cf6" }} />;
      case "reliability":
        return <Activity style={{ width: 14, height: 14, color: "#f59e0b" }} />;
      case "risk profile":
        return <AlertTriangle style={{ width: 14, height: 14, color: "#ef4444" }} />;
      default:
        return <TrendingUp style={{ width: 14, height: 14, color: "#06b6d4" }} />;
    }
  };

  if (loading) {
    return (
      <div className="gs-page">
        <div className="lb-header">
          <h1 className="lb-title">Governance Score™</h1>
          <p className="lb-subtitle">Loading persistent agent trust scores from backend database...</p>
        </div>
      </div>
    );
  }

  const fleetAvg = scores.length > 0
    ? Math.round(scores.reduce((s, sc) => s + sc.overall_score, 0) / scores.length)
    : 0;
  const certifiedCount = scores.filter(s => s.certified).length;
  const fleetColor = fleetAvg >= 80 ? "#10b981" : fleetAvg >= 60 ? "#f59e0b" : "#ef4444";
  const selected = scores.find(s => s.agent_id === selectedAgentId);
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);

  return (
    <div className="gs-page">
      <div className="gs-header">
        <div>
          <h1 className="lb-title">Governance Score™</h1>
          <p className="lb-subtitle">Standardized trust certification and dimensional risk auditing for autonomous agents</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {feedback && (
            <span style={{ fontSize: 12, color: "var(--accent-cyan)", background: "rgba(6,182,212,0.1)", padding: "4px 10px", borderRadius: 4 }}>
              {feedback}
            </span>
          )}
          {canRecompute ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRecompute}
              disabled={recomputing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw style={{ width: 13, height: 13, animation: recomputing ? "spin 1s linear infinite" : "none" }} />
              <span>{recomputing ? "Recomputing..." : "Recompute Scores"}</span>
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Lock style={{ width: 12, height: 12 }} />
              Viewer Mode
            </span>
          )}
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="gs-fleet-banner">
        <div className="gs-fleet-score-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={fleetColor}
              strokeWidth="8"
              strokeDasharray={`${(fleetAvg / 100) * 327} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          </svg>
          <div className="gs-fleet-score-inner">
            <div className="gs-fleet-score-num" style={{ color: fleetColor }}>{fleetAvg}</div>
            <div className="gs-fleet-score-label">Fleet Average</div>
          </div>
        </div>

        <div className="gs-fleet-stats">
          <div className="gs-fleet-stat">
            <span className="gs-stat-val" style={{ color: "var(--accent-green)" }}>{certifiedCount}</span>
            <span className="gs-stat-lbl">Certified Agents (Score &ge; 80)</span>
          </div>
          <div className="gs-fleet-stat">
            <span className="gs-stat-val">{scores.length}</span>
            <span className="gs-stat-lbl">Evaluated Agents</span>
          </div>
          <div className="gs-fleet-stat">
            <span className="gs-stat-val" style={{ color: "var(--accent-cyan)" }}>
              {scores.length > 0 ? `${Math.round((certifiedCount / scores.length) * 100)}%` : "0%"}
            </span>
            <span className="gs-stat-lbl">Fleet Certification Rate</span>
          </div>
        </div>
      </div>

      {scores.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", marginTop: 20 }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--accent-green)", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>No Scores Generated Yet</h3>
          <p style={{ margin: 0, fontSize: 13 }}>Click &quot;Recompute Scores&quot; to evaluate your registered agents against the governance criteria.</p>
        </div>
      ) : (
        <div className="gs-main" style={{ marginTop: 24 }}>
          {/* Agent Score List */}
          <div className="gs-scores-list">
            <div className="fr-sidebar-header">
              <span className="an-chart-title" style={{ margin: 0 }}>Agent Trust Rankings</span>
            </div>
            <div className="gs-agent-list">
              {scores.map(s => {
                const ag = agents.find(a => a.agent_id === s.agent_id);
                const gColor = GRADE_COLORS[s.grade] || "#3b82f6";
                return (
                  <button
                    key={s.agent_id}
                    className={`gs-agent-card ${selectedAgentId === s.agent_id ? "active" : ""}`}
                    onClick={() => setSelectedAgentId(s.agent_id)}
                  >
                    <div className="gs-agent-info">
                      <span className="gs-agent-name">{ag?.agent_name || s.agent_id}</span>
                      <span className="gs-agent-dept">{ag?.department || "Autonomous Agent"}</span>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: gColor }}>{s.overall_score}</span>
                      <span className="gs-score-pill" style={{ background: `${gColor}20`, color: gColor }}>
                        {s.grade}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Agent Score Breakdown */}
          {selected && (
            <div className="gs-detail">
              <div className="dna-header-card">
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                    {selectedAgent?.agent_name || selected.agent_id}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    Department: {selectedAgent?.department || "Unassigned"} • Computed: {new Date(selected.computed_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  {selected.certified ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--accent-green)", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Award style={{ width: 14, height: 14 }} />
                      Velyrion Certified
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 6 }}>
                      Uncertified (&lt; 80)
                    </span>
                  )}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: GRADE_COLORS[selected.grade] || "#3b82f6" }}>
                      {selected.overall_score}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                      Grade {selected.grade}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimensions Breakdown */}
              <div className="an-chart-card">
                <div className="an-chart-title">Dimensional Trust Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {(selected.dimensions || []).map((dim, idx) => (
                    <div key={idx} style={{ padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {getDimensionIcon(dim.name)}
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{dim.name}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({Math.round(dim.weight * 100)}% weight)</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: dim.color || "var(--text-primary)" }}>
                          {dim.score}/100
                        </span>
                      </div>
                      <div className="an-budget-bar" style={{ height: 6 }}>
                        <div className="an-budget-fill" style={{ width: `${dim.score}%`, background: dim.color || "var(--accent-cyan)" }} />
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{dim.description}</p>
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
