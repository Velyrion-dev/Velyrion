"use client";
import { useState } from "react";

interface SimScenario {
  id: string;
  name: string;
  icon: string;
  description: string;
  params: { name: string; value: string }[];
}

interface SimResult {
  score: number;
  grade: string;
  violations: { type: string; severity: string }[];
  actions: number;
  cost: number;
  risk: string;
  recommendations: string[];
}

const SCENARIOS: SimScenario[] = [
  { id: "normal", name: "Normal Operations", icon: "🟢", description: "Standard workload — 500 actions, normal tools, low risk tasks", params: [{ name: "Actions", value: "500" }, { name: "Risk Level", value: "LOW" }, { name: "Budget", value: "50,000 tokens" }] },
  { id: "high_volume", name: "High Volume Burst", icon: "📈", description: "10x normal traffic — stress test budget and rate limits", params: [{ name: "Actions", value: "5,000" }, { name: "Risk Level", value: "MEDIUM" }, { name: "Budget", value: "50,000 tokens" }] },
  { id: "adversarial", name: "Adversarial Attack", icon: "🔴", description: "Agent attempts unauthorized tools and restricted data access", params: [{ name: "Actions", value: "200" }, { name: "Risk Level", value: "CRITICAL" }, { name: "Budget", value: "50,000 tokens" }] },
  { id: "budget_drain", name: "Budget Exhaustion", icon: "💸", description: "Agent consumes tokens rapidly — tests budget enforcement", params: [{ name: "Actions", value: "1,000" }, { name: "Token Cost/Action", value: "500" }, { name: "Budget", value: "50,000 tokens" }] },
  { id: "compliance", name: "Compliance Audit", icon: "📋", description: "Simulate regulatory audit — checks all governance requirements", params: [{ name: "Regulations", value: "EU AI Act, SOC2" }, { name: "Depth", value: "Full" }, { name: "Budget", value: "50,000 tokens" }] },
];

function runSimulation(scenarioId: string): SimResult {
  switch (scenarioId) {
    case "normal": return { score: 92, grade: "A", violations: [], actions: 500, cost: 2.50, risk: "LOW", recommendations: ["Agent performing optimally", "Consider increasing budget for growth"] };
    case "high_volume": return { score: 71, grade: "B-", violations: [{ type: "RATE_LIMIT_EXCEEDED", severity: "MEDIUM" }, { type: "TOKEN_BUDGET_WARNING", severity: "LOW" }], actions: 5000, cost: 25.00, risk: "MEDIUM", recommendations: ["Implement request queuing for burst traffic", "Increase token budget to 100K", "Enable auto-scaling policies"] };
    case "adversarial": return { score: 45, grade: "D", violations: [{ type: "UNAUTHORIZED_TOOL", severity: "CRITICAL" }, { type: "DATA_SOURCE_VIOLATION", severity: "HIGH" }, { type: "CONFIDENCE_TOO_LOW", severity: "MEDIUM" }], actions: 200, cost: 1.20, risk: "CRITICAL", recommendations: ["Kill switch activated — agent locked", "Review and restrict allowed_tools list", "Enable mandatory human-in-the-loop", "Add IP-based access controls"] };
    case "budget_drain": return { score: 58, grade: "C", violations: [{ type: "TOKEN_BUDGET_EXCEEDED", severity: "HIGH" }, { type: "COST_THRESHOLD_EXCEEDED", severity: "MEDIUM" }], actions: 100, cost: 50.00, risk: "HIGH", recommendations: ["Agent killed at 100/1000 actions (budget exhausted)", "Set per-action token limits", "Enable cost-aware model routing", "Implement progressive budget warnings at 50%, 75%, 90%"] };
    case "compliance": return { score: 85, grade: "A-", violations: [{ type: "MISSING_DOCUMENTATION", severity: "LOW" }], actions: 0, cost: 0, risk: "LOW", recommendations: ["EU AI Act: 90% compliant — add technical documentation", "SOC2: 85% compliant — configure data retention", "Overall: Ready for audit with minor gaps"] };
    default: return { score: 0, grade: "F", violations: [], actions: 0, cost: 0, risk: "UNKNOWN", recommendations: [] };
  }
}

const SEVERITY_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#10b981" };

export default function SandboxPage() {
  const [selectedScenario, setSelectedScenario] = useState<string>("normal");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [progress, setProgress] = useState(0);

  const scenario = SCENARIOS.find(s => s.id === selectedScenario)!;

  const runSim = () => {
    setRunning(true); setResult(null); setProgress(0);
    const interval = setInterval(() => { setProgress(p => { if (p >= 100) { clearInterval(interval); return 100; } return p + Math.random() * 15; }); }, 200);
    setTimeout(() => { clearInterval(interval); setProgress(100); setResult(runSimulation(selectedScenario)); setRunning(false); }, 2500);
  };

  const scoreColor = (s: number) => s >= 85 ? "#10b981" : s >= 70 ? "#3b82f6" : s >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="sb-page">
      <div className="lb-header"><h1 className="lb-title">🧪 Agent Simulation Sandbox</h1><p className="lb-subtitle">Test agents in sandboxed scenarios before production deployment</p></div>

      <div className="sb-main">
        {/* Scenarios */}
        <div className="sb-scenarios">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Scenarios</span></div>
          <div className="sb-scenario-list">
            {SCENARIOS.map(s => (
              <button key={s.id} className={`sb-scenario-card ${selectedScenario === s.id ? "active" : ""}`} onClick={() => { setSelectedScenario(s.id); setResult(null); }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div><div className="sb-scenario-name">{s.name}</div><div className="sb-scenario-desc">{s.description}</div></div>
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Panel */}
        <div className="sb-panel">
          <div className="sb-config">
            <h3 className="an-chart-title">Configuration — {scenario.name}</h3>
            <div className="sb-params">{scenario.params.map(p => <div key={p.name} className="sb-param"><span className="fr-state-label">{p.name}</span><span className="fr-state-value">{p.value}</span></div>)}</div>
            <button className="btn btn-primary" onClick={runSim} disabled={running} style={{ marginTop: 16 }}>{running ? "⏳ Simulating..." : "▶ Run Simulation"}</button>
            {running && <div className="an-budget-bar" style={{ marginTop: 12 }}><div className="an-budget-fill" style={{ width: `${Math.min(progress, 100)}%`, transition: "width 0.2s" }} /></div>}
          </div>

          {result && (
            <div className="sb-results">
              <div className="sb-result-header">
                <div className="dna-fingerprint-display" style={{ borderColor: `${scoreColor(result.score)}40` }}>
                  <div className="dna-fp-label">SIMULATION SCORE</div>
                  <div className="dna-fp-code" style={{ color: scoreColor(result.score), fontSize: 32 }}>{result.score}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(result.score) }}>{result.grade}</div>
                </div>
                <div className="sb-result-stats">
                  <div className="fr-state-item"><span className="fr-state-label">Actions</span><span className="fr-state-value">{result.actions.toLocaleString()}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">Cost</span><span className="fr-state-value">${result.cost.toFixed(2)}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">Risk</span><span className="fr-state-value" style={{ color: SEVERITY_COLORS[result.risk] || "var(--text-primary)" }}>{result.risk}</span></div>
                  <div className="fr-state-item"><span className="fr-state-label">Violations</span><span className="fr-state-value" style={{ color: result.violations.length > 0 ? "#ef4444" : "#10b981" }}>{result.violations.length}</span></div>
                </div>
              </div>

              {result.violations.length > 0 && (
                <div className="sb-violations"><div className="an-chart-title">Violations Triggered</div>{result.violations.map((v, i) => <div key={i} className="sb-vio-item"><span className="ti-pattern-severity" style={{ background: `${SEVERITY_COLORS[v.severity]}20`, color: SEVERITY_COLORS[v.severity] }}>{v.severity}</span><span style={{ fontSize: 13, color: "var(--text-primary)" }}>{v.type.replace(/_/g, " ")}</span></div>)}</div>
              )}

              <div className="sb-recs"><div className="an-chart-title">💡 Recommendations</div>{result.recommendations.map((r, i) => <div key={i} className="co-rec-card" style={{ borderLeftColor: "var(--accent-blue)" }}><p className="co-rec-msg">{r}</p></div>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
