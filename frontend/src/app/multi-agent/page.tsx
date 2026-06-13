"use client";
import { useEffect, useState } from "react";
import { api, Agent } from "@/lib/api";

interface AgentNode {
  agent: Agent;
  x: number;
  y: number;
}

interface MessageFlow {
  from: string;
  to: string;
  action: string;
  status: "governed" | "blocked" | "pending";
  timestamp: string;
}

const FLOW_STATUS = {
  governed: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Governed", icon: "✅" },
  blocked: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Blocked", icon: "🚫" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending", icon: "⏳" },
};

export default function MultiAgentProtocolPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<MessageFlow | null>(null);

  useEffect(() => {
    api.getAgents().then(a => { setAgents(a); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ma-page"><div className="lb-header"><h1 className="lb-title">Multi-Agent Protocol</h1><p className="lb-subtitle">Loading topology...</p></div></div>;

  // Generate inter-agent flows
  const flows: MessageFlow[] = agents.length >= 2 ? [
    { from: agents[0]?.agent_name, to: agents[1]?.agent_name, action: "Data request", status: "governed", timestamp: new Date(Date.now() - 60000).toISOString() },
    { from: agents[1]?.agent_name, to: agents[2]?.agent_name || agents[0]?.agent_name, action: "Task delegation", status: "governed", timestamp: new Date(Date.now() - 120000).toISOString() },
    { from: agents[2]?.agent_name || agents[0]?.agent_name, to: agents[3]?.agent_name || agents[1]?.agent_name, action: "Result aggregation", status: "governed", timestamp: new Date(Date.now() - 180000).toISOString() },
    { from: agents[0]?.agent_name, to: agents[3]?.agent_name || agents[1]?.agent_name, action: "Unauthorized tool share", status: "blocked", timestamp: new Date(Date.now() - 300000).toISOString() },
    { from: agents[1]?.agent_name, to: agents[0]?.agent_name, action: "Budget transfer request", status: "pending", timestamp: new Date(Date.now() - 600000).toISOString() },
    { from: agents[3]?.agent_name || agents[0]?.agent_name, to: agents[0]?.agent_name, action: "Status report", status: "governed", timestamp: new Date(Date.now() - 900000).toISOString() },
  ] : [];

  const governedCount = flows.filter(f => f.status === "governed").length;
  const blockedCount = flows.filter(f => f.status === "blocked").length;
  const pendingCount = flows.filter(f => f.status === "pending").length;

  const policies = [
    { name: "Tool Sharing", rule: "Agents may NOT share tools across permission boundaries", status: "enforced" },
    { name: "Data Relay", rule: "Data passed between agents must match both agents' access levels", status: "enforced" },
    { name: "Budget Transfer", rule: "Token budget transfers require human approval", status: "enforced" },
    { name: "Task Delegation", rule: "Agents may delegate within same department only", status: "enforced" },
    { name: "Result Aggregation", rule: "Multi-agent results must be validated before output", status: "monitoring" },
  ];

  return (
    <div className="ma-page">
      <div className="lb-header">
        <h1 className="lb-title">🔗 Multi-Agent Governance Protocol</h1>
        <p className="lb-subtitle">Runtime governance layer for inter-agent communication</p>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue"><div className="an-kpi-icon">🤖</div><div className="an-kpi-data"><div className="an-kpi-value">{agents.length}</div><div className="an-kpi-label">Agents in Mesh</div></div></div>
        <div className="an-kpi green"><div className="an-kpi-icon">✅</div><div className="an-kpi-data"><div className="an-kpi-value">{governedCount}</div><div className="an-kpi-label">Governed Flows</div></div></div>
        <div className="an-kpi red"><div className="an-kpi-icon">🚫</div><div className="an-kpi-data"><div className="an-kpi-value">{blockedCount}</div><div className="an-kpi-label">Blocked</div></div></div>
        <div className="an-kpi yellow"><div className="an-kpi-icon">⏳</div><div className="an-kpi-data"><div className="an-kpi-value">{pendingCount}</div><div className="an-kpi-label">Pending Review</div></div></div>
      </div>

      <div className="an-bottom-grid">
        {/* Message Flows */}
        <div className="an-chart-card">
          <div className="an-chart-title">📡 Inter-Agent Message Flows</div>
          <div className="ma-flow-list">
            {flows.map((f, i) => {
              const sc = FLOW_STATUS[f.status];
              return (
                <div key={i} className={`ma-flow-card ${selectedFlow === f ? "active" : ""}`} onClick={() => setSelectedFlow(f)}>
                  <span style={{ fontSize: 14 }}>{sc.icon}</span>
                  <div className="ma-flow-info">
                    <div className="ma-flow-route">
                      <span className="ma-flow-agent">{f.from}</span>
                      <span className="tm-ag-arrow">→</span>
                      <span className="ma-flow-agent">{f.to}</span>
                    </div>
                    <div className="ma-flow-action">{f.action}</div>
                  </div>
                  <span className="ra-req-badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              );
            })}
          </div>

          {selectedFlow && (
            <div className="ma-flow-detail" style={{ marginTop: 16 }}>
              <div className="an-chart-title">Flow Detail</div>
              <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <div className="fr-state-item"><span className="fr-state-label">From</span><span className="fr-state-value">{selectedFlow.from}</span></div>
                <div className="fr-state-item"><span className="fr-state-label">To</span><span className="fr-state-value">{selectedFlow.to}</span></div>
                <div className="fr-state-item"><span className="fr-state-label">Action</span><span className="fr-state-value">{selectedFlow.action}</span></div>
                <div className="fr-state-item"><span className="fr-state-label">Status</span><span className="fr-state-value" style={{ color: FLOW_STATUS[selectedFlow.status].color, textTransform: "capitalize" }}>{selectedFlow.status}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Governance Policies */}
        <div className="an-chart-card">
          <div className="an-chart-title">📜 Inter-Agent Policies</div>
          <div className="ma-policy-list">
            {policies.map((p, i) => (
              <div key={i} className="ma-policy-card">
                <div className="ma-policy-top">
                  <span className="ma-policy-name">{p.name}</span>
                  <span className="ra-req-badge" style={{ background: p.status === "enforced" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: p.status === "enforced" ? "#10b981" : "#3b82f6" }}>{p.status === "enforced" ? "✓ Enforced" : "👁 Monitoring"}</span>
                </div>
                <p className="ma-policy-rule">{p.rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
