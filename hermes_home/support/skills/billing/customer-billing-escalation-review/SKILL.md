---
name: customer-billing-escalation-review
category: billing
description: Automated process to review customer billing data for discrepancies and generate escalation reports
---

## Trigger Conditions\n- Customer has overdue invoices with status 'overdue'\n- Subscription status is 'cancelled' but invoices still being generated\n- Presence of billing-related support tickets\n- Customer onboarded status is inactive (onboarded=0) while subscriptions are active

## Tool Sequence
- get_customer_by_id(customer_id)
- get_invoices(customer_id)
- get_support_tickets(customer_id)
- Analyze results and summarize

## Output Format
One paragraph stating customer name and company, overdue/cancelled invoice details, current ticket status, and required action.

## Validation Steps
- Confirm all API calls return expected data
- Check subscription status vs invoice due dates
- Verify no duplicate invoice statuses
- Ensure ticket priority is appropriate

## Common Pitfalls
- Missing subscription end dates causing invoice misalignment
- Ignoring pending invoices post-cancellation
- Not cross-referencing subscription cancellation date with invoice due dates
- Forgetting to check all invoices in the billing period

## Example
Alice Johnson (TechCorp) has an overdue $99 invoice for GPT-4 API Access, yet the subscription is marked cancelled. A $60 Midjourney invoice from Feb 18 remains pending despite cancellation. Ticket #1 (billing discrepancy) should be escalated to finance/engineering.