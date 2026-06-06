"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

interface NotifSetting { id: string; label: string; description: string; enabled: boolean; }

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState<NotifSetting[]>([
    { id: "violations", label: "Violation Alerts", description: "Get notified when agents trigger policy violations", enabled: true },
    { id: "budget", label: "Budget Warnings", description: "Alert when agents approach token budget limits", enabled: true },
    { id: "anomaly", label: "Anomaly Detection", description: "Real-time alerts for detected behavioral anomalies", enabled: true },
    { id: "kill", label: "Kill Switch Events", description: "Notify when agents are killed or locked", enabled: true },
    { id: "health", label: "Health Degradation", description: "Alert when agent health score drops below threshold", enabled: false },
    { id: "reports", label: "Weekly Reports", description: "Receive weekly compliance summary reports", enabled: false },
  ]);
  const [theme, setTheme] = useState("dark");
  const [timezone, setTimezone] = useState("UTC");
  const [saved, setSaved] = useState(false);

  const mockApiKey = "vlr_sk_" + "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8";

  const copyApiKey = () => {
    navigator.clipboard.writeText(mockApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleNotif = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n));
  };

  const saveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS = [
    { id: "general", label: "General", icon: "⚙️" },
    { id: "api", label: "API Keys", icon: "🔑" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "team", label: "Team", icon: "👥" },
  ];

  return (
    <div className="set-page">
      <div className="lb-header">
        <h1 className="lb-title">⚙️ Settings</h1>
        <p className="lb-subtitle">Platform configuration and preferences</p>
      </div>

      <div className="set-main">
        {/* Tab Sidebar */}
        <div className="set-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`set-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="set-content">
          {/* General */}
          {activeTab === "general" && (
            <div className="set-section">
              <h2 className="set-section-title">General Settings</h2>
              <div className="set-field">
                <label className="set-label">Platform Name</label>
                <input className="set-input" type="text" defaultValue="Velyrion" disabled />
              </div>
              <div className="set-field">
                <label className="set-label">API Base URL</label>
                <input className="set-input" type="text" defaultValue={API_BASE} disabled />
              </div>
              <div className="set-field">
                <label className="set-label">Theme</label>
                <div className="set-radio-group">
                  {["dark", "light", "system"].map(t => (
                    <button key={t} className={`set-radio ${theme === t ? "active" : ""}`} onClick={() => setTheme(t)}>
                      {t === "dark" ? "🌙" : t === "light" ? "☀️" : "💻"} {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="set-field">
                <label className="set-label">Timezone</label>
                <select className="set-input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={saveSettings}>{saved ? "✓ Saved!" : "Save Changes"}</button>
            </div>
          )}

          {/* API Keys */}
          {activeTab === "api" && (
            <div className="set-section">
              <h2 className="set-section-title">API Keys</h2>
              <p className="set-desc">Use API keys to authenticate requests to the Velyrion API.</p>

              <div className="set-api-card">
                <div className="set-api-header">
                  <div>
                    <div className="set-api-name">Production Key</div>
                    <div className="set-api-created">Created Jan 15, 2025</div>
                  </div>
                  <span className="st-service-badge" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>Active</span>
                </div>
                <div className="set-api-key-row">
                  <code className="set-api-key">{apiKeyVisible ? mockApiKey : "vlr_sk_" + "•".repeat(32)}</code>
                  <button className="btn btn-ghost btn-sm" onClick={() => setApiKeyVisible(!apiKeyVisible)}>{apiKeyVisible ? "🙈 Hide" : "👁️ Show"}</button>
                  <button className="btn btn-primary btn-sm" onClick={copyApiKey}>{copied ? "✓ Copied" : "📋 Copy"}</button>
                </div>
              </div>

              <div className="set-api-card" style={{ opacity: 0.6 }}>
                <div className="set-api-header">
                  <div>
                    <div className="set-api-name">Test Key</div>
                    <div className="set-api-created">For development and testing</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">+ Generate</button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <div className="set-section">
              <h2 className="set-section-title">Notification Preferences</h2>
              <p className="set-desc">Choose which events trigger notifications.</p>
              <div className="set-notif-list">
                {notifications.map(n => (
                  <div key={n.id} className="set-notif-item">
                    <div className="set-notif-info">
                      <div className="set-notif-label">{n.label}</div>
                      <div className="set-notif-desc">{n.description}</div>
                    </div>
                    <button className={`set-toggle ${n.enabled ? "on" : "off"}`} onClick={() => toggleNotif(n.id)}>
                      <div className="set-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={saveSettings} style={{ marginTop: 16 }}>{saved ? "✓ Saved!" : "Save Preferences"}</button>
            </div>
          )}

          {/* Team */}
          {activeTab === "team" && (
            <div className="set-section">
              <h2 className="set-section-title">Team Members</h2>
              <p className="set-desc">Manage who has access to the Velyrion platform.</p>
              <div className="set-team-list">
                {[
                  { name: "Admin User", email: "admin@velyrion.com", role: "Owner", avatar: "AU" },
                  { name: "Security Lead", email: "security@velyrion.com", role: "Admin", avatar: "SL" },
                  { name: "DevOps Engineer", email: "devops@velyrion.com", role: "Viewer", avatar: "DE" },
                ].map((m, i) => (
                  <div key={i} className="set-team-card">
                    <div className="set-team-avatar">{m.avatar}</div>
                    <div className="set-team-info">
                      <div className="set-team-name">{m.name}</div>
                      <div className="set-team-email">{m.email}</div>
                    </div>
                    <span className="set-team-role">{m.role}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 12 }}>+ Invite Team Member</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
