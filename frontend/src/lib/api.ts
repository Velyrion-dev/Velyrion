const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("velyrion_access_token");
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API Error");
  }
  return res.json();
}

// ── Types ──

export interface Agent {
  agent_id: string;
  agent_name: string;
  owner_email: string;
  department: string;
  allowed_tools: string[];
  allowed_data_sources: string[];
  max_token_budget: number;
  max_task_duration_seconds: number;
  requires_human_approval_for: string[];
  compliance_frameworks: string[];
  status: string;
  tokens_used: number;
  total_cost_usd: number;
  total_actions: number;
  total_violations: number;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  agent_id: string;
  agent_name: string;
  task_description: string;
  tool_used: string;
  input_data: string;
  output_data: string;
  confidence_score: number;
  duration_ms: number;
  token_cost: number;
  compute_cost_usd: number;
  human_in_loop: boolean;
  risk_level: string;
}

export interface Violation {
  violation_id: string;
  timestamp: string;
  agent_id: string;
  event_id: string | null;
  violation_type: string;
  description: string;
  severity: string;
  action_taken: string;
  resolved: boolean;
}

export interface Anomaly {
  anomaly_id: string;
  timestamp: string;
  agent_id: string;
  event_id: string | null;
  anomaly_type: string;
  description: string;
  risk_level: string;
}

export interface Incident {
  incident_id: string;
  timestamp: string;
  agent_id: string;
  violation_type: string;
  severity: string;
  system_action: string;
  agent_state_snapshot: string;
  resolution_status: string;
}

export interface ApprovalRequest {
  request_id: string;
  timestamp: string;
  agent_id: string;
  task_description: string;
  action_context: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface Alert {
  alert_id: string;
  timestamp: string;
  alert_type: string;
  agent_id: string;
  event_description: string;
  risk_level: string;
  action_taken: string;
  human_action_required: string;
  channel: string;
  delivered: boolean;
}

export interface DashboardStats {
  total_agents: number;
  active_agents: number;
  locked_agents: number;
  total_events: number;
  total_violations: number;
  total_anomalies: number;
  total_incidents: number;
  pending_approvals: number;
  total_cost_usd: number;
  violations_by_severity: Record<string, number>;
  events_last_24h: number;
}

export interface AgentHealth {
  agent_id: string;
  agent_name: string;
  health_score: number;
  total_actions: number;
  total_violations: number;
  total_cost_usd: number;
  status: string;
}

export interface AgentCost {
  agent_id: string;
  agent_name: string;
  tokens_used: number;
  max_token_budget: number;
  total_cost_usd: number;
  budget_usage_pct: number;
}

export interface ComplianceReport {
  report_period: string;
  total_agent_actions: number;
  policy_violations: Record<string, number>;
  human_interventions: number;
  cost_per_agent: { agent_id: string; agent_name: string; cost_usd: number }[];
  top_performing_agents: { agent_id: string; agent_name: string; actions: number; violations: number }[];
  underperforming_agents: { agent_id: string; agent_name: string; actions: number; violations: number }[];
  department_risk_scores: { department: string; risk_score: number; total_agents: number; total_violations: number }[];
}

// ── API Functions ──

export const api = {
  // Dashboard
  getStats: () => fetchAPI<DashboardStats>("/api/dashboard/stats"),
  getHealth: () => fetchAPI<AgentHealth[]>("/api/dashboard/health"),
  getCosts: () => fetchAPI<AgentCost[]>("/api/dashboard/costs"),

  // Agents
  getAgents: () => fetchAPI<Agent[]>("/api/agents"),
  getAgent: (id: string) => fetchAPI<Agent>(`/api/agents/${id}`),
  createAgent: (data: Partial<Agent>) =>
    fetchAPI<Agent>("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<Agent>) =>
    fetchAPI<Agent>(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateAgent: (id: string) =>
    fetchAPI(`/api/agents/${id}`, { method: "DELETE" }),

  // Events
  getEvents: (limit = 100) => fetchAPI<AuditEvent[]>(`/api/events?limit=${limit}`),

  // Violations
  getViolations: (limit = 100) => fetchAPI<Violation[]>(`/api/violations?limit=${limit}`),

  // Anomalies
  getAnomalies: (limit = 100) => fetchAPI<Anomaly[]>(`/api/anomalies?limit=${limit}`),

  // Incidents
  getIncidents: () => fetchAPI<Incident[]>("/api/incidents"),
  resolveIncident: (id: string) =>
    fetchAPI(`/api/incidents/${id}/resolve`, { method: "POST" }),

  // Approvals
  getApprovals: () => fetchAPI<ApprovalRequest[]>("/api/approvals"),
  approveRequest: (id: string) =>
    fetchAPI(`/api/approvals/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  rejectRequest: (id: string) =>
    fetchAPI(`/api/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({}) }),

  // Alerts
  getAlerts: (limit = 100) => fetchAPI<Alert[]>(`/api/alerts?limit=${limit}`),

  // Reports
  getComplianceReport: (period = "2025-Q1") =>
    fetchAPI<ComplianceReport>(`/api/reports/compliance?period=${period}`),

  // ── Agent Controls (Kill Switch) ──
  killAgent: (id: string, reason = "") =>
    fetchAPI(`/api/agents/${id}/kill`, { method: "POST", body: JSON.stringify({ reason }) }),
  pauseAgent: (id: string, reason = "") =>
    fetchAPI(`/api/agents/${id}/pause`, { method: "POST", body: JSON.stringify({ reason }) }),
  unlockAgent: (id: string, reason = "") =>
    fetchAPI(`/api/agents/${id}/unlock`, { method: "POST", body: JSON.stringify({ reason }) }),
  revokeToolFromAgent: (id: string, tool: string, reason = "") =>
    fetchAPI(`/api/agents/${id}/revoke-tool`, { method: "POST", body: JSON.stringify({ tool, reason }) }),
  getAgentStatus: (id: string) =>
    fetchAPI<{ agent_id: string; status: string; should_kill: boolean; should_pause: boolean }>(`/api/agents/${id}/status`),

  // ── Policies ──
  getPolicies: () =>
    fetchAPI<{ filename: string; name: string; version: string; agents: string[]; rules_count: number }[]>("/api/policies"),
  getPolicy: (filename: string) =>
    fetchAPI(`/api/policies/${filename}`),
  createPolicy: (data: { name: string; version?: string; agents?: string[]; rules: { name: string; condition: string; action: string; severity?: string; message?: string }[] }) =>
    fetchAPI("/api/policies", { method: "POST", body: JSON.stringify(data) }),
  deletePolicy: (filename: string) =>
    fetchAPI(`/api/policies/${filename}`, { method: "DELETE" }),
  evaluatePolicy: (data: { agent_id: string; tool_used?: string; task?: string; confidence_score?: number }) =>
    fetchAPI<{ rule_name: string; action: string; severity: string; message: string; policy_file: string }[]>(
      "/api/policies/evaluate", { method: "POST", body: JSON.stringify(data) }
    ),

  // ── Replay / Forensics ──
  getAgentReplay: (agentId: string) =>
    fetchAPI<{
      session: { agent_id: string; agent_name: string; total_events: number; total_tokens: number; total_cost_usd: number; avg_confidence: number; risk_breakdown: Record<string, number>; first_event: string; last_event: string };
      timeline: AuditEvent[];
      violations: { violation_id: number; type: string; description: string; severity: string; action_taken: string; created_at: string }[];
      anomalies: { anomaly_id: number; type: string; description: string; risk_level: string; detected_at: string }[];
    }>(`/api/replay/${agentId}`),
  compareAgents: (a: string, b: string) =>
    fetchAPI(`/api/replay/compare/${a}/${b}`),

  // ── Webhooks ──
  getWebhooks: () =>
    fetchAPI<{ id: number; name: string; url: string; channel: string; events: string[]; severity_filter: string[]; enabled: boolean; deliveries: number; failures: number }[]>("/api/webhooks"),
  createWebhook: (data: { name: string; url: string; channel?: string; events?: string[]; severity_filter?: string[]; slack_channel?: string }) =>
    fetchAPI("/api/webhooks", { method: "POST", body: JSON.stringify(data) }),
  deleteWebhook: (id: number) =>
    fetchAPI(`/api/webhooks/${id}`, { method: "DELETE" }),
  toggleWebhook: (id: number) =>
    fetchAPI(`/api/webhooks/${id}/toggle`, { method: "POST" }),
  testWebhook: (id: number) =>
    fetchAPI<{ success: boolean; status_code: number | null; message: string }>(`/api/webhooks/${id}/test`, { method: "POST" }),
  getWebhookDeliveries: (limit = 50) =>
    fetchAPI<{ alert_id: string; type: string; agent_id: string; description: string; severity: string; channel: string; delivered: boolean; timestamp: string }[]>(`/api/webhooks/deliveries?limit=${limit}`),

  // ── v3.0: Predictions ──
  getPredictions: () =>
    fetchAPI<{ agent_id: string; agent_name: string; department: string; risk_score: number; risk_level: string; prediction: string; recommended_action: string; factors: { factor: string; severity: string; detail: string; score_impact: number }[]; analyzed_at: string }[]>("/api/predictions"),

  // ── v3.0: Graph Intelligence ──
  getGraphNodes: () =>
    fetchAPI<{ id: string; label: string; type: string; department?: string; status?: string; risk_score?: number; total_actions?: number; total_violations?: number; total_cost?: number; size: number }[]>("/api/graph/nodes"),
  getGraphEdges: () =>
    fetchAPI<{ source: string; target: string; type: string; weight: number }[]>("/api/graph/edges"),
  getBlastRadius: (agentId: string) =>
    fetchAPI<{ agent_id: string; agent_name: string; department: string; status: string; blast_radius: { risk_rating: string; direct_tools: string[]; direct_data_sources: string[]; connected_agents: { agent_id: string; agent_name: string; department: string; shared_tools: string[]; shared_data_sources: string[]; risk: string }[]; total_connected_agents: number; total_exposure_points: number }; violations: { type: string; description: string; severity: string }[] }>(`/api/graph/blast-radius/${agentId}`),

  // ── v3.0: Audit Chain ──
  verifyAuditChain: () =>
    fetchAPI<{ chain_integrity: string; total_events: number; verified_events: number; merkle_root: string | null; broken_at: string | null; error: string | null }>("/api/audit/verify"),
  getAuditChain: (limit = 20) =>
    fetchAPI<{ event_id: string; timestamp: string; agent_id: string; agent_name: string; task: string; risk_level: string; event_hash: string; previous_hash: string; hash_linked: boolean }[]>(`/api/audit/chain?limit=${limit}`),
};

// ── WebSocket URL ──
export const WS_URL = API_BASE.replace("https://", "wss://").replace("http://", "ws://") + "/ws/events";
