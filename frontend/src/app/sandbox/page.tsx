"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { usePermissions } from "@/lib/auth";
import {
  Play,
  Cpu,
  History,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Activity,
  Coins,
  FileCheck,
  Lock,
  RefreshCw
} from "lucide-react";

interface SimScenario {
  id: string;
  name: string;
  description: string;
  params: { name: string; value: string }[];
}

interface SimResult {
  run_id: string;
  scenario_id: string;
  score: number;
  grade: string;
  violations: { type: string; severity: string }[];
  actions: number;
  cost: number;
  risk: string;
  recommendations: string[];
  ran_at: string;
}

interface SimHistoryItem {
  run_id: string;
  scenario_id: string;
  agent_id: string | null;
  score: number;
  grade: string;
  risk: string;
  ran_at: string;
}

const SCENARIOS: SimScenario[] = [
  {
    id: "normal",
    name: "Normal Operations",
    description: "Standard workload — 500 actions, normal tools, baseline risk",
    params: [{ name: "Actions", value: "500" }, { name: "Risk Level", value: "LOW" }, { name: "Budget", value: "50,000 tokens" }],
  },
  {
    id: "high_volume",
    name: "High Volume Burst",
    description: "10x normal traffic — stress test budget thresholds and rate limits",
    params: [{ name: "Actions", value: "5,000" }, { name: "Risk Level", value: "MEDIUM" }, { name: "Budget", value: "50,000 tokens" }],
  },
  {
    id: "adversarial",
    name: "Adversarial Attack",
    description: "Simulated prompt injection, unauthorized tools, and restricted data access",
    params: [{ name: "Actions", value: "200" }, { name: "Risk Level", value: "CRITICAL" }, { name: "Budget", value: "50,000 tokens" }],
  },
  {
    id: "budget_drain",
    name: "Budget Exhaustion",
    description: "Rapid token depletion testing auto-containment and kill switches",
    params: [{ name: "Actions", value: "1,000" }, { name: "Token Cost/Action", value: "500" }, { name: "Budget", value: "50,000 tokens" }],
  },
  {
    id: "compliance",
    name: "Compliance Audit",
    description: "Simulate regulatory compliance audit against EU AI Act & SOC2",
    params: [{ name: "Regulations", value: "EU AI Act, SOC2" }, { name: "Depth", value: "Full" }, { name: "Budget", value: "50,000 tokens" }],
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

export default function SandboxPage() {
  const { isAdmin, isOperator, canManageAgents } = usePermissions();
  const canRun = canManageAgents || isAdmin || isOperator;

  const [selectedScenario, setSelectedScenario] = useState<string>("normal");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [history, setHistory] = useState<SimHistoryItem[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadAgentsAndHistory = useCallback(async () => {
    try {
      const [fetchedAgents, fetchedHistory] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getSimulationHistory(10).catch(() => []),
      ]);
      setAgents(fetchedAgents);
      setHistory(fetchedHistory);
      if (fetchedAgents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(fetchedAgents[0].agent_id);
      }
    } catch {
      // ignore
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadAgentsAndHistory();
  }, [loadAgentsAndHistory]);

  const scenario = SCENARIOS.find(s => s.id === selectedScenario) || SCENARIOS[0];

  const handleRunSimulation = async () => {
    if (!canRun) return;
    setRunning(true);
    setErrorMsg("");
    setResult(null);

    try {
      const simRes = await api.runSimulation(selectedScenario, selectedAgentId || undefined);
      setResult(simRes);
      // Reload history
      const freshHistory = await api.getSimulationHistory(10).catch(() => []);
      setHistory(freshHistory);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Simulation execution failed");
    } finally {
      setRunning(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 85 ? "#10b981" : s >= 70 ? "#3b82f6" : s >= 50 ? "#f59e0b" : "#ef4444";

  const getScenarioIcon = (id: string) => {
    switch (id) {
      case "normal":
        return <Activity style={{ width: 18, height: 18, color: "#10b981" }} />;
      case "high_volume":
        return <Flame style={{ width: 18, height: 18, color: "#f59e0b" }} />;
      case "adversarial":
        return <ShieldAlert style={{ width: 18, height: 18, color: "#ef4444" }} />;
      case "budget_drain":
        return <Coins style={{ width: 18, height: 18, color: "#f97316" }} />;
      case "compliance":
        return <FileCheck style={{ width: 18, height: 18, color: "#3b82f6" }} />;
      default:
        return <Cpu style={{ width: 18, height: 18 }} />;
    }
  };

  return (
    <div className="sb-page">
      <div className="lb-header">
        <div>
          <h1 className="lb-title">Agent Simulation Sandbox</h1>
          <p className="lb-subtitle">
            Execute sandboxed scenario evaluations backed by the Velyrion simulation engine
          </p>
        </div>
      </div>

      {!canRun && (
        <div style={{ padding: "8px 14px", background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <Lock style={{ width: 14, height: 14 }} />
          <span>Viewer account: Simulation execution is restricted. Upgrade role to Operator or Admin to run scenario stress tests.</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, marginBottom: 16, color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle style={{ width: 16, height: 16 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="sb-main">
        {/* Scenarios List */}
        <div className="sb-scenarios">
          <div className="fr-sidebar-header">
            <span className="an-chart-title" style={{ margin: 0 }}>Scenarios</span>
          </div>
          <div className="sb-scenario-list">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                className={`sb-scenario-card ${selectedScenario === s.id ? "active" : ""}`}
                onClick={() => { setSelectedScenario(s.id); setResult(null); }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "var(--bg-secondary)", flexShrink: 0 }}>
                  {getScenarioIcon(s.id)}
                </div>
                <div>
                  <div className="sb-scenario-name">{s.name}</div>
                  <div className="sb-scenario-desc">{s.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Past Simulation History */}
          {history.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="fr-sidebar-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <History style={{ width: 14, height: 14 }} />
                <span className="an-chart-title" style={{ margin: 0 }}>Recent Runs</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {history.map(h => (
                  <div
                    key={h.run_id}
                    style={{
                      padding: "8px 12px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 6,
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {SCENARIOS.find(s => s.id === h.scenario_id)?.name || h.scenario_id}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(h.ran_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 700, color: scoreColor(h.score) }}>{h.score}/100</span>
                      <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)" }}>
                        {h.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Simulation Panel */}
        <div className="sb-panel">
          <div className="sb-config">
            <h3 className="an-chart-title">Scenario Parameters — {scenario.name}</h3>
            
            {agents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  Target Agent Under Test
                </label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    padding: "8px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    color: "var(--text-primary)",
                    fontSize: 13
                  }}
                >
                  {agents.map(a => (
                    <option key={a.agent_id} value={a.agent_id}>
                      {a.agent_name} ({a.department})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sb-params">
              {scenario.params.map(p => (
                <div key={p.name} className="sb-param">
                  <span className="fr-state-label">{p.name}</span>
                  <span className="fr-state-value">{p.value}</span>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunSimulation}
              disabled={running || !canRun}
              style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              {running ? (
                <>
                  <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                  <span>Simulating on Engine...</span>
                </>
              ) : (
                <>
                  <Play style={{ width: 14, height: 14 }} />
                  <span>Execute Simulation</span>
                </>
              )}
            </button>
          </div>

          {result && (
            <div className="sb-results">
              <div className="sb-result-header">
                <div className="dna-fingerprint-display" style={{ borderColor: `${scoreColor(result.score)}40` }}>
                  <div className="dna-fp-label">SANDBOX SCORE</div>
                  <div className="dna-fp-code" style={{ color: scoreColor(result.score), fontSize: 32 }}>
                    {result.score}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(result.score) }}>
                    Grade {result.grade}
                  </div>
                </div>
                <div className="sb-result-stats">
                  <div className="fr-state-item">
                    <span className="fr-state-label">Actions</span>
                    <span className="fr-state-value">{result.actions.toLocaleString()}</span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Cost</span>
                    <span className="fr-state-value">${result.cost.toFixed(2)}</span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Risk Level</span>
                    <span className="fr-state-value" style={{ color: SEVERITY_COLORS[result.risk] || "var(--text-primary)" }}>
                      {result.risk}
                    </span>
                  </div>
                  <div className="fr-state-item">
                    <span className="fr-state-label">Violations</span>
                    <span className="fr-state-value" style={{ color: result.violations.length > 0 ? "#ef4444" : "#10b981" }}>
                      {result.violations.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Violations Triggered */}
              {result.violations.length > 0 && (
                <div className="sb-violations">
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>
                    Violations Triggered ({result.violations.length})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.violations.map((v, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "var(--bg-secondary)",
                          borderRadius: 6,
                          borderLeft: `3px solid ${SEVERITY_COLORS[v.severity] || "#ef4444"}`
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{v.type}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.05)",
                            color: SEVERITY_COLORS[v.severity]
                          }}
                        >
                          {v.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="sb-recommendations" style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>
                    Governance Engine Recommendations
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          padding: "6px 0"
                        }}
                      >
                        <CheckCircle2 style={{ width: 14, height: 14, color: "var(--accent-cyan)", flexShrink: 0, marginTop: 2 }} />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
