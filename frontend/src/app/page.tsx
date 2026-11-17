"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Shield,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Crosshair,
  ShieldCheck,
  Scale,
  Layers,
  Coins,
  Lock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Terminal,
  Server,
  Zap,
  Check,
} from "lucide-react";

/* ── Animated Counter ── */
function Counter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span ref={ref}>{val.toLocaleString("en-US")}{suffix}</span>;
}

/* ── Interactive Simulator Scenarios ── */
const SIMULATOR_SCENARIOS = [
  {
    id: "exfiltration",
    title: "1. Data Egress Boundary",
    agentName: "sales-outreach-agent-04",
    framework: "LangChain / GPT-4o",
    attemptedAction: "Export CRM Customer Records",
    payload: `// Agent emitted tool call:
{
  "tool": "export_customers_s3",
  "parameters": {
    "filter": "status == 'ACTIVE'",
    "include_fields": ["email", "credit_card_last4", "phone"],
    "destination": "s3://unverified-external-bucket/dump.csv"
  }
}`,
    policyRule: "POL-042: Cross-Zone Data Egress Restriction",
    status: "BLOCKED",
    badgeClass: "blocked",
    latency: "12ms",
    verdictMessage: "Action Intercepted & Terminated. Egress target 'unverified-external-bucket' is not in corporate whitelist.",
    preventedImpact: "Prevented unauthorized exfiltration of 14,200 customer PII records.",
  },
  {
    id: "mutation",
    title: "2. Destructive DB Mutation",
    agentName: "db-maintenance-agent",
    framework: "CrewAI / Claude 3.5 Sonnet",
    attemptedAction: "Execute Schema Modification",
    payload: `// Agent emitted SQL execution:
{
  "tool": "postgres_executor",
  "query": "DROP TABLE production_transfers_audit_v2 CASCADE;",
  "reason": "Optimize index storage for Q3 archiving"
}`,
    policyRule: "POL-009: Strict Schema Immutability Gate",
    status: "PAUSED (HITL)",
    badgeClass: "hitl",
    latency: "14ms",
    verdictMessage: "Execution Halted. Mutation flagged as CRITICAL. Dispatched to #secops Slack channel with 1-click Approve / Reject.",
    preventedImpact: "Prevented unrecoverable deletion of core production transaction ledger.",
  },
  {
    id: "runaway",
    title: "3. Runaway Loop & Spend Cap",
    agentName: "research-deep-indexer",
    framework: "AutoGen / Llama 3",
    attemptedAction: "Recursive Sub-Agent Spawning",
    payload: `// Agent entering recursive iteration #420:
{
  "tool": "spawn_child_agents",
  "sub_agents_active": 128,
  "tokens_consumed_5min": 14500000,
  "velocity_usd_per_min": 85.50
}`,
    policyRule: "POL-018: Token Velocity & Spend Circuit Breaker",
    status: "AUTO-QUARANTINED",
    badgeClass: "quarantined",
    latency: "9ms",
    verdictMessage: "Agent Process Frozen via Kill Switch. Snapshot captured for forensic replay. Budget limit enforced.",
    preventedImpact: "Capped runaway spend at $50 budget limit, saving estimated $8,400 in runaway API tokens.",
  },
];

/* ── The 4 Critical Business Questions ── */
const BUSINESS_PROBLEMS = [
  {
    icon: ShieldAlertIcon,
    role: "Chief Information Security Officer (CISO)",
    question: "What if an autonomous agent takes an irreversible or destructive production action?",
    solution: "VELYRION acts as an inline zero-trust proxy. Before any tool call, API request, or database query executes, our policy engine validates permissions and parameter boundaries in <15ms. Destructive commands are blocked or paused for human approval.",
    metricValue: "100%",
    metricLabel: "Pre-execution validation",
  },
  {
    icon: Scale,
    role: "Head of Compliance & Legal",
    question: "How do we prove to EU AI Act regulators and SOC2 auditors that our agents are safe?",
    solution: "Every prompt, tool payload, output, and token expenditure is immutably logged into a SHA-256 cryptographically chained audit ledger. Generate 1-click compliance packs mapped directly to EU AI Act Articles 14 & 15, SOC2 CC6.1, and HIPAA.",
    metricValue: "1-Click",
    metricLabel: "Audit Report Generation",
  },
  {
    icon: Layers,
    role: "VP of Engineering & Platform",
    question: "We run 40+ agents across LangChain, CrewAI, and OpenAI — how do we govern them without rewriting code?",
    solution: "Our Universal SDK and reverse proxy let you wrap any Python or Node agent in exactly 1 line of code. Connect n8n, LangGraph, or custom agent scripts with zero architectural disruption.",
    metricValue: "1 Line",
    metricLabel: "SDK Integration Effort",
  },
  {
    icon: Coins,
    role: "Chief Financial Officer (CFO)",
    question: "How do we eliminate surprise runaway token bills and measure ROI across our agent fleet?",
    solution: "Real-time token velocity monitoring detects infinite loops and runaway agent chains instantly. Hard budget caps auto-quarantine misbehaving agents before bills escalate, with per-department spend attribution.",
    metricValue: "0 Spikes",
    metricLabel: "Uncapped Budget Overruns",
  },
];

function ShieldAlertIcon(props: { style?: React.CSSProperties }) {
  return <AlertOctagon {...props} />;
}

/* ── Framework Logos ── */
const FRAMEWORKS = [
  { name: "OpenAI", color: "#10a37f" },
  { name: "Anthropic", color: "#d4a574" },
  { name: "Google Gemini", color: "#4285f4" },
  { name: "AWS Bedrock", color: "#ff9900" },
  { name: "Azure OpenAI", color: "#0078d4" },
  { name: "Vertex AI", color: "#4285f4" },
  { name: "LangChain", color: "#1c3c3c" },
  { name: "LangGraph", color: "#1c3c3c" },
  { name: "CrewAI", color: "#ff6b35" },
  { name: "AutoGen", color: "#0078d4" },
  { name: "LlamaIndex", color: "#8b5cf6" },
  { name: "Mistral", color: "#ff7000" },
  { name: "Cohere", color: "#39594d" },
  { name: "Ollama", color: "#ffffff" },
  { name: "HuggingFace", color: "#ffd21e" },
  { name: "PydanticAI", color: "#e92063" },
  { name: "n8n", color: "#ea4b71" },
];

/* ── Code Snippets ── */
const CODE_TABS = [
  {
    label: "Python SDK",
    code: `from velyrion import Velyrion

# Initialize control plane
v = Velyrion(api_url="https://velyrion.onrender.com", api_key="vlr_sk_...")

# Wrap ANY agent — governance in 1 line
v.wrap(agent, agent_id="agent-001")

# Every tool call is now validated against policies before execution`,
  },
  {
    label: "TypeScript / Node",
    code: `import { Velyrion } from "@velyrion/sdk";

const v = new Velyrion({ apiKey: process.env.VELYRION_API_KEY });

// Attach runtime proxy to your agent executor
const guardedAgent = v.guard(myAgent, { agentId: "agent-001" });
await guardedAgent.run(prompt);`,
  },
  {
    label: "REST API Proxy",
    code: `curl -X POST https://velyrion.onrender.com/api/agent/event \\
  -H "Authorization: Bearer vlr_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent-001",
    "task_description": "Execute database query",
    "tool_used": "postgres_executor",
    "parameters": {"sql": "SELECT count(*) FROM users"}
  }'`,
  },
  {
    label: "n8n / Webhook",
    code: `// In n8n, add an HTTP Request node before critical actions:
// Method: POST
// URL: https://velyrion.onrender.com/api/agent/event
// Header: Authorization: Bearer {{$env.VELYRION_KEY}}
{
  "agent_id": "n8n-workflow-001",
  "task_description": "{{$json.task}}",
  "tool_used": "n8n_node",
  "token_cost": 0
}`,
  },
];

/* ── Regulatory Matrix ── */
const REGULATORY_ITEMS = [
  {
    reg: "EU AI Act 2025/2026",
    clause: "Article 14 & 15",
    desc: "Mandatory human oversight, technical robustness, cybersecurity, and continuous event logging for high-risk AI systems.",
    status: "Fully Compliant",
  },
  {
    reg: "SOC2 Type II",
    clause: "CC6.1 - CC6.8",
    desc: "Logical access control, principle of least privilege, and tamper-evident audit logging of all automated system modifications.",
    status: "Audit Ready",
  },
  {
    reg: "HIPAA Security Rule",
    clause: "45 CFR § 164.312",
    desc: "Automatic PII/PHI redaction, end-to-end encrypted payload capture, and immutable audit trails for healthcare agent workflows.",
    status: "Guardrail Enforced",
  },
  {
    reg: "GDPR Article 22",
    clause: "Automated Decisions",
    desc: "Right to human intervention and transparent algorithmic decision trails for fully automated customer-facing agents.",
    status: "HITL Integrated",
  },
];

/* ── Pricing Tiers ── */
const PRICING = [
  {
    name: "Starter", price: "$0", period: "forever", agents: "Up to 5 agents",
    desc: "For developer teams piloting autonomous agents in staging environments.",
    features: ["Audit logging & immutable trail", "Anomaly detection & kill switches", "Mission Control dashboard", "Community support & API access"],
    popular: false, cta: "Get Started Free",
  },
  {
    name: "Pro", price: "$49", period: "/month", agents: "Up to 50 agents",
    desc: "For fast-growing companies deploying production agents into real workflows.",
    features: ["Everything in Starter", "Automated compliance reports (EU AI Act)", "Slack & PagerDuty webhook alerts", "Human-in-the-Loop approval gateway", "Priority engineering support"],
    popular: true, cta: "Start Free Trial",
  },
  {
    name: "Enterprise", price: "Custom", period: "", agents: "Unlimited agents",
    desc: "For enterprise security & risk teams requiring dedicated infrastructure & SLAs.",
    features: ["Everything in Pro", "Dedicated 99.99% uptime SLA", "Private Cloud / On-Prem VPC Deployment", "SSO, SAML & Custom RBAC", "Custom policy engine integrations"],
    popular: false, cta: "Contact Sales",
  },
];

/* ── FAQ Items ── */
const FAQ_ITEMS = [
  {
    q: "Does VELYRION introduce latency into our agent workflows?",
    a: "No. Velyrion's evaluation engine is built in high-performance asynchronous architecture. Real-time deterministic policy checks execute in under 15ms, which is completely imperceptible to users or streaming LLM completions.",
  },
  {
    q: "Does VELYRION read or store our proprietary customer data?",
    a: "Velyrion operates under a zero-retention data privacy architecture. Sensitive tool payloads can be masked on-the-fly, and only cryptographically hashed metadata is stored in the audit ledger unless explicit enterprise full-trace retention is enabled.",
  },
  {
    q: "Can we deploy VELYRION entirely inside our own private cloud / VPC?",
    a: "Yes. Enterprise customers can deploy Velyrion via our production Docker containers or Kubernetes Helm charts within their own AWS, Azure, or GCP private VPC with zero data leaving their security perimeter.",
  },
  {
    q: "What happens if an agent exceeds its budget or triggers a critical security policy?",
    a: "Velyrion executes an automated 5-step containment response: (1) Instantly halt agent execution, (2) Snapshot execution state, (3) Quarantine agent from emitting future actions, (4) Alert SecOps team via Slack/PagerDuty, and (5) Record immutable incident report.",
  },
  {
    q: "How is VELYRION different from general observability tools like LangSmith or Datadog?",
    a: "Observability tools only tell you what happened after an agent failed or leaked data. VELYRION is an active runtime control plane with pre-execution circuit breakers that intercept and block unauthorized actions before they touch your production database or APIs.",
  },
];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const curScenario = SIMULATOR_SCENARIOS[selectedScenario];

  return (
    <div className="landing">
      {/* ── Navbar ── */}
      <nav
        className="landing-nav"
        style={{
          backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
          background: scrollY > 50 ? "rgba(9, 10, 15, 0.9)" : "transparent",
          borderBottom: scrollY > 50 ? "1px solid var(--border-subtle)" : "1px solid transparent",
        }}
      >
        <div className="landing-nav-inner">
          <div className="landing-logo">VELYRION</div>
          <div className="landing-nav-links">
            <a href="#simulator">Live Simulator</a>
            <a href="#problems">Enterprise Questions</a>
            <a href="#architecture">Architecture</a>
            <a href="#compliance">EU AI Act</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login" className="btn btn-ghost" style={{ padding: "8px 16px" }}>Sign In</Link>
            <Link
              href="/dashboard"
              className="btn btn-primary"
              style={{ padding: "8px 20px", color: "#ffffff", fontWeight: 700, letterSpacing: "0.3px" }}
            >
              Launch Console →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck style={{ width: 14, height: 14, color: "#60a5fa" }} />
            RUNTIME DEFENSE & AUDIT INTELLIGENCE FOR AI AGENTS
          </div>
          <h1 className="hero-title">
            The Real-Time Control Plane for<br />
            <span className="hero-gradient-text">Autonomous AI Agents.</span>
          </h1>
          <p className="hero-subtitle">
            Prevent rogue actions, enforce zero-trust tool permissions, and automate EU AI Act & SOC2 compliance across your entire AI fleet — in real time.
          </p>
          <div className="hero-cta-group">
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Launch Live Console →
            </Link>
            <a href="#simulator" className="btn btn-ghost btn-lg">
              Inspect Live Simulator ↓
            </a>
          </div>

          {/* ── Value Proof Bar ── */}
          <div className="hero-stats-row">
            <div className="hero-stat">
              <div className="hero-stat-value">&lt; 15ms</div>
              <div className="hero-stat-label">Evaluation Latency</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Immutable Audit Trail</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">0 Breaches</div>
              <div className="hero-stat-label">Zero-Trust Guardrails</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">21+</div>
              <div className="hero-stat-label">Frameworks Supported</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Live Interception Simulator ── */}
      <section className="landing-section" id="simulator" style={{ paddingTop: 20 }}>
        <div className="section-heading">
          <span className="section-tag">Interactive Runtime Defense</span>
          <h2>See How Velyrion Intercepts Rogue Actions in Real Time</h2>
          <p>
            Choose a critical enterprise failure mode below to see how our runtime proxy evaluates policies, halts unauthorized mutations, and dispatches human approvals.
          </p>
        </div>

        <div className="sim-container">
          {/* Tab Selector */}
          <div className="sim-nav">
            {SIMULATOR_SCENARIOS.map((s, idx) => (
              <button
                key={s.id}
                className={`sim-tab ${selectedScenario === idx ? "active" : ""}`}
                onClick={() => setSelectedScenario(idx)}
              >
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Split Pane: Agent Payload vs Velyrion Verdict */}
          <div className="sim-grid">
            {/* Left: Agent Payload */}
            <div className="sim-pane left">
              <div className="sim-pane-header">
                <span className="sim-pane-title">Agent Tool Execution Payload</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {curScenario.framework}
                </span>
              </div>
              <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                Agent: <strong style={{ color: "var(--text-primary)" }}>{curScenario.agentName}</strong> · Action: <span style={{ color: "var(--accent-yellow)" }}>{curScenario.attemptedAction}</span>
              </div>
              <pre className="sim-code-box"><code>{curScenario.payload}</code></pre>
            </div>

            {/* Right: Velyrion Interception Verdict */}
            <div className="sim-pane">
              <div className="sim-pane-header">
                <span className="sim-pane-title">Velyrion Runtime Guardrail</span>
                <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 600 }}>
                  Latency: {curScenario.latency}
                </span>
              </div>

              <div className="sim-verdict-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={`sim-status-badge ${curScenario.badgeClass}`}>
                    ● {curScenario.status}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Policy Rule: {curScenario.policyRule}</span>
                </div>

                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  {curScenario.verdictMessage}
                </div>

                <div style={{ padding: "10px 14px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 6, fontSize: 12, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span><strong>Business Protection:</strong> {curScenario.preventedImpact}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The 4 Critical Business Questions ── */}
      <section className="landing-section" id="problems">
        <div className="section-heading">
          <span className="section-tag">Executive Problem-Solution Matrix</span>
          <h2>The 4 Critical Questions Every Enterprise Buyer Asks</h2>
          <p>
            Whether you are the CISO, Head of AI, Compliance Director, or VP of Engineering — here is how Velyrion protects your business.
          </p>
        </div>

        <div className="bproblem-grid">
          {BUSINESS_PROBLEMS.map((bp, i) => {
            const Icon = bp.icon;
            return (
              <div key={i} className="bproblem-card">
                <div className="bproblem-header">
                  <div className="bproblem-icon-wrap">
                    <Icon style={{ width: 18, height: 18 }} />
                  </div>
                  <span className="bproblem-role">{bp.role}</span>
                </div>

                <h3 className="bproblem-q">“{bp.question}”</h3>
                <p className="bproblem-a">{bp.solution}</p>

                <div className="bproblem-metrics">
                  <div className="bproblem-metric-item">
                    <span className="bproblem-metric-val">{bp.metricValue}</span>
                    <span className="bproblem-metric-lbl">{bp.metricLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Architecture Blueprint ── */}
      <section className="landing-section" id="architecture" style={{ background: "rgba(17, 24, 39, 0.4)" }}>
        <div className="section-heading">
          <span className="section-tag">Enterprise Architecture</span>
          <h2>Zero-Trust Runtime Defense Layer</h2>
          <p>How Velyrion integrates seamlessly between your agents and your production infrastructure.</p>
        </div>

        <div className="arch-container">
          <div className="arch-flow">
            {/* Column 1: Agents */}
            <div className="arch-col">
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                1. Your Fleet
              </div>
              <div className="arch-box">
                <div className="arch-box-title">LangChain & LangGraph</div>
                <div className="arch-box-sub">Multi-Agent State Machines</div>
              </div>
              <div className="arch-box">
                <div className="arch-box-title">CrewAI & AutoGen</div>
                <div className="arch-box-sub">Collaborative Agent Swarms</div>
              </div>
              <div className="arch-box">
                <div className="arch-box-title">OpenAI & Custom SDKs</div>
                <div className="arch-box-sub">Direct LLM Tool Calls</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="arch-arrow">→</div>

            {/* Column 2: Velyrion Gateway */}
            <div className="arch-col">
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", textTransform: "uppercase", marginBottom: 4 }}>
                2. VELYRION Control Plane (&lt; 15ms)
              </div>
              <div className="arch-box core">
                <div className="arch-box-title">Deterministic Policy Engine</div>
                <div className="arch-box-sub">RBAC · Parameter Boundaries · Tool Restrictions</div>
              </div>
              <div className="arch-box core">
                <div className="arch-box-title">Anomaly Circuit Breakers</div>
                <div className="arch-box-sub">Spend Spikes · Recursive Loops · Duration Spikes</div>
              </div>
              <div className="arch-box core">
                <div className="arch-box-title">Cryptographic Audit Ledger</div>
                <div className="arch-box-sub">SHA-256 Append-Only Immutable Logging</div>
              </div>
              <div className="arch-box core">
                <div className="arch-box-title">Human-in-the-Loop Gateway</div>
                <div className="arch-box-sub">1-Click Slack / Webhook Authorization</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="arch-arrow">→</div>

            {/* Column 3: Production APIs */}
            <div className="arch-col">
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-green)", textTransform: "uppercase", marginBottom: 4 }}>
                3. Safe Execution
              </div>
              <div className="arch-box">
                <div className="arch-box-title">Production Databases</div>
                <div className="arch-box-sub">PostgreSQL · MongoDB · Snowflake</div>
              </div>
              <div className="arch-box">
                <div className="arch-box-title">Payment & SaaS APIs</div>
                <div className="arch-box-sub">Stripe · GitHub · Salesforce · AWS</div>
              </div>
              <div className="arch-box">
                <div className="arch-box-title">Incident War Room</div>
                <div className="arch-box-sub">Automated Quarantine on Breach</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Framework Logos ── */}
      <section className="landing-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <p className="logos-label">Compatible with every enterprise framework, model provider, and workflow orchestrator</p>
        <div className="logos-row">
          {FRAMEWORKS.map(f => (
            <div key={f.name} className="logo-chip" style={{ borderColor: `${f.color}40` }}>
              {f.name}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
          <div className="trust-shield">End-to-End Encrypted</div>
          <div className="trust-shield">SOC2 Type II Aligned</div>
          <div className="trust-shield">EU AI Act Ready</div>
          <div className="trust-shield">ISO 42001 Standard</div>
        </div>
      </section>

      {/* ── Integration / How It Works ── */}
      <section className="landing-section" id="integration" style={{ background: "rgba(17, 24, 39, 0.4)" }}>
        <div className="section-heading">
          <span className="section-tag">Zero-Friction Integration</span>
          <h2>Governance in Exactly One Line of Code</h2>
          <p>Python SDK, Node.js, REST API, or Webhooks — protect any agent in under 60 seconds.</p>
        </div>
        <div className="lp-code-section">
          <div className="lp-code-tabs">
            {CODE_TABS.map((tab, i) => (
              <button
                key={i}
                className={`lp-code-tab ${activeTab === i ? "active" : ""}`}
                onClick={() => setActiveTab(i)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="lp-code-block">
            <div className="lp-code-header">
              <span className="lp-code-dots"><span /><span /><span /></span>
              <span className="lp-code-filename">{CODE_TABS[activeTab].label}</span>
            </div>
            <pre className="lp-code-content"><code>{CODE_TABS[activeTab].code}</code></pre>
          </div>
        </div>

        <div className="steps-row" style={{ marginTop: 48 }}>
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Install SDK</h3>
            <p><code style={{ background: "rgba(59,130,246,0.15)", padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>pip install velyrion</code></p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Wrap Agent</h3>
            <p>One line: <code style={{ background: "rgba(59,130,246,0.15)", padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>v.wrap(agent)</code></p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Monitor Live</h3>
            <p>Every tool execution is evaluated, guarded, and immutably logged.</p>
          </div>
        </div>
      </section>

      {/* ── Regulatory Compliance Matrix ── */}
      <section className="landing-section" id="compliance">
        <div className="section-heading">
          <span className="section-tag">Automated Compliance</span>
          <h2>Mapped Directly to Major AI Regulations</h2>
          <p>VELYRION automates the documentation, human oversight, and audit logging required by law.</p>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {REGULATORY_ITEMS.map((item, idx) => (
            <div key={idx} className="bproblem-card" style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{item.reg}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(16, 185, 129, 0.15)", color: "var(--accent-green)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  {item.status}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-blue)", marginBottom: 6 }}>
                Clause: {item.clause}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="landing-section" id="pricing" style={{ background: "rgba(17, 24, 39, 0.4)" }}>
        <div className="section-heading">
          <span className="section-tag">Predictable ROI</span>
          <h2>Start Free, Scale as Your Fleet Expands</h2>
          <p>Transparent pricing. No hidden fees. Deploy in production within minutes.</p>
        </div>
        <div className="pricing-grid">
          {PRICING.map((p, i) => (
            <div key={i} className={`pricing-card ${p.popular ? "pricing-popular" : ""}`}>
              {p.popular && <div className="pricing-badge">Most Popular</div>}
              <h3>{p.name}</h3>
              <div className="pricing-price">
                <span className="pricing-amount">{p.price}</span>
                <span className="pricing-period">{p.period}</span>
              </div>
              <div className="pricing-agents">{p.agents}</div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{p.desc}</p>
              <ul className="pricing-features">
                {p.features.map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <Link
                href={p.name === "Enterprise" ? "mailto:contact@velyrion.com" : "/signup"}
                className={`btn ${p.popular ? "btn-primary" : "btn-ghost"} btn-lg`}
                style={{ width: "100%", textAlign: "center", marginTop: "auto" }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Enterprise FAQ ── */}
      <section className="landing-section" id="faq">
        <div className="section-heading">
          <span className="section-tag">Frequently Asked Questions</span>
          <h2>Everything You Need to Know Before Deploying</h2>
          <p>Common questions from engineering leads, CISOs, and enterprise architects.</p>
        </div>

        <div className="faq-grid">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                >
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                </button>
                {isOpen && (
                  <div className="faq-answer">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section landing-cta-section">
        <h2>Ready to Govern Your Autonomous AI Agents?</h2>
        <p>Deploy in 60 seconds with 1 line of code. Total visibility, zero rogue actions.</p>
        <div className="hero-cta-group">
          <Link href="/signup" className="btn btn-primary btn-lg">Get Started Free →</Link>
          <Link href="/dashboard" className="btn btn-ghost btn-lg">Open Live Console</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div>
            <div className="landing-logo" style={{ marginBottom: 8 }}>VELYRION</div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 280 }}>
              The real-time control plane and safety perimeter for enterprise autonomous AI agents.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#simulator">Live Simulator</a>
              <a href="#problems">Enterprise Value</a>
              <a href="#architecture">Architecture</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Platform</h4>
              <Link href="/dashboard">Console</Link>
              <Link href="/mission-control">Mission Control</Link>
              <Link href="/governance-score">Governance Score</Link>
              <Link href="/docs">API Reference</Link>
            </div>
            <div>
              <h4>Compliance</h4>
              <a href="#compliance">EU AI Act</a>
              <a href="#compliance">SOC2 Type II</a>
              <a href="#compliance">HIPAA Guardrails</a>
              <a href="#compliance">GDPR Article 22</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 Velyrion Inc. All rights reserved. · Privacy Policy · Security Center · Terms of Service
        </div>
      </footer>
    </div>
  );
}
