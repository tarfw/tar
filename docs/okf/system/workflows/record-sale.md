---
type: Workflow
title: Record sale
description: The workflow for recording a sale — check stock, deduct, create receipt motion.
resource: tarflue-v2://src/workflows/
tags: [workflow, sale, stock, receipt]
timestamp: 2026-07-04T00:00:00Z
---

# Record sale

Handles "Record sale of 3 Pepsi" type requests.

## Steps

```
1. read(table='matter', id='{productId}')
   → Get current qty, price

2. IF qty >= requestedQty:
   → update(table='matter', id='{productId}', qty=qty - requestedQty)
   → create(table='motion', type='sale', data:{productId, qty, total})
   → create(table='motion', type='payment', data:{method, amount})
   → Reply: "3 Pepsi sold. Stock: 10 → 7. Total: ₹66"

3. IF qty < requestedQty:
   → Reply: "Only {qty} left. Need {requestedQty}."
```

## Flow diagram

```
User: "Record sale of 3 Pepsi"
  │
  ▼
Agent detects: intent=record_sale, item=pepsi, qty=3
  │
  ▼
Workflow: wf_record_sale
  │
  ├── read(matter, id='m_p001') → qty=10
  │
  ├── 10 >= 3? YES
  │
  ├── update(matter, id='m_p001', qty=7)
  ├── create(motion, type='sale', qty=3, total=66)
  ├── create(motion, type='payment', method='upi', amount=66)
  │
  └── Reply: "3 Pepsi sold. Stock: 10→7. ₹66"
```

## LLM cost

₹0 after first time. Action memory caches this workflow as a card.

## Related

- [Inventory module](/modules/inventory.md) — stock management
- [Orders module](/modules/orders.md) — order creation
- [Tools: Read](/tools/read.md) — reading product data
- [Tools: Update](/tools/update.md) — deducting stock
