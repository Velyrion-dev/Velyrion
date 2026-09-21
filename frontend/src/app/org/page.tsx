"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { orgApi, OrgMember, OrgInvitation } from "@/lib/api";

const ORG_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATOR", "VIEWER"];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "#f59e0b",
  ADMIN: "#8b5cf6",
  OPERATOR: "#3b82f6",
  VIEWER: "#6b7280",
};

const ROLE_ICONS: Record<string, string> = {
  SUPER_ADMIN: "👑",
  ADMIN: "🛡️",
  OPERATOR: "⚙️",
  VIEWER: "👁️",
};

const PLAN_BADGES: Record<string, { bg: string; text: string }> = {
  free: { bg: "rgba(107,114,128,0.15)", text: "#9ca3af" },
  pro: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" },
  enterprise: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
};

export default function OrgPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [inviting, setInviting] = useState(false);

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const orgRole = user?.org?.role || "";
  const isSuperAdmin = orgRole === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || orgRole === "ADMIN";

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const orgData = await orgApi.getOrg();
      setOrg(orgData);

      if (orgData.org_id) {
        const memberData = await orgApi.getMembers();
        setMembers(memberData);
        if (isAdmin) {
          try {
            const invData = await orgApi.getInvitations();
            setInvitations(invData);
          } catch { setInvitations([]); }
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    setSuccess("");
    try {
      const res = await orgApi.inviteMember(inviteEmail.trim(), inviteRole);
      setSuccess(`Invitation sent to ${inviteEmail}! Token: ${res.token}`);
      setInviteEmail("");
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    setError("");
    setSuccess("");
    try {
      await orgApi.changeMemberRole(userId, newRole);
      setSuccess("Role updated successfully");
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to change role");
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    setError("");
    try {
      await orgApi.removeMember(userId);
      setSuccess(`${name} has been removed`);
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem", animation: "pulse 1.5s infinite" }}>🏢</div>
          <div style={{ color: "#9ca3af" }}>Loading organization...</div>
        </div>
      </div>
    );
  }

  if (!org?.org_id) {
    return (
      <div style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>🏢</div>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#e5e7eb" }}>No Organization Yet</h2>
        <p style={{ color: "#9ca3af", marginBottom: "2rem" }}>Create or join an organization to start managing your agents collaboratively.</p>
      </div>
    );
  }

  const planBadge = PLAN_BADGES[org.plan] || PLAN_BADGES.free;

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f3f4f6", margin: 0 }}>
            🏢 {org.name}
          </h1>
          <span style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            background: planBadge.bg,
            color: planBadge.text,
          }}>
            {org.plan}
          </span>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          /{org.slug} · {org.member_count} members · {org.agent_count} agents · Your role: {ROLE_ICONS[orgRole]} {orgRole}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171",
        }}>
          ❌ {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{
          padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8,
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80",
        }}>
          ✅ {success}
          <button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", color: "#4ade80", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Members", value: org.member_count, max: org.max_members, icon: "👥", color: "#8b5cf6" },
          { label: "Agents", value: org.agent_count, max: org.max_agents, icon: "🤖", color: "#3b82f6" },
          { label: "Plan", value: org.plan.charAt(0).toUpperCase() + org.plan.slice(1), icon: "💎", color: "#f59e0b" },
          { label: "Your Role", value: orgRole, icon: ROLE_ICONS[orgRole] || "👤", color: ROLE_COLORS[orgRole] || "#6b7280" },
        ].map((card) => (
          <div key={card.label} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "1.25rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ color: "#9ca3af", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</span>
              <span style={{ fontSize: "1.25rem" }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.max && <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>of {card.max} max</div>}
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "1.5rem", marginBottom: "2rem",
      }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "1rem" }}>
          👥 Team Members ({members.length})
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Member", "Role", "Joined", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                  <th key={h} style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${ROLE_COLORS[m.role] || "#6b7280"}, #1f2937)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.875rem", fontWeight: 600, color: "#fff",
                      }}>
                        {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} /> : m.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: "#e5e7eb", fontSize: "0.875rem" }}>
                          {m.name} {m.user_id === user?.user_id && <span style={{ color: "#6b7280" }}>(you)</span>}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    {isSuperAdmin && m.user_id !== user?.user_id && m.role !== "SUPER_ADMIN" ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                        disabled={changingRole === m.user_id}
                        style={{
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 6, padding: "0.375rem 0.5rem", color: ROLE_COLORS[m.role],
                          fontSize: "0.8rem", cursor: "pointer",
                        }}
                      >
                        {ORG_ROLES.filter(r => r !== "SUPER_ADMIN").map(r => (
                          <option key={r} value={r}>{ROLE_ICONS[r]} {r}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.35rem",
                        padding: "0.25rem 0.625rem", borderRadius: 6,
                        background: `${ROLE_COLORS[m.role]}22`,
                        color: ROLE_COLORS[m.role],
                        fontSize: "0.8rem", fontWeight: 500,
                      }}>
                        {ROLE_ICONS[m.role]} {m.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem", color: "#9ca3af", fontSize: "0.8rem" }}>
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—"}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "0.75rem" }}>
                      {m.user_id !== user?.user_id && m.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={() => handleRemove(m.user_id, m.name)}
                          style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                            color: "#f87171", borderRadius: 6, padding: "0.35rem 0.75rem",
                            fontSize: "0.75rem", cursor: "pointer", transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Section */}
      {isAdmin && (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "1.5rem", marginBottom: "2rem",
        }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "1rem" }}>
            ✉️ Invite Member
          </h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                flex: "1 1 250px", padding: "0.625rem 1rem", borderRadius: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                color: "#e5e7eb", fontSize: "0.875rem", outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{
                padding: "0.625rem 0.75rem", borderRadius: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                color: "#e5e7eb", fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              {ORG_ROLES.filter(r => r !== "SUPER_ADMIN").map(r => (
                <option key={r} value={r}>{ROLE_ICONS[r]} {r}</option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={{
                padding: "0.625rem 1.5rem", borderRadius: 8, border: "none",
                background: inviting ? "#4b5563" : "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: "#fff", fontWeight: 600, cursor: inviting ? "default" : "pointer",
                fontSize: "0.875rem", transition: "all 0.2s",
              }}
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <h3 style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "0.75rem" }}>
                Pending Invitations ({invitations.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {invitations.map((inv) => (
                  <div key={inv.invite_id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.625rem 0.875rem", borderRadius: 8,
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div>
                      <span style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>{inv.email}</span>
                      <span style={{
                        marginLeft: "0.5rem", padding: "0.125rem 0.5rem", borderRadius: 4,
                        background: `${ROLE_COLORS[inv.role]}22`, color: ROLE_COLORS[inv.role],
                        fontSize: "0.7rem",
                      }}>
                        {inv.role}
                      </span>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
