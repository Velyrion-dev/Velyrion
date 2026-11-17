"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Network,
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
  Clock,
  RefreshCw,
  Cpu,
  ShieldAlert,
  CheckCircle2
} from "lucide-react";

interface FlowRecord {
  flow_id: string;
  from_agent_id: string;
  from_agent_name: string;
  to_agent_id: string;
  to_agent_name: string;
  action: string;
  status: string;
  timestamp: string;
}

interface InterPolicy {
  policy_id: string;
  name: string;
  rule: string;
  enforcement: string;
}

const FLOW_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  governed: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Governed" },
  blocked: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Blocked" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending" },
};

const DEFAULT_POLICIES: InterPolicy[] = [
  { policy_id: "pol-1", name: "Cross-Boundary Tool Lock", rule: "Agents may NOT invoke tools outside their assigned security perimeter", enforcement: "enforced" },
  { policy_id: "pol-2", name: "Data Sensitivity Relay", rule: "Data relayed between agents must match the lower data classification level", enforcement: "enforced" },
  { policy_id: "pol-3", name: "Autonomous Budget Transfer", rule: "Inter-agent token budget delegation requires human approval", enforcement: "enforced" },
  { policy_id: "pol-4", name: "Scope-Bounded Delegation", rule: "Agents may delegate tasks only to agents within the same organizational scope", enforcement: "enforced" },
  { policy_id: "pol-5", name: "Consensus Verification", rule: "Aggregated multi-agent outputs require deterministic schema validation", enforcement: "monitoring" },
];

export default function MultiAgentProtocolPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [stats, setStats] = useState<{ total: number; governed: number; blocked: number; pending: number }>({
    total: 0,
    governed: 0,
    blocked: 0,
    pending: 0,
  });
  const [policies, setPolicies] = useState<InterPolicy[]>(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedAgents, fetchedFlows, fetchedStats, fetchedPolicies] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getAgentFlows(50).catch(() => []),
        api.getFlowStats().catch(() => ({ total: 0, governed: 0, blocked: 0, pending: 0 })),
        api.getInterAgentPolicies().catch(() => []),
      ]);

      setAgents(fetchedAgents);
      setFlows(fetchedFlows);
      setStats(fetchedStats);
      if (fetchedPolicies && fetchedPolicies.length > 0) {
        setPolicies(fetchedPolicies);
      }
    } catch (e) {
      console.error("Multi-agent fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="ma-page">
        <div className="lb-header">
          <h1 className="lb-title">Multi-Agent Protocol</h1>
          <p className="lb-subtitle">Querying inter-agent communication flows and topology from database...</p>
        </div>
      </div>
    );
  }

  const governedCount = stats.governed || flows.filter(f => f.status === "governed").length;
  const blockedCount = stats.blocked || flows.filter(f => f.status === "blocked").length;
  const pendingCount = stats.pending || flows.filter(f => f.status === "pending").length;

  return (
    <div className="ma-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Multi-Agent Governance Protocol</h1>
          <p className="lb-subtitle">Runtime security boundaries and policy enforcement for collaborative multi-agent workflows</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Topology">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{agents.length}</div>
            <div className="an-kpi-label">Active Agents</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <ShieldCheck style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{governedCount}</div>
            <div className="an-kpi-label">Governed Flows</div>
          </div>
        </div>
        <div className="an-kpi red">
          <div className="an-kpi-icon">
            <AlertOctagon style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{blockedCount}</div>
            <div className="an-kpi-label">Blocked Attempts</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">
            <Clock style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{pendingCount}</div>
            <div className="an-kpi-label">Pending Verification</div>
          </div>
        </div>
      </div>

      <div className="an-bottom-grid">
        {/* Message Flows */}
        <div className="an-chart-card">
          <div className="an-chart-title">Inter-Agent Flow Log ({flows.length})</div>
          {flows.length === 0 ? (
            <div className="an-empty">
              No inter-agent communication flows recorded yet. Dispatched agent interactions will stream here.
            </div>
          ) : (
            <div className="ma-flow-list">
              {flows.map(f => {
                const sc = FLOW_STATUS[f.status] || FLOW_STATUS.governed;
                return (
                  <div
                    key={f.flow_id}
                    className={`ma-flow-card ${selectedFlow?.flow_id === f.flow_id ? "active" : ""}`}
                    onClick={() => setSelectedFlow(f)}
                  >
                    <div className="ma-flow-info">
                      <div className="ma-flow-route" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="ma-flow-agent">{f.from_agent_name}</span>
                        <ArrowRight style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
                        <span className="ma-flow-agent">{f.to_agent_name}</span>
                      </div>
                      <div className="ma-flow-action">{f.action}</div>
                    </div>
                    <span className="ra-req-badge" style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedFlow && (
            <div className="ma-flow-detail" style={{ marginTop: 16 }}>
              <div className="an-chart-title">Flow Diagnostic Details</div>
              <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <div className="fr-state-item">
                  <span className="fr-state-label">Source Agent</span>
                  <span className="fr-state-value">{selectedFlow.from_agent_name}</span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Destination Agent</span>
                  <span className="fr-state-value">{selectedFlow.to_agent_name}</span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Action Signature</span>
                  <span className="fr-state-value">{selectedFlow.action}</span>
                </div>
                <div className="fr-state-item">
                  <span className="fr-state-label">Governance State</span>
                  <span className="fr-state-value" style={{ color: FLOW_STATUS[selectedFlow.status]?.color || "#10b981", textTransform: "capitalize" }}>
                    {selectedFlow.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Governance Policies */}
        <div className="an-chart-card">
          <div className="an-chart-title">Inter-Agent Security Rules ({policies.length})</div>
          <div className="ma-policy-list">
            {policies.map(p => (
              <div key={p.policy_id} className="ma-policy-card">
                <div className="ma-policy-top">
                  <span className="ma-policy-name">{p.name}</span>
                  <span
                    className="ra-req-badge"
                    style={{
                      background: p.enforcement === "enforced" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)",
                      color: p.enforcement === "enforced" ? "#10b981" : "#3b82f6",
                      textTransform: "capitalize"
                    }}
                  >
                    {p.enforcement}
                  </span>
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
