"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Globe,
  ArrowRightLeft,
  ShieldCheck,
  AlertOctagon,
  Building2,
  RefreshCw,
  Clock,
  CheckCircle2
} from "lucide-react";

interface AgreementRecord {
  agreement_id: string;
  org_a: string;
  org_b: string;
  status: string;
  agent_count: number;
  shared_policies: string[];
  created_at: string;
  expires_at: string | null;
}

interface CrossOrgEventRecord {
  event_id: string;
  timestamp: string;
  from_org: string;
  from_agent: string;
  to_org: string;
  to_agent: string;
  action: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Active" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending" },
  expired: { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Expired" },
};

export default function TrustMeshPage() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [events, setEvents] = useState<CrossOrgEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedAgreements, fetchedEvents] = await Promise.all([
        api.getTrustAgreements().catch(() => []),
        api.getCrossOrgEvents(50).catch(() => []),
      ]);

      setAgreements(fetchedAgreements);
      setEvents(fetchedEvents);
    } catch (e) {
      console.error("Trust mesh fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="tm-page">
        <div className="lb-header">
          <h1 className="lb-title">Cross-Company Trust Mesh</h1>
          <p className="lb-subtitle">Querying cross-organization trust topology from database...</p>
        </div>
      </div>
    );
  }

  const activeAgreements = agreements.filter(a => a.status === "active").length;
  const connectedAgents = agreements.reduce((s, a) => s + (a.agent_count || 0), 0);
  const blockedCount = events.filter(e => e.status === "blocked").length;

  return (
    <div className="tm-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Cross-Company Trust Mesh</h1>
          <p className="lb-subtitle">Govern and cryptographically verify agent-to-agent communication across independent enterprise tenants</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Topology">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <ShieldCheck style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{activeAgreements}</div>
            <div className="an-kpi-label">Active Treaties</div>
          </div>
        </div>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Building2 style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{connectedAgents}</div>
            <div className="an-kpi-label">Mesh Connected Agents</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <Globe style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{events.length}</div>
            <div className="an-kpi-label">Inter-Tenant Events</div>
          </div>
        </div>
        <div className="an-kpi red">
          <div className="an-kpi-icon">
            <AlertOctagon style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{blockedCount}</div>
            <div className="an-kpi-label">Boundary Violations</div>
          </div>
        </div>
      </div>

      <div className="an-bottom-grid">
        {/* Trust Agreements */}
        <div className="an-chart-card">
          <div className="an-chart-title">Bilateral Trust Agreements ({agreements.length})</div>
          {agreements.length === 0 ? (
            <div className="an-empty">
              No cross-organization trust agreements established yet. Negotiate mutual treaties between orgs to enable federation.
            </div>
          ) : (
            <div className="tm-agreement-list">
              {agreements.map(a => {
                const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
                return (
                  <div key={a.agreement_id} className="tm-agreement-card">
                    <div className="tm-ag-top">
                      <div className="tm-ag-orgs" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="tm-ag-org">{a.org_a}</span>
                        <ArrowRightLeft style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
                        <span className="tm-ag-org">{a.org_b}</span>
                      </div>
                      <span className="ra-req-badge" style={{ background: sc.bg, color: sc.color, textTransform: "capitalize" }}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="tm-ag-meta">
                      <span>{a.agent_count} federated agents</span>
                      <span>
                        Created {new Date(a.created_at).toLocaleDateString()}{a.expires_at ? ` · Exp ${new Date(a.expires_at).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    {(a.shared_policies || []).length > 0 && (
                      <div className="ti-agent-chips" style={{ marginTop: 8 }}>
                        {a.shared_policies.map(p => (
                          <span key={p} className="ti-agent-chip">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cross-Org Event Log */}
        <div className="an-chart-card">
          <div className="an-chart-title">Cross-Tenant Audit Stream ({events.length})</div>
          {events.length === 0 ? (
            <div className="an-empty">
              No cross-tenant audit events logged yet. External inter-agent calls will stream here in real time.
            </div>
          ) : (
            <div className="tm-event-list">
              {events.map(e => (
                <div key={e.event_id} className="tm-event-card">
                  <div className="tm-event-info">
                    <div className="tm-event-action" style={{ fontWeight: 600 }}>{e.action}</div>
                    <div className="tm-event-route" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      <span className="tm-event-agent">{e.from_org} / {e.from_agent}</span>
                      <span>&rarr;</span>
                      <span className="tm-event-agent">{e.to_org} / {e.to_agent}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: e.status === "governed" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        color: e.status === "governed" ? "#10b981" : "#ef4444",
                        textTransform: "capitalize"
                      }}
                    >
                      {e.status}
                    </span>
                    <div className="tm-event-time" style={{ fontSize: 10, marginTop: 4 }}>
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
