---
name: pos
description: How to handle point-of-sale operations, orders, payments, and receipts
---

# POS Skill

## Core Concepts

### Order
A customer order stored as `matter` with `type='order'`.
- `value` = total amount
- `data` = `{ items, paymentMethod, status }`

### Payment
Payment record stored as `matter` with `type='payment'`.
- `value` = amount paid
- `data` = `{ method, txn_id, status }`

## Common Operations (6-Tool Pattern)

### Record Sale
1. `create(table='matter', type='order', title='Order #{id}', value={total}, data:{items, paymentMethod, status:'completed'}, scope='{scope}')`
2. For each item: `update(table='matter', id='{productId}', patch:{qty: currentQty - soldQty})`
3. `create(table='motion', stream:'{orderId}', action=99993, data:{event:'sale_recorded', total, items: items.length}, scope='{scope}')`

### Refund Order
1. `read(table='matter', id='{orderId}')` — get order details
2. `update(table='matter', id='{orderId}', patch:{data:{...currentData, status:'refunded'}})`
3. For each item: `update(table='matter', id='{productId}', patch:{qty: currentQty + returnedQty})`
4. `create(table='motion', stream:'{orderId}', action=99993, data:{event:'order_refunded'}, scope='{scope}')`

### Start Shift
1. `create(table='matter', type='shift', title='Shift', data:{startTime, cashier}, scope='{scope}')`

### End Shift
1. `update(table='matter', id='{shiftId}', patch:{data:{...currentData, endTime, totalSales, variance}})`
2. `create(table='motion', stream:'{shiftId}', action=99993, data:{event:'shift_ended'}, scope='{scope}')`

### List Today's Orders
1. `read(table='matter', type='order', scope='{scope}', limit:100)`

### Get Order by ID
1. `read(table='matter', id='{orderId}')`

## Payment Methods

- UPI: Record `data.method='upi'`, `data.txn_id`
- Cash: Record `data.method='cash'`
- Card: Record `data.method='card'`

## Best Practices

- Always deduct stock when recording a sale
- Use `data` JSON for items array, payment details
- Log every sale to motion for audit trail
- Soft-delete orders (set `active=0`) for refunds, don't hard-delete
