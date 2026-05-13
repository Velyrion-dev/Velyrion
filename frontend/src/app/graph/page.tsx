"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  department?: string;
  status?: string;
  risk_score?: number;
  total_actions?: number;
  total_violations?: number;
  total_cost?: number;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface BlastRadius {
  agent_id: string;
  agent_name: string;
  department: string;
  status: string;
  blast_radius: {
    risk_rating: string;
    direct_tools: string[];
    direct_data_sources: string[];
    connected_agents: { agent_id: string; agent_name: string; department: string; shared_tools: string[]; shared_data_sources: string[]; risk: string }[];
    total_connected_agents: number;
    total_exposure_points: number;
  };
  violations: { type: string; description: string; severity: string }[];
}

const NODE_COLORS: Record<string, string> = {
  agent: "#00b4d8",
  tool: "#ffc107",
  data_source: "#00e5a0",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#00e5a0",
  LOCKED: "#ff3b5c",
  SUSPENDED: "#ff6b35",
  PAUSED: "#ffc107",
};

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ff3b5c",
  HIGH: "#ff6b35",
  MEDIUM: "#ffc107",
  LOW: "#00e5a0",
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadius | null>(null);
  const [loading, setLoading] = useState(true);
  const [blastLoading, setBlastLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getGraphNodes(), api.getGraphEdges()])
      .then(([n, e]) => { setNodes(n); setEdges(e); })
      .finally(() => setLoading(false));
  }, []);

  const handleAgentClick = async (agentId: string) => {
    setSelectedAgent(agentId);
    setBlastLoading(true);
    try {
      const data = await api.getBlastRadius(agentId);
      setBlastRadius(data);
    } catch { setBlastRadius(null); }
    setBlastLoading(false);
  };

  const agentNodes = nodes.filter(n => n.type === "agent");
  const toolNodes = nodes.filter(n => n.type === "tool");
  const dataNodes = nodes.filter(n => n.type === "data_source");

  // Edges for selected agent
  const selectedEdges = selectedAgent
    ? edges.filter(e => e.source === selectedAgent || e.target === selectedAgent)
    : [];
  const connectedIds = new Set(selectedEdges.flatMap(e => [e.source, e.target]));

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>🕸️ Agent Behavior Graph</h1><p>Loading graph intelligence...</p></div>
        <div className="stats-grid">{[...Array(4)].map((_, i) => <div key={i} className="stat-card" style={{ height: 110 }}><div className="loading-shimmer" /></div>)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>🕸️ Agent Behavior Graph</h1>
        <p>Interactive visualization of agent connections, data flows, and blast radius analysis</p>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-label">Agent Nodes</div>
          <div className="stat-value">{agentNodes.length}</div>
          <div className="stat-subtitle">{agentNodes.filter(n => n.status === "LOCKED").length} locked</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Tool Nodes</div>
          <div className="stat-value">{toolNodes.length}</div>
          <div className="stat-subtitle">Registered capabilities</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Data Sources</div>
          <div className="stat-value">{dataNodes.length}</div>
          <div className="stat-subtitle">Connected data endpoints</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Connections</div>
          <div className="stat-value">{edges.length}</div>
          <div className="stat-subtitle">{edges.filter(e => e.type === "violation").length} violation edges</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Graph Visualization */}
        <div className="card">
          <h3 className="section-title">🗺️ Network Map — Click an agent to analyze blast radius</h3>
          <div style={{ position: "relative", minHeight: 500, background: "var(--bg-primary)", borderRadius: 12, padding: 20, overflow: "hidden" }}>
            {/* Agent Cluster */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {agentNodes.map((node, i) => {
                const isSelected = selectedAgent === node.id;
                const isConnected = connectedIds.has(node.id);
                const borderColor = node.status === "LOCKED" ? STATUS_COLORS.LOCKED :
                  isSelected ? "#fff" :
                  isConnected ? "#00e5ff" :
                  STATUS_COLORS[node.status || "ACTIVE"] || "#8b95a5";
                const violations = node.total_violations || 0;

                return (
                  <div
                    key={node.id}
                    onClick={() => handleAgentClick(node.id)}
                    style={{
                      width: Math.max(90, (node.size || 10) * 2.5),
                      padding: "12px 10px",
                      background: isSelected ? "rgba(0,180,216,0.15)" : "var(--bg-secondary)",
                      border: `2px solid ${borderColor}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                      transform: isSelected ? "scale(1.08)" : "scale(1)",
                      boxShadow: isSelected ? `0 0 20px ${borderColor}40` : "none",
                      opacity: selectedAgent && !isSelected && !isConnected ? 0.4 : 1,
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>
                      {node.status === "LOCKED" ? "🔒" : "🤖"}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                      {node.department || ""}
                    </div>
                    {violations > 0 && (
                      <span className={`badge badge-${violations > 5 ? "critical" : violations > 2 ? "high" : "medium"}`} style={{ fontSize: 8, marginTop: 4, display: "inline-block" }}>
                        {violations} violations
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tool & Data Source Rows */}
            <div style={{ marginTop: 20, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: NODE_COLORS.tool, marginBottom: 6, textTransform: "uppercase" }}>🔧 Tools</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {toolNodes.map(t => (
                    <span key={t.id} style={{
                      padding: "4px 10px",
                      background: connectedIds.has(t.id) ? "rgba(255,193,7,0.15)" : "var(--bg-secondary)",
                      border: `1px solid ${connectedIds.has(t.id) ? NODE_COLORS.tool : "var(--border-subtle)"}`,
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "monospace",
                      opacity: selectedAgent && !connectedIds.has(t.id) ? 0.3 : 1,
                    }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: NODE_COLORS.data_source, marginBottom: 6, textTransform: "uppercase" }}>📊 Data Sources</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {dataNodes.map(d => (
                    <span key={d.id} style={{
                      padding: "4px 10px",
                      background: connectedIds.has(d.id) ? "rgba(0,229,160,0.15)" : "var(--bg-secondary)",
                      border: `1px solid ${connectedIds.has(d.id) ? NODE_COLORS.data_source : "var(--border-subtle)"}`,
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "monospace",
                      opacity: selectedAgent && !connectedIds.has(d.id) ? 0.3 : 1,
                    }}>
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Blast Radius Panel */}
        <div className="card">
          <h3 className="section-title">💥 Blast Radius Analysis</h3>
          {!selectedAgent ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Select an agent</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Click any agent to analyze its blast radius — what it can access and who it affects</div>
            </div>
          ) : blastLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
              <div className="loading-shimmer" style={{ height: 200 }} />
            </div>
          ) : blastRadius ? (
            <div>
              {/* Agent Header */}
              <div style={{ padding: 16, background: "var(--bg-secondary)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{blastRadius.agent_name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{blastRadius.department}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge badge-${blastRadius.blast_radius.risk_rating.toLowerCase()}`}>
                      {blastRadius.blast_radius.risk_rating} RISK
                    </span>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {blastRadius.blast_radius.total_exposure_points} exposure points
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Access */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-yellow)", marginBottom: 6 }}>🔧 DIRECT TOOL ACCESS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {blastRadius.blast_radius.direct_tools.map(t => (
                    <span key={t} style={{ padding: "4px 10px", background: "rgba(255,193,7,0.1)", border: "1px solid rgba(255,193,7,0.3)", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-green)", marginBottom: 6 }}>📊 DIRECT DATA ACCESS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {blastRadius.blast_radius.direct_data_sources.map(d => (
                    <span key={d} style={{ padding: "4px 10px", background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Connected Agents */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)", marginBottom: 6 }}>
                  ⚡ CONNECTED AGENTS ({blastRadius.blast_radius.total_connected_agents})
                </div>
                {blastRadius.blast_radius.connected_agents.map(ca => (
                  <div key={ca.agent_id} style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${RISK_COLORS[ca.risk] || "#8b95a5"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{ca.agent_name}</span>
                      <span className={`badge badge-${ca.risk.toLowerCase()}`} style={{ fontSize: 9 }}>{ca.risk}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {ca.department} · Shared: {[...ca.shared_tools, ...ca.shared_data_sources].join(", ")}
                    </div>
                  </div>
                ))}
                {blastRadius.blast_radius.connected_agents.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 12 }}>No connected agents — isolated scope</div>
                )}
              </div>

              {/* Violations */}
              {blastRadius.violations.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)", marginBottom: 6 }}>🚫 RECENT VIOLATIONS</div>
                  {blastRadius.violations.slice(0, 5).map((v, i) => (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(255,59,92,0.05)", borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
                      <span className={`badge badge-${v.severity.toLowerCase()}`} style={{ fontSize: 9, marginRight: 6 }}>{v.severity}</span>
                      {v.type}: {v.description.slice(0, 80)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
