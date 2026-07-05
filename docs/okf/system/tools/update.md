---
type: Tool
title: Update
description: UPDATE operation. Modifies existing rows in form, matter, or motion.
resource: tarflue-v2://tools/update
tags: [tool, update, modify]
timestamp: 2026-07-04T00:00:00Z
---

# Update

UPDATE an existing row in `form`, `matter`, or `motion`.

## Agent usage

```
update(table='matter', id='m_8001', qty=47)
update(table='matter', id='m_8001', data:{...currentData, min_stock: 25})
update(table='matter', id='exp_8001', data:{...currentData, status:'paid', txn_id:'TXN123'})
```

## What it does

1. Reads the current row
2. Merges the update fields
3. Writes the updated row back
4. For stock changes: also creates a motion event

## Common patterns

### Deduct stock (sale)
```
read(table='matter', id='m_8001')  → current qty=50
update(table='matter', id='m_8001', qty=47)  → new qty=47
create(table='motion', type='sale', data:{productId:'m_8001', sold:3})
```

### Update expense status
```
read(table='matter', id='exp_8001')  → current data
update(table='matter', id='exp_8001', data:{...currentData, status:'paid'})
```

### Soft delete
```
update(table='matter', id='m_8001', active=0)
```

## Does NOT work on

- `graph` table (use `link` tool to toggle edges)
- `memory` table (use `search` tool)

## Related

- [Read](/tools/read.md) — read current state first
- [Create](/tools/create.md) — insert new rows
- [Delete](/tools/delete.md) — soft delete
