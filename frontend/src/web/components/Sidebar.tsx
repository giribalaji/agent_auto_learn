import { Link, useLocation } from "wouter";

const nav = [
  { path: "/", label: "Dashboard", icon: "⬡" },
  { path: "/subscriptions", label: "Subscriptions", icon: "◈" },
  { path: "/billing", label: "Billing", icon: "◎" },
  { path: "/analytics", label: "Analytics", icon: "◉" },
  { path: "/tickets", label: "Support", icon: "◇" },
  { path: "/chat", label: "AI Agents", icon: "✦" },
  { path: "/settings", label: "Settings", icon: "⊙" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      background: "#080c18",
      borderRight: "1px solid #1a2540",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #1a2540" }}>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.1em" }}>
          SUB<span style={{ color: "#00ff9d" }}>SYNC</span>
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, letterSpacing: "0.15em" }}>
          AI SUBSCRIPTION OS
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {nav.map(({ path, label, icon }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          return (
            <Link key={path} href={path}>
              <a style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                color: active ? "#00d4ff" : "#64748b",
                background: active ? "rgba(0,212,255,0.07)" : "transparent",
                borderLeft: active ? "2px solid #00d4ff" : "2px solid transparent",
                textDecoration: "none",
                fontSize: 12,
                letterSpacing: "0.05em",
                transition: "all 0.15s",
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 14, opacity: active ? 1 : 0.6 }}>{icon}</span>
                <span>{label}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #1a2540" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff9d" }} />
          <span style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>HERMES ACTIVE</span>
        </div>
        <div style={{ fontSize: 10, color: "#1a2540", marginTop: 4 }}>4 agents running</div>
      </div>
    </aside>
  );
}
