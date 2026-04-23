import { useEffect, useState } from "react";
import { fetchTickets, resolveTicket } from "../lib/api";

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");

  const load = () => fetchTickets(filter || undefined).then(setTickets);
  useEffect(() => { load(); }, [filter]);

  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#64748b" } as any;

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>SUPPORT TICKETS</h1>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{tickets.length} tickets</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "open", "in_progress", "resolved"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "5px 12px", borderRadius: 4, border: "1px solid",
              borderColor: filter === s ? "#f59e0b" : "#1a2540",
              background: filter === s ? "rgba(245,158,11,0.1)" : "transparent",
              color: filter === s ? "#f59e0b" : "#64748b",
              cursor: "pointer", fontSize: 11
            }}>{s || "ALL"}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tickets.map(ticket => (
          <div key={ticket.id} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 4, height: 40, borderRadius: 2, flexShrink: 0,
              background: priorityColor[ticket.priority] || "#64748b"
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>{ticket.subject}</span>
                <span className={`badge badge-${ticket.status}`}>{ticket.status}</span>
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 3,
                  background: `${priorityColor[ticket.priority]}15`,
                  color: priorityColor[ticket.priority]
                }}>{ticket.priority}</span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>{ticket.customer_name}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{ticket.email}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{ticket.created_at?.split("T")[0] || ticket.created_at?.split(" ")[0]}</span>
              </div>
            </div>
            {ticket.status !== "resolved" && (
              <button onClick={async () => { await resolveTicket(ticket.id); load(); }} style={{
                padding: "6px 14px", borderRadius: 4, border: "1px solid rgba(0,255,157,0.3)",
                background: "rgba(0,255,157,0.05)", color: "#00ff9d", cursor: "pointer", fontSize: 11
              }}>Resolve</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
