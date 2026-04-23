import { useState, useEffect } from "react";

const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    placeholder: "sk-or-v1-...",
    hint: "Get your key at openrouter.ai — free tier available",
    defaultModel: "google/gemma-4-31b-it:free",
    modelHint: "Free: google/gemma-4-31b-it:free · qwen/qwen3-coder:free · openai/gpt-oss-120b:free",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    placeholder: "gsk_...",
    hint: "Get your key at console.groq.com — free tier available",
    defaultModel: "llama-3.3-70b-versatile",
    modelHint: "Fast models: llama-3.3-70b-versatile · llama-3.1-8b-instant · mixtral-8x7b-32768",
  },
];

export default function Settings() {
  const [provider, setProvider] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(PROVIDERS[0].defaultModel);
  const [saved, setSaved] = useState(false);

  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  useEffect(() => {
    const savedProvider = localStorage.getItem("subsync_provider") || "openrouter";
    const prov = PROVIDERS.find(p => p.id === savedProvider) || PROVIDERS[0];
    setProvider(savedProvider);
    setApiKey(localStorage.getItem(`${savedProvider}_key`) || "");
    setModel(localStorage.getItem("subsync_model") || prov.defaultModel);
  }, []);

  // When provider changes, load that provider's saved key
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const prov = PROVIDERS.find(p => p.id === newProvider)!;
    setApiKey(localStorage.getItem(`${newProvider}_key`) || "");
    setModel(localStorage.getItem("subsync_model") || prov.defaultModel);
  };

  const save = async () => {
    localStorage.setItem("subsync_provider", provider);
    localStorage.setItem(`${provider}_key`, apiKey);
    localStorage.setItem("subsync_model", model);

    try {
      await fetch("http://localhost:8765/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: apiKey,
          model,
          base_url: currentProvider.baseUrl,
        }),
      });
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fade-up" style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>SETTINGS</h1>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Configure AI agents & integrations</div>
      </div>

      {/* AI Provider Config */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: "0.1em", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span>◈</span> AI PROVIDER CONFIGURATION
        </div>

        {/* Provider toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>
            PROVIDER
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: `1px solid ${provider === p.id ? "#00d4ff" : "#1a2540"}`,
                  background: provider === p.id ? "rgba(0,212,255,0.12)" : "transparent",
                  color: provider === p.id ? "#00d4ff" : "#64748b",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "Space Mono",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
            Base URL: <span style={{ color: "#475569" }}>{currentProvider.baseUrl}</span>
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>
            API KEY
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={currentProvider.placeholder}
            style={{
              width: "100%", padding: "10px 14px", background: "#080c18",
              border: "1px solid #1a2540", borderRadius: 6,
              color: "#e2e8f0", fontSize: 12, fontFamily: "Space Mono",
              outline: "none", boxSizing: "border-box"
            }}
          />
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
            {currentProvider.hint}
          </div>
        </div>

        {/* Model */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6, letterSpacing: "0.05em" }}>
            MODEL
          </label>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder={currentProvider.defaultModel}
            style={{
              width: "100%", padding: "10px 14px", background: "#080c18",
              border: "1px solid #1a2540", borderRadius: 6,
              color: "#e2e8f0", fontSize: 12, fontFamily: "JetBrains Mono",
              outline: "none", boxSizing: "border-box"
            }}
          />
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
            {currentProvider.modelHint}
          </div>
        </div>

        <button onClick={save} style={{
          padding: "10px 24px", borderRadius: 6,
          background: saved ? "rgba(0,255,157,0.15)" : "rgba(0,212,255,0.1)",
          border: `1px solid ${saved ? "#00ff9d40" : "#00d4ff40"}`,
          color: saved ? "#00ff9d" : "#00d4ff",
          cursor: "pointer", fontSize: 12, fontFamily: "Space Mono",
          transition: "all 0.2s"
        }}>
          {saved ? "✓ SAVED" : "SAVE CONFIG"}
        </button>
      </div>

      {/* Hermes Status */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#00ff9d", letterSpacing: "0.1em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00ff9d" }} />
          HERMES AGENT ENGINE
        </div>
        {[
          { label: "Agent Loop", status: "sense→plan→act→observe", ok: true },
          { label: "Auto-Skill Creation", status: "ENABLED", ok: true },
          { label: "Memory Persistence", status: "ACTIVE", ok: true },
          { label: "Session Search (FTS5)", status: "INDEXED", ok: true },
          { label: "Subagent Spawning", status: "READY", ok: true },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2540" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>{item.label}</span>
            <span style={{ fontSize: 11, color: item.ok ? "#00ff9d" : "#ef4444" }}>{item.status}</span>
          </div>
        ))}
      </div>

      {/* Agents */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 12, color: "#8b5cf6", letterSpacing: "0.1em", marginBottom: 16 }}>ACTIVE AGENTS</div>
        {[
          { name: "Onboarding Agent", color: "#00ff9d", skill: "skills/onboarding_agent.md" },
          { name: "Billing Agent", color: "#00d4ff", skill: "skills/billing_agent.md" },
          { name: "Analytics Agent", color: "#8b5cf6", skill: "skills/analytics_agent.md" },
          { name: "Support Agent", color: "#f59e0b", skill: "skills/support_agent.md" },
        ].map(agent => (
          <div key={agent.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a2540" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color }} />
              <span style={{ fontSize: 12, color: "#e2e8f0" }}>{agent.name}</span>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "Space Mono" }}>{agent.skill}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
