---
type: Tool
title: Link
description: Graph edge operation. INSERT or TOGGLE a relationship between any two entities.
resource: tarflue-v2://tools/link
tags: [tool, link, graph, relationship]
timestamp: 2026-07-04T00:00:00Z
---

# Link

INSERT or TOGGLE a graph edge. Creates a relationship between any two entities.

## Agent usage

```
link(src='user:ravanan', tgt='w:rest-101', rel='owner')
link(src='w:rest-101', tgt='m_p001', rel='stocks')
link(src='exp_8001', tgt='doc_receipt_001', rel='attached_to')
```

## What it does

1. Checks if edge `(src, rel, tgt)` exists
2. If exists: toggles `active` (ON→OFF or OFF→ON)
3. If not exists: inserts new edge with `active=1`

## Common relationships

| src | rel | tgt | Meaning |
|---|---|---|---|
| `user:ravanan` | `owner` | `w:rest-101` | User owns workspace |
| `user:thamizhi` | `staff` | `w:clinic-303` | User is staff at workspace |
| `w:rest-101` | `stocks` | `m_p001` | Workspace stocks this product |
| `m_p001` | `supplies` | `sup_001` | Product supplied by supplier |
| `exp_8001` | `attached_to` | `doc_001` | Expense has receipt attached |
| `o:order_789` | `assigned_to` | `driver_001` | Order assigned to driver |

## Graph as ACL

```
user:ravanan → w:rest-101 (owner)     → full access
user:staff1 → w:rest-101 (staff)       → staff access
user:thamizhi → w:clinic-303 (staff)   → staff access
```

If the graph edge exists, the user has access. Roles (owner/staff/viewer) are agent logic.

## Related

- [Read](/tools/read.md) — `read(table='graph', src='user:x')` to find all relationships
- [Create](/tools/create.md) — `create(table='graph', ...)` also works but doesn't toggle
