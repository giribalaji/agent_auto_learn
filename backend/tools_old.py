"""Custom tools for SubSync agents — registered into Hermes tool loop"""
import json
from datetime import datetime
from db import get_db

# ─── Subscription Tools ──────────────────────────────────────────────────────

def get_subscriptions(customer_id: int = None, status: str = None) -> str:
    """Get all subscriptions, optionally filtered by customer_id or status."""
    conn = get_db()
    query = """
        SELECT s.*, c.name as customer_name, c.email
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
    """
    params = []
    if customer_id:
        query += " AND s.customer_id = ?"
        params.append(customer_id)
    if status:
        query += " AND s.status = ?"
        params.append(status)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

def get_subscription_by_id(subscription_id: int) -> str:
    """Get a specific subscription by ID."""
    conn = get_db()
    row = conn.execute(
        "SELECT s.*, c.name as customer_name FROM subscriptions s JOIN customers c ON s.customer_id=c.id WHERE s.id=?",
        (subscription_id,)
    ).fetchone()
    conn.close()
    return json.dumps(dict(row) if row else {"error": "Not found"})

def update_subscription_status(subscription_id: int, status: str) -> str:
    """Update subscription status: active, cancelled."""
    conn = get_db()
    conn.execute("UPDATE subscriptions SET status=? WHERE id=?", (status, subscription_id))
    conn.commit()
    conn.close()
    return json.dumps({"success": True, "subscription_id": subscription_id, "new_status": status})

# ─── Customer Tools ───────────────────────────────────────────────────────────

def get_customers(status: str = None) -> str:
    """Get all customers."""
    conn = get_db()
    query = "SELECT * FROM customers"
    params = []
    if status:
        query += " WHERE status=?"
        params.append(status)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

def get_customer_by_id(customer_id: int) -> str:
    """Get a customer and their subscriptions."""
    conn = get_db()
    customer = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    subs = conn.execute("SELECT * FROM subscriptions WHERE customer_id=?", (customer_id,)).fetchall()
    conn.close()
    if not customer:
        return json.dumps({"error": "Customer not found"})
    return json.dumps({
        "customer": dict(customer),
        "subscriptions": [dict(s) for s in subs]
    }, indent=2)

def mark_customer_onboarded(customer_id: int) -> str:
    """Mark a customer as fully onboarded."""
    conn = get_db()
    conn.execute("UPDATE customers SET onboarded=1 WHERE id=?", (customer_id,))
    conn.commit()
    conn.close()
    return json.dumps({"success": True, "customer_id": customer_id, "onboarded": True})

# ─── Billing Tools ────────────────────────────────────────────────────────────

def get_invoices(customer_id: int = None, status: str = None) -> str:
    """Get invoices, optionally filtered by customer or status."""
    conn = get_db()
    query = """
        SELECT i.*, c.name as customer_name, s.product_name
        FROM invoices i
        JOIN customers c ON i.customer_id=c.id
        JOIN subscriptions s ON i.subscription_id=s.id
        WHERE 1=1
    """
    params = []
    if customer_id:
        query += " AND i.customer_id=?"
        params.append(customer_id)
    if status:
        query += " AND i.status=?"
        params.append(status)
    query += " ORDER BY i.due_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

def update_payment_status(invoice_id: int, status: str, notes: str = None) -> str:
    """Update invoice payment status: paid, pending, overdue, cancelled."""
    conn = get_db()
    paid_date = datetime.now().strftime("%Y-%m-%d") if status == "paid" else None
    conn.execute(
        "UPDATE invoices SET status=?, paid_date=?, notes=? WHERE id=?",
        (status, paid_date, notes, invoice_id)
    )
    conn.commit()
    conn.close()
    return json.dumps({"success": True, "invoice_id": invoice_id, "new_status": status})

def get_billing_summary() -> str:
    """Get billing overview: MRR, overdue count, total outstanding."""
    conn = get_db()
    mrr = conn.execute(
        "SELECT SUM(price) FROM subscriptions WHERE status='active'"
    ).fetchone()[0] or 0
    overdue = conn.execute(
        "SELECT COUNT(*), SUM(amount) FROM invoices WHERE status='overdue'"
    ).fetchone()
    pending = conn.execute(
        "SELECT COUNT(*), SUM(amount) FROM invoices WHERE status='pending'"
    ).fetchone()
    conn.close()
    return json.dumps({
        "mrr": round(mrr, 2),
        "overdue_count": overdue[0],
        "overdue_amount": round(overdue[1] or 0, 2),
        "pending_count": pending[0],
        "pending_amount": round(pending[1] or 0, 2),
    })

# ─── Usage Analytics Tools ────────────────────────────────────────────────────

def get_usage_metrics(customer_id: int = None, days: int = 30) -> str:
    """Get usage metrics for the last N days."""
    conn = get_db()
    query = """
        SELECT u.event_type, COUNT(*) as count, SUM(u.value) as total_value,
               s.product_name, c.name as customer_name
        FROM usage_events u
        JOIN subscriptions s ON u.subscription_id=s.id
        JOIN customers c ON u.customer_id=c.id
        WHERE u.recorded_at >= datetime('now', ?)
    """
    params = [f"-{days} days"]
    if customer_id:
        query += " AND u.customer_id=?"
        params.append(customer_id)
    query += " GROUP BY u.event_type, u.subscription_id ORDER BY count DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

def get_top_products_by_usage(limit: int = 5) -> str:
    """Get top products by usage events in last 30 days."""
    conn = get_db()
    rows = conn.execute("""
        SELECT s.product_name, s.product_type, COUNT(u.id) as usage_count
        FROM usage_events u
        JOIN subscriptions s ON u.subscription_id=s.id
        WHERE u.recorded_at >= datetime('now', '-30 days')
        GROUP BY s.id
        ORDER BY usage_count DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

# ─── Support Tools ────────────────────────────────────────────────────────────

def get_support_tickets(status: str = None, customer_id: int = None) -> str:
    """Get support tickets."""
    conn = get_db()
    query = """
        SELECT t.*, c.name as customer_name, c.email
        FROM support_tickets t
        JOIN customers c ON t.customer_id=c.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND t.status=?"
        params.append(status)
    if customer_id:
        query += " AND t.customer_id=?"
        params.append(customer_id)
    query += " ORDER BY t.created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return json.dumps([dict(r) for r in rows], indent=2)

def create_support_ticket(customer_id: int, subject: str, description: str, priority: str = "medium") -> str:
    """Create a new support ticket."""
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO support_tickets (customer_id, subject, description, priority) VALUES (?,?,?,?)",
        (customer_id, subject, description, priority)
    )
    conn.commit()
    conn.close()
    return json.dumps({"success": True, "ticket_id": cur.lastrowid})

def resolve_ticket(ticket_id: int, resolution_notes: str = None) -> str:
    """Resolve a support ticket."""
    conn = get_db()
    conn.execute(
        "UPDATE support_tickets SET status='resolved', resolved_at=CURRENT_TIMESTAMP WHERE id=?",
        (ticket_id,)
    )
    conn.commit()
    conn.close()
    return json.dumps({"success": True, "ticket_id": ticket_id, "status": "resolved"})

# ─── Tool registry for Hermes ─────────────────────────────────────────────────

SUBSYNC_TOOLS = {
    "get_subscriptions": get_subscriptions,
    "get_subscription_by_id": get_subscription_by_id,
    "update_subscription_status": update_subscription_status,
    "get_customers": get_customers,
    "get_customer_by_id": get_customer_by_id,
    "mark_customer_onboarded": mark_customer_onboarded,
    "get_invoices": get_invoices,
    "update_payment_status": update_payment_status,
    "get_billing_summary": get_billing_summary,
    "get_usage_metrics": get_usage_metrics,
    "get_top_products_by_usage": get_top_products_by_usage,
    "get_support_tickets": get_support_tickets,
    "create_support_ticket": create_support_ticket,
    "resolve_ticket": resolve_ticket,
}
