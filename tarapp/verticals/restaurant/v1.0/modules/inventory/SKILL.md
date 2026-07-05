---
name: inventory
version: 1.0.0
module: inventory
tools: [create, read, update, delete, link]
---

# Inventory Skill — Restaurant

## Purpose
Track stock levels, manage suppliers, handle expiry, prevent oversell.

## Actions

### action_add_product
Add a new product to inventory.

Steps:
1. `create(table='matter', type='product', title='{name}', qty={qty}, unit='{unit}', value={price}, data:{cost_price:{cost}, mrp:{mrp}, min_stock:{min}}, scope='{scope}')`
2. `link(src='{scope}', tgt='{productId}', rel='stocks')`

### action_update_stock
Add stock (restock) to an existing product.

Steps:
1. `read(table='matter', id='{productId}')` — get current qty
2. `update(table='matter', id='{productId}', qty=currentQty + addedQty)`
3. `create(table='motion', type='restock', data:{productId:{id}, addedQty:{qty}, newQty:newTotal})`

### action_deduct_stock
Reduce stock after a sale (called by order workflow).

Steps:
1. `read(table='matter', id='{productId}')` — get current qty
2. If FIFO batch tracking: `read(table='matter', type='product', form='{formId}', active=1)` → pick oldest batch
3. `update(table='matter', id='{productId or batchId}', qty=currentQty - soldQty)`
4. If qty hits 0: `create(table='motion', type='stock_alert', data:{productId, title, qty:0})`

### action_check_low_stock
Find products below minimum stock level.

Steps:
1. `read(table='matter', type='product', active=1, scope='{scope}')`
2. Filter: qty <= JSON_EXTRACT(data, '$.min_stock')
3. For each: `create(table='motion', type='stock_alert', data:{productId, title, qty, minStock})`

### action_remove_product
Soft-delete a product.

Steps:
1. `update(table='matter', id='{productId}', active=0)`
2. `create(table='motion', type='product_removed', data:{productId, title})`

## Intent Matching

| User says | Action |
|---|---|
| add product / new item / add stock | action_add_product |
| restock / add quantity | action_update_stock |
| low stock / running out | action_check_low_stock |
| remove product / delete item | action_remove_product |
