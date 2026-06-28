---
name: pos
description: How to manage retail point of sale, stores, products, and transactions
---

# POS Skill

## Core Concepts

### Store
Physical or virtual location where sales happen.
- Has registers (POS terminals)
- Has inventory (stock)
- Has staff (cashiers)
- Has tax rules

### Product
Item available for sale.
- Has price
- Has variants (size, color)
- Has stock per location
- Has SKU/barcode

### Order
Single transaction (sale).
- Contains line items
- Calculates: subtotal + tax - discount = total
- Links to payment

### Shift
Cashier work period.
- Opens with starting cash
- Tracks sales during shift
- Closes with ending cash + variance

## Common Operations

### Create Product
1. action_create_product(name, price, stock, description, storeId)
2. Creates product matter
3. Sets price + stock in attr
4. Embeds for search

### Ring Sale (Checkout)
1. action_checkout(storeId, items, paymentMethod)
2. Creates order matter
3. Links products via graph
4. Calculates total
5. Updates inventory via attr
6. Sends receipt via action_notify

### Open Shift
1. action_start_shift(registerId, cashierId, startingCash)
2. Creates shift matter
3. Sets status='open'

### Close Shift
1. action_end_shift(shiftId, endingCash)
2. Calculates variance
3. Sets status='closed'

### Add to Cart
1. action_add_to_cart(sessionId, product, price, qty)
2. Appends to motion stream

## Inventory Management

### Stock Levels
- Store in attr: key='stock-{storeId}', num=quantity
- Query: tool_list_matters(type='product') + tool_set_attr filters
- Reorder: set attr(reorder_point=N), alert when stock < N

### Restock
1. Receive shipment
2. tool_set_attr(stock+quantity)
3. Log to motion

### Low Stock Alert
1. Check attr(num) < reorder_point
2. action_notify(channel='email', template='restock-needed')

## Tax & Discounts

### Tax Rules
- Store in form.type='tax-rule'
- Apply during checkout calculation

### Discounts
- Store in form.type='discount'
- Apply before tax calculation

## Best Practices

### Receipts
- Always send/email receipt
- Log to motion for audit

### Security
- Each shift is its own matter
- Cashier logged per transaction
- Variance tracking
