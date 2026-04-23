"""Database setup and seed data for SubSync"""
import sqlite3
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "subsync.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    company TEXT,
    plan TEXT DEFAULT 'starter',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    onboarded INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    product_name TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK(product_type IN ('ai_tool', 'saas')),
    plan TEXT NOT NULL,
    price REAL NOT NULL,
    billing_cycle TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'active',
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER REFERENCES subscriptions(id),
    customer_id INTEGER REFERENCES customers(id),
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','cancelled')),
    due_date TEXT NOT NULL,
    paid_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER REFERENCES subscriptions(id),
    customer_id INTEGER REFERENCES customers(id),
    event_type TEXT NOT NULL,
    value REAL DEFAULT 1,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
    priority TEXT DEFAULT 'medium',
    resolved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_type TEXT NOT NULL,
    customer_id INTEGER,
    session_id TEXT,
    summary TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()

    # Check if already seeded
    cur = conn.execute("SELECT COUNT(*) FROM customers")
    if cur.fetchone()[0] > 0:
        conn.close()
        return

    # Seed customers
    customers = [
        ("Alice Johnson", "alice@techcorp.com", "TechCorp", "pro"),
        ("Bob Smith", "bob@aiventures.io", "AI Ventures", "enterprise"),
        ("Carol White", "carol@startupx.com", "StartupX", "starter"),
        ("David Lee", "david@cloudbase.net", "CloudBase", "pro"),
        ("Eva Martinez", "eva@datasync.ai", "DataSync AI", "enterprise"),
        ("Frank Chen", "frank@buildfast.dev", "BuildFast", "starter"),
        ("Grace Kim", "grace@scalenow.co", "ScaleNow", "pro"),
        ("Henry Brown", "henry@nexustech.io", "NexusTech", "enterprise"),
    ]
    for name, email, company, plan in customers:
        conn.execute(
            "INSERT INTO customers (name, email, company, plan, onboarded) VALUES (?,?,?,?,?)",
            (name, email, company, plan, random.choice([0, 1]))
        )
    conn.commit()

    # Seed subscriptions
    products = [
        ("GPT-4 API Access", "ai_tool", "pro", 99.0),
        ("Claude API Pro", "ai_tool", "enterprise", 199.0),
        ("Stable Diffusion Cloud", "ai_tool", "starter", 29.0),
        ("Notion AI", "saas", "pro", 49.0),
        ("Vercel Pro", "saas", "pro", 40.0),
        ("GitHub Copilot", "ai_tool", "starter", 19.0),
        ("Datadog APM", "saas", "enterprise", 299.0),
        ("Linear Teams", "saas", "pro", 59.0),
        ("Midjourney Pro", "ai_tool", "pro", 60.0),
        ("AWS Bedrock", "ai_tool", "enterprise", 499.0),
    ]
    sub_ids = []
    for i, (pname, ptype, plan, price) in enumerate(products):
        cid = (i % 8) + 1
        start = (datetime.now() - timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d")
        cur = conn.execute(
            "INSERT INTO subscriptions (customer_id, product_name, product_type, plan, price, status, start_date) VALUES (?,?,?,?,?,?,?)",
            (cid, pname, ptype, plan, price, random.choice(["active","active","active","cancelled"]), start)
        )
        sub_ids.append(cur.lastrowid)
    conn.commit()

    # Seed invoices
    for sub_id in sub_ids:
        sub = conn.execute("SELECT * FROM subscriptions WHERE id=?", (sub_id,)).fetchone()
        for month in range(3):
            due = (datetime.now() - timedelta(days=30*month)).strftime("%Y-%m-%d")
            status = random.choice(["paid", "paid", "paid", "pending", "overdue"])
            paid_date = due if status == "paid" else None
            conn.execute(
                "INSERT INTO invoices (subscription_id, customer_id, amount, status, due_date, paid_date) VALUES (?,?,?,?,?,?)",
                (sub_id, sub["customer_id"], sub["price"], status, due, paid_date)
            )
    conn.commit()

    # Seed usage events
    event_types = ["api_call", "login", "export", "query", "upload", "dashboard_view"]
    for sub_id in sub_ids:
        sub = conn.execute("SELECT * FROM subscriptions WHERE id=?", (sub_id,)).fetchone()
        for _ in range(random.randint(20, 100)):
            days_ago = random.randint(0, 30)
            recorded = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                "INSERT INTO usage_events (subscription_id, customer_id, event_type, value, recorded_at) VALUES (?,?,?,?,?)",
                (sub_id, sub["customer_id"], random.choice(event_types), random.randint(1, 100), recorded)
            )
    conn.commit()

    # Seed support tickets
    subjects = [
        "Billing discrepancy on last invoice",
        "API rate limit exceeded",
        "Cannot access dashboard",
        "Need to upgrade plan",
        "Invoice not received",
        "Feature request: export to CSV",
        "Integration broken after update",
    ]
    for i, subject in enumerate(subjects):
        cid = (i % 8) + 1
        conn.execute(
            "INSERT INTO support_tickets (customer_id, subject, status, priority) VALUES (?,?,?,?)",
            (cid, subject, random.choice(["open","in_progress","resolved"]), random.choice(["low","medium","high"]))
        )
    conn.commit()
    conn.close()
    print("✅ Database initialized and seeded")

if __name__ == "__main__":
    init_db()
