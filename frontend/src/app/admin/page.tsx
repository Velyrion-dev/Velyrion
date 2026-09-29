"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { platformAdmin } from "@/lib/api";

type Tab = "overview" | "users" | "orgs" | "audit";

export default function PlatformAdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const s = await platformAdmin.getStats();
      setStats(s);
      if (tab === "users") {
        setUsers(await platformAdmin.getUsers());
      } else if (tab === "orgs") {
        setOrgs(await platformAdmin.getOrgs());
      } else if (tab === "audit") {
        setAuditLogs(await platformAdmin.getAuditLog(100));
      }
    } catch (e: any) {
      setError(e.message || "Access denied");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 4000); return () => clearTimeout(t); }
  }, [success]);

  if (!isAdmin) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h1 style={{ color: "#ef4444", fontSize: "1.5rem", marginBottom: "1rem" }}>🔒 Access Denied</h1>
        <p style={{ color: "#9ca3af" }}>Platform admin privileges required. Your role: <strong>{user?.role}</strong></p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "users", label: "Users", icon: "👥" },
    { key: "orgs", label: "Organizations", icon: "🏢" },
    { key: "audit", label: "Audit Log", icon: "📋" },
  ];

  const STAT_CARDS = stats ? [
    { label: "Total Users", value: stats.total_users, icon: "👥", color: "#3b82f6" },
    { label: "Organizations", value: stats.total_orgs, icon: "🏢", color: "#8b5cf6" },
    { label: "Total Agents", value: stats.total_agents, icon: "🤖", color: "#10b981" },
    { label: "Active Agents", value: stats.active_agents, icon: "✅", color: "#22c55e" },
    { label: "Locked Agents", value: stats.locked_agents, icon: "🔒", color: "#ef4444" },
    { label: "Agent Groups", value: stats.total_groups, icon: "📁", color: "#f59e0b" },
    { label: "Pending Invites", value: stats.pending_invitations, icon: "✉️", color: "#06b6d4" },
  ] : [];

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#e5e7eb", marginBottom: "0.5rem" }}>
          ⚡ Platform Admin Console
        </h1>
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          God-view over all users, organizations, groups, and agents
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.75rem 1rem", color: "#f87171", marginBottom: "1rem" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "0.75rem 1rem", color: "#4ade80", marginBottom: "1rem" }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "0.5rem 1.25rem", borderRadius: 8, border: "none",
              background: tab === t.key ? "rgba(59,130,246,0.15)" : "transparent",
              color: tab === t.key ? "#60a5fa" : "#9ca3af",
              fontWeight: tab === t.key ? 600 : 400,
              cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>Loading...</div>}

      {/* ═══ Overview Tab ═══ */}
      {!loading && tab === "overview" && stats && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {STAT_CARDS.map((s) => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "1.25rem", textAlign: "center",
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{s.icon}</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <button onClick={() => setTab("users")} style={{
              padding: "1.5rem", borderRadius: 12, border: "1px solid rgba(59,130,246,0.2)",
              background: "rgba(59,130,246,0.05)", color: "#60a5fa", cursor: "pointer",
              fontSize: "1rem", fontWeight: 600, textAlign: "center",
            }}>
              👥 Manage Users →
            </button>
            <button onClick={() => setTab("orgs")} style={{
              padding: "1.5rem", borderRadius: 12, border: "1px solid rgba(139,92,246,0.2)",
              background: "rgba(139,92,246,0.05)", color: "#a78bfa", cursor: "pointer",
              fontSize: "1rem", fontWeight: 600, textAlign: "center",
            }}>
              🏢 Manage Organizations →
            </button>
          </div>
        </div>
      )}

      {/* ═══ Users Tab ═══ */}
      {!loading && tab === "users" && (
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "1rem" }}>
            👥 All Platform Users ({users.length})
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Name", "Email", "Role", "Orgs", "Google", "Verified", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "0.75rem", textAlign: "left", color: "#9ca3af", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", color: "#e5e7eb", fontSize: "0.85rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                        ) : (
                          <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#3b82f6", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#fff" }}>
                            {u.name?.[0] || "?"}
                          </span>
                        )}
                        {u.name}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "#9ca3af", fontSize: "0.8rem" }}>{u.email}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <select
                        value={u.role}
                        onChange={async (e) => {
                          if (u.user_id === user?.user_id) return alert("Cannot change own role");
                          try {
                            await platformAdmin.changeUserRole(u.user_id, e.target.value);
                            setSuccess(`Role updated for ${u.email}`);
                            loadData();
                          } catch (err: any) { setError(err.message); }
                        }}
                        style={{
                          padding: "0.25rem 0.5rem", borderRadius: 4,
                          background: u.role === "ADMIN" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: u.role === "ADMIN" ? "#f59e0b" : "#e5e7eb",
                          fontSize: "0.75rem", cursor: "pointer",
                        }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {u.orgs?.length > 0 ? (
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {u.orgs.map((o: any) => (
                            <span key={o.org_id} style={{
                              padding: "0.15rem 0.5rem", borderRadius: 4,
                              background: "rgba(139,92,246,0.1)", color: "#a78bfa",
                              fontSize: "0.7rem",
                            }}>
                              {o.name} ({o.role})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: u.google_id ? "#22c55e" : "#6b7280", fontSize: "0.8rem" }}>
                      {u.google_id ? "✓" : "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: u.email_verified ? "#22c55e" : "#ef4444", fontSize: "0.8rem" }}>
                      {u.email_verified ? "✓" : "✗"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "#6b7280", fontSize: "0.75rem" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {u.user_id !== user?.user_id && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete user ${u.email}? This is irreversible.`)) return;
                            try {
                              await platformAdmin.deleteUser(u.user_id);
                              setSuccess(`User ${u.email} deleted`);
                              loadData();
                            } catch (err: any) { setError(err.message); }
                          }}
                          style={{
                            padding: "0.25rem 0.5rem", borderRadius: 4,
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            color: "#f87171", fontSize: "0.75rem", cursor: "pointer",
                          }}
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Orgs Tab ═══ */}
      {!loading && tab === "orgs" && (
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "1rem" }}>
            🏢 All Organizations ({orgs.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orgs.map((o) => (
              <div key={o.org_id} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "1.25rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#e5e7eb", margin: 0 }}>
                      🏢 {o.name}
                    </h3>
                    <div style={{ color: "#6b7280", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      Slug: {o.slug} · Owner: {o.owner_email} · Created: {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem", borderRadius: 4,
                      background: o.plan === "enterprise" ? "rgba(245,158,11,0.15)" : o.plan === "pro" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
                      color: o.plan === "enterprise" ? "#f59e0b" : o.plan === "pro" ? "#60a5fa" : "#9ca3af",
                      fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" as const,
                    }}>
                      {o.plan}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(`DELETE org "${o.name}"? This will remove all members, groups, and unlink agents.`)) return;
                        try {
                          await platformAdmin.deleteOrg(o.org_id);
                          setSuccess(`Org "${o.name}" deleted`);
                          loadData();
                        } catch (err: any) { setError(err.message); }
                      }}
                      style={{
                        padding: "0.25rem 0.5rem", borderRadius: 4,
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171", fontSize: "0.75rem", cursor: "pointer",
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>

                {/* Org stats */}
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#3b82f6" }}>👥 {o.member_count}/{o.max_members} members</span>
                  <span style={{ fontSize: "0.8rem", color: "#10b981" }}>🤖 {o.agent_count}/{o.max_agents} agents</span>
                  <span style={{ fontSize: "0.8rem", color: "#f59e0b" }}>📁 {o.group_count} groups</span>
                </div>

                {/* Plan controls */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>Plan:</span>
                  {["free", "pro", "enterprise"].map((p) => (
                    <button
                      key={p}
                      onClick={async () => {
                        try {
                          await platformAdmin.updateOrg(o.org_id, { plan: p });
                          setSuccess(`${o.name} plan updated to ${p}`);
                          loadData();
                        } catch (err: any) { setError(err.message); }
                      }}
                      style={{
                        padding: "0.2rem 0.6rem", borderRadius: 4, border: "none",
                        background: o.plan === p ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)",
                        color: o.plan === p ? "#60a5fa" : "#9ca3af",
                        fontSize: "0.75rem", cursor: "pointer", fontWeight: o.plan === p ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Audit Tab ═══ */}
      {!loading && tab === "audit" && (
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "1rem" }}>
            📋 Platform-Wide Audit Log ({auditLogs.length})
          </h2>
          {auditLogs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>No audit events yet</div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {auditLogs.map((l) => (
                <div key={l.log_id} style={{
                  display: "flex", gap: "0.75rem", alignItems: "flex-start",
                  padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                    {l.action === "INVITE_SENT" ? "✉️" : l.action === "ROLE_CHANGE" ? "🔄" : l.action === "MEMBER_REMOVED" ? "❌" : l.action === "TRANSFER_OWNERSHIP" ? "👑" : "📝"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", color: "#e5e7eb" }}>
                      <span style={{
                        padding: "0.1rem 0.4rem", borderRadius: 3,
                        background: "rgba(139,92,246,0.1)", color: "#a78bfa",
                        fontSize: "0.7rem", marginRight: "0.5rem",
                      }}>
                        {l.org_name}
                      </span>
                      <strong>{l.actor_email}</strong> — {l.details || l.action}
                    </div>
                    {l.target_email && (
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Target: {l.target_email}</div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
