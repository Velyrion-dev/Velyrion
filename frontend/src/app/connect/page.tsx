"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

const PLATFORMS = [
  {
    name: "Python SDK",
    icon: "🐍",
    level: "Code",
    color: "#3776ab",
    description: "Full governance with kill switch, policy engine, and async support.",
    code: `pip install velyrion

from velyrion import Velyrion

v = Velyrion(api_url="${API_BASE}")
v.wrap(agent, agent_id="my-agent")

# That's it — every action is now governed`,
  },
  {
    name: "OpenAI",
    icon: "🤖",
    level: "Code",
    color: "#10a37f",
    description: "Wrap any OpenAI client to monitor completions, tokens, and costs.",
    code: `from openai import OpenAI
from velyrion import Velyrion

client = OpenAI()
v = Velyrion(api_url="${API_BASE}")
v.wrap(client, agent_id="openai-agent")

# Every chat completion is now governed
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello"}]
)`,
  },
  {
    name: "Anthropic",
    icon: "🧠",
    level: "Code",
    color: "#d4a574",
    description: "Monitor Claude API calls with token tracking and cost analysis.",
    code: `from anthropic import Anthropic
from velyrion import Velyrion

client = Anthropic()
v = Velyrion(api_url="${API_BASE}")
v.wrap(client, agent_id="claude-agent")

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    messages=[{"role": "user", "content": "Summarize"}]
)`,
  },
  {
    name: "LangChain",
    icon: "🦜",
    level: "Code",
    color: "#1c3c3c",
    description: "Governance for LangChain agents, chains, and tools.",
    code: `from langchain.agents import AgentExecutor
from velyrion import Velyrion

agent = AgentExecutor(agent=my_agent, tools=tools)
v = Velyrion(api_url="${API_BASE}")
v.wrap(agent, agent_id="langchain-agent")

result = agent.invoke({"input": "Analyze data"})`,
  },
  {
    name: "n8n",
    icon: "⚡",
    level: "No-Code",
    color: "#ea4b71",
    description: "Add an HTTP Request node to any n8n workflow for governance.",
    code: `// Add an HTTP Request node after your AI node:
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
    icon: "🔮",
    level: "No-Code",
    color: "#6d28d9",
    description: "Add an HTTP module in your Make scenario to report events.",
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
    icon: "🌐",
    level: "Any",
    color: "#3b82f6",
    description: "Universal HTTP endpoint — works with any language or platform.",
    code: `curl -X POST ${API_BASE}/api/agent/event \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "my-agent-001",
    "task_description": "Process customer order",
    "tool_used": "order_processor",
    "token_cost": 250,
    "confidence_score": 0.95,
    "compute_cost_usd": 0.003
  }'`,
  },
  {
    name: "Webhook",
    icon: "🔗",
    level: "Any",
    color: "#f59e0b",
    description: "Fire-and-forget POST from any system — Zapier, IFTTT, custom apps.",
    code: `// From any HTTP client, POST to:
// ${API_BASE}/api/agent/event
//
// Required fields:
//   agent_id (string) — your agent identifier
//   task_description (string) — what the agent did
//   tool_used (string) — which tool was used
//
// Optional fields:
//   token_cost (int) — tokens consumed
//   compute_cost_usd (float) — cost in USD
//   confidence_score (float) — 0.0 to 1.0
//   duration_ms (int) — execution time
//   input_data (string) — what was sent
//   output_data (string) — what was returned`,
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

  return (
    <div className="cn-page">
      <div className="cn-header">
        <div>
          <h1 className="cn-title">Universal Agent Connector</h1>
          <p className="cn-subtitle">Connect any AI agent — from simple n8n workflows to enterprise production systems</p>
        </div>
      </div>

      {/* Filter */}
      <div className="cn-filters">
        {["All", "Code", "No-Code", "Any"].map(f => (
          <button key={f} className={`cn-filter-btn ${filter === f ? "active" : ""}`} onClick={() => { setFilter(f); setSelected(0); }}>
            {f === "All" ? "🌍 All" : f === "Code" ? "💻 Code" : f === "No-Code" ? "🎨 No-Code" : "🌐 Universal"}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="cn-main">
        {/* Platform List */}
        <div className="cn-platform-list">
          {filteredPlatforms.map((p, i) => (
            <button
              key={p.name}
              className={`cn-platform-card ${selected === PLATFORMS.indexOf(p) ? "active" : ""}`}
              onClick={() => setSelected(PLATFORMS.indexOf(p))}
            >
              <span className="cn-platform-icon">{p.icon}</span>
              <div className="cn-platform-info">
                <span className="cn-platform-name">{p.name}</span>
                <span className="cn-platform-level" style={{ color: p.color }}>{p.level}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Code Viewer */}
        <div className="cn-code-panel">
          <div className="cn-code-top">
            <div>
              <div className="cn-code-platform-name">
                <span style={{ fontSize: 24 }}>{PLATFORMS[selected].icon}</span>
                {PLATFORMS[selected].name}
              </div>
              <p className="cn-code-desc">{PLATFORMS[selected].description}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={copyCode} style={{ gap: 4, flexShrink: 0 }}>
              {copied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>
          <div className="lp-code-block" style={{ borderRadius: 14 }}>
            <div className="lp-code-header">
              <span className="lp-code-dots"><span /><span /><span /></span>
              <span className="lp-code-filename">{PLATFORMS[selected].name}</span>
            </div>
            <pre className="lp-code-content"><code>{PLATFORMS[selected].code}</code></pre>
          </div>
        </div>
      </div>

      {/* API Reference */}
      <div className="cn-api-ref">
        <h2 className="cn-section-title">API Reference</h2>
        <div className="cn-endpoint-card">
          <div className="cn-endpoint-method">POST</div>
          <code className="cn-endpoint-url">{API_BASE}/api/agent/event</code>
        </div>
        <div className="cn-fields-grid">
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">agent_id</span><span className="cn-field-type">string</span><span className="cn-field-req">required</span></div>
            <p className="cn-field-desc">Unique identifier for your agent</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">task_description</span><span className="cn-field-type">string</span><span className="cn-field-req">required</span></div>
            <p className="cn-field-desc">What the agent did in this action</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">tool_used</span><span className="cn-field-type">string</span><span className="cn-field-req">required</span></div>
            <p className="cn-field-desc">Which tool or API was called</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">token_cost</span><span className="cn-field-type">integer</span><span className="cn-field-opt">optional</span></div>
            <p className="cn-field-desc">Number of tokens consumed</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">compute_cost_usd</span><span className="cn-field-type">float</span><span className="cn-field-opt">optional</span></div>
            <p className="cn-field-desc">Cost in USD for this action</p>
          </div>
          <div className="cn-field">
            <div className="cn-field-header"><span className="cn-field-name">confidence_score</span><span className="cn-field-type">float</span><span className="cn-field-opt">optional</span></div>
            <p className="cn-field-desc">Agent confidence (0.0 - 1.0)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
