---
name: inventory
description: How to manage stock levels, batch/expiry tracking, and supplier management
---

# Inventory Skill

## Core Concepts

### Stock
Quantity of a product stored in `matter` row.
- `qty` column = current stock count
- `unit` column = unit of measure (piece, kg, litre, metre, bag, box, dozen)
- `value` column = selling price per unit
- `data` JSON = `{ cost_price, mrp, min_stock, batch, supplier_id }`

### Batch Tracking
Products with `data.batch` field are tracked by batch ID.
- FIFO rotation: oldest batch sold first (sorted by `start` date)

### Expiry
Products with `end` date set are perishable.
- `end` column = expiry date (ISO 8601)
- `end = null` = perpetual (no expiry)

## Common Operations (6-Tool Pattern)

### Check Stock
1. `read(table='matter', type='product', active=1, scope='{scope}')`

### Update Stock (Add)
1. `read(table='matter', id='{productId}')` — get current qty
2. `update(table='matter', id='{productId}', patch:{qty: currentQty + addedQty})`
3. `create(table='motion', stream='{productId}', action=99993, data:{event:'restock', addedQty, newQty: currentQty + addedQty}, scope='{scope}')`

### Deduct Stock (Sale)
1. `read(table='matter', id='{productId}')` — get current qty
2. `update(table='matter', id='{productId}', patch:{qty: currentQty - soldQty})`
3. `create(table='motion', stream='{productId}', action=99993, data:{event:'stock_deducted', soldQty, newQty: currentQty - soldQty}, scope='{scope}')`

### Transfer Stock
1. `update(table='matter', id='{sourceId}', patch:{qty: sourceQty - transferQty})`
2. `update(table='matter', id='{destId}', patch:{qty: destQty + transferQty})`
3. `create(table='motion', stream:'stock_transfer', action=99993, data:{from: sourceId, to: destId, qty: transferQty}, scope='{scope}')`

### Set Minimum Stock Level
1. `read(table='matter', id='{productId}')` — get current data
2. `update(table='matter', id='{productId}', patch:{data:{...currentData, min_stock: N}})`

### Check Low Stock
1. `read(table='matter', type='product', active=1, scope='{scope}')`
2. Filter: `qty <= data.min_stock`

### Add Product
1. `create(table='matter', type='product', form='{formId}', title='{name}', qty={qty}, unit='{unit}', value={sellingPrice}, data:{cost_price, mrp, min_stock, batch}, scope='{scope}')`
2. `link(src='{scope}', rel='stocks', tgt='{productId}')`

### Remove Product
1. `update(table='matter', id='{productId}', patch:{active: 0})`
2. `create(table='motion', stream:'{productId}', action=99993, data:{event:'product_removed'}, scope='{scope}')`

## Best Practices

- Always check `min_stock` after deductions
- Use FIFO for batch-tracked products
- Set `end` date on perishable items at time of stock entry
- Store cost data in `matter.data` JSON
