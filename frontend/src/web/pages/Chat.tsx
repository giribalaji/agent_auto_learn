import { useState, useRef, useEffect } from "react";
import { chatWithAgent } from "../lib/api";

const AGENTS = [
  { type: "onboarding", name: "Onboarding Agent", color: "#00ff9d", icon: "🚀", desc: "New customer setup & guidance" },
  { type: "billing", name: "Billing Agent", color: "#00d4ff", icon: "💳", desc: "Invoices, payments & billing" },
  { type: "analytics", name: "Analytics Agent", color: "#8b5cf6", icon: "📊", desc: "Usage patterns & insights" },
  { type: "support", name: "Support Agent", color: "#f59e0b", icon: "🎧", desc: "Customer issues & tickets" },
];

const SUGGESTIONS: Record<string, string[]> = {
  onboarding: ["Show me customers not yet onboarded", "Walk me through onboarding customer 3", "How many customers still need setup?"],
  billing: ["Show billing summary", "List all overdue invoices", "Mark invoice 1 as paid"],
  analytics: ["Show usage metrics for last 30 days", "Which products have highest usage?", "Identify churn risk customers"],
  support: ["Show all open tickets", "What are high priority issues?", "Resolve ticket 1"],
};

interface Message {
  role: "user" | "assistant";
  content: string;
  agent?: string;
  tool_calls?: any[];
  iterations?: number;
}

export default function Chat() {
  const [activeAgent, setActiveAgent] = useState("support");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = AGENTS.find(a => a.type === activeAgent)!;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleAgentSwitch = (type: string) => {
    setActiveAgent(type);
    setMessages([]);
    setHistory([]);
    setInput("");
  };

  const send = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const newHistory = [...history, { role: "user", content: text }];

    try {
      const res = await chatWithAgent(text, activeAgent, history);
      const assistantMsg: Message = {
        role: "assistant",
        content: res.response || "No response",
        agent: activeAgent,
        tool_calls: res.tool_calls || [],
        iterations: res.iterations,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setHistory([...newHistory, { role: "assistant", content: res.response }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Connection error. Make sure the backend is running.",
        agent: activeAgent,
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="fade-up" style={{ display: "flex", gap: 16, height: "calc(100vh - 100px)" }}>
      {/* Agent Selector */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 12 }}>SELECT AGENT</div>
        {AGENTS.map(a => (
          <div key={a.type} onClick={() => handleAgentSwitch(a.type)} style={{
            padding: "12px 14px", borderRadius: 6, marginBottom: 8,
            border: `1px solid ${activeAgent === a.type ? a.color + "40" : "#1a2540"}`,
            background: activeAgent === a.type ? `${a.color}08` : "transparent",
            cursor: "pointer", transition: "all 0.15s"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span>{a.icon}</span>
              <span style={{ fontSize: 12, color: activeAgent === a.type ? a.color : "#e2e8f0" }}>{a.name}</span>
            </div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{a.desc}</div>
            {activeAgent === a.type && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                <div className="pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 9, color: a.color, letterSpacing: "0.1em" }}>HERMES LOOP ACTIVE</span>
              </div>
            )}
          </div>
        ))}

        {/* Suggestions */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>QUICK PROMPTS</div>
          {(SUGGESTIONS[activeAgent] || []).map(s => (
            <div key={s} onClick={() => send(s)} style={{
              padding: "8px 10px", borderRadius: 4, marginBottom: 6,
              background: "rgba(255,255,255,0.02)", border: "1px solid #1a2540",
              cursor: "pointer", fontSize: 11, color: "#64748b",
              transition: "all 0.1s"
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = agent.color + "40"; (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a2540"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="card" style={{ padding: "14px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: agent.color }} className="pulse" />
          <div>
            <span className="font-display" style={{ fontSize: 13, color: agent.color }}>{agent.name}</span>
            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 10 }}>Powered by Hermes Agent Loop · OpenRouter</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{agent.icon}</div>
              <div className="font-display" style={{ fontSize: 14, color: agent.color, marginBottom: 8 }}>{agent.name}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{agent.desc}</div>
              <div style={{ fontSize: 11, color: "#1a2540", marginTop: 8 }}>Ask me anything — I'll use real data from your subscriptions</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 12
            }}>
              <div style={{ maxWidth: "80%" }}>
                {msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {msg.tool_calls.map((tc: any, j: number) => (
                      <div key={j} style={{
                        fontSize: 10, color: "#64748b", padding: "3px 8px",
                        background: "rgba(255,255,255,0.03)", borderRadius: 4,
                        border: "1px solid #1a2540", marginBottom: 4,
                        fontFamily: "Space Mono"
                      }}>
                        ⚡ {tc.tool}({Object.entries(tc.args || {}).map(([k, v]) => `${k}=${v}`).join(", ")})
                      </div>
                    ))}
                  </div>
                )}
                <div style={{
                  padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
                  background: msg.role === "user" ? `${agent.color}15` : "#0d1424",
                  border: `1px solid ${msg.role === "user" ? agent.color + "30" : "#1a2540"}`,
                  fontSize: 12, color: "#e2e8f0", lineHeight: 1.6,
                  whiteSpace: "pre-wrap"
                }}>
                  {msg.content}
                </div>
                {msg.iterations && (
                  <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, textAlign: "right" }}>
                    {msg.iterations} iterations · Hermes loop
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0" }}>
              <div style={{ padding: "10px 14px", background: "#0d1424", border: "1px solid #1a2540", borderRadius: "2px 12px 12px 12px" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color }} />
                  <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color, animationDelay: "0.2s" }} />
                  <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color, animationDelay: "0.4s" }} />
                  <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>Hermes loop running...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`Ask ${agent.name}...`}
            style={{
              flex: 1, padding: "12px 16px", background: "#0d1424",
              border: `1px solid ${input ? agent.color + "40" : "#1a2540"}`,
              borderRadius: 6, color: "#e2e8f0", fontSize: 12,
              outline: "none", fontFamily: "JetBrains Mono", transition: "border-color 0.2s"
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            padding: "12px 20px", borderRadius: 6,
            background: loading ? "rgba(0,212,255,0.05)" : `${agent.color}15`,
            border: `1px solid ${agent.color}30`, color: agent.color,
            cursor: loading ? "not-allowed" : "pointer", fontSize: 12,
            fontFamily: "Space Mono", transition: "all 0.15s",
            opacity: loading || !input.trim() ? 0.5 : 1
          }}>SEND</button>
        </div>
      </div>
    </div>
  );
}
