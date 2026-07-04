---
type: Module
title: Inventory module
description: Stock tracking, low-stock alerts, batch/expiry tracking, supplier management, FIFO rotation.
resource: tarflue-v2://skills/inventory
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
| `qty` | Current stock count |
| `unit` | piece, kg, litre, metre, bag, box, dozen |
| `value` | Selling price per unit |
| `data.cost_price` | What we pay |
| `data.mrp` | Maximum retail price |
| `data.min_stock` | Alert threshold |
| `data.batch` | Batch ID for FIFO |

## Batch/FIFO flow

```
User sells 5 Pepsi (batch A: qty=3, batch B: qty=4)
  → Read batches sorted by start (FIFO): batch A first
  → Deduct 3 from batch A (depleted, set active=0)
  → Deduct 2 from batch B (4→2)
  → Log sale motion
```

## Expiry scanner

Runs daily at 6 AM via Cloudflare Cron Trigger.

```sql
SELECT * FROM matter
WHERE type = 'product'
  AND active = 1
  AND end IS NOT NULL
  AND end <= datetime('now', '+7 days')
ORDER BY end ASC
```

Creates `expiry` motion events. ExpiryCard actions: Discount, Discard, Dismiss.

## Actions

| Action | What it does |
|---|---|
| `action_check_stock` | Read all products, filter by qty |
| `action_add_stock` | Update qty, create restock motion |
| `action_deduct_stock` | FIFO deduction, alert if below min |
| `action_expiry_scan` | Daily scan, create expiry motions |

## Related

- [Orders](/modules/orders.md) — stock deducted on order
- [Matter schema](/schemas/matter.md) — product fields
- [Motion types](/schemas/motion.md) — stock_alert, restock, expiry
