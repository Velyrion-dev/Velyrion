"use client";
import { useEffect, useState, useCallback } from "react";
import { api, ApprovalRequest } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const reload = useCallback(() => api.getApprovals().then(setApprovals), []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const interval = setInterval(reload, 10000);
    return () => clearInterval(interval);
  }, [reload]);

  const handle = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      if (action === "approve") await api.approveRequest(id);
      else await api.rejectRequest(id);
      toast(`Request ${action}d successfully`, "success");
      await reload();
    } catch {
      toast(`Failed to ${action} request`, "error");
    }
    finally { setProcessing(null); }
  };

  const pending = approvals.filter(a => a.status === "PENDING");
  const resolved = approvals.filter(a => a.status !== "PENDING");

  return (
    <div>
      <div className="page-header">
        <h1>Human-in-the-Loop Approvals</h1>
        <p>Actions requiring human review before proceeding</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card yellow">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{pending.length}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{approvals.filter(a => a.status === "APPROVED").length}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Rejected</div>
          <div className="stat-value">{approvals.filter(a => a.status === "REJECTED").length}</div>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 8 }}>⏳ Pending Approvals</h3>
          {pending.map(a => (
            <div key={a.request_id} className="card" style={{ marginBottom: 12, borderLeft: "3px solid var(--accent-yellow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div className="cell-primary" style={{ marginBottom: 4 }}>{a.task_description}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                    Agent: <code style={{ color: "var(--accent-cyan)" }}>{a.agent_id}</code> · {formatTime(a.timestamp)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--accent-yellow)" }}>Reason: {a.reason}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-success btn-sm" onClick={() => handle(a.request_id, "approve")} disabled={processing === a.request_id}>
                    {processing === a.request_id ? "..." : "✓ Approve"}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handle(a.request_id, "reject")} disabled={processing === a.request_id}>
                    {processing === a.request_id ? "..." : "✕ Reject"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {pending.length === 0 && !loading && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ color: "var(--accent-green)", marginBottom: 8 }}>All Clear</h3>
          <p style={{ color: "var(--text-muted)" }}>No pending approvals. All agent actions reviewed.</p>
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 24 }}>📜 History</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Timestamp</th><th>Agent</th><th>Task</th><th>Reason</th><th>Decision</th></tr></thead>
              <tbody>
                {resolved.map(a => (
                  <tr key={a.request_id}>
                    <td className="timestamp">{formatTime(a.timestamp)}</td>
                    <td><code style={{ fontSize: 11, color: "var(--accent-cyan)" }}>{a.agent_id}</code></td>
                    <td className="cell-primary" style={{ fontSize: 12 }}>{a.task_description}</td>
                    <td style={{ fontSize: 12 }}>{a.reason}</td>
                    <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
