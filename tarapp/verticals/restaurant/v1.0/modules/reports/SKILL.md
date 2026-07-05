---
name: reports
version: 1.0.0
module: reports
tools: [read, search]
---

# Reports Skill

## Purpose
Generate business reports: sales, stock, tax, revenue.

## Actions

### action_report_daily_sales
Show today's sales summary.

Steps:
1. `read(table='matter', type='order', active=1, scope='{scope}')` — filter by today's date
2. Group by payment method, sum values
3. Format: total orders, total revenue, UPI vs Cash split

### action_report_stock_valuation
Show total inventory value.

Steps:
1. `read(table='matter', type='product', active=1, scope='{scope}')`
2. Compute: SUM(qty x value) per product and total

### action_report_tax_summary
Show GST collected.

Steps:
1. `read(table='matter', type='order', scope='{scope}')` — filter by date range
2. Read tax config from `form WHERE type='tax_config'`
3. Apply rates, aggregate CGST/SGST/IGST

### action_report_low_stock
Show products below minimum.

Steps:
1. `read(table='matter', type='product', active=1, scope='{scope}')`
2. Filter: qty <= JSON_EXTRACT(data, '$.min_stock')

### action_report_expiring
Show products expiring soon.

Steps:
1. `read(table='matter', type='product', active=1, scope='{scope}')`
2. Filter: end IS NOT NULL AND end <= datetime('now', '+7 days')

## Intent Matching

| User says | Action |
|---|---|
| today's sales / how much sold | action_report_daily_sales |
| stock value / inventory worth | action_report_stock_valuation |
| tax / GST / CGST SGST | action_report_tax_summary |
| low stock / running out | action_report_low_stock |
| expiring / about to expire | action_report_expiring |
