"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Bot,
  User as UserIcon,
  Send,
  Sparkles,
  RefreshCw,
  HelpCircle,
  ShieldCheck
} from "lucide-react";

interface Message {
  role: "user" | "copilot";
  content: string;
  timestamp: string;
  dataPoints?: number;
}

const SUGGESTIONS = [
  "Which agents have the highest risk?",
  "How can I reduce total fleet cost?",
  "Are there any agents exceeding budget?",
  "Recommend governance policies for new agents",
  "What is our regulatory compliance status?",
  "Show me recent anomaly patterns and trends",
];

export default function CopilotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "copilot",
      content: "Hello! I am your Velyrion Fleet Governance Copilot. I analyze your agents, token budgets, policy violations, and compliance posture in real time. Ask me anything about your active fleet.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = async (contentToSend: string) => {
    const text = contentToSend.trim();
    if (!text || thinking) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const res = await api.askCopilot(text);
      setMessages(prev => [
        ...prev,
        {
          role: "copilot",
          content: res.response || "No response received from governance assistant.",
          timestamp: new Date().toISOString(),
          dataPoints: res.data_points,
        },
      ]);
    } catch (err: unknown) {
      setMessages(prev => [
        ...prev,
        {
          role: "copilot",
          content: `⚠️ Failed to query Copilot engine: ${err instanceof Error ? err.message : "Service unavailable"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="cp-page">
      <div className="cp-header">
        <div>
          <h1 className="lb-title">Governance AI Copilot</h1>
          <p className="lb-subtitle">Autonomous fleet intelligence powered by real-time audit and policy metrics</p>
        </div>
      </div>

      <div className="cp-main">
        <div className="cp-chat" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`cp-msg ${m.role}`}>
              <div className="cp-msg-avatar">
                {m.role === "copilot" ? (
                  <Bot style={{ width: 16, height: 16, color: "var(--accent-cyan)" }} />
                ) : (
                  <UserIcon style={{ width: 16, height: 16, color: "var(--accent-purple)" }} />
                )}
              </div>
              <div className="cp-msg-body">
                <div className="cp-msg-header">
                  <span className="cp-msg-author">{m.role === "copilot" ? "Velyrion Copilot" : (user?.name || "You")}</span>
                  <span className="cp-msg-time">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="cp-msg-content" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {m.content}
                </div>
                {m.dataPoints !== undefined && m.dataPoints > 0 && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck style={{ width: 12, height: 12, color: "var(--accent-green)" }} />
                    <span>Cross-referenced against {m.dataPoints} live fleet data points</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="cp-msg copilot">
              <div className="cp-msg-avatar">
                <Bot style={{ width: 16, height: 16, color: "var(--accent-cyan)" }} />
              </div>
              <div className="cp-msg-body">
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                  <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                  <span>Analyzing fleet telemetry and running policy correlations...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="cp-suggestions">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <Sparkles style={{ width: 13, height: 13, color: "var(--accent-cyan)" }} />
            <span>Suggested prompts:</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: "5px 10px" }}
                onClick={() => handleSend(s)}
                disabled={thinking}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="cp-input-bar">
          <input
            className="cp-input"
            placeholder="Ask about agent risk, budget burn, compliance, or policy recommendations..."
            value={input}
            disabled={thinking}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend(input)}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSend(input)}
            disabled={thinking || !input.trim()}
          >
            <Send style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
