---
type: Tool
title: Delete
description: SOFT DELETE operation. Sets active=0 on form, matter, or graph rows.
resource: tarflue-v2://tools/delete
tags: [tool, delete, soft-delete]
timestamp: 2026-07-04T00:00:00Z
---

# Delete

SOFT DELETE — sets `active=0` on `form`, `matter`, or `graph` rows. Never hard-deletes.

## Agent usage

```
delete(table='matter', id='m_8001')
delete(table='graph', src='user:x', rel='member', tgt='w:y')
```

## What it does

1. Sets `active=0` on the target row
2. Row stays in the database for audit trail
3. Future `read` queries filter out inactive rows by default

## Why soft delete

- Audit trail: we can see what was deleted and when
- Recovery: can reactivate by setting `active=1`
- Referential integrity: other rows may reference this one

## Does NOT work on

- `motion` table (motion rows are archived, not deleted)
- `memory` table (use `search` tool)

## Related

- [Read](/tools/read.md) — reads exclude inactive by default
- [Update](/tools/update.md) — can also soft-delete via `active=0`
