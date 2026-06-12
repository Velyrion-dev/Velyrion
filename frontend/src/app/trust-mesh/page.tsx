"use client";
import { useEffect, useState } from "react";
import { api, Agent } from "@/lib/api";

interface TrustAgreement {
  id: string;
  orgA: string;
  orgB: string;
  status: "active" | "pending" | "expired";
  agentCount: number;
  sharedPolicies: string[];
  createdAt: string;
  expiresAt: string;
}

interface CrossOrgEvent {
  timestamp: string;
  fromOrg: string;
  fromAgent: string;
  toOrg: string;
  toAgent: string;
  action: string;
  status: "allowed" | "blocked" | "flagged";
}

const STATUS_CONFIG = {
  active: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Active" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending" },
  expired: { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Expired" },
};

const EVENT_STATUS = {
  allowed: { color: "#10b981", icon: "✅" },
  blocked: { color: "#ef4444", icon: "🚫" },
  flagged: { color: "#f59e0b", icon: "⚠️" },
};

export default function TrustMeshPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgents().then(a => { setAgents(a); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="tm-page"><div className="lb-header"><h1 className="lb-title">Trust Mesh</h1><p className="lb-subtitle">Loading mesh topology...</p></div></div>;

  // Simulated cross-org agreements
  const agreements: TrustAgreement[] = [
    { id: "ta-1", orgA: "Velyrion Inc.", orgB: "Acme Corp", status: "active", agentCount: 4, sharedPolicies: ["Data Sharing", "Cost Limits", "Kill Switch"], createdAt: "2025-01-10", expiresAt: "2026-01-10" },
    { id: "ta-2", orgA: "Velyrion Inc.", orgB: "TechFlow AI", status: "active", agentCount: 3, sharedPolicies: ["Audit Trail", "Rate Limits"], createdAt: "2025-03-15", expiresAt: "2026-03-15" },
    { id: "ta-3", orgA: "Velyrion Inc.", orgB: "DataSync Ltd", status: "pending", agentCount: 2, sharedPolicies: ["Data Access", "Compliance"], createdAt: "2025-06-01", expiresAt: "2026-06-01" },
    { id: "ta-4", orgA: "Velyrion Inc.", orgB: "FinanceBot Co", status: "expired", agentCount: 1, sharedPolicies: ["Cost Limits"], createdAt: "2024-06-01", expiresAt: "2025-06-01" },
  ];

  const crossOrgEvents: CrossOrgEvent[] = [
    { timestamp: new Date(Date.now() - 300000).toISOString(), fromOrg: "Velyrion", fromAgent: agents[0]?.agent_name || "Agent-1", toOrg: "Acme Corp", toAgent: "Acme-Analyzer", action: "Data query request", status: "allowed" },
    { timestamp: new Date(Date.now() - 900000).toISOString(), fromOrg: "TechFlow AI", fromAgent: "TF-Processor", toOrg: "Velyrion", toAgent: agents[1]?.agent_name || "Agent-2", action: "API call", status: "allowed" },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), fromOrg: "Unknown", fromAgent: "Rogue-Bot", toOrg: "Velyrion", toAgent: agents[2]?.agent_name || "Agent-3", action: "Unauthorized access", status: "blocked" },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), fromOrg: "DataSync", fromAgent: "DS-Crawler", toOrg: "Velyrion", toAgent: agents[0]?.agent_name || "Agent-1", action: "Bulk data request", status: "flagged" },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), fromOrg: "Velyrion", fromAgent: agents[3]?.agent_name || "Agent-4", toOrg: "Acme Corp", toAgent: "Acme-Writer", action: "Report generation", status: "allowed" },
  ];

  const activeAgreements = agreements.filter(a => a.status === "active").length;
  const totalCrossOrg = crossOrgEvents.length;
  const blockedCount = crossOrgEvents.filter(e => e.status === "blocked").length;

  return (
    <div className="tm-page">
      <div className="lb-header">
        <h1 className="lb-title">🤝 Cross-Company Trust Mesh</h1>
        <p className="lb-subtitle">Govern agent-to-agent communication across organizations</p>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi green"><div className="an-kpi-icon">🤝</div><div className="an-kpi-data"><div className="an-kpi-value">{activeAgreements}</div><div className="an-kpi-label">Active Agreements</div></div></div>
        <div className="an-kpi blue"><div className="an-kpi-icon">🔗</div><div className="an-kpi-data"><div className="an-kpi-value">{agreements.reduce((s, a) => s + a.agentCount, 0)}</div><div className="an-kpi-label">Connected Agents</div></div></div>
        <div className="an-kpi purple"><div className="an-kpi-icon">📡</div><div className="an-kpi-data"><div className="an-kpi-value">{totalCrossOrg}</div><div className="an-kpi-label">Cross-Org Events</div></div></div>
        <div className="an-kpi red"><div className="an-kpi-icon">🚫</div><div className="an-kpi-data"><div className="an-kpi-value">{blockedCount}</div><div className="an-kpi-label">Blocked</div></div></div>
      </div>

      <div className="an-bottom-grid">
        {/* Trust Agreements */}
        <div className="an-chart-card">
          <div className="an-chart-title">📋 Trust Agreements</div>
          <div className="tm-agreement-list">
            {agreements.map(a => {
              const sc = STATUS_CONFIG[a.status];
              return (
                <div key={a.id} className="tm-agreement-card">
                  <div className="tm-ag-top">
                    <div className="tm-ag-orgs">
                      <span className="tm-ag-org">{a.orgA}</span>
                      <span className="tm-ag-arrow">⇄</span>
                      <span className="tm-ag-org">{a.orgB}</span>
                    </div>
                    <span className="ra-req-badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="tm-ag-meta">
                    <span>🤖 {a.agentCount} agents</span>
                    <span>📅 {a.createdAt} → {a.expiresAt}</span>
                  </div>
                  <div className="ti-agent-chips" style={{ marginTop: 6 }}>{a.sharedPolicies.map(p => <span key={p} className="ti-agent-chip">{p}</span>)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cross-Org Event Log */}
        <div className="an-chart-card">
          <div className="an-chart-title">📡 Cross-Organization Event Log</div>
          <div className="tm-event-list">
            {crossOrgEvents.map((e, i) => {
              const es = EVENT_STATUS[e.status];
              return (
                <div key={i} className="tm-event-card">
                  <span style={{ fontSize: 16 }}>{es.icon}</span>
                  <div className="tm-event-info">
                    <div className="tm-event-action">{e.action}</div>
                    <div className="tm-event-route">
                      <span className="tm-event-agent">{e.fromOrg}/{e.fromAgent}</span>
                      <span style={{ color: "var(--text-muted)" }}>→</span>
                      <span className="tm-event-agent">{e.toOrg}/{e.toAgent}</span>
                    </div>
                  </div>
                  <div className="tm-event-time">{new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
