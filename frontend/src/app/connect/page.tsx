"use client";
import { useState } from "react";
import {
  Terminal,
  Cpu,
  Bot,
  Zap,
  Code,
  ShieldCheck,
  Check,
  Copy,
  Globe,
  Webhook as WebhookIcon,
  Layers,
  Sparkles
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

interface Platform {
  name: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  level: "Code" | "No-Code" | "Any";
  color: string;
  description: string;
  code: string;
}

const PLATFORMS: Platform[] = [
  {
    name: "Python SDK",
    icon: Code,
    level: "Code",
    color: "#38bdf8",
    description: "Native runtime governance with deterministic kill switch, policy engine, and async streaming.",
    code: `pip install velyrion

from velyrion import Velyrion

v = Velyrion(api_url="${API_BASE}")
v.wrap(agent, agent_id="my-agent")

# Every agent tool execution and completion is now strictly governed`,
  },
  {
    name: "OpenAI",
    icon: Sparkles,
    level: "Code",
    color: "#10b981",
    description: "Wrap standard OpenAI client to monitor completions, token budgets, and cost ceilings.",
    code: `from openai import OpenAI
from velyrion import Velyrion

client = OpenAI()
v = Velyrion(api_url="${API_BASE}")
v.wrap(client, agent_id="openai-agent")

# Every chat completion is now audited against policies
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Analyze telemetry"}]
)`,
  },
  {
    name: "Anthropic",
    icon: Bot,
    level: "Code",
    color: "#f59e0b",
    description: "Intercept Claude Messages API with real-time prompt firewall and boundary checks.",
    code: `from anthropic import Anthropic
from velyrion import Velyrion

client = Anthropic()
v = Velyrion(api_url="${API_BASE}")
v.wrap(client, agent_id="claude-agent")

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Summarize financial risk"}]
)`,
  },
  {
    name: "LangChain",
    icon: Layers,
    level: "Code",
    color: "#a78bfa",
    description: "Full governance hook for LangChain agent executors, custom tools, and vector chains.",
    code: `from langchain.agents import AgentExecutor
from velyrion import Velyrion

agent = AgentExecutor(agent=my_agent, tools=tools)
v = Velyrion(api_url="${API_BASE}")
v.wrap(agent, agent_id="langchain-agent")

result = agent.invoke({"input": "Perform database audit"})`,
  },
  {
    name: "n8n Workflow",
    icon: Zap,
    level: "No-Code",
    color: "#ea4b71",
    description: "Insert an HTTP Request node into any n8n workflow for automated compliance logging.",
    code: `// Add an HTTP Request node after your AI agent node:
//
// Method: POST
// URL: ${API_BASE}/api/agent/event
// Headers: Content-Type: application/json
// Body (JSON):
{
  "agent_id": "n8n-workflow-001",
  "task_description": "{{$json.task}}",
  "tool_used": "n8n_{{$node.name}}",
  "token_cost": 0,
  "output_data": "{{$json.output}}"
}`,
  },
  {
    name: "Make.com",
    icon: Cpu,
    level: "No-Code",
    color: "#8b5cf6",
    description: "Add an HTTP module in your Make scenario to stream governed execution events.",
    code: `// Add an HTTP "Make a request" module:
//
// URL: ${API_BASE}/api/agent/event
// Method: POST
// Body type: JSON
// Request content:
{
  "agent_id": "make-scenario-001",
  "task_description": "{{1.task}}",
  "tool_used": "make_module",
  "token_cost": 0
}`,
  },
  {
    name: "REST API",
    icon: Globe,
    level: "Any",
    color: "#3b82f6",
    description: "Universal REST endpoint — compatible with any language, framework, or orchestrator.",
    code: `curl -X POST ${API_BASE}/api/agent/event \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "my-agent-001",
    "task_description": "Process customer payment verification",
    "tool_used": "payment_gateway",
    "token_cost": 250,
    "confidence_score": 0.98,
    "compute_cost_usd": 0.003
  }'`,
  },
  {
    name: "Outbound Webhook",
    icon: WebhookIcon,
    level: "Any",
    color: "#f97316",
    description: "Fire-and-forget JSON POST from Zapier, webhook relays, or edge serverless workers.",
    code: `// From any HTTP client or webhook trigger, POST to:
// ${API_BASE}/api/agent/event
//
// Required fields:
//   agent_id (string) — registered agent identifier
//   task_description (string) — operation performed
//   tool_used (string) — tool or service invoked
//
// Optional fields:
//   token_cost (int) — tokens consumed
//   compute_cost_usd (float) — cost in USD
//   confidence_score (float) — 0.0 to 1.0`,
  },
];

export default function ConnectPage() {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState("All");
  const [copied, setCopied] = useState(false);

  const filteredPlatforms = filter === "All" ? PLATFORMS : PLATFORMS.filter(p => p.level === filter);

  const copyCode = () => {
    navigator.clipboard.writeText(PLATFORMS[selected].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SelectedIcon = PLATFORMS[selected].icon;

  return (
    <div className="cn-page">
      <div className="cn-header">
        <div>
          <h1 className="cn-title">Universal Agent Connector</h1>
          <p className="cn-subtitle">Integrate any AI agent runtime — from visual automation workflows to Python SDK and REST APIs</p>
        </div>
      </div>

      {/* Filter */}
      <div className="cn-filters">
        {["All", "Code", "No-Code", "Any"].map(f => (
          <button
            key={f}
            className={`cn-filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => {
              setFilter(f);
              setSelected(0);
            }}
          >
            {f === "All" ? "All Integrations" : f === "Code" ? "Code SDKs" : f === "No-Code" ? "No-Code Platforms" : "Universal APIs"}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="cn-main">
        {/* Platform List */}
        <div className="cn-platform-list">
          {filteredPlatforms.map((p, i) => {
            const Icon = p.icon;
            const isSel = selected === PLATFORMS.indexOf(p);
            return (
              <button
                key={p.name}
                className={`cn-platform-card ${isSel ? "active" : ""}`}
                onClick={() => setSelected(PLATFORMS.indexOf(p))}
              >
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon style={{ width: 16, height: 16, color: p.color }} />
                </div>
                <div className="cn-platform-info">
                  <span className="cn-platform-name">{p.name}</span>
                  <span className="cn-platform-level" style={{ color: p.color }}>{p.level}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Code Viewer */}
        <div className="cn-code-panel">
          <div className="cn-code-top">
            <div>
              <div className="cn-code-platform-name" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SelectedIcon style={{ width: 22, height: 22, color: PLATFORMS[selected].color }} />
                <span>{PLATFORMS[selected].name}</span>
              </div>
              <p className="cn-code-desc">{PLATFORMS[selected].description}</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={copyCode}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
            >
              {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              <span>{copied ? "Copied!" : "Copy Snippet"}</span>
            </button>
          </div>
          <div className="lp-code-block" style={{ borderRadius: 12 }}>
            <div className="lp-code-header">
              <span className="lp-code-dots"><span /><span /><span /></span>
              <span className="lp-code-filename">{PLATFORMS[selected].name} Setup</span>
            </div>
            <pre className="lp-code-content"><code>{PLATFORMS[selected].code}</code></pre>
          </div>
        </div>
      </div>

      {/* API Reference */}
      <div className="cn-api-ref">
        <h2 className="cn-section-title">Telemetry Ingestion Endpoint</h2>
        <div className="cn-endpoint-card">
          <div className="cn-endpoint-method">POST</div>
          <code className="cn-endpoint-url">{API_BASE}/api/agent/event</code>
        </div>
        <div className="cn-fields-grid">
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">agent_id</span>
              <span className="cn-field-type">string</span>
              <span className="cn-field-req">required</span>
            </div>
            <p className="cn-field-desc">Unique identifier for your registered agent</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">task_description</span>
              <span className="cn-field-type">string</span>
              <span className="cn-field-req">required</span>
            </div>
            <p className="cn-field-desc">Semantic description of the autonomous action</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">tool_used</span>
              <span className="cn-field-type">string</span>
              <span className="cn-field-req">required</span>
            </div>
            <p className="cn-field-desc">API or tool invoked during execution</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">token_cost</span>
              <span className="cn-field-type">integer</span>
              <span className="cn-field-opt">optional</span>
            </div>
            <p className="cn-field-desc">Total prompt and completion tokens consumed</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">compute_cost_usd</span>
              <span className="cn-field-type">float</span>
              <span className="cn-field-opt">optional</span>
            </div>
            <p className="cn-field-desc">Incurred inference cost in USD</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header">
              <span className="cn-field-name">confidence_score</span>
              <span className="cn-field-type">float</span>
              <span className="cn-field-opt">optional</span>
            </div>
            <p className="cn-field-desc">Agent self-reported confidence metric (0.0 to 1.0)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
