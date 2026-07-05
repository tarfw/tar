---
name: orders
version: 1.0.0
module: orders
tools: [create, read, update, delete, link]
---

# Orders Skill — Restaurant

## Purpose
Handle POS operations: create orders, record payments, send receipts.

## Actions

### action_create_order
Create a new order for a customer.

Steps:
1. `create(table='matter', type='order', title='Order #{auto_id}', value={total}, data:{items:{items}, customer:{customer}, payment_method:{method}}, scope='{scope}')`
2. `create(table='motion', type='order', data:{orderId:{id}, status:'pending', items:{items}, total:{total}})`
3. For each item: `read(table='matter', id={itemId})` → `update(table='matter', id={itemId}, qty=currentQty - soldQty)`

### action_confirm_order
Confirm a pending order and update status.

Steps:
1. `update(table='matter', id={orderId}, data:{...currentData, status:'confirmed'})`
2. `create(table='motion', type='order', data:{orderId:{id}, status:'confirmed'})`

### action_ready_order
Mark order as ready for pickup/delivery.

Steps:
1. `update(table='matter', id={orderId}, data:{...currentData, status:'ready'})`
2. `create(table='motion', type='order', data:{orderId:{id}, status:'ready'})`

### action_cancel_order
Cancel an order and restore stock.

Steps:
1. `read(table='matter', id={orderId})` — get order items
2. For each item: `update(table='matter', id={itemId}, qty=currentQty + itemQty)`
3. `update(table='matter', id={orderId}, data:{...currentData, status:'cancelled'})`
4. `create(table='motion', type='order', data:{orderId:{id}, status:'cancelled'})`

### action_record_payment
Record payment for an order.

Steps:
1. `update(table='matter', id={orderId}, data:{...currentData, payment_method:{method}, payment_status:'paid', txn_id:{txnId}})`
2. `create(table='motion', type:'payment', data:{orderId:{id}, amount:{amount}, method:{method}})`

## Intent Matching

| User says | Action |
|---|---|
| order / sell / record sale | action_create_order |
| confirm order | action_confirm_order |
| order ready / mark ready | action_ready_order |
| cancel order | action_cancel_order |
| paid / payment received | action_record_payment |
