import { useEffect, useState } from "react";
import { fetchDashboard } from "../lib/api";

function StatCard({ label, value, accent, sub }: { label: string; value: any; accent: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, transparent)`
      }} />
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ActivityItem({ item }: { item: any }) {
  const isInvoice = item.type === "invoice";
  const statusColor = {
    paid: "#00ff9d", pending: "#f59e0b", overdue: "#ef4444",
    open: "#00d4ff", resolved: "#64748b", in_progress: "#8b5cf6"
  }[item.status] || "#64748b";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
      borderBottom: "1px solid #1a2540"
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6,
        background: isInvoice ? "rgba(0,212,255,0.1)" : "rgba(139,92,246,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14
      }}>
        {isInvoice ? "◎" : "◇"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: "#e2e8f0" }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{item.product_name || item.subject}</div>
      </div>
      <span className="badge" style={{
        background: `${statusColor}20`, color: statusColor,
        border: `1px solid ${statusColor}30`
      }}>
        {item.status}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchDashboard().then(setData);
  }, []);

  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ color: "#64748b", fontSize: 12 }}>
        <span className="pulse" style={{ display: "inline-block", marginRight: 8 }}>◉</span>
        Loading...
      </div>
    </div>
  );

  const { stats, recent_activity } = data;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          DASHBOARD
        </h1>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Subscription intelligence overview</div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="MONTHLY REVENUE" value={`$${stats.mrr.toLocaleString()}`} accent="#00d4ff" sub="MRR" />
        <StatCard label="ACTIVE SUBS" value={stats.active_subscriptions} accent="#00ff9d" sub={`${stats.ai_tools_count} AI Tools · ${stats.saas_count} SaaS`} />
        <StatCard label="TOTAL CUSTOMERS" value={stats.total_customers} accent="#8b5cf6" sub={`${stats.pending_onboarding} pending onboarding`} />
        <StatCard label="OVERDUE INVOICES" value={stats.overdue_invoices} accent="#ef4444" sub={`${stats.open_tickets} open tickets`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Activity */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>
            RECENT ACTIVITY
          </div>
          {recent_activity.map((item: any, i: number) => (
            <ActivityItem key={i} item={item} />
          ))}
        </div>

        {/* Agent Status */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>
            AI AGENTS — HERMES LOOP
          </div>
          {[
            { name: "Onboarding Agent", color: "#00ff9d", tasks: stats.pending_onboarding, label: "customers pending" },
            { name: "Billing Agent", color: "#00d4ff", tasks: stats.overdue_invoices, label: "overdue invoices" },
            { name: "Analytics Agent", color: "#8b5cf6", tasks: stats.active_subscriptions, label: "subs monitored" },
            { name: "Support Agent", color: "#f59e0b", tasks: stats.open_tickets, label: "open tickets" },
          ].map((agent) => (
            <div key={agent.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: agent.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#e2e8f0" }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{agent.tasks} {agent.label}</div>
              </div>
              <div style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: `${agent.color}15`, color: agent.color
              }}>ACTIVE</div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "12px", background: "rgba(0,212,255,0.05)", borderRadius: 6, border: "1px solid rgba(0,212,255,0.1)" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>HERMES LEARNING STATUS</div>
            <div style={{ fontSize: 11, color: "#00d4ff" }}>✦ Auto-skill creation: ENABLED</div>
            <div style={{ fontSize: 11, color: "#00d4ff", marginTop: 2 }}>✦ Memory persistence: ACTIVE</div>
            <div style={{ fontSize: 11, color: "#00d4ff", marginTop: 2 }}>✦ Session search: INDEXED</div>
          </div>
        </div>
      </div>
    </div>
  );
}
