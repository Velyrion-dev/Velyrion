"use client";
import { useEffect, useState } from "react";
import { api, Agent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Award,
  ArrowRightLeft,
  CheckCircle2,
  Cpu,
  RefreshCw
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

export default function ComparePage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentA, setAgentA] = useState<string>("");
  const [agentB, setAgentB] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.getAgents().then(a => {
      setAgents(a);
      if (a.length >= 2) {
        setAgentA(a[0].agent_id);
        setAgentB(a[1].agent_id);
      } else if (a.length === 1) {
        setAgentA(a[0].agent_id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="cmp-page">
        <div className="lb-header">
          <h1 className="lb-title">Agent Comparison</h1>
          <p className="lb-subtitle">Querying registered agent metrics...</p>
        </div>
      </div>
    );
  }

  const a = agents.find(x => x.agent_id === agentA);
  const b = agents.find(x => x.agent_id === agentB);

  const metrics = [
    { label: "Status", valA: a?.status || "—", valB: b?.status || "—", type: "status" },
    { label: "Department", valA: a?.department || "—", valB: b?.department || "—", type: "text" },
    { label: "Total Actions", valA: a?.total_actions || 0, valB: b?.total_actions || 0, type: "number", higher: "better" },
    { label: "Total Violations", valA: a?.total_violations || 0, valB: b?.total_violations || 0, type: "number", higher: "worse" },
    { label: "Total Cost (USD)", valA: a?.total_cost_usd || 0, valB: b?.total_cost_usd || 0, type: "money", higher: "worse" },
    { label: "Tokens Used", valA: a?.tokens_used || 0, valB: b?.tokens_used || 0, type: "number", higher: "neutral" },
    { label: "Token Budget", valA: a?.max_token_budget || 0, valB: b?.max_token_budget || 0, type: "number", higher: "neutral" },
    {
      label: "Budget Usage",
      valA: a && a.max_token_budget > 0 ? Math.round((a.tokens_used / a.max_token_budget) * 100) : 0,
      valB: b && b.max_token_budget > 0 ? Math.round((b.tokens_used / b.max_token_budget) * 100) : 0,
      type: "percent",
      higher: "worse"
    },
    {
      label: "Efficiency",
      valA: a && a.total_violations > 0 ? Math.round((a.total_actions || 0) / a.total_violations) : (a?.total_actions || 0) * 10,
      valB: b && b.total_violations > 0 ? Math.round((b.total_actions || 0) / b.total_violations) : (b?.total_actions || 0) * 10,
      type: "number",
      higher: "better"
    },
    {
      label: "Cost per Action",
      valA: a && a.total_actions > 0 ? a.total_cost_usd / a.total_actions : 0,
      valB: b && b.total_actions > 0 ? b.total_cost_usd / b.total_actions : 0,
      type: "cost_per",
      higher: "worse"
    },
    { label: "Allowed Tools", valA: a?.allowed_tools?.length || 0, valB: b?.allowed_tools?.length || 0, type: "number", higher: "neutral" },
  ];

  const getWinner = (valA: number, valB: number, higher: string) => {
    if (valA === valB) return "tie";
    if (higher === "better") return valA > valB ? "a" : "b";
    if (higher === "worse") return valA < valB ? "a" : "b";
    return "tie";
  };

  const scoreA = metrics
    .filter(m => m.type === "number" || m.type === "money" || m.type === "percent" || m.type === "cost_per")
    .filter(m => getWinner(Number(m.valA), Number(m.valB), m.higher || "neutral") === "a").length;

  const scoreB = metrics
    .filter(m => m.type === "number" || m.type === "money" || m.type === "percent" || m.type === "cost_per")
    .filter(m => getWinner(Number(m.valA), Number(m.valB), m.higher || "neutral") === "b").length;

  return (
    <div className="cmp-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Agent Benchmark Comparison</h1>
          <p className="lb-subtitle">Side-by-side behavioral, efficiency, and compliance performance audit</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Agents">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Selectors */}
      <div className="cmp-selectors">
        <div className="cmp-select-card blue">
          <label className="cmp-select-label">Agent Candidate A</label>
          <select className="cmp-select" value={agentA} onChange={e => setAgentA(e.target.value)}>
            {agents.map(ag => (
              <option key={ag.agent_id} value={ag.agent_id}>
                {ag.agent_name} ({ag.department})
              </option>
            ))}
          </select>
        </div>
        <div className="cmp-vs">
          <ArrowRightLeft style={{ width: 16, height: 16 }} />
        </div>
        <div className="cmp-select-card red">
          <label className="cmp-select-label">Agent Candidate B</label>
          <select className="cmp-select" value={agentB} onChange={e => setAgentB(e.target.value)}>
            {agents.map(ag => (
              <option key={ag.agent_id} value={ag.agent_id}>
                {ag.agent_name} ({ag.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score Banner */}
      {a && b && (
        <div className="cmp-score-banner">
          <div className="cmp-score" style={{ color: scoreA >= scoreB ? "var(--accent-green)" : "var(--text-muted)" }}>
            {scoreA}
          </div>
          <div className="cmp-score-label" style={{ fontWeight: 700 }}>
            {scoreA > scoreB ? `${a.agent_name} outperforms` : scoreB > scoreA ? `${b.agent_name} outperforms` : "Performance Parity"}
          </div>
          <div className="cmp-score" style={{ color: scoreB >= scoreA ? "var(--accent-green)" : "var(--text-muted)" }}>
            {scoreB}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {a && b && (
        <div className="cmp-table-section">
          <table className="an-table cmp-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>{a.agent_name}</th>
                <th style={{ textAlign: "center", width: 180 }}>Evaluation Dimension</th>
                <th style={{ textAlign: "right", width: 220 }}>{b.agent_name}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const winner =
                  m.type === "number" || m.type === "money" || m.type === "percent" || m.type === "cost_per"
                    ? getWinner(Number(m.valA), Number(m.valB), m.higher || "neutral")
                    : "tie";
                const formatVal = (val: string | number) => {
                  if (m.type === "status") return val;
                  if (m.type === "text") return val;
                  if (m.type === "money") return `$${Number(val).toFixed(2)}`;
                  if (m.type === "percent") return `${val}%`;
                  if (m.type === "cost_per") return `$${Number(val).toFixed(4)}`;
                  return fmtCompact(Number(val));
                };
                return (
                  <tr key={i}>
                    <td>
                      <span className={`cmp-val ${winner === "a" ? "winner" : winner === "b" ? "loser" : ""}`}>
                        {m.type === "status" ? (
                          <span className={`mc-agent-status ${m.valA}`}>{m.valA}</span>
                        ) : (
                          formatVal(m.valA)
                        )}
                      </span>
                      {winner === "a" && (
                        <Award style={{ width: 13, height: 13, color: "var(--accent-green)", marginLeft: 6, display: "inline" }} />
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="cmp-metric-label">{m.label}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {winner === "b" && (
                        <Award style={{ width: 13, height: 13, color: "var(--accent-green)", marginRight: 6, display: "inline" }} />
                      )}
                      <span className={`cmp-val ${winner === "b" ? "winner" : winner === "a" ? "loser" : ""}`}>
                        {m.type === "status" ? (
                          <span className={`mc-agent-status ${m.valB}`}>{m.valB}</span>
                        ) : (
                          formatVal(m.valB)
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Visual Bars */}
      {a && b && (
        <div className="an-chart-card">
          <div className="an-chart-title">Direct Metrics Visualization</div>
          {[
            { label: "Actions", vA: a.total_actions, vB: b.total_actions },
            { label: "Cost ($)", vA: a.total_cost_usd, vB: b.total_cost_usd },
            { label: "Violations", vA: a.total_violations, vB: b.total_violations },
            { label: "Tokens", vA: a.tokens_used, vB: b.tokens_used },
          ].map(item => {
            const max = Math.max(item.vA, item.vB, 1);
            return (
              <div key={item.label} className="cmp-bar-row">
                <div className="cmp-bar-val left">{fmtCompact(item.vA)}</div>
                <div className="cmp-bar-track">
                  <div className="cmp-bar-fill left" style={{ width: `${(item.vA / max) * 50}%` }} />
                  <div className="cmp-bar-center-label">{item.label}</div>
                  <div className="cmp-bar-fill right" style={{ width: `${(item.vB / max) * 50}%` }} />
                </div>
                <div className="cmp-bar-val right">{fmtCompact(item.vB)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
