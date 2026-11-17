"use client";
import { useState } from "react";
import {
  BookOpen,
  UserCheck,
  FileText,
  Shield,
  ShieldAlert,
  Award,
  Network
} from "lucide-react";

const SPEC_VERSION = "1.0.0";

interface SpecSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  content: string;
  fields?: { name: string; type: string; required: boolean; desc: string }[];
}

const SECTIONS: SpecSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: `The Open Agent Governance Standard (OAGS) defines an open universal specification for governing autonomous AI agents across platforms, runtimes, and multi-tenant cloud ecosystems. It provides a formal schema and protocol specification for registration, event telemetry logging, declarative policy enforcement, and audit chain verification.\n\nSpecification Version: ${SPEC_VERSION}\nStatus: Enterprise Draft Specification\nMaintainer: Velyrion Technical Standards Committee`,
  },
  {
    id: "agent_registration",
    title: "Agent Registration",
    icon: UserCheck,
    content: "Every AI agent runtime MUST be registered with an authorized governance authority prior to executing production tools or accessing customer databases. Registration mandates immutable identity, capability bounds, and ownership declarations.",
    fields: [
      { name: "agent_id", type: "string (UUID)", required: true, desc: "Globally unique agent identifier" },
      { name: "agent_name", type: "string", required: true, desc: "Human-readable display name" },
      { name: "organization_id", type: "string", required: true, desc: "Owning organization tenant UUID" },
      { name: "department", type: "string", required: true, desc: "Organizational business unit" },
      { name: "allowed_tools", type: "string[]", required: true, desc: "Whitelist of permitted tool calls and external APIs" },
      { name: "max_token_budget", type: "integer", required: true, desc: "Cumulative token consumption ceiling" },
      { name: "data_access_level", type: "enum", required: true, desc: "PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED" },
      { name: "model_version", type: "string", required: false, desc: "Underlying model identifier" },
    ],
  },
  {
    id: "event_logging",
    title: "Event Logging",
    icon: FileText,
    content: "Every action, tool execution, and state transition MUST emit a structured telemetry event. Events form an append-only, cryptographically linked audit trail for compliance, forensics, and liability underwriting.",
    fields: [
      { name: "event_id", type: "string (UUID)", required: true, desc: "Unique event identifier" },
      { name: "agent_id", type: "string", required: true, desc: "Acting agent identifier" },
      { name: "timestamp", type: "ISO 8601", required: true, desc: "UTC timestamp of the action" },
      { name: "task_description", type: "string", required: true, desc: "Human-readable semantic action summary" },
      { name: "tool_used", type: "string", required: true, desc: "API endpoint, method, or tool invoked" },
      { name: "risk_level", type: "enum", required: true, desc: "LOW | MEDIUM | HIGH | CRITICAL" },
      { name: "confidence_score", type: "float [0,1]", required: true, desc: "Agent self-reported confidence metric" },
      { name: "token_cost", type: "integer", required: false, desc: "Tokens consumed in this action" },
      { name: "duration_ms", type: "integer", required: false, desc: "Action execution latency in milliseconds" },
      { name: "human_in_loop", type: "boolean", required: false, desc: "Whether human approval was required and verified" },
    ],
  },
  {
    id: "policy_engine",
    title: "Policy Engine",
    icon: Shield,
    content: "Governance policies MUST be declarative, versioned, and machine-enforceable at runtime. Policies define pre-execution preconditions and automated containment measures.",
    fields: [
      { name: "policy_id", type: "string", required: true, desc: "Unique policy identifier" },
      { name: "policy_type", type: "enum", required: true, desc: "ALLOW | DENY | RATE_LIMIT | BUDGET | ESCALATE" },
      { name: "scope", type: "enum", required: true, desc: "GLOBAL | ORGANIZATION | DEPARTMENT | AGENT" },
      { name: "conditions", type: "object[]", required: true, desc: "Rule evaluation predicates (tools, data levels, budgets)" },
      { name: "action", type: "enum", required: true, desc: "ALLOW | BLOCK | ALERT | KILL | HUMAN_REVIEW" },
    ],
  },
  {
    id: "violation_handling",
    title: "Violation Handling",
    icon: ShieldAlert,
    content: "When an agent breaches an established policy, the platform MUST record a persistent violation, execute automated mitigation (such as model throttling or emergency kill switches), and broadcast alerts.",
    fields: [
      { name: "violation_id", type: "string", required: true, desc: "Unique violation identifier" },
      { name: "agent_id", type: "string", required: true, desc: "Violating agent identifier" },
      { name: "violation_type", type: "string", required: true, desc: "Categorical violation code" },
      { name: "severity", type: "enum", required: true, desc: "LOW | MEDIUM | HIGH | CRITICAL" },
      { name: "response_action", type: "enum", required: true, desc: "Mitigation action executed: ALERT | BLOCK | KILL | ESCALATE" },
      { name: "resolved", type: "boolean", required: true, desc: "Whether the violation has been reviewed and cleared" },
    ],
  },
  {
    id: "governance_score",
    title: "Governance Score",
    icon: Award,
    content: "Every agent MUST possess a computed Governance Score (0-100) evaluated across compliance rate, cost efficiency, budget adherence, health reliability, and past violation track record. Certified agents unlock reduced liability insurance premiums and inter-tenant mesh trust.",
  },
  {
    id: "interop",
    title: "Interoperability",
    icon: Network,
    content: "OAGS-compliant systems MUST expose standard REST APIs and WebSocket endpoints for seamless federation:\n\n• POST /api/agent/register — Register agent profile\n• POST /api/agent/event — Ingest action telemetry\n• GET /api/governance-score/{id} — Retrieve audited trust score\n• GET /api/violations — Query compliance violations\n• WS /ws/events — Real-time event and anomaly streaming",
  },
];

export default function OAGSPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const selected = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="oags-page">
      <div className="oags-header">
        <div>
          <h1 className="lb-title">Open Agent Governance Standard</h1>
          <p className="lb-subtitle">OAGS v{SPEC_VERSION} — Universal architectural specification for autonomous agent governance</p>
        </div>
        <div className="oags-version-badge">v{SPEC_VERSION} Specification</div>
      </div>

      <div className="oags-main">
        {/* Spec TOC */}
        <div className="oags-toc">
          <div className="fr-sidebar-header">
            <span className="an-chart-title" style={{ margin: 0 }}>Specification Modules</span>
          </div>
          <div className="oags-toc-list">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  className={`oags-toc-item ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Icon style={{ width: 14, height: 14, color: activeSection === s.id ? "var(--accent-cyan)" : "var(--text-muted)" }} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spec Content */}
        <div className="oags-content">
          <div className="oags-section-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SelectedIcon style={{ width: 22, height: 22, color: "var(--accent-cyan)" }} />
            </div>
            <h2 className="oags-section-title" style={{ margin: 0 }}>{selected.title}</h2>
          </div>
          <div className="oags-section-body" style={{ marginTop: 16 }}>
            {selected.content.split("\n").map((line, i) => (
              <p key={i} className="oags-paragraph">{line}</p>
            ))}
          </div>
          {selected.fields && (
            <div className="oags-fields" style={{ marginTop: 24 }}>
              <h3 className="an-chart-title">Data Schema Specification</h3>
              <div className="cn-fields-grid">
                {selected.fields.map(f => (
                  <div key={f.name} className="cn-field">
                    <div className="cn-field-header">
                      <span className="cn-field-name">{f.name}</span>
                      <span className="cn-field-type">{f.type}</span>
                      <span className={f.required ? "cn-field-req" : "cn-field-opt"}>
                        {f.required ? "required" : "optional"}
                      </span>
                    </div>
                    <p className="cn-field-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
