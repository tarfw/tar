---
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
| Simple/POS | Workspace (`matter`) | Quick sale, walk-in |
| Complex/delivery | Order (`o:`) | Multi-step lifecycle, async events |

## Order state machine (complex orders)

```
created → confirmed → preparing → dispatched → delivered
                                          ↓
                                       cancelled
```

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
| `action_create_order` | Creates order matter + motion |
| `action_confirm_order` | Advances state to confirmed |
| `action_record_payment` | Records payment matter |
| `action_cancel_order` | Cancels + refunds |

## GST/tax

Action reads item price, applies tax rate from `form WHERE type='tax_config'`, returns CGST+SGST or IGST breakup.

## Reports

| Report | Query |
|---|---|
| Daily Sales | `matter WHERE type='order' AND start >= today` |
| Tax Summary | Tax config + order items → aggregate by tax type |
| Revenue by Category | Orders grouped by product category |

## Related

- [Inventory](/modules/inventory.md) — stock deducted on order
- [Logistics](/modules/logistics.md) — delivery for complex orders
- [Reports](/modules/reports.md) — sales and tax reports
