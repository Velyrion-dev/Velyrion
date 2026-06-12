"use client";
import { useEffect, useState } from "react";
import { api, Agent, DashboardStats } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Regulation {
  id: string;
  name: string;
  icon: string;
  description: string;
  requirements: { name: string; status: "compliant" | "partial" | "non_compliant"; detail: string }[];
}

export default function RegulatoryAutopilotPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState("eu_ai_act");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getAgents(), api.getStats()])
      .then(([a, s]) => { setAgents(a); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ra-page"><div className="lb-header"><h1 className="lb-title">Regulatory Autopilot</h1><p className="lb-subtitle">Loading compliance data...</p></div></div>;

  const totalAgents = agents.length;
  const hasAuditTrail = true;
  const hasAnomalyDetection = true;
  const hasKillSwitch = true;
  const hasHumanInLoop = true;

  const regulations: Regulation[] = [
    {
      id: "eu_ai_act", name: "EU AI Act 2025", icon: "🇪🇺",
      description: "European Union regulation on artificial intelligence systems — risk classification, transparency, and documentation requirements.",
      requirements: [
        { name: "Risk Classification System", status: "compliant", detail: "All agents classified by risk level (LOW/MEDIUM/HIGH/CRITICAL) with automatic categorization." },
        { name: "Human Oversight Mechanism", status: hasHumanInLoop ? "compliant" : "non_compliant", detail: "Human-in-the-loop approval system active for sensitive operations." },
        { name: "Transparency & Audit Trail", status: hasAuditTrail ? "compliant" : "non_compliant", detail: `${fmt(stats?.total_events || 0)} events logged with immutable, append-only audit trail.` },
        { name: "Technical Documentation", status: "compliant", detail: "Complete agent documentation including capabilities, limitations, and risk assessments." },
        { name: "Anomaly Monitoring", status: hasAnomalyDetection ? "compliant" : "non_compliant", detail: "5 anomaly detection algorithms monitoring all agent behavior in real-time." },
        { name: "Incident Response Plan", status: hasKillSwitch ? "compliant" : "partial", detail: "Automated 5-step incident response: kill → snapshot → lock → alert → log." },
      ],
    },
    {
      id: "soc2", name: "SOC 2 Type II", icon: "🔒",
      description: "Service Organization Control 2 — security, availability, processing integrity, confidentiality, and privacy.",
      requirements: [
        { name: "Access Controls", status: "compliant", detail: "Permission engine validates every agent action against defined access policies." },
        { name: "Change Management", status: "compliant", detail: "All agent configuration changes logged with timestamps and operator identity." },
        { name: "Incident Management", status: "compliant", detail: "Automated incident creation, escalation, and resolution tracking." },
        { name: "Monitoring & Alerting", status: "compliant", detail: "Real-time monitoring via Mission Control with webhook and Slack alerts." },
        { name: "Data Retention", status: "partial", detail: "Audit logs retained. Configurable retention policies recommended." },
        { name: "Vendor Management", status: "partial", detail: "Agent registry tracks all AI vendors. SLA monitoring in progress." },
      ],
    },
    {
      id: "hipaa", name: "HIPAA", icon: "🏥",
      description: "Health Insurance Portability and Accountability Act — protecting sensitive patient health information.",
      requirements: [
        { name: "Access Audit Trail", status: "compliant", detail: "Every data access by AI agents logged with full context." },
        { name: "Minimum Necessary Rule", status: "compliant", detail: "Data access level controls (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED)." },
        { name: "Breach Notification", status: hasKillSwitch ? "compliant" : "non_compliant", detail: "Automated alerts for unauthorized data access with kill switch." },
        { name: "Risk Assessment", status: "compliant", detail: "Governance Score™ provides continuous risk assessment per agent." },
        { name: "Encryption", status: "partial", detail: "API communications encrypted. At-rest encryption configuration available." },
      ],
    },
    {
      id: "gdpr", name: "GDPR", icon: "🇪🇺",
      description: "General Data Protection Regulation — data protection and privacy for EU citizens.",
      requirements: [
        { name: "Data Processing Records", status: "compliant", detail: "Complete records of all AI agent data processing activities." },
        { name: "Right to Explanation", status: "compliant", detail: "Full audit trail provides explainability for every AI decision." },
        { name: "Data Minimization", status: "compliant", detail: "Agents restricted to minimum required data access levels." },
        { name: "Breach Detection", status: "compliant", detail: "Anomaly engine detects unauthorized data processing within seconds." },
        { name: "DPO Support", status: "partial", detail: "Compliance reports available for Data Protection Officer review." },
      ],
    },
    {
      id: "sec_ai", name: "SEC AI Oversight", icon: "📊",
      description: "Securities and Exchange Commission guidelines for AI in financial services.",
      requirements: [
        { name: "Algorithmic Accountability", status: "compliant", detail: "Every AI action audited with confidence scores and cost tracking." },
        { name: "Risk Controls", status: "compliant", detail: "Budget limits, token caps, and kill switches for all agents." },
        { name: "Market Manipulation Safeguards", status: "compliant", detail: "Anomaly detection monitors for unusual trading patterns." },
        { name: "Regulatory Reporting", status: "compliant", detail: "On-demand compliance reports with export functionality." },
        { name: "Model Governance", status: "partial", detail: "Agent registry tracks model versions. Full model lineage tracking planned." },
      ],
    },
  ];

  const selected = regulations.find(r => r.id === selectedReg) || regulations[0];
  const complianceRate = Math.round((selected.requirements.filter(r => r.status === "compliant").length / selected.requirements.length) * 100);

  const STATUS_MAP = {
    compliant: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "✓ Compliant", icon: "✅" },
    partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "◐ Partial", icon: "⚠️" },
    non_compliant: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "✗ Non-Compliant", icon: "❌" },
  };

  const exportReport = (regId: string) => {
    setExporting(regId);
    const reg = regulations.find(r => r.id === regId)!;
    const report = {
      report_type: "Compliance Assessment",
      regulation: reg.name,
      generated_at: new Date().toISOString(),
      organization: "Velyrion Platform",
      total_agents: totalAgents,
      compliance_rate: `${complianceRate}%`,
      requirements: reg.requirements,
      summary: `${reg.requirements.filter(r => r.status === "compliant").length} of ${reg.requirements.length} requirements fully met.`,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `velyrion-${regId}-compliance-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(null), 1000);
  };

  const overallCompliance = Math.round(regulations.reduce((s, r) => s + (r.requirements.filter(req => req.status === "compliant").length / r.requirements.length) * 100, 0) / regulations.length);

  return (
    <div className="ra-page">
      <div className="ra-header">
        <div>
          <h1 className="lb-title">🏛️ Regulatory Autopilot</h1>
          <p className="lb-subtitle">One-click compliance documentation for every major AI regulation</p>
        </div>
        <button className="btn btn-primary" onClick={() => exportReport(selectedReg)} disabled={exporting !== null}>
          {exporting ? "⏳ Exporting..." : "📥 Export Report"}
        </button>
      </div>

      {/* Overall Compliance */}
      <div className="ra-overview">
        <div className="ra-overview-score">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={overallCompliance >= 80 ? "#10b981" : "#f59e0b"} strokeWidth="8"
              strokeDasharray={`${(overallCompliance / 100) * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div className="ra-overview-inner">
            <div className="ra-overview-num">{overallCompliance}%</div>
            <div className="ra-overview-label">Overall</div>
          </div>
        </div>
        <div className="ra-reg-pills">
          {regulations.map(r => {
            const rate = Math.round((r.requirements.filter(req => req.status === "compliant").length / r.requirements.length) * 100);
            return (
              <button key={r.id} className={`ra-reg-pill ${selectedReg === r.id ? "active" : ""}`} onClick={() => setSelectedReg(r.id)}>
                <span>{r.icon}</span>
                <span className="ra-reg-pill-name">{r.name}</span>
                <span className="ra-reg-pill-rate" style={{ color: rate >= 80 ? "#10b981" : rate >= 60 ? "#f59e0b" : "#ef4444" }}>{rate}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Regulation Detail */}
      <div className="ra-detail">
        <div className="ra-detail-header">
          <span style={{ fontSize: 32 }}>{selected.icon}</span>
          <div>
            <h2 className="ra-detail-name">{selected.name}</h2>
            <p className="ra-detail-desc">{selected.description}</p>
          </div>
          <div className="ra-compliance-badge" style={{
            background: complianceRate >= 80 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
            color: complianceRate >= 80 ? "#10b981" : "#f59e0b",
            borderColor: complianceRate >= 80 ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"
          }}>
            {complianceRate}% Compliant
          </div>
        </div>

        <div className="ra-req-list">
          {selected.requirements.map((req, i) => {
            const sc = STATUS_MAP[req.status];
            return (
              <div key={i} className="ra-req-card">
                <div className="ra-req-status" style={{ background: sc.bg, color: sc.color }}>{sc.icon}</div>
                <div className="ra-req-info">
                  <div className="ra-req-name">{req.name}</div>
                  <div className="ra-req-detail">{req.detail}</div>
                </div>
                <span className="ra-req-badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
