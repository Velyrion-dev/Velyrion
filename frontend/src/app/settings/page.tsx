"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, usePermissions, getAccessToken } from "@/lib/auth";
import { orgApi, OrgMember } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import {
  Settings,
  Key,
  Bell,
  Users,
  Shield,
  Lock,
  Copy,
  Check,
  Building2,
  ExternalLink,
  AlertTriangle,
  User,
  Save,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

interface NotifSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { role, isAdmin, isOperator, isViewer } = usePermissions();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"general" | "api" | "notifications" | "team">("general");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile Form
  const [name, setName] = useState(user?.name || "");
  const [theme, setTheme] = useState("dark");
  const [timezone, setTimezone] = useState("UTC");

  // Real Team Members from Organization
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<NotifSetting[]>([
    { id: "violations", label: "Policy Violation Alerts", description: "Immediate notification when agents trigger boundary violations", enabled: true },
    { id: "budget", label: "Token Budget Thresholds", description: "Warning alerts when agents reach 80% and 95% of allocated compute budget", enabled: true },
    { id: "anomaly", label: "Behavioral Drift Detection", description: "Alerts when an agent deviates from its statistical behavioral baseline", enabled: true },
    { id: "kill", label: "Emergency Termination Events", description: "Broadcast alert whenever an automated or manual kill switch is executed", enabled: true },
    { id: "health", label: "Health Degradation Alerts", description: "Notification if an agent health score drops below threshold", enabled: false },
    { id: "reports", label: "Compliance & Audit Digests", description: "Periodic summary reports for SOC2 and regulatory compliance", enabled: false },
  ]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (activeTab === "team") {
      setLoadingMembers(true);
      orgApi
        .getMembers()
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false));
    }
  }, [activeTab]);

  const token = getAccessToken() || "";
  const maskedToken = token ? `${token.slice(0, 10)}••••••••••••••••••••••••${token.slice(-6)}` : "No active session token";

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast("Access token copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleNotif = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("velyrion_theme", theme);
        localStorage.setItem("velyrion_timezone", timezone);
        document.documentElement.setAttribute("data-theme", theme);
      }
      toast("Preferences saved successfully", "success");
    } catch {
      toast("Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "general", label: "General & Profile", icon: Settings },
    { id: "api", label: "API Keys & Access", icon: Key },
    { id: "notifications", label: "Notification Routing", icon: Bell },
    { id: "team", label: "Team & Organization", icon: Users },
  ];

  return (
    <div className="set-page">
      <div className="lb-header">
        <h1 className="lb-title">Platform Settings</h1>
        <p className="lb-subtitle">Organization boundaries, credentials, and operator preferences</p>
      </div>

      <div className="set-main">
        {/* Tab Sidebar */}
        <div className="set-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`set-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id as any)}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <Icon style={{ width: 15, height: 15 }} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="set-content">
          {/* ── 1. General & Profile ── */}
          {activeTab === "general" && (
            <div className="set-section">
              <h2 className="set-section-title">Identity & Workstation Profile</h2>

              <div
                style={{
                  padding: "16px",
                  background: "var(--bg-secondary)",
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "var(--accent-blue)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.name || "Authenticated Operator"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user?.email}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 4,
                      background:
                        role === "ADMIN"
                          ? "rgba(239, 68, 68, 0.15)"
                          : role === "OPERATOR"
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(6, 182, 212, 0.15)",
                      color:
                        role === "ADMIN"
                          ? "var(--accent-red)"
                          : role === "OPERATOR"
                          ? "var(--accent-yellow)"
                          : "var(--accent-cyan)",
                      border: "1px solid currentColor",
                    }}
                  >
                    Role: {role}
                  </span>
                  {user?.org && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      Org: {user.org.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="set-field">
                <label className="set-label">Display Name</label>
                <input
                  className="set-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>

              <div className="set-field">
                <label className="set-label">Registered Email</label>
                <input className="set-input" type="text" value={user?.email || ""} disabled />
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Managed via OAuth / organization identity provider
                </span>
              </div>

              <div className="set-field">
                <label className="set-label">Gateway Endpoint (API Base URL)</label>
                <input className="set-input" type="text" defaultValue={API_BASE} disabled />
              </div>

              <div className="set-field">
                <label className="set-label">Interface Theme</label>
                <div className="set-radio-group">
                  {["dark", "light", "system"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`set-radio ${theme === t ? "active" : ""}`}
                      onClick={() => setTheme(t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="set-field">
                <label className="set-label">Telemetry Timezone</label>
                <select
                  className="set-input"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT / BST)</option>
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={savePreferences}
                disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12 }}
              >
                <Save style={{ width: 14, height: 14 }} />
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          )}

          {/* ── 2. API Keys & Credentials (RBAC PROTECTED) ── */}
          {activeTab === "api" && (
            <div className="set-section">
              <h2 className="set-section-title">API Keys & Programmatic Credentials</h2>

              {isViewer ? (
                /* STRICT RBAC LOCK FOR VIEWERS */
                <div
                  style={{
                    padding: "28px",
                    borderRadius: 12,
                    background: "rgba(239, 68, 68, 0.05)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    textAlign: "center",
                    marginTop: 16,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "var(--accent-red)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <Lock style={{ width: 24, height: 24 }} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-red)", margin: "0 0 8px" }}>
                    Credential Access Restricted
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      maxWidth: 480,
                      margin: "0 auto 16px",
                      lineHeight: 1.5,
                    }}
                  >
                    You are signed in with the <strong>Viewer</strong> role. Production secret keys, webhook signing secrets, and agent deployment tokens are only accessible to Organization Administrators and Operators.
                  </p>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Contact your organization administrator to request elevated permissions.
                  </div>
                </div>
              ) : (
                /* ADMIN & OPERATOR VIEW */
                <>
                  <p className="set-desc">
                    Use scoped Bearer tokens or organization API keys to authenticate AI agents and SDK clients.
                  </p>

                  <div className="set-api-card">
                    <div className="set-api-header">
                      <div>
                        <div className="set-api-name">Active Session Credential</div>
                        <div className="set-api-created">
                          JWT Bearer Token · Scoped to user: {user?.email}
                        </div>
                      </div>
                      <span
                        className="st-service-badge"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                      >
                        Active
                      </span>
                    </div>

                    <div className="set-api-key-row">
                      <code className="set-api-key">
                        {apiKeyVisible ? token : maskedToken}
                      </code>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      >
                        {apiKeyVisible ? "Mask" : "Reveal"}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={copyToken}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                        {copied ? "Copied" : "Copy Token"}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      padding: 16,
                      background: "var(--bg-secondary)",
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      SDK Agent Integration
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
                      Pass your token into the Python SDK or environment variables:
                    </p>
                    <pre
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        background: "var(--bg-primary)",
                        color: "var(--accent-cyan)",
                        fontSize: 12,
                        margin: 0,
                        overflowX: "auto",
                      }}
                    >
                      {`export VELYRION_API_URL="${API_BASE}"\nexport VELYRION_API_KEY="${apiKeyVisible ? token : maskedToken}"`}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 3. Notification Preferences ── */}
          {activeTab === "notifications" && (
            <div className="set-section">
              <h2 className="set-section-title">Notification Routing</h2>
              <p className="set-desc">Configure threshold alerts and operational digest triggers.</p>

              <div className="set-notif-list">
                {notifications.map((n) => (
                  <div key={n.id} className="set-notif-item">
                    <div className="set-notif-info">
                      <div className="set-notif-label">{n.label}</div>
                      <div className="set-notif-desc">{n.description}</div>
                    </div>
                    <button
                      type="button"
                      className={`set-toggle ${n.enabled ? "on" : "off"}`}
                      onClick={() => toggleNotif(n.id)}
                    >
                      <div className="set-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={savePreferences}
                style={{ marginTop: 16 }}
              >
                Save Preferences
              </button>
            </div>
          )}

          {/* ── 4. Team & Organization ── */}
          {activeTab === "team" && (
            <div className="set-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <h2 className="set-section-title" style={{ margin: 0 }}>
                    Organization Roster
                  </h2>
                  <p className="set-desc" style={{ margin: "4px 0 0" }}>
                    Active members with access to {user?.org?.name || "this workspace"}.
                  </p>
                </div>

                <Link
                  href="/org"
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Building2 style={{ width: 14, height: 14 }} />
                  Full Org Console <ExternalLink style={{ width: 12, height: 12 }} />
                </Link>
              </div>

              {isViewer && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(6, 182, 212, 0.08)",
                    border: "1px solid rgba(6, 182, 212, 0.2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--accent-cyan)",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Shield style={{ width: 14, height: 14 }} />
                  Viewing organization in audit mode. Membership modifications require Administrator privileges.
                </div>
              )}

              {loadingMembers ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  Loading organization members...
                </div>
              ) : members.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: "center",
                    background: "var(--bg-secondary)",
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <User style={{ width: 32, height: 32, opacity: 0.4, margin: "0 auto 12px" }} />
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    {user?.name || "Current Operator"} ({user?.email})
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                    Role: {role} · Organization: {user?.org?.name || "Default Workspace"}
                  </div>
                  <Link href="/org" className="btn btn-secondary btn-sm">
                    Manage Members in Organization Console →
                  </Link>
                </div>
              ) : (
                <div className="set-team-list">
                  {members.map((m) => (
                    <div key={m.user_id} className="set-team-card">
                      <div className="set-team-avatar">
                        {m.name ? m.name.slice(0, 2).toUpperCase() : "U"}
                      </div>
                      <div className="set-team-info">
                        <div className="set-team-name">{m.name}</div>
                        <div className="set-team-email">{m.email}</div>
                      </div>
                      <span className="set-team-role">{m.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
