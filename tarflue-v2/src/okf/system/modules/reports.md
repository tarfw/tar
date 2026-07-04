---
type: Module
title: Reports module
description: SQL queries over WorkspaceDO data — sales, stock, tax, revenue, alerts. No new tables.
resource: tarflue-v2://skills/reports
tags: [module, reports, analytics, sql]
timestamp: 2026-07-04T00:00:00Z
---

# Reports module

Reports are SQL queries over existing WorkspaceDO data (matter + motion). No new tables. Each report is a `form` row with `type='action'`.

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
- `from` — start date (ISO 8601)
- `end` — end date (ISO 8601)
- `scope` — workspace scope (auto-filled)

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

```
Daily Sales — July 3, 2026
Orders: 47
Revenue: ₹12,400
UPI: ₹8,200 (66%) | Cash: ₹4,200 (34%)
Top: Biryani × 28 = ₹5,040
```

## Action memory connection

First report query uses LLM. Every subsequent query reuses the action memory card. User edits date range and taps "Run Report". Zero LLM cost.

## Related

- [Matter schema](/schemas/matter.md) — data source
- [Action memory](/agents/action-memory.md) — cached report cards
