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
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
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
    icon: "📊", title: "Compliance Reports",
    desc: "On-demand reports covering violations, costs, agent rankings, and department risk scores. Export as JSON or PDF for auditors.",
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
  },
];

const PRICING = [
  {
    name: "Starter", price: "$500", period: "/month", agents: "Up to 10 agents",
    features: ["Audit logging", "Anomaly detection", "Email alerts", "Basic dashboard"],
    popular: false, cta: "Start Free Trial",
  },
  {
    name: "Business", price: "$2,500", period: "/month", agents: "Up to 100 agents",
    features: ["All Starter features", "Compliance reports (JSON + PDF)", "Slack + webhook alerts", "API access", "Role management"],
    popular: true, cta: "Start Free Trial",
  },
  {
    name: "Enterprise", price: "$15,000", period: "/month", agents: "Unlimited agents",
    features: ["All Business features", "Dedicated SLA", "Custom onboarding", "Security team alerts", "Full incident response"],
    popular: false, cta: "Contact Sales",
  },
];

const LOGOS = ["LangChain", "CrewAI", "AutoGen", "OpenAI", "Anthropic", "Custom LLMs"];
const REGULATIONS = ["EU AI Act 2025", "SEC AI Oversight", "HIPAA", "SOC2", "GDPR"];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
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
            <a href="#pricing">Pricing</a>
            <a href="#compliance">Compliance</a>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: "8px 20px", color: "#ffffff", fontWeight: 700, letterSpacing: "0.3px" }}>Open Dashboard →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-badge">🚀 The Governance Layer for Autonomous AI Agents</div>
          <h1 className="hero-title">
            Monitor. Govern.<br />
            <span className="hero-gradient-text">Trust Every Agent.</span>
          </h1>
          <p className="hero-subtitle">
            VELYRION provides enterprise-grade audit trails, behavioral monitoring, anomaly detection, and compliance reporting for every AI agent in your stack — regardless of vendor or framework.
          </p>
          <div className="hero-cta-group">
            <Link href="/dashboard" className="btn btn-primary btn-lg">Open Live Dashboard →</Link>
            <a href="#features" className="btn btn-ghost btn-lg">Learn More</a>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={99} suffix="%" /></div>
              <div className="hero-stat-label">Audit Coverage</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value"><Counter end={5} /><span style={{ fontSize: 18 }}>ms</span></div>
              <div className="hero-stat-label">Avg Latency</div>
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

      {/* ── Logos ── */}
      <section className="landing-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <p className="logos-label">Works with every agent framework</p>
        <div className="logos-row">
          {LOGOS.map(l => <div key={l} className="logo-chip">{l}</div>)}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section" id="features">
        <div className="section-heading">
          <span className="section-tag">Core Capabilities</span>
          <h2>Everything you need to govern AI agents at scale</h2>
          <p>From audit logging to incident response — one platform, complete coverage.</p>
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

      {/* ── How It Works ── */}
      <section className="landing-section" style={{ background: "rgba(17, 24, 39, 0.5)" }}>
        <div className="section-heading">
          <span className="section-tag">Integration</span>
          <h2>Three steps to full agent governance</h2>
        </div>
        <div className="steps-row">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Register Agents</h3>
            <p>Define permissions, budgets, data boundaries, and compliance frameworks for each agent.</p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Send Events</h3>
            <p>Point your agents at our webhook. One POST per action — we handle the rest.</p>
          </div>
          <div className="step-connector">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Monitor & Govern</h3>
            <p>Real-time dashboard with alerts, anomaly detection, and compliance reports.</p>
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
          <h2>Simple, transparent pricing</h2>
          <p>Start with 10 agents free for 14 days. No credit card required.</p>
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
              <button className={`btn ${p.popular ? "btn-primary" : "btn-ghost"} btn-lg`} style={{ width: "100%" }}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section landing-cta-section">
        <div className="cta-glow" />
        <h2>Ready to govern your AI agents?</h2>
        <p>Start with a free trial. Deploy in minutes. Full audit coverage from day one.</p>
        <div className="hero-cta-group">
          <Link href="/dashboard" className="btn btn-primary btn-lg">Open Dashboard →</Link>
          <a href="mailto:sales@velyrion.ai" className="btn btn-ghost btn-lg">Contact Sales</a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div>
            <div className="landing-logo" style={{ marginBottom: 8 }}>VELYRION</div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 280 }}>
              The governance layer for autonomous AI agents. Datadog + Okta for the AI era.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div>
              <h4>Compliance</h4>
              <a href="#compliance">EU AI Act</a>
              <a href="#compliance">SOC2</a>
              <a href="#compliance">HIPAA</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="mailto:sales@velyrion.ai">Contact</a>
              <a href="#">Blog</a>
              <a href="#">Docs</a>
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
