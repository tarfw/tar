---
type: Tool
title: Read
description: SELECT operation. Reads rows from any table with filters.
resource: taragent://tools/read
tags: [tool, read, select, query]
timestamp: 2026-07-04T00:00:00Z
---

# Read

SELECT rows from `form`, `matter`, `motion`, or `graph` with optional filters.

## Agent usage

```
read(table='matter', type='product', scope='w:rest-101')
read(table='matter', id='m_8001')
read(table='motion', type='order', scope='u:ravanan', limit=50)
read(table='graph', src='user:ravanan', rel='owns')
```

## What it does

1. Builds SQL query from the provided params
2. Executes against the correct store (DO SQLite or Turso)
3. Returns matching rows as JSON

## Filters

| Filter | Example | SQL equivalent |
|---|---|---|
| `type` | `type='product'` | `WHERE type = 'product'` |
| `id` | `id='m_8001'` | `WHERE id = 'm_8001'` |
| `scope` | `scope='w:rest-101'` | `WHERE scope = 'w:rest-101'` |
| `active` | `active=1` | `WHERE active = 1` |
| `limit` | `limit=50` | `LIMIT 50` |

## Store routing

| Scope prefix | Store |
|---|---|
| `w:` | Workspace (DO SQLite) |
| `o:` | Order (DO SQLite) |
| `u:` | User Inbox (Turso) |
| `g:` | Global (Turso) |

## Related

- [Create](/tools/create.md) — insert rows
- [Update](/tools/update.md) — modify rows
- [Search](/tools/search.md) — vector search
