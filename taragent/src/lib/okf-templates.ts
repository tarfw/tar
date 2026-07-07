export const OKF_TEMPLATES: Record<string, Record<string, string>> = {
  restaurant: {
    "index": `# restaurant\nVertical: restaurant\nModules: inventory, orders, reports\n\n## Modules\n- [inventory](./inventory.md)\n- [orders](./orders.md)\n- [reports](./reports.md)\n`,

    "inventory": `---
type: Module
title: Inventory module
description: Stock tracking, low-stock alerts, batch/expiry tracking, supplier management, FIFO rotation.
resource: taragent://skills/inventory
tags: [module, inventory, stock, expiry]
timestamp: 2026-07-04T00:00:00Z
---

# Inventory module

Manages stock levels, batch tracking, expiry scanning, and supplier relationships.

## What it does

- Track stock quantities per product
- Low-stock alerts (below min_stock)
- Batch tracking with FIFO rotation
- Expiry scanning (daily cron)
- Supplier profiles and reorder triggers
- Stock transfers between locations

## Stock fields in matter

| Field | Purpose |
|---|---|
| \`qty\` | Current stock count |
| \`unit\` | piece, kg, litre, metre, bag, box, dozen |
| \`value\` | Selling price per unit |
| \`data.cost_price\` | What we pay |
| \`data.mrp\` | Maximum retail price |
| \`data.min_stock\` | Alert threshold |
| \`data.batch\` | Batch ID for FIFO |

## Batch/FIFO flow

\`\`\`
User sells 5 Pepsi (batch A: qty=3, batch B: qty=4)
  → Read batches sorted by start (FIFO): batch A first
  → Deduct 3 from batch A (depleted, set active=0)
  → Deduct 2 from batch B (4→2)
  → Log sale motion
\`\`\`

## Expiry scanner

Runs daily at 6 AM via Cloudflare Cron Trigger.

\`\`\`sql
SELECT * FROM matter
WHERE type = 'product'
  AND active = 1
  AND end IS NOT NULL
  AND end <= datetime('now', '+7 days')
ORDER BY end ASC
\`\`\`

Creates \`expiry\` motion events. ExpiryCard actions: Discount, Discard, Dismiss.

## Actions

| Action | What it does |
|---|---|
| \`action_check_stock\` | Read all products, filter by qty |
| \`action_add_stock\` | Update qty, create restock motion |
| \`action_deduct_stock\` | FIFO deduction, alert if below min |
| \`action_expiry_scan\` | Daily scan, create expiry motions |

## Related

- [Orders](/modules/orders.md) — stock deducted on order
- [Matter schema](/schemas/matter.md) — product fields
- [Motion types](/schemas/motion.md) — stock_alert, restock, expiry
`,

    "orders": `---
type: Module
title: Orders module
description: Order creation, status tracking, payment recording, GST/tax, loyalty points, multi-currency.
resource: taragent://skills/pos
tags: [module, orders, pos, payments]
timestamp: 2026-07-04T00:00:00Z
---

# Orders module

Handles the full order lifecycle — from placement to payment to completion.

## What it does

- Create orders (simple POS or complex delivery)
- Track order status through state machine
- Record payments (UPI or Cash)
- Apply GST/tax calculations
- Loyalty points (earn on purchase, redeem on next)
- Multi-currency support

## Order types

| Type | Store | Use case |
|---|---|---|
| Simple/POS | Workspace (\`matter\`) | Quick sale, walk-in |
| Complex/delivery | Order (\`o:\`) | Multi-step lifecycle, async events |

## Order state machine (complex orders)

\`\`\`
created → confirmed → preparing → dispatched → delivered
                                          ↓
                                       cancelled
\`\`\`

Each transition serialized through the DO — no race conditions.

## Payment model

UPI + Cash only. No gateway. No reconciliation.

| Method | How |
|---|---|
| UPI | Workspace stores UPI ID. Invoice shows QR code. Customer pays directly. |
| Cash | Owner marks order as paid. No digital transfer. |

## Actions

| Action | What it does |
|---|---|
| \`action_create_order\` | Creates order matter + motion |
| \`action_confirm_order\` | Advances state to confirmed |
| \`action_record_payment\` | Records payment matter |
| \`action_cancel_order\` | Cancels + refunds |

## GST/tax

Action reads item price, applies tax rate from \`form WHERE type='tax_config'\`, returns CGST+SGST or IGST breakup.

## Reports

| Report | Query |
|---|---|
| Daily Sales | \`matter WHERE type='order' AND start >= today\` |
| Tax Summary | Tax config + order items → aggregate by tax type |
| Revenue by Category | Orders grouped by product category |

## Related

- [Inventory](/modules/inventory.md) — stock deducted on order
- [Logistics](/modules/logistics.md) — delivery for complex orders
- [Reports](/modules/reports.md) — sales and tax reports
`,

    "reports": `---
type: Module
title: Reports module
description: SQL queries over Workspace data — sales, stock, tax, revenue, alerts. No new tables.
resource: taragent://skills/reports
tags: [module, reports, analytics, sql]
timestamp: 2026-07-04T00:00:00Z
---

# Reports module

Reports are SQL queries over existing Workspace data (matter + motion). No new tables. Each report is a \`form\` row with \`type='action'\`.

## Available reports

| # | Report | What it shows | Source tables |
|---|---|---|---|
| 1 | Daily Sales Summary | Orders count, revenue, UPI vs Cash | matter (type='order') + matter (type='payment') |
| 2 | Stock Valuation | qty × value = total per product | matter (type='product') |
| 3 | Tax Summary (GST) | CGST, SGST, IGST collected | matter + form (tax_config) |
| 4 | Revenue by Category | Revenue per product category | matter (type='order') + product data.category |
| 5 | Low Stock Alert | Products below min_stock | matter (type='product') |
| 6 | Expiring Soon | Products within 7 days of expiry | matter (type='product', end IS NOT NULL) |
| 7 | Monthly Expense Summary | Expenses by category | matter (type='expense') |
| 8 | Expense vs Revenue | Profit/loss calculation | expenses + orders |
| 9 | Outstanding Bills | Unpaid expenses with due dates | matter (type='expense', status='unpaid') |

## Report parameters

All reports accept:
- \`from\` — start date (ISO 8601)
- \`end\` — end date (ISO 8601)
- \`scope\` — workspace scope (auto-filled)

## Intent matching

| User says | Report |
|---|---|
| "today's sales" / "how much sold" | action_report_daily_sales |
| "stock value" / "inventory worth" | action_report_stock_valuation |
| "tax" / "GST" | action_report_tax_summary |
| "revenue by category" / "best sellers" | action_report_revenue_by_category |
| "low stock" / "running out" | action_report_low_stock |
| "expiring" / "about to expire" | action_report_expiring |

## Output format

\`\`\`
Daily Sales — July 3, 2026
Orders: 47
Revenue: ₹12,400
UPI: ₹8,200 (66%) | Cash: ₹4,200 (34%)
Top: Biryani × 28 = ₹5,040
\`\`\`

## Action memory connection

First report query uses LLM. Every subsequent query reuses the action memory card. User edits date range and taps "Run Report". Zero LLM cost.

## Related

- [Matter schema](/schemas/matter.md) — data source
- [Action memory](/agents/action-memory.md) — cached report cards
`
  }
};
