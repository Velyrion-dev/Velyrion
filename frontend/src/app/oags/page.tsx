"use client";
import { useState } from "react";

const SPEC_VERSION = "1.0.0";

interface SpecSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  fields?: { name: string; type: string; required: boolean; desc: string }[];
}

const SECTIONS: SpecSection[] = [
  {
    id: "overview", title: "Overview", icon: "📐",
    content: `The Open Agent Governance Standard (OAGS) defines a universal framework for governing AI agents across platforms, vendors, and organizations. It provides a common language for agent registration, event logging, policy enforcement, and compliance reporting.\n\nVersion: ${SPEC_VERSION}\nStatus: Draft Specification\nMaintainer: Velyrion Governance Council`,
  },
  {
    id: "agent_registration", title: "Agent Registration", icon: "🤖",
    content: "Every AI agent MUST be registered with a governance platform before deployment. Registration captures identity, capabilities, constraints, and ownership.",
    fields: [
      { name: "agent_id", type: "string (UUID)", required: true, desc: "Globally unique agent identifier" },
      { name: "agent_name", type: "string", required: true, desc: "Human-readable display name" },
      { name: "organization_id", type: "string", required: true, desc: "Owning organization" },
      { name: "department", type: "string", required: true, desc: "Organizational unit" },
      { name: "allowed_tools", type: "string[]", required: true, desc: "Whitelist of permitted tools/APIs" },
      { name: "max_token_budget", type: "integer", required: true, desc: "Maximum token consumption limit" },
      { name: "data_access_level", type: "enum", required: true, desc: "PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED" },
      { name: "model_version", type: "string", required: false, desc: "Underlying model identifier" },
    ],
  },
  {
    id: "event_logging", title: "Event Logging", icon: "📋",
    content: "Every agent action MUST emit a standardized event. Events form an immutable audit trail for compliance, forensics, and analytics.",
    fields: [
      { name: "event_id", type: "string (UUID)", required: true, desc: "Unique event identifier" },
      { name: "agent_id", type: "string", required: true, desc: "Acting agent reference" },
      { name: "timestamp", type: "ISO 8601", required: true, desc: "UTC timestamp of the action" },
      { name: "task_description", type: "string", required: true, desc: "Human-readable action description" },
      { name: "tool_used", type: "string", required: true, desc: "Tool or API invoked" },
      { name: "risk_level", type: "enum", required: true, desc: "LOW | MEDIUM | HIGH | CRITICAL" },
      { name: "confidence_score", type: "float [0,1]", required: true, desc: "Agent's confidence in the action" },
      { name: "token_cost", type: "integer", required: false, desc: "Tokens consumed" },
      { name: "duration_ms", type: "integer", required: false, desc: "Execution time" },
      { name: "human_in_loop", type: "boolean", required: false, desc: "Whether human approved this action" },
    ],
  },
  {
    id: "policy_engine", title: "Policy Engine", icon: "📜",
    content: "Governance policies MUST be declarative, versioned, and machine-enforceable. Policies define what agents can and cannot do.",
    fields: [
      { name: "policy_id", type: "string", required: true, desc: "Unique policy identifier" },
      { name: "policy_type", type: "enum", required: true, desc: "ALLOW | DENY | RATE_LIMIT | BUDGET | ESCALATE" },
      { name: "scope", type: "enum", required: true, desc: "GLOBAL | ORGANIZATION | DEPARTMENT | AGENT" },
      { name: "conditions", type: "object[]", required: true, desc: "Rule conditions (tool, data_level, cost, etc.)" },
      { name: "action", type: "enum", required: true, desc: "ALLOW | BLOCK | ALERT | KILL | HUMAN_REVIEW" },
    ],
  },
  {
    id: "violation_handling", title: "Violation Handling", icon: "🚨",
    content: "When a policy is violated, the platform MUST create a violation record, execute the response action, and notify relevant stakeholders.",
    fields: [
      { name: "violation_id", type: "string", required: true, desc: "Unique violation identifier" },
      { name: "agent_id", type: "string", required: true, desc: "Violating agent" },
      { name: "violation_type", type: "string", required: true, desc: "Category of violation" },
      { name: "severity", type: "enum", required: true, desc: "LOW | MEDIUM | HIGH | CRITICAL" },
      { name: "response_action", type: "enum", required: true, desc: "Action taken: ALERT | BLOCK | KILL | ESCALATE" },
      { name: "resolved", type: "boolean", required: true, desc: "Whether violation has been resolved" },
    ],
  },
  {
    id: "governance_score", title: "Governance Score", icon: "📊",
    content: "Every agent MUST have a computed Governance Score between 0-100 based on compliance, cost efficiency, reliability, risk profile, and track record. Scores enable certification, insurance, and trust decisions.",
  },
  {
    id: "interop", title: "Interoperability", icon: "🔗",
    content: "OAGS-compliant platforms MUST expose standard REST APIs for agent registration, event ingestion, and policy management. WebSocket support is RECOMMENDED for real-time event streaming.\n\nEndpoints:\n• POST /oags/v1/agents — Register agent\n• POST /oags/v1/events — Log event\n• GET /oags/v1/agents/{id}/score — Get governance score\n• GET /oags/v1/violations — List violations\n• WS /oags/v1/stream — Real-time event stream",
  },
];

export default function OAGSPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const selected = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];

  return (
    <div className="oags-page">
      <div className="oags-header">
        <div>
          <h1 className="lb-title">📐 Open Agent Governance Standard</h1>
          <p className="lb-subtitle">OAGS v{SPEC_VERSION} — The universal specification for AI agent governance</p>
        </div>
        <div className="oags-version-badge">v{SPEC_VERSION} Draft</div>
      </div>

      <div className="oags-main">
        {/* Spec TOC */}
        <div className="oags-toc">
          <div className="fr-sidebar-header"><span className="an-chart-title" style={{ margin: 0 }}>Specification</span></div>
          <div className="oags-toc-list">
            {SECTIONS.map((s, i) => (
              <button key={s.id} className={`oags-toc-item ${activeSection === s.id ? "active" : ""}`} onClick={() => setActiveSection(s.id)}>
                <span className="oags-toc-num">{i + 1}</span>
                <span>{s.icon} {s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Spec Content */}
        <div className="oags-content">
          <div className="oags-section-header">
            <span style={{ fontSize: 28 }}>{selected.icon}</span>
            <h2 className="oags-section-title">{selected.title}</h2>
          </div>
          <div className="oags-section-body">
            {selected.content.split("\n").map((line, i) => (
              <p key={i} className="oags-paragraph">{line}</p>
            ))}
          </div>
          {selected.fields && (
            <div className="oags-fields">
              <h3 className="an-chart-title">Schema Definition</h3>
              <div className="cn-fields-grid">
                {selected.fields.map(f => (
                  <div key={f.name} className="cn-field">
                    <div className="cn-field-header">
                      <span className="cn-field-name">{f.name}</span>
                      <span className="cn-field-type">{f.type}</span>
                      <span className={f.required ? "cn-field-req" : "cn-field-opt"}>{f.required ? "required" : "optional"}</span>
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
