const API = "http://localhost:8765";

export async function fetchDashboard() {
  const r = await fetch(`${API}/api/dashboard`);
  return r.json();
}

export async function fetchCustomers(status?: string) {
  const q = status ? `?status=${status}` : "";
  const r = await fetch(`${API}/api/customers${q}`);
  return r.json();
}

export async function fetchCustomer(id: number) {
  const r = await fetch(`${API}/api/customers/${id}`);
  return r.json();
}

export async function fetchSubscriptions(params?: { status?: string; product_type?: string }) {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API}/api/subscriptions${q ? "?" + q : ""}`);
  return r.json();
}

export async function updateSubscription(id: number, status: string) {
  const r = await fetch(`${API}/api/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.json();
}

export async function fetchInvoices(params?: { status?: string; customer_id?: number }) {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API}/api/invoices${q ? "?" + q : ""}`);
  return r.json();
}

export async function updateInvoice(id: number, status: string, notes?: string) {
  const r = await fetch(`${API}/api/invoices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });
  return r.json();
}

export async function fetchAnalytics(days = 30) {
  const r = await fetch(`${API}/api/analytics?days=${days}`);
  return r.json();
}

export async function fetchTickets(status?: string) {
  const q = status ? `?status=${status}` : "";
  const r = await fetch(`${API}/api/tickets${q}`);
  return r.json();
}

export async function resolveTicket(id: number) {
  const r = await fetch(`${API}/api/tickets/${id}/resolve`, { method: "PATCH" });
  return r.json();
}

export async function chatWithAgent(message: string, agentType: string, history: any[]) {
  const r = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agent_type: agentType, conversation_history: history }),
  });
  return r.json();
}

export async function fetchAgents() {
  const r = await fetch(`${API}/api/agents`);
  return r.json();
}

export async function saveSettings(key: string, model: string) {
  const r = await fetch(`${API}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openrouter_api_key: key, model }),
  });
  return r.json();
}
