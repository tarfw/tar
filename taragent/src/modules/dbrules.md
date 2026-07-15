# Database Rules

> AI must follow these rules for all SQL, workspace creation, and module design.

---

## 1. Two Databases

| Database | Purpose | Instance |
|----------|---------|----------|
| **Global DB** | Shared catalog and skill templates | One shared Turso DB |
| **Workspace DB** | All workspace data | One Turso DB per workspace |

- Never mix global and workspace data in the same query.
- Workspace is identified by its `scope` value (e.g. `ws:anjalis`).

---

## 2. Schema — Workspace DB

```sql
CREATE TABLE IF NOT EXISTS matter (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  value      REAL,
  status     TEXT DEFAULT 'active',
  data       TEXT,
  s3_key     TEXT,
  scope      TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS motion (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  ref_id     TEXT,
  data       TEXT,
  created_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  scope      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph (
  src   TEXT NOT NULL,
  rel   TEXT NOT NULL,
  tgt   TEXT NOT NULL,
  scope TEXT NOT NULL,
  time  INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (src, rel, tgt)
);

CREATE TABLE IF NOT EXISTS inbox (
  id         TEXT PRIMARY KEY,
  scope      TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  status     TEXT DEFAULT 'open',
  ref_id     TEXT,
  data       TEXT,
  due_at     INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS memory (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT,
  data       TEXT,
  scope      TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_matter_scope_type   ON matter(scope, type);
CREATE INDEX IF NOT EXISTS idx_matter_scope_status ON matter(scope, status);
CREATE INDEX IF NOT EXISTS idx_motion_scope_type   ON motion(scope, type);
CREATE INDEX IF NOT EXISTS idx_motion_ref           ON motion(ref_id);
CREATE INDEX IF NOT EXISTS idx_inbox_scope_status  ON inbox(scope, status);
CREATE INDEX IF NOT EXISTS idx_inbox_due            ON inbox(due_at);
CREATE INDEX IF NOT EXISTS idx_graph_src            ON graph(src);
CREATE INDEX IF NOT EXISTS idx_graph_tgt            ON graph(tgt);
```

---

## 3. Schema — Global DB

```sql
CREATE TABLE IF NOT EXISTS catalog (
  id    TEXT PRIMARY KEY,
  type  TEXT NOT NULL,
  title TEXT NOT NULL,
  data  TEXT,
  scope TEXT DEFAULT 'global'
);
```

> No embeddings table. Use an external vector store (e.g. LanceDB or Vectorize) if semantic search is needed — not a DB column.

---

## 4. ID Rules

- Format: `{entity_prefix}_{nanoid}` — always entity-specific, never generic.
- Never use sequential integers.

| Entity | Prefix |
|--------|--------|
| order | `ord_` |
| booking | `bkg_` |
| customer | `cus_` |
| staff | `stf_` |
| invoice | `inv_` |
| expense | `exp_` |
| deal | `deal_` |
| motion | `mot_` |
| inbox | `ibx_` |
| any other | `{type_abbrev}_` |

---

## 5. Table Rules

### matter
- The source of truth for all entity current state.
- One row per entity. `status` column owns the entity lifecycle.
- `status` values: `active` · `completed` · `cancelled` · `voided` · `archived`
- `value` column stores the primary numeric (price, quantity, amount).
- `data` column: inline JSON for fields < 2KB. Use `s3_key` for anything larger.
- Never hard-DELETE. Set status instead.
- Types: `order` · `appointment` · `booking` · `customer` · `staff` · `invoice` · `expense` · `stock` · `deal` · `contract` · `asset` · `ticket` · `project` · `payslip` · `purchase_order` · `work_order` · `shipment` · `listing` · `setting`

### motion
- Selective user-visible event log. Not a full audit trail.
- Write motion only when the event belongs in a user-facing history or timeline.
- Do NOT write motion for: internal state updates, bulk operations, computed changes.
- `ref_id` links back to the `matter` row the event belongs to.
- Current entity status = `matter.status` — never read from motion.
- Prune rows older than 90 days.
- Types: `sale` · `payment` · `booking` · `status_change` · `clock_in` · `clock_out` · `stock_adjustment` · `restock` · `deal_stage_change` · `activity` · `milestone` · `completion`

### graph
- Stores relationships that require traversal queries.
- Only write graph when you need to query "find all X linked to Y".
- Do NOT write graph if the reference is just displayed (store in `matter.data` instead).
- Do NOT write graph to link an entity to its workspace — `scope` already does that.
- To remove a relationship: DELETE the graph row (graph rows are cheap and disposable).
- Relations: `customer` · `contains` · `assigned_to` · `created_by` · `works_at` · `for_order` · `depends_on` · `member_of`

### inbox
- One row per actionable item requiring human attention.
- `title`: short action label only (e.g. `"New order"`, `"Low stock"`). Not a description.
- `ref_id`: ID of the related `matter` row. Fetch full details from `matter` on demand.
- `data`: store only fields not in `matter` and needed for the inbox card (max 3-4 fields).
- `urgency` is NOT stored — computed at read time from `due_at`:
  - `due_at` passed and status is `open` → **now**
  - `due_at` is in the future → **next**
  - No `due_at` → **normal**
- `type` = module name, free-form. All 80 modules write here without code changes.
- Status values: `open` · `done` · `archived`
- Prune rows with `status != 'open'` older than 30 days.

### memory
- AI-inferred patterns and context only — not user-entered profile data.
- User profile data belongs in `matter(type=customer).data`.
- Write with UPSERT on `(scope, type, title)` key — never INSERT duplicates.
- Prune rows older than 180 days.
- Types: `preference` · `pattern` · `note`

### form (Workspace DB) + catalog (Global DB)
- `catalog` = global defaults shared across all workspaces.
- `form` = workspace override for a specific catalog item. Write only when workspace differs.
- Read rule: if no `form` rows exist for this scope, read `catalog` directly — skip merge.
- `form` wins over `catalog` for the same `(type, title)` key.
- `form` rows can be hard-deleted — they are disposable overrides.

---

## 6. No Data Repeat Rules

These rules prevent the same data being stored in two places:

| Situation | Rule |
|-----------|------|
| Order created → inbox created | `inbox.ref_id = matter.id`. Do not copy order fields into `inbox.data`. |
| Customer linked to order | Store `customer_id` in `matter(order).data` OR in `graph` — never both. |
| Customer preferences | Store in `memory` only if AI-inferred. User-entered data stays in `matter(customer).data`. |
| Inbox title vs matter title | `inbox.title` is a short label. `matter.title` is the full name. They serve different purposes. |
| Urgency field | Never store. Always compute from `due_at` at read time. |

---

## 7. S3 Pointer Rule

- If `matter.data` or `motion.data` exceeds 2KB, store in S3 and put the key in `s3_key`.
- S3 key format: `{scope}/{table}/{id}.json`
- List queries and inbox load: read DB only — never fetch S3.
- Detail view (single record open): fetch `s3_key` content on demand.

---

## 8. Module Write Pattern

Every module follows this pattern. Steps 2 and 3 are conditional.

1. **matter** — always. Create or update the entity.
2. **motion** — only if the event is user-visible (history/timeline).
3. **inbox** — only if a human needs to act on it.
4. **graph** — only if the relationship needs traversal queries.

### Module Rules

**Orders / POS**
- `matter(type=order)` — entity. `motion(type=sale)` — event. `inbox(type=order)` — notify staff.
- `graph(src=ord_id, rel=customer, tgt=cus_id)` — only if you need "find all orders for customer".

**Inventory**
- `matter(type=stock)` — quantity in `value` column.
- `motion(type=stock_adjustment)` — only on manual adjustments, not automated deductions.
- Atomic deduction: `UPDATE matter SET value = value - N WHERE id = ? AND value >= N`
- `inbox(type=stock_alert)` — only when stock hits minimum threshold. Set `due_at = now`.

**Bookings**
- `matter(type=appointment)` — entity. `motion(type=booking)` — event.
- `inbox(type=booking, due_at={appointment_time})` — urgency computed automatically from `due_at`.

**CRM**
- `matter` for customer, company, and deal entities separately.
- `graph` for deal→customer and deal→company links (traversal needed).
- `motion(type=deal_stage_change)` and `motion(type=activity)` for visible history.
- `inbox(type=deal)` with `due_at` for follow-up tasks.
- `memory` for AI-inferred patterns only.

**Staff / HR**
- `matter(type=staff)` — profile. `motion(type=clock_in / clock_out)` — attendance.
- `matter(type=payslip)` — payroll record. `inbox(type=payroll)` — for approvals.

**Extended Modules**
- Same 4-step pattern. Choose a clear `matter.type` name.
- Only write `graph` if traversal queries are required.
- Use `s3_key` for payloads with many line items.

---

## 9. Query Rules

- Filter by `scope` first in every query.
- Entity current state → query `matter`. History → query `motion`.
- Never derive entity status from `motion` — use `matter.status`.
- Inbox list: `WHERE scope = ? AND status = 'open' ORDER BY due_at ASC NULLS LAST LIMIT 50`
- Compute urgency at read: `due_at < unixepoch()` → now, `due_at >= unixepoch()` → next, `due_at IS NULL` → normal.
- Partial JSON read: `json_extract(data, '$.field')`
- Partial JSON update: `json_set(data, '$.field', value)` — never overwrite the full `data` column.
- Pagination: `WHERE created_at < {cursor}` — never use `OFFSET`.
- Check if `form` rows exist for scope before querying catalog. Skip merge if none.

---

## 10. Write Rules

| Rule | Reason |
|------|--------|
| `scope` in every INSERT | Prevents cross-workspace data leaks |
| Never UPDATE `motion` | Events are facts — immutable |
| Never hard-DELETE `matter` | Set `status` instead |
| `graph` only when traversal is needed | Avoids redundant relationship storage |
| `inbox.ref_id` points to `matter` | No field duplication between inbox and matter |
| `inbox.urgency` is never stored | Computed from `due_at` — always accurate |
| UPSERT `memory`, never INSERT duplicate | One row per (scope, type, title) key |
| `json_set` for partial data updates | Prevents field overwrites |
| Atomic `value - N WHERE value >= N` | Prevents oversell and negative stock |
| `s3_key` for data > 2KB | Keeps rows small, queries fast |
| Prune `motion` > 90 days | Not an audit system |
| Prune closed `inbox` > 30 days | Done items have no active value |
| Entity-type ID prefix always | `ord_`, `cus_`, `ibx_` — type readable from ID |
| `unixepoch()` for all timestamps | Fast integer comparison, no timezone issues |

---

## 11. Soft Delete Reference

| Table | How to delete |
|-------|--------------|
| matter | `UPDATE matter SET status = 'voided' WHERE id = ?` |
| inbox | `UPDATE inbox SET status = 'archived' WHERE id = ?` then prune after 30 days |
| graph | Hard DELETE — graph rows are disposable |
| motion | Prune hard DELETE rows older than 90 days on schedule |
| form | Hard DELETE — overrides are disposable |
| memory | Hard DELETE — AI memory is clearable |

---

## 12. Type Reference

### matter.type
`order` · `appointment` · `booking` · `customer` · `staff` · `invoice` · `expense` · `stock` · `deal` · `contract` · `asset` · `ticket` · `project` · `payslip` · `purchase_order` · `work_order` · `shipment` · `listing` · `setting`

### matter.status
`active` · `completed` · `cancelled` · `voided` · `archived`

### motion.type
`sale` · `payment` · `booking` · `status_change` · `clock_in` · `clock_out` · `stock_adjustment` · `restock` · `deal_stage_change` · `activity` · `milestone` · `completion`

### inbox.type
Free-form module name — `order` · `booking` · `stock_alert` · `deal` · `invoice` · `payroll` · `ticket` · `procurement` · `approval` · *any module name*

### inbox urgency (computed, not stored)
- `due_at < now()` and status `open` → **now**
- `due_at >= now()` → **next**
- `due_at IS NULL` → **normal**

### graph.rel
`customer` · `contains` · `assigned_to` · `created_by` · `works_at` · `for_order` · `depends_on` · `member_of`
