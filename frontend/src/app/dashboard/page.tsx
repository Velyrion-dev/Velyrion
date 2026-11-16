"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardStats, AgentHealth, AgentCost } from "@/lib/api";
import {
  Bot,
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

function HealthBar({ score }: { score: number }) {
  const cls =
    score >= 90
      ? "health-excellent"
      : score >= 70
      ? "health-good"
      : score >= 50
      ? "health-fair"
      : score >= 30
      ? "health-poor"
      : "health-critical";

  const color =
    score >= 70
      ? "var(--accent-green)"
      : score >= 50
      ? "var(--accent-yellow)"
      : "var(--accent-red)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="health-bar-bg" style={{ width: 120 }}>
        <div className={`health-bar-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {score}
      </span>
    </div>
  );
}

function CostBar({ pct }: { pct: number }) {
  const color =
    pct > 100
      ? "var(--accent-red)"
      : pct > 75
      ? "var(--accent-yellow)"
      : "var(--accent-cyan)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="cost-bar-bg" style={{ flex: 1 }}>
        <div
          className="cost-bar-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          minWidth: 46,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = () => {
    setRefreshing(true);
    Promise.all([api.getStats(), api.getHealth(), api.getCosts()])
      .then(([s, h, c]) => {
        setStats(s);
        setHealth(h);
        setCosts(c);
      })
      .catch((err) => console.error("Error loading dashboard data:", err))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !stats) {
    return (
      <div>
        <div className="page-header">
          <h1>Governance Dashboard</h1>
          <p>Loading real-time fleet telemetry...</p>
        </div>
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card" style={{ height: 110 }}>
              <div className="loading-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1>Governance Overview</h1>
          <p>Real-time security telemetry, policy enforcement, and spend analytics</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw
              style={{
                width: 13,
                height: 13,
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/connect"
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Bot style={{ width: 14, height: 14 }} />
            Connect Agent
          </Link>
        </div>
      </div>

      {/* Core Telemetry Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Total Fleet</span>
            <Bot style={{ width: 15, height: 15, opacity: 0.6 }} />
          </div>
          <div className="stat-value">{stats.total_agents}</div>
          <div className="stat-subtitle">
            <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{stats.active_agents} active</span> ·{" "}
            {stats.locked_agents} quarantined
          </div>
        </div>

        <div className="stat-card green">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Total Events</span>
            <Activity style={{ width: 15, height: 15, opacity: 0.6 }} />
          </div>
          <div className="stat-value">{stats.total_events.toLocaleString()}</div>
          <div className="stat-subtitle">
            <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{stats.events_last_24h}</span> in last 24h
          </div>
        </div>

        <div className="stat-card red">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Policy Violations</span>
            <ShieldAlert style={{ width: 15, height: 15, color: "var(--accent-red)" }} />
          </div>
          <div className="stat-value">{stats.total_violations}</div>
          <div className="stat-subtitle">
            {stats.violations_by_severity?.CRITICAL || 0} critical ·{" "}
            {stats.violations_by_severity?.HIGH || 0} high
          </div>
        </div>

        <div className="stat-card yellow">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Anomalies</span>
            <AlertTriangle style={{ width: 15, height: 15, opacity: 0.6 }} />
          </div>
          <div className="stat-value">{stats.total_anomalies}</div>
          <div className="stat-subtitle">Statistical outliers detected</div>
        </div>

        <div className="stat-card purple">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Pending HITL</span>
            <CheckCircle2 style={{ width: 15, height: 15, opacity: 0.6 }} />
          </div>
          <div className="stat-value">{stats.pending_approvals}</div>
          <div className="stat-subtitle">Awaiting operator sign-off</div>
        </div>

        <div className="stat-card cyan">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="stat-label">Token Spend</span>
            <DollarSign style={{ width: 15, height: 15, opacity: 0.6 }} />
          </div>
          <div className="stat-value" style={{ fontVariantNumeric: "tabular-nums" }}>
            ${stats.total_cost_usd.toFixed(2)}
          </div>
          <div className="stat-subtitle">Cumulative model consumption</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid-2">
        {/* Agent Health */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity style={{ width: 16, height: 16, color: "var(--accent-cyan)" }} />
              <h3 className="section-title" style={{ margin: 0 }}>
                Fleet Health Scores
              </h3>
            </div>
            <Link
              href="/agents"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
            >
              View Fleet <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>

          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Health</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {health.slice(0, 8).map((h) => (
                  <tr key={h.agent_id}>
                    <td className="cell-primary">{h.agent_name}</td>
                    <td>
                      <HealthBar score={h.health_score} />
                    </td>
                    <td>
                      <span className={`badge badge-${h.status.toLowerCase()}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Costs */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp style={{ width: 16, height: 16, color: "var(--accent-yellow)" }} />
              <h3 className="section-title" style={{ margin: 0 }}>
                Token Budget Consumption
              </h3>
            </div>
            <Link
              href="/cost-optimizer"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
            >
              Cost Analytics <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>

          <div className="data-table-wrapper" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Budget Allocated</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.agent_id}>
                    <td className="cell-primary">{c.agent_name}</td>
                    <td style={{ minWidth: 180 }}>
                      <CostBar pct={c.budget_usage_pct} />
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      ${c.total_cost_usd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Violations by Severity */}
      <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert style={{ width: 16, height: 16, color: "var(--accent-red)" }} />
            <h3 className="section-title" style={{ margin: 0 }}>
              Violations by Severity Tier
            </h3>
          </div>
          <Link
            href="/violations"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
          >
            All Violations <ArrowUpRight style={{ width: 12, height: 12 }} />
          </Link>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {Object.entries(stats.violations_by_severity || {}).map(([level, count]) => (
            <div
              key={level}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 18px",
                background: "var(--bg-secondary)",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                minWidth: 160,
              }}
            >
              <span className={`badge badge-${level.toLowerCase()}`}>{level}</span>
              <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Posture */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: "var(--accent-green)" }} />
            <h3 className="section-title" style={{ margin: 0 }}>
              Framework Compliance Posture
            </h3>
          </div>
          <Link
            href="/regulatory"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
          >
            Audit Matrix <ArrowUpRight style={{ width: 12, height: 12 }} />
          </Link>
        </div>

        <div className="compliance-item">
          <span className="compliance-label">SOC2 Type II</span>
          <div className="compliance-bar-bg">
            <div className="compliance-bar-fill" style={{ width: "94%" }} />
          </div>
          <span className="compliance-pct">94%</span>
        </div>
        <div className="compliance-item">
          <span className="compliance-label">GDPR Article 22</span>
          <div className="compliance-bar-bg">
            <div className="compliance-bar-fill" style={{ width: "91%" }} />
          </div>
          <span className="compliance-pct">91%</span>
        </div>
        <div className="compliance-item">
          <span className="compliance-label">EU AI Act (High-Risk)</span>
          <div className="compliance-bar-bg">
            <div className="compliance-bar-fill" style={{ width: "88%" }} />
          </div>
          <span className="compliance-pct">88%</span>
        </div>
        <div className="compliance-item">
          <span className="compliance-label">HIPAA Security Rule</span>
          <div className="compliance-bar-bg">
            <div className="compliance-bar-fill" style={{ width: "96%" }} />
          </div>
          <span className="compliance-pct">96%</span>
        </div>
      </div>
    </div>
  );
}
