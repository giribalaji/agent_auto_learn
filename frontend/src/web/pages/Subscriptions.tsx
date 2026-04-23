import { useEffect, useState } from "react";
import { fetchSubscriptions, updateSubscription } from "../lib/api";

export default function Subscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const load = () => fetchSubscriptions({ status: filter || undefined, product_type: typeFilter || undefined }).then(setSubs);

  useEffect(() => { load(); }, [filter, typeFilter]);

  const handleStatus = async (id: number, status: string) => {
    await updateSubscription(id, status);
    load();
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>SUBSCRIPTIONS</h1>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{subs.length} subscriptions</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "active", "cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "6px 14px", borderRadius: 4, border: "1px solid",
              borderColor: filter === s ? "#00d4ff" : "#1a2540",
              background: filter === s ? "rgba(0,212,255,0.1)" : "transparent",
              color: filter === s ? "#00d4ff" : "#64748b",
              cursor: "pointer", fontSize: 11, letterSpacing: "0.05em"
            }}>
              {s || "ALL"}
            </button>
          ))}
          {["", "ai_tool", "saas"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: "6px 14px", borderRadius: 4, border: "1px solid",
              borderColor: typeFilter === t ? "#8b5cf6" : "#1a2540",
              background: typeFilter === t ? "rgba(139,92,246,0.1)" : "transparent",
              color: typeFilter === t ? "#8b5cf6" : "#64748b",
              cursor: "pointer", fontSize: 11, letterSpacing: "0.05em"
            }}>
              {t || "ALL TYPES"}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a2540" }}>
              {["PRODUCT", "CUSTOMER", "TYPE", "PLAN", "PRICE", "STATUS", "STARTED", "ACTION"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subs.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #0f1829", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", color: "#e2e8f0", fontSize: 12 }}>{s.product_name}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#e2e8f0" }}>{s.customer_name}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{s.email}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span className={`badge badge-${s.product_type}`}>{s.product_type}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{s.plan}</td>
                <td style={{ padding: "12px 16px", color: "#00d4ff", fontSize: 12, fontFamily: "Space Mono" }}>${s.price}/mo</td>
                <td style={{ padding: "12px 16px" }}>
                  <span className={`badge badge-${s.status}`}>{s.status}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 11 }}>{s.start_date}</td>
                <td style={{ padding: "12px 16px" }}>
                  {s.status === "active" ? (
                    <button onClick={() => handleStatus(s.id, "cancelled")} style={{
                      padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)",
                      background: "rgba(239,68,68,0.05)", color: "#ef4444",
                      cursor: "pointer", fontSize: 10
                    }}>Cancel</button>
                  ) : (
                    <button onClick={() => handleStatus(s.id, "active")} style={{
                      padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(0,255,157,0.3)",
                      background: "rgba(0,255,157,0.05)", color: "#00ff9d",
                      cursor: "pointer", fontSize: 10
                    }}>Reactivate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
