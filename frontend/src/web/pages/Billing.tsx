import { useEffect, useState } from "react";
import { fetchInvoices, updateInvoice } from "../lib/api";

export default function Billing() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");

  const load = () => fetchInvoices({ status: filter || undefined }).then(setInvoices);

  useEffect(() => { load(); }, [filter]);

  const handleUpdate = async (id: number, status: string) => {
    await updateInvoice(id, status);
    load();
  };

  const total = invoices.reduce((sum, i) => sum + i.amount, 0);
  const overdue = invoices.filter(i => i.status === "overdue");
  const overdueAmt = overdue.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>BILLING</h1>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Invoice & payment tracking</div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL SHOWN", value: `$${total.toFixed(0)}`, color: "#00d4ff" },
          { label: "OVERDUE", value: `$${overdueAmt.toFixed(0)}`, color: "#ef4444" },
          { label: "OVERDUE COUNT", value: overdue.length, color: "#f59e0b" },
          { label: "INVOICES", value: invoices.length, color: "#8b5cf6" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>{s.label}</div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["", "paid", "pending", "overdue", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "5px 12px", borderRadius: 4, border: "1px solid",
            borderColor: filter === s ? "#00d4ff" : "#1a2540",
            background: filter === s ? "rgba(0,212,255,0.1)" : "transparent",
            color: filter === s ? "#00d4ff" : "#64748b",
            cursor: "pointer", fontSize: 11
          }}>{s || "ALL"}</button>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a2540" }}>
              {["CUSTOMER", "PRODUCT", "AMOUNT", "STATUS", "DUE DATE", "PAID DATE", "ACTIONS"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #0f1829" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", color: "#e2e8f0", fontSize: 12 }}>{inv.customer_name}</td>
                <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 11 }}>{inv.product_name}</td>
                <td style={{ padding: "12px 16px", color: "#00d4ff", fontSize: 12, fontFamily: "Space Mono" }}>${inv.amount}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                </td>
                <td style={{ padding: "12px 16px", color: inv.status === "overdue" ? "#ef4444" : "#64748b", fontSize: 11 }}>{inv.due_date}</td>
                <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 11 }}>{inv.paid_date || "—"}</td>
                <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                  {inv.status !== "paid" && (
                    <button onClick={() => handleUpdate(inv.id, "paid")} style={{
                      padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(0,255,157,0.3)",
                      background: "rgba(0,255,157,0.05)", color: "#00ff9d", cursor: "pointer", fontSize: 10
                    }}>Mark Paid</button>
                  )}
                  {inv.status === "pending" && (
                    <button onClick={() => handleUpdate(inv.id, "overdue")} style={{
                      padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(239,68,68,0.3)",
                      background: "rgba(239,68,68,0.05)", color: "#ef4444", cursor: "pointer", fontSize: 10
                    }}>Overdue</button>
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
