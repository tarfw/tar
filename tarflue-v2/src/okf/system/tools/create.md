---
type: Tool
title: Create
description: INSERT operation. Creates a new row in any of the 5 tables.
resource: tarflue-v2://tools/create
tags: [tool, create, insert]
timestamp: 2026-07-04T00:00:00Z
---

# Create

INSERT a new row into `form`, `matter`, `motion`, or `graph`.

## Agent usage

```
create(table='matter', type='lead', title='Ravanan', data:{phone:'98765'}, scope='w:rest-101')
create(table='motion', type='order', data:{orderId:'789', items:'5 Burgers'}, scope='u:ravanan')
create(table='graph', src='user:ravanan', rel='owns', tgt='w:rest-101')
```

## What it does

1. Generates a unique ID (e.g., `m_8001`, `mem_001`)
2. Inserts the row into the target table
3. For motion: also writes to the user's Turso Inbox
4. Returns the created row's ID

## Tables it works on

| Table | Example |
|---|---|
| `form` | `create(table='form', type='action', title='Create Lead', ...)` |
| `matter` | `create(table='matter', type='product', title='Pepsi', qty=50, ...)` |
| `motion` | `create(table='motion', type='order', data:{...})` |
| `graph` | `create(table='graph', src='user:x', rel='member', tgt='w:y')` |

## Does NOT work on

- `memory` table (use `search` tool for vector operations)

## Related

- [Read](/tools/read.md) — read what you created
- [Update](/tools/update.md) — modify the row later
- [Link](/tools/link.md) — create graph relationships
