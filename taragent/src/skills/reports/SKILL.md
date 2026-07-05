---
name: reports
description: How to generate business reports — sales, stock, tax, revenue, alerts
---

# Reports Skill

## Core Concepts

### Report
A SQL query over Workspace data (matter + motion). Returns aggregated results.
- Each report is a `form` row with `type='action'`
- Reports read from `matter` and `motion` tables only

### Report Parameters
All reports accept:
- `from` — start date (ISO 8601)
- `end` — end date (ISO 8601)
- `scope` — workspace scope (auto-filled from context)

## Available Reports

### 1. Daily Sales Summary
- **Intent:** "today's sales", "sales report", "daily revenue"
- **Action:** `action_report_daily_sales`
- **Query:** `read(table='matter', type='payment', scope='{scope}')`
- **Output:** Total orders, total revenue, UPI vs Cash split

### 2. Stock Valuation
- **Intent:** "stock value", "inventory worth"
- **Query:** `read(table='matter', type='product', active=1, scope='{scope}')`
- **Output:** Per-product value (qty × price), total inventory value

### 3. Tax Summary (GST)
- **Intent:** "tax report", "GST summary"
- **Query:** Read tax config from form, apply to orders, aggregate by tax type
- **Output:** CGST, SGST, IGST collected

### 4. Revenue by Category
- **Intent:** "revenue by category", "best sellers"
- **Query:** `read(table='matter', type='order', scope='{scope}')` → group by category
- **Output:** Revenue per category, percentage share

### 5. Low Stock Alert
- **Intent:** "low stock", "running out"
- **Query:** `read(table='matter', type='product', active=1, scope='{scope}')` → filter low
- **Output:** Products below threshold

### 6. Expiring Soon
- **Intent:** "expiring products", "expiry report"
- **Query:** `read(table='matter', type='product', active=1, scope='{scope}')` → filter by end date
- **Output:** Products expiring within 7 days

## Intent Matching

| User says | Match to |
|---|---|
| "today's sales" / "sales report" | `action_report_daily_sales` |
| "stock value" / "inventory worth" | `action_report_stock_valuation` |
| "tax" / "GST" | `action_report_tax_summary` |
| "revenue by category" / "best sellers" | `action_report_revenue_by_category` |
| "low stock" / "running out" | `action_report_low_stock` |
| "expiring" / "about to expire" | `action_report_expiring` |

## Best Practices

- Always scope queries to the current workspace
- Default to "today" for daily reports
- If no data found, say "No orders today" — don't show empty tables
