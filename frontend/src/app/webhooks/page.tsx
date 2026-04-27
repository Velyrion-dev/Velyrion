"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/auth";

interface Webhook {
  id: number; name: string; url: string; channel: string;
  events: string[]; severity_filter: string[]; enabled: boolean;
  deliveries: number; failures: number;
}

interface Delivery {
  alert_id: string; type: string; agent_id: string; description: string;
  severity: string; channel: string; delivered: boolean; timestamp: string;
}

const CHANNELS = [
  { value: "slack", label: "Slack", icon: "💬", color: "#4A154B" },
  { value: "pagerduty", label: "PagerDuty", icon: "🔔", color: "#06AC38" },
  { value: "custom", label: "Custom URL", icon: "🔗", color: "#6366F1" },
];

const EVENT_TYPES = ["VIOLATION", "INCIDENT", "ANOMALY", "HITL_REQUIRED"];
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);
  const { canManageWebhooks } = usePermissions();

  const reload = useCallback(() => {
    Promise.all([api.getWebhooks(), api.getWebhookDeliveries(20)]).then(([wh, dl]) => {
      setWebhooks(wh);
      setDeliveries(dl);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (id: number) => {
    await api.toggleWebhook(id);
    reload();
  };

  const handleTest = async (id: number) => {
    setTestResult(null);
    const result = await api.testWebhook(id);
    setTestResult({ id, ...result });
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleDelete = async (id: number) => {
    await api.deleteWebhook(id);
    reload();
  };

  const channelInfo = (ch: string) => CHANNELS.find(c => c.value === ch) || CHANNELS[2];

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>🔗 Webhook Integrations</h1>
          <p>Route governance events to Slack, PagerDuty, or any HTTP endpoint</p>
        </div>
        {canManageWebhooks && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "✕ Close" : "+ Add Webhook"}
          </button>
        )}
      </div>

      {showForm && canManageWebhooks && <WebhookForm onDone={() => { setShowForm(false); reload(); }} />}

      {/* Webhook Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[...Array(2)].map((_, i) => <div key={i} className="card" style={{ padding: 20, height: 140 }}><div className="loading-shimmer" style={{ height: 100 }} /></div>)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h3>No webhooks configured</h3>
          <p>Add a Slack, PagerDuty, or custom webhook to receive real-time governance alerts</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {webhooks.filter(w => !w.name.startsWith("[DELETED]")).map(wh => {
            const ch = channelInfo(wh.channel);
            const totalDeliveries = wh.deliveries + wh.failures;
            const successRate = totalDeliveries > 0 ? Math.round((wh.deliveries / totalDeliveries) * 100) : 100;

            return (
              <div key={wh.id} className="card" style={{
                padding: 20,
                opacity: wh.enabled ? 1 : 0.5,
                borderLeft: `3px solid ${wh.enabled ? ch.color : "var(--border-color)"}`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{ch.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{wh.name}</span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: wh.enabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.1)",
                        color: wh.enabled ? "var(--accent-green)" : "var(--text-muted)",
                        fontWeight: 600,
                      }}>
                        {wh.enabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>
                      {wh.url.length > 50 ? wh.url.slice(0, 47) + "..." : wh.url}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleTest(wh.id)}
                      style={{ fontSize: 10, padding: "4px 10px", background: "rgba(99,102,241,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer", borderRadius: 4 }}>
                      🧪 Test
                    </button>
                    {canManageWebhooks && (
                      <>
                        <button onClick={() => handleToggle(wh.id)}
                          style={{ fontSize: 10, padding: "4px 10px", background: "rgba(251,191,36,0.15)", color: "var(--accent-yellow)", border: "1px solid rgba(251,191,36,0.3)", cursor: "pointer", borderRadius: 4 }}>
                          {wh.enabled ? "⏸ Disable" : "▶ Enable"}
                        </button>
                        <button onClick={() => handleDelete(wh.id)}
                          style={{ fontSize: 10, padding: "4px 10px", background: "rgba(239,68,68,0.1)", color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", borderRadius: 4 }}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Test Result Banner */}
                {testResult && testResult.id === wh.id && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, marginBottom: 10, fontSize: 12,
                    background: testResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: testResult.success ? "var(--accent-green)" : "var(--accent-red)",
                    border: `1px solid ${testResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}>
                    {testResult.success ? "✅" : "❌"} {testResult.message}
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Delivered: </span>
                    <strong style={{ color: "var(--accent-green)" }}>{wh.deliveries}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Failed: </span>
                    <strong style={{ color: wh.failures > 0 ? "var(--accent-red)" : "var(--text-muted)" }}>{wh.failures}</strong>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Rate: </span>
                    <strong style={{ color: successRate >= 95 ? "var(--accent-green)" : successRate >= 80 ? "var(--accent-yellow)" : "var(--accent-red)" }}>{successRate}%</strong>
                  </div>
                </div>

                {/* Event + Severity Tags */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {wh.events.map(ev => (
                    <span key={ev} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(99,102,241,0.1)", color: "var(--accent-purple)", fontWeight: 600 }}>
                      {ev}
                    </span>
                  ))}
                  {wh.severity_filter.map(s => (
                    <span key={s} className={`badge badge-${s.toLowerCase()}`} style={{ fontSize: 9, padding: "1px 5px" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delivery Log */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>📋 Recent Alert Deliveries</h3>
        </div>
        {deliveries.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No deliveries yet
          </div>
        ) : (
          <div style={{ maxHeight: 350, overflowY: "auto" }}>
            {deliveries.map((d, i) => (
              <div key={d.alert_id || i} style={{
                padding: "10px 20px", borderBottom: "1px solid var(--border-color)",
                display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14 }}>{d.delivered ? "✅" : "❌"}</span>
                  <span className={`badge badge-${d.severity.toLowerCase()}`} style={{ fontSize: 9 }}>{d.severity}</span>
                  <code style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--bg-secondary)", color: "var(--accent-cyan)" }}>{d.type}</code>
                  <span style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.description}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text-muted)" }}>
                  <span>{d.channel}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10 }}>{d.agent_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WebhookForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", url: "", channel: "custom",
    events: [...EVENT_TYPES], severity_filter: [...SEVERITIES],
    slack_channel: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleEvent = (ev: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  };

  const toggleSeverity = (s: string) => {
    setForm(f => ({
      ...f,
      severity_filter: f.severity_filter.includes(s) ? f.severity_filter.filter(x => x !== s) : [...f.severity_filter, s],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.url) { setError("Name and URL are required"); return; }
    setSubmitting(true);
    try {
      await api.createWebhook(form);
      onDone();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20, padding: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>➕ Register Webhook</h3>
      {error && <div style={{ color: "var(--accent-red)", fontSize: 13, marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)" }}>✕ {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Name *</label>
          <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Slack #security-alerts" required />
        </div>
        <div>
          <label style={labelStyle}>Endpoint URL *</label>
          <input style={inputStyle} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://hooks.slack.com/services/..." required />
        </div>
        <div>
          <label style={labelStyle}>Channel Type</label>
          <select className="filter-select" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} style={{ width: "100%", height: 42 }}>
            {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Event Types */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Events to Forward</label>
        <div style={{ display: "flex", gap: 8 }}>
          {EVENT_TYPES.map(ev => (
            <button type="button" key={ev} onClick={() => toggleEvent(ev)} style={{
              fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
              background: form.events.includes(ev) ? "rgba(99,102,241,0.2)" : "var(--bg-secondary)",
              color: form.events.includes(ev) ? "var(--accent-purple)" : "var(--text-muted)",
              border: form.events.includes(ev) ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--border-subtle)",
              fontWeight: 600,
            }}>{ev}</button>
          ))}
        </div>
      </div>

      {/* Severity Filter */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Severity Filter</label>
        <div style={{ display: "flex", gap: 8 }}>
          {SEVERITIES.map(s => (
            <button type="button" key={s} onClick={() => toggleSeverity(s)} style={{
              fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
              background: form.severity_filter.includes(s) ? "rgba(251,191,36,0.15)" : "var(--bg-secondary)",
              color: form.severity_filter.includes(s) ? "var(--accent-yellow)" : "var(--text-muted)",
              border: form.severity_filter.includes(s) ? "1px solid rgba(251,191,36,0.4)" : "1px solid var(--border-subtle)",
              fontWeight: 600,
            }}>{s}</button>
          ))}
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Creating..." : "Create Webhook"}
      </button>
    </form>
  );
}
