import { useEffect, useState } from "react";
import { fetchAnalytics } from "../lib/api";

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#e2e8f0" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "Space Mono" }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "#1a2540", borderRadius: 2 }}>
        <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => { fetchAnalytics(days).then(setData); }, [days]);

  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <span style={{ color: "#64748b", fontSize: 12 }}>
        <span className="pulse" style={{ display: "inline-block", marginRight: 8 }}>◉</span>Loading analytics...
      </span>
    </div>
  );

  const maxUsage = Math.max(...(data.usage_by_type.map((u: any) => u.count) || [1]));
  const maxProduct = Math.max(...(data.usage_by_product.map((u: any) => u.events) || [1]));
  const colors = ["#00d4ff", "#00ff9d", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>ANALYTICS</h1>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Usage intelligence & insights</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "5px 12px", borderRadius: 4, border: "1px solid",
              borderColor: days === d ? "#8b5cf6" : "#1a2540",
              background: days === d ? "rgba(139,92,246,0.1)" : "transparent",
              color: days === d ? "#8b5cf6" : "#64748b",
              cursor: "pointer", fontSize: 11
            }}>{d}D</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Revenue Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>REVENUE BREAKDOWN</div>
          {data.revenue_breakdown.map((r: any, i: number) => (
            <div key={r.product_type} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderBottom: i < data.revenue_breakdown.length - 1 ? "1px solid #1a2540" : "none"
            }}>
              <div>
                <span className={`badge badge-${r.product_type}`}>{r.product_type}</span>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{r.count} subscriptions</div>
              </div>
              <div className="font-display" style={{ fontSize: 20, color: i === 0 ? "#00d4ff" : "#8b5cf6" }}>
                ${r.total_mrr?.toFixed(0)}
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: "JetBrains Mono" }}>/mo</span>
              </div>
            </div>
          ))}
        </div>

        {/* Usage by Event Type */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>USAGE BY EVENT TYPE ({days}D)</div>
          {data.usage_by_type.map((u: any, i: number) => (
            <Bar key={u.event_type} label={u.event_type} value={u.count} max={maxUsage} color={colors[i % colors.length]} />
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>
          TOP PRODUCTS BY USAGE ({days}D)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {data.usage_by_product.slice(0, 6).map((p: any, i: number) => (
            <div key={p.product_name} style={{
              padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 6,
              border: `1px solid ${colors[i % colors.length]}20`
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span className={`badge badge-${p.product_type}`}>{p.product_type}</span>
                <span className="font-display" style={{ fontSize: 18, color: colors[i % colors.length] }}>{p.events}</span>
              </div>
              <div style={{ fontSize: 12, color: "#e2e8f0" }}>{p.product_name}</div>
              <div style={{ marginTop: 8, height: 3, background: "#1a2540", borderRadius: 2 }}>
                <div style={{ height: 3, width: `${(p.events / maxProduct) * 100}%`, background: colors[i % colors.length], borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Trend */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", marginBottom: 16 }}>DAILY USAGE TREND</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {data.daily_trend.map((d: any, i: number) => {
            const maxVal = Math.max(...data.daily_trend.map((x: any) => x.events));
            const h = maxVal > 0 ? (d.events / maxVal) * 80 : 4;
            return (
              <div key={d.date} title={`${d.date}: ${d.events}`} style={{
                flex: 1, height: `${h}px`, background: "rgba(0,212,255,0.4)",
                borderRadius: "2px 2px 0 0", cursor: "pointer", transition: "background 0.1s",
                minHeight: 4
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#00d4ff")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,212,255,0.4)")}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>{data.daily_trend[0]?.date}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>{data.daily_trend[data.daily_trend.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
