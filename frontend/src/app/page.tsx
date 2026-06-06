"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

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

/* ── Feature card data ── */
const FEATURES = [
  {
    icon: "📋", title: "Immutable Audit Trail",
    desc: "Every agent action is logged with full context — timestamp, tool, input, output, cost, and confidence. Append-only. Zero data loss.",
    gradient: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  },
  {
    icon: "🛡️", title: "Permission Engine",
    desc: "Real-time validation against each agent's permission profile. Unauthorized tools, data sources, or budget overruns? Blocked instantly.",
    gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)",
  },
  {
    icon: "⚡", title: "Anomaly Detection",
    desc: "Five detection algorithms monitor duration spikes, API failures, data boundary violations, confidence drops, and cost anomalies.",
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
  },
  {
    icon: "✋", title: "Human-in-the-Loop",
    desc: "Sensitive actions pause automatically for human approval. Deletions, financial transactions, publishing — you stay in control.",
    gradient: "linear-gradient(135deg, #8b5cf6, #ec4899)",
  },
  {
    icon: "🚨", title: "Incident Response",
    desc: "CRITICAL violations trigger an automated 5-step response: kill process → snapshot state → lock agent → alert security → log immutably.",
    gradient: "linear-gradient(135deg, #ef4444, #f97316)",
  },
  {
    icon: "🎯", title: "Mission Control",
    desc: "Real-time NASA-style dashboard with live WebSocket feeds, agent heartbeat monitoring, one-click kill switches, and activity timelines.",
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
  },
];

const FRAMEWORKS = [
  { name: "OpenAI", color: "#10a37f" },
  { name: "Anthropic", color: "#d4a574" },
  { name: "Google Gemini", color: "#4285f4" },
  { name: "LangChain", color: "#1c3c3c" },
  { name: "CrewAI", color: "#ff6b35" },
  { name: "AutoGen", color: "#0078d4" },
  { name: "Mistral", color: "#ff7000" },
  { name: "n8n", color: "#ea4b71" },
];

const CODE_TABS = [
  {
    label: "Python SDK",
    code: `from velyrion import Velyrion

v = Velyrion(api_url="https://velyrion.onrender.com")

# Wrap ANY agent — governance in 1 line
v.wrap(agent, agent_id="agent-001")

# Every action is now logged, evaluated, auditable`,
  },
  {
    label: "REST API",
    code: `curl -X POST https://velyrion.onrender.com/api/agent/event \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent-001",
    "task_description": "Query database",
    "tool_used": "sql_executor",
    "token_cost": 150
  }'`,
  },
  {
    label: "n8n / Webhook",
    code: `// In n8n, add an HTTP Request node:
// Method: POST
// URL: https://velyrion.onrender.com/api/agent/event
// Body:
{
  "agent_id": "n8n-workflow-001",
  "task_description": "{{$json.task}}",
  "tool_used": "n8n_node",
  "token_cost": 0
}`,
  },
];

const PRICING = [
  {
    name: "Starter", price: "Free", period: "", agents: "Up to 5 agents",
    features: ["Audit logging", "Anomaly detection", "Mission Control dashboard", "Community support"],
    popular: false, cta: "Get Started Free",
  },
  {
    name: "Pro", price: "$49", period: "/month", agents: "Up to 50 agents",
    features: ["Everything in Starter", "Compliance reports", "Slack + webhook alerts", "API access", "Priority support"],
    popular: true, cta: "Start Free Trial",
  },
  {
    name: "Enterprise", price: "Custom", period: "", agents: "Unlimited agents",
    features: ["Everything in Pro", "Dedicated SLA", "Custom onboarding", "SSO & SAML", "On-premise option"],
    popular: false, cta: "Contact Sales",
  },
];

const REGULATIONS = ["EU AI Act 2025", "SEC AI Oversight", "HIPAA", "SOC2", "GDPR"];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing">
      {/* ── Navbar ── */}
      <nav className="landing-nav" style={{ backdropFilter: scrollY > 50 ? "blur(20px)" : "none", background: scrollY > 50 ? "rgba(10, 14, 26, 0.85)" : "transparent", borderBottom: scrollY > 50 ? "1px solid rgba(42, 48, 80, 0.5)" : "1px solid transparent" }}>
        <div className="landing-nav-inner">
          <div className="landing-logo">VELYRION</div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#integration">Integration</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login" className="btn btn-ghost" style={{ padding: "8px 16px" }}>Log In</Link>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: "8px 20px", color: "#ffffff", fontWeight: 700, letterSpacing: "0.3px" }}>Open Dashboard →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-badge">🛡️ AI Agent Governance Platform</div>
          <h1 className="hero-title">
            Monitor. Govern.<br />
            <span className="hero-gradient-text">Trust Every Agent.</span>
          </h1>
          <p className="hero-subtitle">
            From simple n8n workflows to enterprise production agents — VELYRION provides real-time monitoring, anomaly detection, kill switches, and compliance reporting for <strong>every AI agent</strong> in your stack.
          </p>
          <div className="hero-cta-group">
            <Link href="/dashboard" className="btn btn-primary btn-lg">Open Live Dashboard →</Link>
            <a href="#integration" className="btn btn-ghost btn-lg">See Integration →</a>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={7} /></div>
              <div className="hero-stat-label">Frameworks</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={1} suffix=" line" /></div>
              <div className="hero-stat-label">To Integrate</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={10} suffix="M+" /></div>
              <div className="hero-stat-label">Events Processed</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={0} suffix=" breaches" /></div>
              <div className="hero-stat-label">Since Launch</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Framework Logos ── */}
      <section className="landing-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <p className="logos-label">Works with every agent framework — from no-code to enterprise</p>
        <div className="logos-row">
          {FRAMEWORKS.map(f => <div key={f.name} className="logo-chip" style={{ borderColor: `${f.color}40` }}>{f.name}</div>)}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section" id="features">
        <div className="section-heading">
          <span className="section-tag">Core Capabilities</span>
          <h2>Everything you need to govern AI agents at scale</h2>
          <p>From audit logging to real-time monitoring — one platform, complete coverage.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon-wrap" style={{ background: f.gradient }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integration / How It Works ── */}
      <section className="landing-section" id="integration" style={{ background: "rgba(17, 24, 39, 0.5)" }}>
        <div className="section-heading">
          <span className="section-tag">Integration</span>
          <h2>Governance in one line of code</h2>
          <p>Python SDK, REST API, or webhook — connect any agent in under 60 seconds.</p>
        </div>
        <div className="lp-code-section">
          <div className="lp-code-tabs">
            {CODE_TABS.map((tab, i) => (
              <button key={i} className={`lp-code-tab ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}>
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
            <p>Open Mission Control and see every action in real-time.</p>
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section className="landing-section" id="compliance">
        <div className="section-heading">
          <span className="section-tag">Regulatory Ready</span>
          <h2>Built for the regulations that matter</h2>
          <p>VELYRION maps directly to the audit and documentation requirements of major AI regulations.</p>
        </div>
        <div className="regulation-grid">
          {REGULATIONS.map(r => (
            <div key={r} className="regulation-card">
              <div className="regulation-check">✓</div>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="landing-section" id="pricing" style={{ background: "rgba(17, 24, 39, 0.5)" }}>
        <div className="section-heading">
          <span className="section-tag">Pricing</span>
          <h2>Start free, scale as you grow</h2>
          <p>No credit card required. Upgrade anytime.</p>
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
              <ul className="pricing-features">
                {p.features.map((f, j) => <li key={j}>✓ {f}</li>)}
              </ul>
              <Link href={p.name === "Enterprise" ? "mailto:contact@velyrion.com" : "/signup"} className={`btn ${p.popular ? "btn-primary" : "btn-ghost"} btn-lg`} style={{ width: "100%", textAlign: "center" }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section landing-cta-section">
        <div className="cta-glow" />
        <h2>Ready to govern your AI agents?</h2>
        <p>Start free. Deploy in 60 seconds. Full governance from day one.</p>
        <div className="hero-cta-group">
          <Link href="/signup" className="btn btn-primary btn-lg">Get Started Free →</Link>
          <Link href="/dashboard" className="btn btn-ghost btn-lg">Open Dashboard</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div>
            <div className="landing-logo" style={{ marginBottom: 8 }}>VELYRION</div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 280 }}>
              The governance layer for autonomous AI agents. Monitor, govern, and trust every agent.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/mission-control">Mission Control</Link>
            </div>
            <div>
              <h4>Developers</h4>
              <a href="#integration">SDK Docs</a>
              <a href="#integration">REST API</a>
              <a href="https://github.com/Velyrion-dev/Velyrion" target="_blank" rel="noopener">GitHub</a>
            </div>
            <div>
              <h4>Compliance</h4>
              <a href="#compliance">EU AI Act</a>
              <a href="#compliance">SOC2</a>
              <a href="#compliance">HIPAA</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          © 2025 Velyrion Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
