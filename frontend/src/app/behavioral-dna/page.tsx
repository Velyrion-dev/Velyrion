"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { usePermissions } from "@/lib/auth";
import {
  Fingerprint,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Shield,
  Cpu
} from "lucide-react";

interface Trait {
  name: string;
  value: number;
  baseline: number;
  deviation: number;
  status: "normal" | "warning" | "anomaly";
}

interface BehavioralProfileRecord {
  profile_id: string;
  agent_id: string;
  fingerprint: string;
  drift_score: number;
  traits: Trait[];
  computed_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  normal: "#10b981",
  warning: "#f59e0b",
  anomaly: "#ef4444"
};

export default function BehavioralDNAPage() {
  const { isAdmin, isOperator, canManageAgents } = usePermissions();
  const canRecompute = canManageAgents || isAdmin || isOperator;

  const [profiles, setProfiles] = useState<BehavioralProfileRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedProfiles, fetchedAgents] = await Promise.all([
        api.getBehavioralProfiles().catch(() => []),
        api.getAgents().catch(() => []),
      ]);

      setAgents(fetchedAgents);

      if (fetchedProfiles.length === 0 && fetchedAgents.length > 0) {
        try {
          await api.recomputeBehavioralDNA();
          const fresh = await api.getBehavioralProfiles();
          setProfiles(fresh);
          if (fresh.length > 0) setSelectedAgentId(fresh[0].agent_id);
          setLoading(false);
          return;
        } catch {
          // ignore
        }
      }

      setProfiles(fetchedProfiles);
      if (fetchedProfiles.length > 0 && !selectedAgentId) {
        setSelectedAgentId(fetchedProfiles[0].agent_id);
      }
    } catch (e) {
      console.error("Failed to load behavioral DNA profiles:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecompute = async () => {
    if (!canRecompute || recomputing) return;
    setRecomputing(true);
    try {
      const res = await api.recomputeBehavioralDNA();
      setFeedback(`Recomputed ${res.recomputed} agent behavioral profiles`);
      setTimeout(() => setFeedback(""), 4000);
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Failed to recompute profiles");
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="dna-page">
        <div className="lb-header">
          <h1 className="lb-title">Behavioral DNA Fingerprinting</h1>
          <p className="lb-subtitle">Loading persistent agent behavioral profiles from database...</p>
        </div>
      </div>
    );
  }

  const selected = profiles.find(p => p.agent_id === selectedAgentId);
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
  const anomalyCount = profiles.filter(p => p.drift_score > 20).length;
  const avgDrift = profiles.length > 0
    ? Math.round(profiles.reduce((s, p) => s + p.drift_score, 0) / profiles.length)
    : 0;

  return (
    <div className="dna-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Behavioral DNA Fingerprinting</h1>
          <p className="lb-subtitle">Unique cryptographic and behavioral signatures — baseline drift detection &amp; anomaly tracking</p>
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
              <span>{recomputing ? "Recomputing..." : "Recompute Baselines"}</span>
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Lock style={{ width: 12, height: 12 }} />
              Viewer Mode
            </span>
          )}
        </div>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{profiles.length}</div>
            <div className="an-kpi-label">Active Profiles</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <CheckCircle2 style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{Math.max(0, profiles.length - anomalyCount)}</div>
            <div className="an-kpi-label">Within Baseline</div>
          </div>
        </div>
        <div className="an-kpi red">
          <div className="an-kpi-icon">
            <AlertTriangle style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{anomalyCount}</div>
            <div className="an-kpi-label">Drift Alerts</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <Activity style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{avgDrift}%</div>
            <div className="an-kpi-label">Avg Fleet Drift</div>
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", marginTop: 20 }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--accent-green)", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>No Behavioral Profiles Available</h3>
          <p style={{ margin: 0, fontSize: 13 }}>Click &quot;Recompute Baselines&quot; to synthesize DNA fingerprints from agent telemetry.</p>
        </div>
      ) : (
        <div className="gs-main" style={{ marginTop: 24 }}>
          {/* Agent List */}
          <div className="gs-scores-list">
            <div className="fr-sidebar-header">
              <span className="an-chart-title" style={{ margin: 0 }}>Fingerprinted Agents</span>
            </div>
            <div className="gs-agent-list">
              {profiles.map(p => {
                const ag = agents.find(a => a.agent_id === p.agent_id);
                const driftColor = p.drift_score > 20 ? "#ef4444" : p.drift_score > 10 ? "#f59e0b" : "#10b981";
                return (
                  <button
                    key={p.agent_id}
                    className={`gs-agent-card ${selectedAgentId === p.agent_id ? "active" : ""}`}
                    onClick={() => setSelectedAgentId(p.agent_id)}
                  >
                    <Fingerprint style={{ width: 18, height: 18, color: "var(--accent-cyan)", flexShrink: 0 }} />
                    <div className="gs-agent-info">
                      <span className="gs-agent-name">{ag?.agent_name || p.agent_id}</span>
                      <span className="gs-agent-dept" style={{ fontFamily: "monospace", letterSpacing: 0.5 }}>
                        {p.fingerprint}
                      </span>
                    </div>
                    <span className="gs-score-pill" style={{ background: `${driftColor}20`, color: driftColor }}>
                      {p.drift_score}% drift
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Detail */}
          {selected && (
            <div className="gs-detail">
              <div className="dna-header-card">
                <div className="dna-fingerprint-display">
                  <div className="dna-fp-label">BEHAVIORAL FINGERPRINT</div>
                  <div className="dna-fp-code">{selected.fingerprint}</div>
                </div>
                <div className="dna-header-info">
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                    {selectedAgent?.agent_name || selected.agent_id}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    Department: {selectedAgent?.department || "Unassigned"} • Fleet Drift:{" "}
                    <span style={{ color: selected.drift_score > 20 ? "#ef4444" : selected.drift_score > 10 ? "#f59e0b" : "#10b981", fontWeight: 800 }}>
                      {selected.drift_score}%
                    </span>
                  </p>
                </div>
              </div>

              <div className="an-chart-card">
                <div className="an-chart-title">Observed Behavior vs Historical Baselines</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {(selected.traits || []).map(t => (
                    <div key={t.name} className="dna-trait-row">
                      <div className="dna-trait-left">
                        <span className="dna-trait-dot" style={{ background: STATUS_COLORS[t.status] || "#10b981" }} />
                        <span className="dna-trait-name">{t.name}</span>
                      </div>
                      <div className="dna-trait-right">
                        <span className="dna-trait-val">{t.value}</span>
                        <span className="dna-trait-vs">vs</span>
                        <span className="dna-trait-base">{t.baseline}</span>
                        <span className="dna-trait-dev" style={{ color: STATUS_COLORS[t.status] || "#10b981" }}>
                          {t.deviation > 0 ? `↕ ${t.deviation}%` : "—"}
                        </span>
                        <span
                          className="dna-trait-status"
                          style={{
                            background: `${STATUS_COLORS[t.status] || "#10b981"}20`,
                            color: STATUS_COLORS[t.status] || "#10b981",
                            textTransform: "capitalize"
                          }}
                        >
                          {t.status}
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
