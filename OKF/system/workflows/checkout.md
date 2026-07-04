---
type: Workflow
title: Checkout
description: Cart → payment → order completion. Handles both simple POS and complex delivery orders.
resource: tarflue-v2://src/workflows/
tags: [workflow, checkout, payment, order]
timestamp: 2026-07-04T00:00:00Z
---

# Checkout

Handles the checkout flow from cart to completed order.

## Simple POS checkout

```
1. User: "Checkout — 3 Pepsi, 1 Biryani"

2. read(table='matter', type='product', scope='w:rest-101')
   → Get prices: Pepsi ₹22, Biryani ₹180

3. Calculate total: (3 × 22) + (1 × 180) = ₹246

4. IF stock sufficient:
   → update(table='matter', id='m_p001', qty=qty-3)
   → update(table='matter', id='m_bir_001', qty=qty-1)
   → create(table='matter', type='order', data:{items, total, status:'completed'})
   → create(table='motion', type='payment', data:{method:'upi', amount:246})

5. Reply: "Order complete. ₹246. UPI or Cash?"
```

## Complex delivery checkout

```
1. User: "Order 5 Burgers for delivery to 123 Anna Nagar"

2. Create OrderDO (o:order_789)
   → State: created

3. Reserve stock in WorkspaceDO
   → State: reserved

4. Record payment
   → State: paid

5. Assign driver
   → State: confirmed

6. Kitchen marks ready
   → State: ready_for_pickup

7. Driver picks up
   → State: out_for_delivery

8. Delivered
   → State: delivered
   → Commit stock deduction
   → Archive OrderDO
```

## Payment methods

| Method | Flow |
|---|---|
| UPI | Show QR code / UPI link. Customer pays directly. Record payment_received. |
| Cash | Owner marks as paid. No digital transfer. Record payment_received. |

No payment gateway. No transaction fees. No settlement cycles.

## Related

- [Orders module](/modules/orders.md) — order state machine
- [Inventory module](/modules/inventory.md) — stock deduction
- [Record Sale](/workflows/record-sale.md) — simpler flow
