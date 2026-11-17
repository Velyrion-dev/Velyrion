"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/auth";
import {
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Download,
  RefreshCw,
  Lock,
  Scale,
  CheckCircle2,
  Clock
} from "lucide-react";

interface Requirement {
  name: string;
  status: "compliant" | "partial" | "non_compliant" | string;
  detail: string;
}

interface RegulatoryAssessment {
  assessment_id: string;
  regulation_id: string;
  regulation_name: string;
  compliance_rate: number;
  requirements: Requirement[];
  assessed_at: string;
}

const STATUS_MAP: Record<string, { color: string; bg: string; label: string }> = {
  compliant: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Compliant" },
  partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Partial" },
  non_compliant: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Non-Compliant" },
};

export default function RegulatoryAutopilotPage() {
  const { isAdmin, isOperator, canConfigurePolicies } = usePermissions();
  const canReassess = canConfigurePolicies || isAdmin || isOperator;

  const [assessments, setAssessments] = useState<RegulatoryAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassessing, setReassessing] = useState(false);
  const [selectedReg, setSelectedReg] = useState<string>("eu_ai_act");
  const [exporting, setExporting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let data = await api.getRegulatoryAssessments().catch(() => []);
      if (!data || data.length === 0) {
        try {
          await api.reassessRegulatory();
          data = await api.getRegulatoryAssessments().catch(() => []);
        } catch {
          // ignore
        }
      }
      setAssessments(data);
      if (data.length > 0 && !selectedReg) {
        setSelectedReg(data[0].regulation_id);
      }
    } catch (e) {
      console.error("Regulatory fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedReg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReassess = async () => {
    if (!canReassess || reassessing) return;
    setReassessing(true);
    try {
      const res = await api.reassessRegulatory();
      setFeedback(`Reassessed ${res.assessed} compliance frameworks`);
      setTimeout(() => setFeedback(""), 4000);
      await loadData();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Reassessment failed");
    } finally {
      setReassessing(false);
    }
  };

  const handleExport = async (regId: string) => {
    setExporting(regId);
    try {
      const report = await api.exportRegulatoryReport(regId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `velyrion-${regId}-compliance-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback export from local assessment
      const current = assessments.find(a => a.regulation_id === regId);
      if (current) {
        const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `velyrion-${regId}-compliance-${new Date().toISOString().split("T")[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setTimeout(() => setExporting(null), 1000);
    }
  };

  if (loading) {
    return (
      <div className="ra-page">
        <div className="lb-header">
          <h1 className="lb-title">Regulatory Autopilot</h1>
          <p className="lb-subtitle">Auditing platform telemetry against regulatory frameworks...</p>
        </div>
      </div>
    );
  }

  const selected = assessments.find(a => a.regulation_id === selectedReg) || assessments[0];
  const overallCompliance = assessments.length > 0
    ? Math.round(assessments.reduce((s, a) => s + a.compliance_rate, 0) / assessments.length)
    : 0;

  return (
    <div className="ra-page">
      <div className="ra-header">
        <div>
          <h1 className="lb-title">Regulatory Autopilot</h1>
          <p className="lb-subtitle">Continuous automated compliance documentation for major international AI regulations</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {feedback && (
            <span style={{ fontSize: 12, color: "var(--accent-cyan)", background: "rgba(6,182,212,0.1)", padding: "4px 10px", borderRadius: 4 }}>
              {feedback}
            </span>
          )}
          {canReassess ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReassess}
              disabled={reassessing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw style={{ width: 13, height: 13, animation: reassessing ? "spin 1s linear infinite" : "none" }} />
              <span>{reassessing ? "Reassessing..." : "Reassess Compliance"}</span>
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Lock style={{ width: 12, height: 12 }} />
              Viewer Mode
            </span>
          )}
          {selected && (
            <button
              className="btn btn-primary"
              onClick={() => handleExport(selected.regulation_id)}
              disabled={exporting !== null}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download style={{ width: 14, height: 14 }} />
              <span>{exporting ? "Exporting..." : "Export Assessment"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Overall Compliance - Enterprise Audit Posture */}
      <div className="ra-overview" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, padding: "20px 24px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRight: "1px solid var(--border-subtle)", paddingRight: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Regulatory Posture
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                background: overallCompliance >= 80 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                color: overallCompliance >= 80 ? "var(--accent-green)" : "var(--accent-yellow)",
                border: `1px solid ${overallCompliance >= 80 ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
              }}
            >
              {overallCompliance >= 80 ? "Audit Ready" : "Remediation Needed"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {overallCompliance}%
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Fleetwide Alignment</span>
          </div>

          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
            <div
              style={{
                width: `${overallCompliance}%`,
                height: "100%",
                background: overallCompliance >= 80 ? "var(--accent-green)" : "var(--accent-yellow)",
                borderRadius: 3,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Covers EU AI Act Art. 14/15, SOC2 Type II, HIPAA &amp; GDPR.
          </div>
        </div>

        <div className="ra-reg-pills" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {assessments.map(r => (
            <button
              key={r.regulation_id}
              className={`ra-reg-pill ${selectedReg === r.regulation_id ? "active" : ""}`}
              onClick={() => setSelectedReg(r.regulation_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 8,
                border: selectedReg === r.regulation_id ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                background: selectedReg === r.regulation_id ? "rgba(59,130,246,0.08)" : "var(--bg-secondary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Scale style={{ width: 15, height: 15, color: selectedReg === r.regulation_id ? "var(--accent-blue)" : "var(--text-muted)" }} />
              <div className="ra-pill-info" style={{ textAlign: "left" }}>
                <div className="ra-pill-name" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.regulation_name}</div>
                <div className="ra-pill-rate" style={{ fontSize: 11, fontWeight: 600, color: r.compliance_rate >= 80 ? "var(--accent-green)" : "var(--accent-yellow)" }}>
                  {r.compliance_rate}% compliant
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="ra-detail" style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selected.regulation_name}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  Last Assessed: {new Date(selected.assessed_at).toLocaleDateString()} • {selected.requirements.length} Evaluated Clauses
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: selected.compliance_rate >= 80 ? "#10b981" : "#f59e0b" }}>
                  {selected.compliance_rate}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Compliance Rating</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.requirements.map((req, idx) => {
                const sc = STATUS_MAP[req.status] || STATUS_MAP.partial;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 16px",
                      background: "var(--bg-secondary)",
                      borderRadius: 6,
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{req.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{req.detail}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 6,
                        background: sc.bg,
                        color: sc.color,
                        flexShrink: 0,
                        marginLeft: 16
                      }}
                    >
                      {sc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", marginTop: 20 }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--accent-green)", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>No Compliance Assessments Found</h3>
          <p style={{ margin: 0, fontSize: 13 }}>Click &quot;Reassess Compliance&quot; to audit platform controls.</p>
        </div>
      )}
    </div>
  );
}
