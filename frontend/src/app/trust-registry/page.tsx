"use client";
import { useEffect, useState } from "react";
import { api, Agent } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("en-US");

interface TrustEntry {
  agent: Agent;
  trustScore: number;
  verified: boolean;
  tier: "platinum" | "gold" | "silver" | "bronze" | "unverified";
  tags: string[];
  integrations: number;
  lastAudit: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  platinum: { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", icon: "💎" },
  gold: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: "🥇" },
  silver: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: "🥈" },
  bronze: { color: "#d97706", bg: "rgba(217,119,6,0.1)", icon: "🥉" },
  unverified: { color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: "❓" },
};

function getTier(score: number): TrustEntry["tier"] {
  if (score >= 95) return "platinum";
  if (score >= 85) return "gold";
  if (score >= 70) return "silver";
  if (score >= 50) return "bronze";
  return "unverified";
}

const TAG_POOL = ["NLP", "Vision", "Data Pipeline", "Customer Service", "Security", "DevOps", "Analytics", "Automation", "Research", "Finance", "Healthcare", "Code Gen"];

export default function TrustRegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<TrustEntry | null>(null);

  useEffect(() => {
    api.getAgents().then(a => { setAgents(a); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="tr-page"><div className="lb-header"><h1 className="lb-title">Trust Registry</h1><p className="lb-subtitle">Loading registry...</p></div></div>;

  const entries: TrustEntry[] = agents.map((a, i) => {
    const score = Math.max(20, Math.min(99, Math.round(
      (a.total_actions > 0 ? 40 : 10) +
      (a.total_violations === 0 ? 30 : Math.max(0, 30 - a.total_violations * 5)) +
      (a.status === "ACTIVE" ? 15 : 5) +
      (a.tokens_used < a.max_token_budget * 0.8 ? 15 : 5)
    )));
    const tier = getTier(score);
    const seed = a.agent_name.length + i;
    const tags = TAG_POOL.filter((_, ti) => (seed + ti) % 3 === 0).slice(0, 3);
    return {
      agent: a, trustScore: score, verified: score >= 70, tier, tags,
      integrations: Math.max(1, (seed * 3) % 12),
      lastAudit: new Date(Date.now() - (seed % 30) * 86400000).toISOString(),
    };
  });

  const filtered = entries.filter(e => {
    if (search && !e.agent.agent_name.toLowerCase().includes(search.toLowerCase()) && !e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterTier !== "all" && e.tier !== filterTier) return false;
    return true;
  }).sort((a, b) => b.trustScore - a.trustScore);

  const verifiedCount = entries.filter(e => e.verified).length;
  const avgScore = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.trustScore, 0) / entries.length) : 0;

  return (
    <div className="tr-page">
      <div className="lb-header">
        <h1 className="lb-title">🏪 Agent Trust Registry</h1>
        <p className="lb-subtitle">Public directory to discover, verify, and trust AI agents</p>
      </div>

      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi blue"><div className="an-kpi-icon">📋</div><div className="an-kpi-data"><div className="an-kpi-value">{entries.length}</div><div className="an-kpi-label">Registered</div></div></div>
        <div className="an-kpi green"><div className="an-kpi-icon">✅</div><div className="an-kpi-data"><div className="an-kpi-value">{verifiedCount}</div><div className="an-kpi-label">Verified</div></div></div>
        <div className="an-kpi purple"><div className="an-kpi-icon">📊</div><div className="an-kpi-data"><div className="an-kpi-value">{avgScore}</div><div className="an-kpi-label">Avg Trust</div></div></div>
        <div className="an-kpi yellow"><div className="an-kpi-icon">💎</div><div className="an-kpi-data"><div className="an-kpi-value">{entries.filter(e => e.tier === "platinum").length}</div><div className="an-kpi-label">Platinum</div></div></div>
      </div>

      {/* Search & Filter */}
      <div className="tr-controls">
        <input className="set-input" style={{ maxWidth: 300 }} placeholder="Search agents or tags..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="set-radio-group">
          {["all", "platinum", "gold", "silver", "bronze"].map(t => (
            <button key={t} className={`set-radio ${filterTier === t ? "active" : ""}`} onClick={() => setFilterTier(t)}>
              {t === "all" ? "All" : `${TIER_CONFIG[t].icon} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="tr-main">
        {/* Registry Grid */}
        <div className="tr-grid">
          {filtered.map(e => {
            const tc = TIER_CONFIG[e.tier];
            return (
              <div key={e.agent.agent_id} className={`tr-card ${selectedEntry?.agent.agent_id === e.agent.agent_id ? "active" : ""}`} onClick={() => setSelectedEntry(e)}>
                <div className="tr-card-top">
                  <span className="tr-card-tier" style={{ background: tc.bg, color: tc.color }}>{tc.icon} {e.tier}</span>
                  {e.verified && <span className="gs-cert-badge" title="Verified">✓</span>}
                </div>
                <div className="tr-card-name">{e.agent.agent_name}</div>
                <div className="tr-card-dept">{e.agent.department}</div>
                <div className="tr-card-score">
                  <div className="gs-dim-bar" style={{ width: "100%" }}><div className="gs-dim-fill" style={{ width: `${e.trustScore}%`, background: tc.color }} /></div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: tc.color }}>{e.trustScore}</span>
                </div>
                <div className="tr-card-tags">{e.tags.map(t => <span key={t} className="ti-agent-chip">{t}</span>)}</div>
              </div>
            );
          })}
        </div>

        {/* Detail Sidebar */}
        {selectedEntry && (
          <div className="tr-detail">
            <div className="tr-detail-top">
              <span style={{ fontSize: 36 }}>{TIER_CONFIG[selectedEntry.tier].icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedEntry.agent.agent_name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{selectedEntry.agent.department} • {selectedEntry.agent.status}</div>
              </div>
            </div>
            <div className="fr-state-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div className="fr-state-item"><span className="fr-state-label">Trust Score</span><span className="fr-state-value" style={{ color: TIER_CONFIG[selectedEntry.tier].color }}>{selectedEntry.trustScore}/100</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Tier</span><span className="fr-state-value" style={{ textTransform: "capitalize" }}>{selectedEntry.tier}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Actions</span><span className="fr-state-value">{fmt(selectedEntry.agent.total_actions)}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Violations</span><span className="fr-state-value">{selectedEntry.agent.total_violations}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Integrations</span><span className="fr-state-value">{selectedEntry.integrations}</span></div>
              <div className="fr-state-item"><span className="fr-state-label">Last Audit</span><span className="fr-state-value">{new Date(selectedEntry.lastAudit).toLocaleDateString()}</span></div>
            </div>
            <div><div className="fr-state-label" style={{ marginBottom: 6 }}>Tags</div><div className="ti-agent-chips">{selectedEntry.tags.map(t => <span key={t} className="ti-agent-chip">{t}</span>)}</div></div>
            <div><div className="fr-state-label" style={{ marginBottom: 6 }}>Allowed Tools</div><div className="ti-agent-chips">{(selectedEntry.agent.allowed_tools || []).map(t => <span key={t} className="ti-agent-chip">{t}</span>)}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
