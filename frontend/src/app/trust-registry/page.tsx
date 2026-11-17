"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ShieldCheck,
  Award,
  Search,
  Cpu,
  Tag,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US");

interface TrustRegistryItem {
  entry_id: string;
  agent_id: string;
  trust_score: number;
  tier: string;
  verified: boolean;
  tags: string[];
  integrations: number;
  last_audit: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  platinum: { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", label: "Platinum" },
  gold: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Gold" },
  silver: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: "Silver" },
  bronze: { color: "#d97706", bg: "rgba(217,119,6,0.1)", label: "Bronze" },
  unverified: { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Unverified" },
};

export default function TrustRegistryPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [registryEntries, setRegistryEntries] = useState<TrustRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedAgents, fetchedRegistry] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getTrustRegistry(filterTier === "all" ? undefined : filterTier).catch(() => []),
      ]);

      setAgents(fetchedAgents);
      setRegistryEntries(fetchedRegistry);
      if (fetchedRegistry.length > 0 && !selectedAgentId) {
        setSelectedAgentId(fetchedRegistry[0].agent_id);
      }
    } catch (e) {
      console.error("Trust registry fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [filterTier, selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="tr-page">
        <div className="lb-header">
          <h1 className="lb-title">Agent Trust Registry</h1>
          <p className="lb-subtitle">Querying verified agent registry from database...</p>
        </div>
      </div>
    );
  }

  // Merge registry entry with agent metadata
  const mergedEntries = registryEntries.map(e => {
    const ag = agents.find(a => a.agent_id === e.agent_id);
    return {
      ...e,
      agentName: ag?.agent_name || e.agent_id,
      department: ag?.department || "Autonomous Agent",
      status: ag?.status || "ACTIVE",
      totalActions: ag?.total_actions || 0,
      totalViolations: ag?.total_violations || 0,
      allowedTools: ag?.allowed_tools || [],
    };
  });

  const filtered = mergedEntries.filter(e => {
    if (
      search &&
      !e.agentName.toLowerCase().includes(search.toLowerCase()) &&
      !e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    return true;
  }).sort((a, b) => b.trust_score - a.trust_score);

  const verifiedCount = mergedEntries.filter(e => e.verified).length;
  const avgScore = mergedEntries.length > 0
    ? Math.round(mergedEntries.reduce((s, e) => s + e.trust_score, 0) / mergedEntries.length)
    : 0;

  const selectedEntry = mergedEntries.find(e => e.agent_id === selectedAgentId);

  return (
    <div className="tr-page">
      <div className="lb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="lb-title">Agent Trust Registry</h1>
          <p className="lb-subtitle">Enterprise directory to discover, verify, and validate AI agent trustworthiness</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadData()} title="Refresh Registry">
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">
            <Cpu style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{mergedEntries.length}</div>
            <div className="an-kpi-label">Registered Agents</div>
          </div>
        </div>
        <div className="an-kpi green">
          <div className="an-kpi-icon">
            <ShieldCheck style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{verifiedCount}</div>
            <div className="an-kpi-label">Verified (Tier &ge; Silver)</div>
          </div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">
            <Award style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{avgScore}</div>
            <div className="an-kpi-label">Avg Trust Score</div>
          </div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">
            <Award style={{ width: 18, height: 18 }} />
          </div>
          <div className="an-kpi-data">
            <div className="an-kpi-value">{mergedEntries.filter(e => e.tier === "platinum").length}</div>
            <div className="an-kpi-label">Platinum Certified</div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="tr-controls">
        <div style={{ position: "relative", maxWidth: 320, width: "100%" }}>
          <Search style={{ position: "absolute", left: 10, top: 10, width: 14, height: 14, color: "var(--text-muted)" }} />
          <input
            className="set-input"
            style={{ paddingLeft: 32, width: "100%" }}
            placeholder="Search agents or capability tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="set-radio-group">
          {["all", "platinum", "gold", "silver", "bronze"].map(t => (
            <button
              key={t}
              className={`set-radio ${filterTier === t ? "active" : ""}`}
              onClick={() => setFilterTier(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="tr-main">
        {/* Registry Grid */}
        <div className="tr-grid">
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
              No agents matching filter criteria found in the trust registry.
            </div>
          ) : (
            filtered.map(e => {
              const tc = TIER_CONFIG[e.tier] || TIER_CONFIG.bronze;
              return (
                <div
                  key={e.agent_id}
                  className={`tr-card ${selectedAgentId === e.agent_id ? "active" : ""}`}
                  onClick={() => setSelectedAgentId(e.agent_id)}
                >
                  <div className="tr-card-top">
                    <span className="tr-card-tier" style={{ background: tc.bg, color: tc.color }}>
                      {tc.label}
                    </span>
                    {e.verified && (
                      <span className="gs-cert-badge" title="Cryptographically Verified">
                        <CheckCircle2 style={{ width: 12, height: 12, color: "var(--accent-green)" }} />
                      </span>
                    )}
                  </div>
                  <div className="tr-card-name">{e.agentName}</div>
                  <div className="tr-card-dept">{e.department}</div>
                  <div className="tr-card-score">
                    <div className="gs-dim-bar" style={{ width: "100%" }}>
                      <div className="gs-dim-fill" style={{ width: `${e.trust_score}%`, background: tc.color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: tc.color }}>{e.trust_score}</span>
                  </div>
                  <div className="tr-card-tags">
                    {e.tags.map(t => (
                      <span key={t} className="ti-agent-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Sidebar */}
        {selectedEntry && (
          <div className="tr-detail">
            <div className="tr-detail-top">
              <Award style={{ width: 32, height: 32, color: (TIER_CONFIG[selectedEntry.tier] || TIER_CONFIG.bronze).color }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedEntry.agentName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {selectedEntry.department} • Status: {selectedEntry.status}
                </div>
              </div>
            </div>
            <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div className="fr-state-item">
                <span className="fr-state-label">Trust Rating</span>
                <span className="fr-state-value" style={{ color: (TIER_CONFIG[selectedEntry.tier] || TIER_CONFIG.bronze).color }}>
                  {selectedEntry.trust_score}/100
                </span>
              </div>
              <div className="fr-state-item">
                <span className="fr-state-label">Assigned Tier</span>
                <span className="fr-state-value" style={{ textTransform: "capitalize" }}>
                  {selectedEntry.tier}
                </span>
              </div>
              <div className="fr-state-item">
                <span className="fr-state-label">Governed Actions</span>
                <span className="fr-state-value">{fmt(selectedEntry.totalActions)}</span>
              </div>
              <div className="fr-state-item">
                <span className="fr-state-label">Violations</span>
                <span className="fr-state-value">{selectedEntry.totalViolations}</span>
              </div>
              <div className="fr-state-item">
                <span className="fr-state-label">Active Integrations</span>
                <span className="fr-state-value">{selectedEntry.integrations}</span>
              </div>
              <div className="fr-state-item">
                <span className="fr-state-label">Last Audit</span>
                <span className="fr-state-value">{new Date(selectedEntry.last_audit).toLocaleDateString()}</span>
              </div>
            </div>
            <div>
              <div className="fr-state-label" style={{ marginBottom: 6 }}>Capability Tags</div>
              <div className="ti-agent-chips">
                {selectedEntry.tags.map(t => (
                  <span key={t} className="ti-agent-chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="fr-state-label" style={{ marginBottom: 6 }}>Allowed Tools</div>
              <div className="ti-agent-chips">
                {(selectedEntry.allowedTools || []).map(t => (
                  <span key={t} className="ti-agent-chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
