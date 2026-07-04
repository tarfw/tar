---
name: ecommerce
description: How to manage products, orders, carts, and online sales
---

# E-commerce Skill

## Core Concepts

### Product
A product stored as `matter` with `type='product'`.
- `qty` = stock quantity
- `value` = selling price
- `data` = `{ cost_price, mrp, category, images, description }`

### Order
A customer order stored as `matter` with `type='order'`.
- `value` = total amount
- `data` = `{ items, shippingAddress, paymentMethod, status }`

## Common Operations (6-Tool Pattern)

### List Products
1. `read(table='matter', type='product', active=1, scope='{scope}')`

### Search Products
1. `search(query='{searchTerm}', scope='{scope}')`

### Add to Cart
1. `create(table='matter', type='cart', title='Cart Item', data:{productId, qty, price}, scope='p:{userId}')`

### Place Order
1. `create(table='matter', type='order', title='Order #{id}', value={total}, data:{items, shippingAddress, paymentMethod, status:'pending'}, scope='{scope}')`
2. For each item: `update(table='matter', id='{productId}', patch:{qty: currentQty - orderedQty})`
3. `link(src='{customerId}', rel='placed', tgt='{orderId}')`
4. `create(table='motion', stream:'{orderId}', action=99993, data:{event:'order_placed', total}, scope='{scope}')`

### Confirm Order
1. `read(table='matter', id='{orderId}')` — get current data
2. `update(table='matter', id='{orderId}', patch:{data:{...currentData, status:'confirmed'}})`
3. `create(table='motion', stream:'{orderId}', action:99993, data:{event:'order_confirmed'}, scope='{scope}')`

### Ship Order
1. `read(table='matter', id='{orderId}')` — get current data
2. `update(table='matter', id='{orderId}', patch:{data:{...currentData, status:'shipped'}})`
3. `create(table='motion', stream:'{orderId}', action:99993, data:{event:'order_shipped'}, scope='{scope}')`

### List Orders
1. `read(table='matter', type='order', scope='{scope}', limit:50)`

## Order Status

1. pending → confirmed → shipped → delivered

## Best Practices

- Deduct stock when order is confirmed
- Store items array in `data.items`
- Link orders to customers via `graph(rel='placed')`
- Log status changes to motion table
