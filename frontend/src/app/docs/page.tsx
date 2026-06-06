"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  bodyExample?: string;
  responseExample?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST", path: "/api/agent/event", title: "Ingest Agent Event",
    description: "Main webhook — receives agent actions, validates permissions, detects anomalies, and triggers responses.",
    params: [
      { name: "agent_id", type: "string", required: true, desc: "Unique agent identifier" },
      { name: "task_description", type: "string", required: true, desc: "What the agent did" },
      { name: "tool_used", type: "string", required: true, desc: "Tool or API called" },
      { name: "token_cost", type: "integer", required: false, desc: "Tokens consumed" },
      { name: "compute_cost_usd", type: "float", required: false, desc: "Cost in USD" },
      { name: "confidence_score", type: "float", required: false, desc: "0.0 - 1.0 confidence" },
      { name: "duration_ms", type: "integer", required: false, desc: "Execution time in ms" },
      { name: "input_data", type: "string", required: false, desc: "Input sent to the tool" },
      { name: "output_data", type: "string", required: false, desc: "Output received" },
    ],
    bodyExample: `{
  "agent_id": "agent-001",
  "task_description": "Query customer database",
  "tool_used": "sql_executor",
  "token_cost": 150,
  "compute_cost_usd": 0.003,
  "confidence_score": 0.95
}`,
    responseExample: `{
  "event_id": "evt_abc123",
  "timestamp": "2025-01-15T10:30:00Z",
  "agent_id": "agent-001",
  "risk_level": "LOW",
  "task_description": "Query customer database",
  "tool_used": "sql_executor"
}`,
  },
  {
    method: "POST", path: "/api/agents", title: "Register Agent",
    description: "Register a new AI agent with permissions, budget, and allowed tools.",
    params: [
      { name: "agent_name", type: "string", required: true, desc: "Display name" },
      { name: "department", type: "string", required: true, desc: "Department or team" },
      { name: "allowed_tools", type: "string[]", required: true, desc: "List of allowed tools" },
      { name: "max_token_budget", type: "integer", required: true, desc: "Token budget limit" },
      { name: "data_access_level", type: "string", required: false, desc: "PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED" },
    ],
    bodyExample: `{
  "agent_name": "DataAnalyzer",
  "department": "analytics",
  "allowed_tools": ["sql_query", "chart_generator"],
  "max_token_budget": 100000,
  "data_access_level": "INTERNAL"
}`,
    responseExample: `{
  "agent_id": "agt_xyz789",
  "agent_name": "DataAnalyzer",
  "status": "ACTIVE",
  "created_at": "2025-01-15T10:00:00Z"
}`,
  },
  {
    method: "GET", path: "/api/agents", title: "List All Agents",
    description: "Retrieve all registered agents with their current status, metrics, and configuration.",
    responseExample: `[
  {
    "agent_id": "agt_001",
    "agent_name": "DataAnalyzer",
    "status": "ACTIVE",
    "total_actions": 1523,
    "total_violations": 2,
    "total_cost_usd": 45.20
  }
]`,
  },
  {
    method: "GET", path: "/api/events", title: "Get Audit Events",
    description: "Retrieve the audit trail — all logged agent events with filtering.",
    params: [
      { name: "limit", type: "integer", required: false, desc: "Max results (default 50)" },
      { name: "agent_id", type: "string", required: false, desc: "Filter by agent" },
    ],
    responseExample: `[
  {
    "event_id": "evt_001",
    "agent_id": "agt_001",
    "task_description": "Process order",
    "risk_level": "LOW",
    "timestamp": "2025-01-15T10:30:00Z"
  }
]`,
  },
  {
    method: "GET", path: "/api/violations", title: "Get Violations",
    description: "List all policy violations with severity and resolution status.",
    responseExample: `[
  {
    "violation_id": "vio_001",
    "agent_id": "agt_001",
    "violation_type": "UNAUTHORIZED_TOOL",
    "severity": "HIGH",
    "description": "Agent used restricted tool"
  }
]`,
  },
  {
    method: "GET", path: "/api/dashboard/stats", title: "Dashboard Stats",
    description: "Aggregated statistics for the dashboard — agents, events, violations, costs.",
    responseExample: `{
  "total_agents": 16,
  "active_agents": 13,
  "total_events": 45230,
  "total_violations": 8,
  "total_cost_usd": 781.21
}`,
  },
  {
    method: "POST", path: "/api/agents/{id}/kill", title: "Kill Agent",
    description: "Emergency kill switch — immediately lock an agent and halt all operations.",
    params: [
      { name: "reason", type: "string", required: true, desc: "Reason for killing the agent" },
    ],
    bodyExample: `{ "reason": "Unauthorized data access detected" }`,
    responseExample: `{ "status": "LOCKED", "message": "Agent killed successfully" }`,
  },
];

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  GET: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
  POST: { bg: "rgba(16,185,129,0.15)", color: "#10b981" },
  PUT: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
  DELETE: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
};

export default function DocsPage() {
  const [selected, setSelected] = useState(0);
  const [tryResponse, setTryResponse] = useState("");
  const [tryLoading, setTryLoading] = useState(false);

  const ep = ENDPOINTS[selected];
  const mc = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;

  const tryEndpoint = async () => {
    if (ep.method !== "GET") {
      setTryResponse("// Try-it-live is available for GET endpoints only.\n// Use curl or Postman for POST/PUT/DELETE.");
      return;
    }
    setTryLoading(true);
    setTryResponse("");
    try {
      const res = await fetch(`${API_BASE}${ep.path}?limit=3`);
      const data = await res.json();
      setTryResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setTryResponse(`// Error: ${err}`);
    }
    setTryLoading(false);
  };

  return (
    <div className="dc-page">
      <div className="dc-header">
        <div>
          <h1 className="lb-title">📖 API Documentation</h1>
          <p className="lb-subtitle">Interactive reference for the Velyrion Governance API</p>
        </div>
        <div className="dc-base-url">
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Base URL</span>
          <code style={{ fontSize: 13, color: "var(--accent-cyan)" }}>{API_BASE}</code>
        </div>
      </div>

      <div className="dc-main">
        {/* Endpoint List */}
        <div className="dc-sidebar">
          <div className="fr-sidebar-header">
            <span className="an-chart-title" style={{ margin: 0 }}>Endpoints</span>
          </div>
          <div className="dc-endpoint-list">
            {ENDPOINTS.map((ep, i) => (
              <button key={i} className={`dc-ep-btn ${selected === i ? "active" : ""}`} onClick={() => { setSelected(i); setTryResponse(""); }}>
                <span className="dc-ep-method" style={{ background: METHOD_COLORS[ep.method]?.bg, color: METHOD_COLORS[ep.method]?.color }}>{ep.method}</span>
                <span className="dc-ep-title">{ep.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="dc-detail">
          {/* Endpoint Header */}
          <div className="fr-summary">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span className="dc-ep-method-lg" style={{ background: mc.bg, color: mc.color }}>{ep.method}</span>
              <code style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{ep.path}</code>
            </div>
            <p className="fr-summary-desc">{ep.description}</p>
          </div>

          {/* Parameters */}
          {ep.params && ep.params.length > 0 && (
            <div className="cn-api-ref" style={{ padding: 20 }}>
              <div className="an-chart-title">Parameters</div>
              <div className="cn-fields-grid">
                {ep.params.map(p => (
                  <div key={p.name} className="cn-field">
                    <div className="cn-field-header">
                      <span className="cn-field-name">{p.name}</span>
                      <span className="cn-field-type">{p.type}</span>
                      <span className={p.required ? "cn-field-req" : "cn-field-opt"}>{p.required ? "required" : "optional"}</span>
                    </div>
                    <p className="cn-field-desc">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {ep.bodyExample && (
            <div className="dc-code-section">
              <div className="an-chart-title">Request Body</div>
              <div className="lp-code-block" style={{ borderRadius: 14 }}>
                <div className="lp-code-header"><span className="lp-code-dots"><span /><span /><span /></span><span className="lp-code-filename">JSON</span></div>
                <pre className="lp-code-content"><code>{ep.bodyExample}</code></pre>
              </div>
            </div>
          )}

          {/* Response Example */}
          {ep.responseExample && (
            <div className="dc-code-section">
              <div className="an-chart-title">Response Example</div>
              <div className="lp-code-block" style={{ borderRadius: 14 }}>
                <div className="lp-code-header"><span className="lp-code-dots"><span /><span /><span /></span><span className="lp-code-filename">200 OK</span></div>
                <pre className="lp-code-content"><code>{ep.responseExample}</code></pre>
              </div>
            </div>
          )}

          {/* Try It Live */}
          <div className="dc-try-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="an-chart-title">Try It Live</div>
              <button className="btn btn-primary btn-sm" onClick={tryEndpoint} disabled={tryLoading}>
                {tryLoading ? "⏳ Loading..." : "▶ Send Request"}
              </button>
            </div>
            <div className="dc-try-url">
              <span className="dc-ep-method" style={{ background: mc.bg, color: mc.color }}>{ep.method}</span>
              <code>{API_BASE}{ep.path}{ep.method === "GET" ? "?limit=3" : ""}</code>
            </div>
            {tryResponse && (
              <div className="lp-code-block" style={{ borderRadius: 14, marginTop: 12 }}>
                <div className="lp-code-header"><span className="lp-code-dots"><span /><span /><span /></span><span className="lp-code-filename">Response</span></div>
                <pre className="lp-code-content" style={{ maxHeight: 300 }}><code>{tryResponse}</code></pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
