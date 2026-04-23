"""SubSync FastAPI Backend"""
import os
import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ENV_FILE = Path(__file__).parent / ".env"

def load_env_file():
    """Load .env file into os.environ on startup."""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

def write_env_file(api_key: str, model: str, provider: str, base_url: str):
    """Persist settings to .env file."""
    drop = {"OPENROUTER_API_KEY", "SUBSYNC_MODEL", "SUBSYNC_PROVIDER", "SUBSYNC_BASE_URL"}
    lines = []
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            key = line.split("=", 1)[0].strip()
            if key in drop:
                continue
            lines.append(line)
    if api_key:
        lines.append(f"OPENROUTER_API_KEY={api_key}")
    if model:
        lines.append(f"SUBSYNC_MODEL={model}")
    if provider:
        lines.append(f"SUBSYNC_PROVIDER={provider}")
    if base_url:
        lines.append(f"SUBSYNC_BASE_URL={base_url}")
    ENV_FILE.write_text("\n".join(lines) + "\n")

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from db import init_db, get_db
from agent_engine import SubSyncAgent, AGENT_CONFIGS

app = FastAPI(title="SubSync API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init DB on startup
@app.on_event("startup")
def startup():
    load_env_file()
    init_db()

# ─── Config ──────────────────────────────────────────────────────────────────

def get_openrouter_key():
    return os.environ.get("OPENROUTER_API_KEY", "")

def get_model():
    return os.environ.get("SUBSYNC_MODEL", "anthropic/claude-3.5-sonnet")

def get_base_url():
    return os.environ.get("SUBSYNC_BASE_URL", "https://openrouter.ai/api/v1")

def get_provider():
    return os.environ.get("SUBSYNC_PROVIDER", "openrouter")

# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard():
    conn = get_db()
    total_subs = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE status='active'").fetchone()[0]
    total_customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    mrr = conn.execute("SELECT SUM(price) FROM subscriptions WHERE status='active'").fetchone()[0] or 0
    overdue = conn.execute("SELECT COUNT(*) FROM invoices WHERE status='overdue'").fetchone()[0]
    pending_tickets = conn.execute("SELECT COUNT(*) FROM support_tickets WHERE status='open'").fetchone()[0]
    not_onboarded = conn.execute("SELECT COUNT(*) FROM customers WHERE onboarded=0").fetchone()[0]
    cancelled = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE status='cancelled'").fetchone()[0]
    ai_tools = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE product_type='ai_tool' AND status='active'").fetchone()[0]
    saas = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE product_type='saas' AND status='active'").fetchone()[0]

    recent_activity = conn.execute("""
        SELECT 'invoice' as type, i.status, c.name, s.product_name, i.created_at as ts
        FROM invoices i JOIN customers c ON i.customer_id=c.id JOIN subscriptions s ON i.subscription_id=s.id
        UNION ALL
        SELECT 'ticket' as type, t.status, c.name, t.subject, t.created_at as ts
        FROM support_tickets t JOIN customers c ON t.customer_id=c.id
        ORDER BY ts DESC LIMIT 8
    """).fetchall()

    conn.close()
    return {
        "stats": {
            "active_subscriptions": total_subs,
            "total_customers": total_customers,
            "mrr": round(mrr, 2),
            "overdue_invoices": overdue,
            "open_tickets": pending_tickets,
            "pending_onboarding": not_onboarded,
            "cancelled_subscriptions": cancelled,
            "ai_tools_count": ai_tools,
            "saas_count": saas,
        },
        "recent_activity": [dict(r) for r in recent_activity],
    }

# ─── Customers ───────────────────────────────────────────────────────────────

@app.get("/api/customers")
def list_customers(status: Optional[str] = None):
    conn = get_db()
    query = "SELECT * FROM customers"
    params = []
    if status:
        query += " WHERE status=?"
        params.append(status)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int):
    conn = get_db()
    c = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    subs = conn.execute("SELECT * FROM subscriptions WHERE customer_id=?", (customer_id,)).fetchall()
    invoices = conn.execute("SELECT * FROM invoices WHERE customer_id=? ORDER BY due_date DESC LIMIT 10", (customer_id,)).fetchall()
    tickets = conn.execute("SELECT * FROM support_tickets WHERE customer_id=? ORDER BY created_at DESC LIMIT 5", (customer_id,)).fetchall()
    conn.close()
    if not c:
        raise HTTPException(404, "Customer not found")
    return {
        "customer": dict(c),
        "subscriptions": [dict(s) for s in subs],
        "invoices": [dict(i) for i in invoices],
        "tickets": [dict(t) for t in tickets],
    }

# ─── Subscriptions ────────────────────────────────────────────────────────────

@app.get("/api/subscriptions")
def list_subscriptions(status: Optional[str] = None, product_type: Optional[str] = None):
    conn = get_db()
    query = """
        SELECT s.*, c.name as customer_name, c.email
        FROM subscriptions s JOIN customers c ON s.customer_id=c.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND s.status=?"
        params.append(status)
    if product_type:
        query += " AND s.product_type=?"
        params.append(product_type)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

class SubscriptionUpdate(BaseModel):
    status: str

@app.patch("/api/subscriptions/{sub_id}")
def update_subscription(sub_id: int, body: SubscriptionUpdate):
    conn = get_db()
    conn.execute("UPDATE subscriptions SET status=? WHERE id=?", (body.status, sub_id))
    conn.commit()
    conn.close()
    return {"success": True}

# ─── Invoices ─────────────────────────────────────────────────────────────────

@app.get("/api/invoices")
def list_invoices(status: Optional[str] = None, customer_id: Optional[int] = None):
    conn = get_db()
    query = """
        SELECT i.*, c.name as customer_name, s.product_name
        FROM invoices i JOIN customers c ON i.customer_id=c.id JOIN subscriptions s ON i.subscription_id=s.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND i.status=?"
        params.append(status)
    if customer_id:
        query += " AND i.customer_id=?"
        params.append(customer_id)
    query += " ORDER BY i.due_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

class InvoiceUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

@app.patch("/api/invoices/{invoice_id}")
def update_invoice(invoice_id: int, body: InvoiceUpdate):
    from datetime import datetime
    conn = get_db()
    paid_date = datetime.now().strftime("%Y-%m-%d") if body.status == "paid" else None
    conn.execute("UPDATE invoices SET status=?, paid_date=?, notes=? WHERE id=?",
                 (body.status, paid_date, body.notes, invoice_id))
    conn.commit()
    conn.close()
    return {"success": True}

# ─── Analytics ────────────────────────────────────────────────────────────────

@app.get("/api/analytics")
def get_analytics(days: int = 30):
    conn = get_db()
    # Usage by event type
    usage_by_type = conn.execute("""
        SELECT event_type, COUNT(*) as count, SUM(value) as total
        FROM usage_events WHERE recorded_at >= datetime('now', ?)
        GROUP BY event_type ORDER BY count DESC
    """, (f"-{days} days",)).fetchall()

    # Usage by product
    usage_by_product = conn.execute("""
        SELECT s.product_name, s.product_type, COUNT(u.id) as events
        FROM usage_events u JOIN subscriptions s ON u.subscription_id=s.id
        WHERE u.recorded_at >= datetime('now', ?)
        GROUP BY s.id ORDER BY events DESC LIMIT 10
    """, (f"-{days} days",)).fetchall()

    # Daily usage trend
    daily_trend = conn.execute("""
        SELECT DATE(recorded_at) as date, COUNT(*) as events
        FROM usage_events WHERE recorded_at >= datetime('now', ?)
        GROUP BY DATE(recorded_at) ORDER BY date
    """, (f"-{days} days",)).fetchall()

    # Revenue breakdown
    revenue = conn.execute("""
        SELECT product_type, SUM(price) as total_mrr, COUNT(*) as count
        FROM subscriptions WHERE status='active'
        GROUP BY product_type
    """).fetchall()

    conn.close()
    return {
        "usage_by_type": [dict(r) for r in usage_by_type],
        "usage_by_product": [dict(r) for r in usage_by_product],
        "daily_trend": [dict(r) for r in daily_trend],
        "revenue_breakdown": [dict(r) for r in revenue],
    }

# ─── Support Tickets ──────────────────────────────────────────────────────────

@app.get("/api/tickets")
def list_tickets(status: Optional[str] = None):
    conn = get_db()
    query = """
        SELECT t.*, c.name as customer_name, c.email
        FROM support_tickets t JOIN customers c ON t.customer_id=c.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND t.status=?"
        params.append(status)
    query += " ORDER BY t.created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

class TicketCreate(BaseModel):
    customer_id: int
    subject: str
    description: Optional[str] = None
    priority: str = "medium"

@app.post("/api/tickets")
def create_ticket(body: TicketCreate):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO support_tickets (customer_id, subject, description, priority) VALUES (?,?,?,?)",
        (body.customer_id, body.subject, body.description, body.priority)
    )
    conn.commit()
    conn.close()
    return {"success": True, "ticket_id": cur.lastrowid}

@app.patch("/api/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int):
    conn = get_db()
    conn.execute("UPDATE support_tickets SET status='resolved', resolved_at=CURRENT_TIMESTAMP WHERE id=?", (ticket_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# ─── Agent Chat ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    agent_type: str = "support"
    conversation_history: list = []

@app.post("/api/chat")
def chat(body: ChatRequest):
    api_key = get_openrouter_key()
    if not api_key:
        return {
            "success": False,
            "response": "OpenRouter API key not configured. Please set OPENROUTER_API_KEY in Settings.",
            "agent": body.agent_type,
            "agent_name": AGENT_CONFIGS.get(body.agent_type, {}).get("name", "Agent"),
            "tool_calls": [],
        }
    agent = SubSyncAgent(body.agent_type, api_key, get_model(), get_base_url())
    result = agent.run(body.message, body.conversation_history)
    return result

@app.get("/api/agents")
def list_agents():
    return [
        {"type": k, **{kk: vv for kk, vv in v.items() if kk != "skill_file"}}
        for k, v in AGENT_CONFIGS.items()
    ]

class SettingsBody(BaseModel):
    openrouter_api_key: str = ""
    api_key: str = ""          # unified field (provider-agnostic)
    model: str = "anthropic/claude-3.5-sonnet"
    provider: str = "openrouter"
    base_url: str = "https://openrouter.ai/api/v1"

@app.post("/api/settings")
def save_settings(body: SettingsBody):
    key = body.api_key or body.openrouter_api_key
    if key:
        os.environ["OPENROUTER_API_KEY"] = key
    if body.model:
        os.environ["SUBSYNC_MODEL"] = body.model
    if body.provider:
        os.environ["SUBSYNC_PROVIDER"] = body.provider
    if body.base_url:
        os.environ["SUBSYNC_BASE_URL"] = body.base_url
    write_env_file(key, body.model, body.provider, body.base_url)
    return {"success": True}

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
