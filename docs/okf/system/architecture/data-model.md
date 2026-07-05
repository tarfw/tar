---
type: Reference
title: Data model — 5 tables
description: All business data fits in 5 tables: form, matter, motion, graph, memory. The attr table is removed.
resource: docs://architecture/data-model
tags: [schema, data-model, tables]
timestamp: 2026-07-04T00:00:00Z
---

# Data model — 5 tables

Every piece of data in the system goes into one of 5 tables. No new tables. No schema migrations per vertical.

## The tables

| Table | Purpose | Example |
|---|---|---|
| `form` | Universal catalog — products, actions, workflows, skills, layouts | Pepsi product definition, `action_create_lead` |
| `matter` | Business entities — products, orders, expenses, documents | 50 Pepsi in stock, order #789, rent receipt |
| `motion` | Action queue — only events needing user action | "Order #789 needs confirmation" |
| `graph` | Relationships — binary edges between any two entities | `user:ravanan → w:rest-101 (owner)` |
| `memory` | Vector search + action memory cards | "Book a Taxi" cached card |

## Matter schema

```sql
CREATE TABLE matter (
  id       TEXT PRIMARY KEY,
  form     TEXT,          -- FK to form.id in global Turso
  title    TEXT NOT NULL,
  type     TEXT,          -- product, service, order, expense, document...
  qty      REAL DEFAULT 0,
  unit     TEXT,          -- piece, kg, litre, metre, bag, box, dozen
  value    REAL DEFAULT 0, -- selling price
  data     TEXT,          -- JSON: cost_price, mrp, expiry, batch, hsn...
  scope    TEXT,          -- workspace scope: w:rest-101
  active   INTEGER DEFAULT 1,
  start    TEXT,          -- birth timestamp
  end      TEXT,          -- death timestamp (null = perpetual)
  life     INTEGER        -- duration in seconds from start
);
```

## Graph schema

```sql
CREATE TABLE graph (
  src TEXT NOT NULL,
  rel TEXT NOT NULL,
  tgt TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  time TEXT,
  PRIMARY KEY (src, rel, tgt)
);
```

All relationships are binary. Edge exists or doesn't. No weighted edges.

## How matter uses time fields

| Field | Meaning | Example |
|---|---|---|
| `start` | When row was created (birth) | `"2026-07-01T10:00:00Z"` |
| `end` | When row expires (death), null = perpetual | Pepsi: null, Milk: `"2026-07-05"` |
| `life` | Duration in seconds from start | Gym membership: 2592000 (30 days) |

## How matter uses data JSON

Hot fields that vary per product type go in `data` JSON, not separate columns:

```json
{
  "cost_price": 18,
  "mrp": 24,
  "hsn": "2202",
  "expiry": "2026-10-15",
  "batch": "OIL-07",
  "min_stock": 20,
  "category": "mains"
}
```

## Related

- [Scopes](/architecture/scopes.md) — which store holds what
- [Motion types](/schemas/motion.md) — the 32 motion types
- [Matter schema](/schemas/matter.md) — detailed column docs
