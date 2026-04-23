---
name: billing-audit-workflow
description: Standard playbook for performing a per-customer billing audit in SubSync. Use whenever the user asks to "audit billing", "check overdue", "review payment status", or otherwise needs a holistic view of a single customer's billing health. Covers the canonical 3-call sequence and the summary format that downstream UI expects.
---

# Billing Audit Workflow

## When to apply
Trigger this skill when the user requests any of:
- "audit billing for customer <id>"
- "check overdue invoices for <name>"
- "review payment status for <customer>"
- "billing health check"
- "account review" (when context is billing)

## Canonical tool sequence
Always run these three tools, in this order, before composing the response:

1. `get_customer_by_id(customer_id=<id>)` — pulls customer profile + active subscriptions.
   This anchors the audit. Skip only if the user already gave you the full profile.

2. `get_invoices(customer_id=<id>, status="overdue")` — overdue invoices first.
   If the result is empty, follow up with `get_invoices(customer_id=<id>)` (no status filter)
   to confirm there are paid invoices and the customer is not just inactive.

3. `get_billing_summary()` — aggregate MRR + overdue stats so the per-customer numbers
   can be put in context against the whole book.

## Output contract
Respond with a tight, scannable summary the operator can paste into a Slack thread:

```
Customer: <name> (<company>) — id <id>
Status: <active | overdue | churned>
Subscriptions: <count> active, total MRR $<amount>
Overdue invoices: <count>, total $<amount>  [or: "None — paid through <date>"]
Book context: $<MRR> total MRR, <n> overdue across all customers
Recommended action: <one of: dunning email | personal outreach | escalate to CSM | none>
```

## Edge cases
- If `get_customer_by_id` returns `null` or `error`: stop, tell the user the customer ID is not found, do NOT call `get_invoices` (it'll waste a tool turn).
- If the customer has zero subscriptions: skip step 2, but still do step 3 for context, and recommend "review onboarding status" (not a billing problem).
- If overdue total > $10,000: append "🚨 high-value at-risk" to the recommended action line.

## Why this order matters
Doing customer profile first means you can address them by name in the response. Doing overdue before the summary means the per-customer line is fresh in the response when you reference book-wide totals — much less likely to confuse the two numbers in the final output.
