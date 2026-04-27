"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface PolicySummary {
  filename: string; name: string; version: string; agents: string[]; rules_count: number;
}

interface PolicyDetail {
  policy: {
    name: string; version: string; agents: string[];
    rules: { name: string; condition: string; action: string; severity: string; message: string }[];
  };
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [loading, setLoading] = useState(true);
  const [evalResult, setEvalResult] = useState<{ rule_name: string; action: string; severity: string; message: string; policy_file: string }[] | null>(null);
  const [evalAgent, setEvalAgent] = useState("");
  const [evalTool, setEvalTool] = useState("");

  useEffect(() => {
    api.getPolicies().then(p => { setPolicies(p); setLoading(false); });
  }, []);

  const loadPolicy = async (filename: string) => {
    setSelectedFile(filename);
    const data = await api.getPolicy(filename);
    setSelectedPolicy(data as PolicyDetail);
  };

  const runEval = async () => {
    if (!evalAgent) return;
    const result = await api.evaluatePolicy({ agent_id: evalAgent, tool_used: evalTool, confidence_score: 0.5 });
    setEvalResult(result);
  };

  const actionColor: Record<string, string> = {
    BLOCK: "var(--accent-red)", KILL: "#ff1744", WARN: "var(--accent-yellow)",
    REQUIRE_APPROVAL: "var(--accent-purple)", THROTTLE: "var(--accent-cyan)",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📜 Policy-as-Code Engine</h1>
          <p>Define, version, and enforce governance policies in YAML — no code changes required</p>
        </div>
        <span className="timestamp">{policies.length} policies loaded</span>
      </div>

      {/* Policy List */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
        <div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Active Policies</h3>
            </div>
            {loading ? (
              <div style={{ padding: 20 }}><div className="loading-shimmer" /></div>
            ) : policies.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>No policies found</div>
            ) : (
              policies.map(p => (
                <div key={p.filename} onClick={() => loadPolicy(p.filename)} style={{
                  padding: "12px 20px", borderBottom: "1px solid var(--border-color)",
                  cursor: "pointer", transition: "all 0.2s",
                  background: selectedFile === p.filename ? "rgba(99,102,241,0.1)" : "transparent",
                  borderLeft: selectedFile === p.filename ? "3px solid var(--accent-purple)" : "3px solid transparent",
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    v{p.version} · {p.rules_count} rules · Agents: {p.agents.join(", ")}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Policy Evaluator */}
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>🧪 Policy Tester</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Test how policies would evaluate an action
            </p>
            <input className="search-input" placeholder="Agent ID (e.g. agent-008)" value={evalAgent}
              onChange={e => setEvalAgent(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="search-input" placeholder="Tool name (e.g. admin_console)" value={evalTool}
              onChange={e => setEvalTool(e.target.value)} style={{ marginBottom: 12 }} />
            <button className="btn btn-success btn-sm" onClick={runEval} style={{ width: "100%" }}>
              Run Evaluation
            </button>
            {evalResult && (
              <div style={{ marginTop: 12 }}>
                {evalResult.length === 0 ? (
                  <div style={{ padding: 12, textAlign: "center", color: "var(--accent-green)", fontSize: 13 }}>
                    ✅ No violations — action allowed
                  </div>
                ) : (
                  evalResult.map((v, i) => (
                    <div key={i} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border-color)" : "none", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>{v.rule_name}</span>
                        <span style={{ color: actionColor[v.action] || "white", fontWeight: 700, fontSize: 11, padding: "2px 8px", background: "rgba(0,0,0,0.3)", borderRadius: 4 }}>
                          {v.action}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{v.message}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Policy Detail */}
        <div>
          {selectedPolicy ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{selectedPolicy.policy.name}</h3>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Version {selectedPolicy.policy.version} · Applies to: {selectedPolicy.policy.agents.join(", ")}
                  </span>
                </div>
                <code style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-secondary)", color: "var(--accent-cyan)" }}>
                  {selectedFile}
                </code>
              </div>
              {/* Rules */}
              {selectedPolicy.policy.rules.map((rule, idx) => (
                <div key={idx} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{rule.name}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`badge badge-${(rule.severity || "medium").toLowerCase()}`}>{rule.severity}</span>
                      <span style={{ color: actionColor[rule.action] || "white", fontWeight: 700, fontSize: 12, padding: "3px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
                        {rule.action}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <code style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, background: "var(--bg-primary)", color: "var(--accent-yellow)", display: "inline-block" }}>
                      {rule.condition}
                    </code>
                  </div>
                  {rule.message && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{rule.message}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
              <h3>Select a policy to view its rules</h3>
              <p>Policies are defined in YAML files in the <code>policies/</code> directory</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
