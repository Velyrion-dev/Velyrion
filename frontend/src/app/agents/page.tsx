"use client";
import React, { useEffect, useState, useCallback } from "react";
import { api, Agent } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { usePermissions } from "@/lib/auth";
import {
  Plus,
  X,
  Search,
  PowerOff,
  Pause,
  Unlock,
  AlertTriangle,
  Bot,
  Shield,
  Activity,
} from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();
  const { canKillAgents, canRegisterAgents } = usePermissions();

  const reload = useCallback(() => {
    api.getAgents().then(setAgents).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const departments = [...new Set(agents.map((a) => a.department))];

  const filtered = agents.filter((a) => {
    const matchSearch =
      !search ||
      a.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_email.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || a.department === deptFilter;
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  return (
    <div>
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
          <h1>Agent Fleet Registry</h1>
          <p>Autonomous agents operating under active Velyrion governance boundaries</p>
        </div>
        {canRegisterAgents && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {showForm ? (
              <>
                <X style={{ width: 14, height: 14 }} /> Close
              </>
            ) : (
              <>
                <Plus style={{ width: 14, height: 14 }} /> Register Agent
              </>
            )}
          </button>
        )}
      </div>

      {showForm && canRegisterAgents && (
        <RegisterForm
          onDone={() => {
            setShowForm(false);
            reload();
            toast("Agent registered successfully");
          }}
        />
      )}

      <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: "var(--text-muted)",
            }}
          />
          <input
            className="search-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search agents by moniker, handle, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Lifecycle Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="LOCKED">Quarantined / Locked</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
        <span className="timestamp" style={{ whiteSpace: "nowrap" }}>
          {filtered.length} of {agents.length} nodes
        </span>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent Moniker</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions Taken</th>
              <th>Violations</th>
              <th>Budget Utilization</th>
              <th>Spend</th>
              <th>Emergency Controls</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}>
                    <div className="loading-shimmer" style={{ height: 24 }} />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}
                >
                  {search || deptFilter || statusFilter
                    ? "No agents match the specified criteria"
                    : "No agents registered in this workspace yet"}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.agent_id}>
                  <td>
                    <div className="cell-primary">{a.agent_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.owner_email}</div>
                  </td>
                  <td>{a.department}</td>
                  <td>
                    <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {a.total_actions.toLocaleString()}
                  </td>
                  <td>
                    <span
                      style={{
                        color:
                          a.total_violations > 5
                            ? "var(--accent-red)"
                            : a.total_violations > 0
                            ? "var(--accent-yellow)"
                            : "var(--accent-green)",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {a.total_violations}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      {a.tokens_used.toLocaleString()} / {a.max_token_budget.toLocaleString()}
                    </div>
                    <div className="cost-bar-bg" style={{ marginTop: 4 }}>
                      <div
                        className="cost-bar-fill"
                        style={{
                          width: `${Math.min((a.tokens_used / a.max_token_budget) * 100, 100)}%`,
                          background:
                            a.tokens_used / a.max_token_budget > 1
                              ? "var(--accent-red)"
                              : a.tokens_used / a.max_token_budget > 0.75
                              ? "var(--accent-yellow)"
                              : "var(--accent-cyan)",
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${a.total_cost_usd.toFixed(2)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {canKillAgents ? (
                        a.status === "ACTIVE" ? (
                          <>
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await api.killAgent(a.agent_id, "Manual kill");
                                reload();
                                toast("Agent terminated by operator");
                              }}
                              style={{
                                fontSize: 11,
                                padding: "4px 8px",
                                background: "rgba(239,68,68,0.12)",
                                color: "var(--accent-red)",
                                border: "1px solid rgba(239,68,68,0.25)",
                                cursor: "pointer",
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <PowerOff style={{ width: 11, height: 11 }} /> Kill
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await api.pauseAgent(a.agent_id, "Manual pause");
                                reload();
                                toast("Agent quarantined / paused");
                              }}
                              style={{
                                fontSize: 11,
                                padding: "4px 8px",
                                background: "rgba(251,191,36,0.12)",
                                color: "var(--accent-yellow)",
                                border: "1px solid rgba(251,191,36,0.25)",
                                cursor: "pointer",
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Pause style={{ width: 11, height: 11 }} /> Pause
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await api.unlockAgent(a.agent_id, "Manual unlock");
                              reload();
                              toast("Agent boundary restored / unlocked");
                            }}
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              background: "rgba(34,197,94,0.12)",
                              color: "var(--accent-green)",
                              border: "1px solid rgba(34,197,94,0.25)",
                              cursor: "pointer",
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Unlock style={{ width: 11, height: 11 }} /> Unlock
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                          Read-only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    agent_name: "",
    owner_email: "",
    department: "",
    allowed_tools: "",
    allowed_data_sources: "",
    max_token_budget: 100000,
    max_task_duration_seconds: 300,
    compliance_frameworks: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createAgent({
        ...form,
        allowed_tools: form.allowed_tools
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allowed_data_sources: form.allowed_data_sources
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        compliance_frameworks: form.compliance_frameworks
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      } as unknown as Partial<Agent>);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register agent");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 6,
    border: "1px solid var(--border-subtle)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 4,
    display: "block",
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
      <h3 className="section-title">Register New Autonomous Agent</h3>
      {error && (
        <div
          style={{
            color: "var(--accent-red)",
            fontSize: 12,
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle style={{ width: 14, height: 14 }} /> {error}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={labelStyle}>Agent Name *</label>
          <input
            style={inputStyle}
            value={form.agent_name}
            onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
            required
            placeholder="e.g. DataSync Pro"
          />
        </div>
        <div>
          <label style={labelStyle}>Owner Email *</label>
          <input
            style={inputStyle}
            type="email"
            value={form.owner_email}
            onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
            required
            placeholder="eng-leads@company.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Department *</label>
          <input
            style={inputStyle}
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            required
            placeholder="e.g. Engineering"
          />
        </div>
        <div>
          <label style={labelStyle}>Allowed Tools (comma-separated)</label>
          <input
            style={inputStyle}
            value={form.allowed_tools}
            onChange={(e) => setForm({ ...form, allowed_tools: e.target.value })}
            placeholder="api_call, database_query"
          />
        </div>
        <div>
          <label style={labelStyle}>Allowed Data Sources</label>
          <input
            style={inputStyle}
            value={form.allowed_data_sources}
            onChange={(e) => setForm({ ...form, allowed_data_sources: e.target.value })}
            placeholder="postgres_main, s3_lake"
          />
        </div>
        <div>
          <label style={labelStyle}>Compliance Frameworks</label>
          <input
            style={inputStyle}
            value={form.compliance_frameworks}
            onChange={(e) => setForm({ ...form, compliance_frameworks: e.target.value })}
            placeholder="SOC2, GDPR, HIPAA"
          />
        </div>
        <div>
          <label style={labelStyle}>Max Token Budget</label>
          <input
            style={inputStyle}
            type="number"
            value={form.max_token_budget}
            onChange={(e) => setForm({ ...form, max_token_budget: +e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>Max Task Duration (seconds)</label>
          <input
            style={inputStyle}
            type="number"
            value={form.max_task_duration_seconds}
            onChange={(e) => setForm({ ...form, max_task_duration_seconds: +e.target.value })}
          />
        </div>
      </div>
      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={submitting}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Bot style={{ width: 14, height: 14 }} />
        {submitting ? "Registering..." : "Provision Boundary"}
      </button>
    </form>
  );
}
