# Database Rules

> AI must follow these rules for all SQL, workspace creation, and module design.

---

## 1. Data Stores

There are 4 stores. Each has a single responsibility.

| Store | What | Cost |
|-------|------|------|
| **Cloudflare D1** | Workspace registry + public listing | Free tier |
| **Turso `tar-search`** | Global vector search index (native libSQL vector) | Free tier |
| **Turso `ws:{id}`** | Per-workspace operational data — matter, motion, graph, inbox (one DB per workspace) | Free tier per DB |
| **S3** | Skill `.md` templates + full entity payloads + workspace agent memory | Near zero |

- Workspace is identified by its `scope` value (e.g. `ws:anjalis`).
- Never query across workspace Turso DBs directly — use `tar-search` for cross-workspace queries.

### D1 Workspace Registry (Cloudflare D1 — not Turso)

D1 is the only shared store. It holds the workspace directory used by the marketplace screen.

| Column | Purpose |
|--------|---------|
| `subdomain` | Unique workspace identifier |
| `scope` | `ws:{subdomain}` — used in all Turso queries |
| `name` | Display name |
| `type` | Business type (restaurant, salon, retail…) |
| `user` | Owner user ID |
| `public` | `1` = visible in marketplace, `0` = private |
| `url` | Workspace Turso DB URL |
| `token` | Workspace Turso DB auth token |

Marketplace listing: `SELECT * FROM workspaces WHERE public = 1 LIMIT 50` — D1 only, no Turso involved.
Workspace products: fetched from that workspace's own Turso `matter(type=product)` table on demand.

### Turso `tar-search` — Global Vector Search DB

One dedicated shared Turso DB named `tar-search`. Uses **Turso native libSQL vector** — built-in, no extension required. This is the only shared Turso DB — everything else is per-workspace.

```sql
CREATE TABLE IF NOT EXISTS search_index (
  id        TEXT PRIMARY KEY,   -- "{scope}::{matter_id}"
  scope     TEXT NOT NULL,
  workspace TEXT NOT NULL,
  kind      TEXT NOT NULL,      -- business type (restaurant, salon…)
  title     TEXT NOT NULL,
  price     REAL,
  type      TEXT NOT NULL,      -- product | service | booking
  embedding F32_BLOB(768)       -- native libSQL vector column
);

CREATE INDEX IF NOT EXISTS idx_search_vec
ON search_index (libsql_vector_idx(embedding));
```

- Write Query: `INSERT OR REPLACE INTO search_index (id, scope, workspace, kind, title, price, type, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, vector32(?))`
- Delete Query: `DELETE FROM search_index WHERE id = ?` (ID format: `{scope}::{matter_id}`)
- Write to `search_index` when a public workspace product/service is created or updated.
- Delete from `search_index` when a product is voided or workspace is set private.
- Embedding generated via Workers AI `@cf/baai/bge-base-en-v1.5` (free tier, 10K req/day).
- Text to embed: `"{workspace} {kind} {title} {type}"` — simple, no heavy prompt.
- ANN search query:
  ```sql
  SELECT s.*, vector_distance_cos(s.embedding, vector32(?)) AS score
  FROM vector_top_k('idx_search_vec', vector32(?), 20) v
  JOIN search_index s ON s.rowid = v.id
  ORDER BY score ASC;
  ```
- Exact distance (small sets): `SELECT *, vector_distance_cos(embedding, vector32(?)) AS score FROM search_index ORDER BY score ASC LIMIT 20`
- ID convention: `{scope}::{matter_id}` (e.g. `ws:anjalis::prd_abc123`)
- `search_index` is a write-through cache — source of truth is always the workspace Turso DB.
- `tar-search` URL and token stored as Worker secrets — never per-workspace.

---

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS matter (
  id      TEXT PRIMARY KEY,
  type    TEXT NOT NULL,
  title   TEXT NOT NULL,
  value   REAL,
  status  TEXT DEFAULT 'active',
  data    TEXT,
  file    TEXT,
  scope   TEXT NOT NULL,
  at      INTEGER DEFAULT (unixepoch()),
  updated INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS motion (
  id    TEXT PRIMARY KEY,
  type  TEXT NOT NULL,
  ref   TEXT,
  data  TEXT,
  by    TEXT,
  at    INTEGER DEFAULT (unixepoch()),
  scope TEXT NOT NULL
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
  id     TEXT PRIMARY KEY,
  scope  TEXT NOT NULL,
  type   TEXT NOT NULL,
  title  TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  ref    TEXT,
  data   TEXT,
  due    INTEGER,
  at     INTEGER DEFAULT (unixepoch())
);



CREATE INDEX IF NOT EXISTS idx_matter_scope_type    ON matter(scope, type);
CREATE INDEX IF NOT EXISTS idx_matter_scope_status  ON matter(scope, status);
CREATE INDEX IF NOT EXISTS idx_matter_scope_updated ON matter(scope, updated);
CREATE INDEX IF NOT EXISTS idx_motion_scope_type    ON motion(scope, type);
CREATE INDEX IF NOT EXISTS idx_motion_ref           ON motion(ref);
CREATE INDEX IF NOT EXISTS idx_inbox_scope_status   ON inbox(scope, status);
CREATE INDEX IF NOT EXISTS idx_inbox_due            ON inbox(due);
CREATE INDEX IF NOT EXISTS idx_graph_src            ON graph(src);
CREATE INDEX IF NOT EXISTS idx_graph_tgt            ON graph(tgt);

```

4 tables. No global DB. No separate catalog or form tables. Memory is S3-based — not a Turso table.

---

## 3. ID Rules

- Format: `{prefix}{ulid}` — 3-char type prefix + ULID. No separator.
- ULID = 26 chars, time-ordered, URL-safe. Sortable by creation time from the ID itself.
- Never use sequential integers. Never use nanoid or UUID.

| Entity | Prefix | Example |
|--------|--------|---------|
| product | `prd` | `prdJ1G5FAV3NDEKTSV4RRFQ69` |
| order | `ord` | `ordJ1G5FAV3NDEKTSV4RRFQ69` |
| booking | `bkg` | `bkgJ1G5FAV3NDEKTSV4RRFQ69` |
| customer | `cus` | `cusJ1G5FAV3NDEKTSV4RRFQ69` |
| staff | `stf` | `stfJ1G5FAV3NDEKTSV4RRFQ69` |
| invoice | `inv` | `invJ1G5FAV3NDEKTSV4RRFQ69` |
| expense | `exp` | `expJ1G5FAV3NDEKTSV4RRFQ69` |
| deal | `dea` | `deaJ1G5FAV3NDEKTSV4RRFQ69` |
| motion | `mot` | `motJ1G5FAV3NDEKTSV4RRFQ69` |
| inbox | `ibx` | `ibxJ1G5FAV3NDEKTSV4RRFQ69` |
| any other | first 3 chars of type | `tkt`, `ast`, `prj`… |

**Why ULID:**
- Time-ordered → IDs sort by creation time naturally, no extra sort column needed.
- Pagination uses ID directly as cursor: `WHERE id < {cursor}` — never `OFFSET`, never `at` as cursor.
- `at` column is still kept for explicit time filtering (e.g. "show items created after date X") — but not needed just for ordering or pagination.
- 29 chars total (3 prefix + 26 ULID) — compact, type-readable from ID alone, collision-safe at any workspace scale.

---

## 4. Table Rules

### matter
- Source of truth for all entity state. One row per entity.
- `value` = the primary numeric for that entity type (quantity for products, amount for invoices, total for orders).
- `status` owns the entity lifecycle: `active` · `completed` · `cancelled` · `voided` · `archived`
- `data` = essential operational fields only (price, sku, key IDs) — minimum needed for list/card views. Full rich payload goes to S3 via `file`.
- `file` = S3 key to the full entity payload. Fetched only on detail page open.
- Never hard-DELETE. Set `status` instead.
- **Strict type validation**: AI must ONLY use the exact `type` values listed in Section 11 (Type Reference). If a new business module is designed requiring a new entity type, it must be added to Section 11 first. Do not hallucinate or create ad-hoc types.
- Products store all workspace-specific details (price, qty, category) directly in their own `matter` row — no separate catalog or override table.

**matter.type values:**
`product` · `order` · `booking` · `customer` · `staff` · `invoice` · `expense` · `deal` · `contract` · `asset` · `ticket` · `project` · `payslip` · `purchase` · `workorder` · `shipment` · `listing` · `setting`

**Product row convention:**
- `value` = current stock quantity
- `data.price` = selling price
- `data.min` = low stock threshold
- `data.category`, `data.sku`, `data.unit` = other product fields

---

### motion
- Selective user-visible event log — not a full audit trail.
- Write only when the event belongs in a user-facing history or timeline.
- Do NOT write for: internal updates, auto-computed changes, bulk operations.
- `ref` = the `matter.id` this event belongs to.
- `by` = who triggered the event. **Always use one of these formats:**
  - Human action: `"user:{user_id}"` (e.g. `"user:u_01J..."`)
  - Agent action: `"agent:{agent_name}"` (e.g. `"agent:taragent"`)
  - Never use a bare name, email, or free-form string.
- Current entity status = `matter.status` — never read status from motion.
- Prune rows older than 90 days.

**motion.type values:**
`sale` · `payment` · `booking` · `change` · `clockin` · `clockout` · `adjust` · `restock` · `stage` · `activity` · `milestone` · `done`

---

### graph
- Only for relationships that require traversal queries ("find all X linked to Y").
- Do NOT write graph if the reference is only displayed — store the ID in `matter.data` instead.
- Do NOT write graph to link an entity to its workspace — `scope` already handles that.
- To remove: hard DELETE the row — graph rows are disposable.
- **Composite Primary Key**: `PRIMARY KEY (src, rel, tgt)` enforces strict deduplication. An entity cannot be linked twice with the identical relation to the same target. Use `INSERT OR IGNORE` to safely handle redundant link attempts without triggering errors.

**graph.rel values:**
`customer` · `contains` · `assigned` · `creator` · `works` · `order` · `depends` · `member`

---

### inbox
- One row per item requiring human attention.
- `title` = short action label only: `"New order"`, `"Low stock"`, `"Booking at 3pm"`.
- `ref` = the linked `matter.id`. Fetch full details from `matter` on demand — do not copy fields.
- `data` = only fields not in `matter` that are needed on the inbox card (max 3 fields).
- `urgency` is NOT stored — computed at read time from `due`.
- `type` = module name, free-form. All 80 modules write here without code changes.
- Prune rows with `status != 'open'` older than 30 days.

**Urgency computation (at read time):**
- `due < unixepoch()` and `status = 'open'` → **now**
- `due >= unixepoch()` → **next**
- `due IS NULL` → **normal**

---

### memory (S3 — not Turso)
- AI-inferred patterns and context only. Stored as individual JSON files in S3, not in the workspace Turso DB.
- **S3 key format:** `{scope}/memory/{type}/{slug}.json`
  - Example: `ws:anjalis/memory/preference/evening-orders.json`
  - `slug` = URL-safe lowercase title (spaces → hyphens, e.g. `"Friday evening orders"` → `friday-evening-orders`)
- User-entered profile data belongs in `matter(type=customer).data` — not here.
- **Write:** PUT to the key — overwrites if exists. Equivalent to UPSERT. Never creates duplicates.
- **Read:** LIST prefix `{scope}/memory/` → GET each file → pass all into agent context. No SQL.
- **Delete:** DELETE the S3 key directly.
- Prune files with last-modified older than 180 days via scheduled Worker.
- No DB connection. Near-zero cost at any scale.

**memory.type values (used as path segment):** `preference` · `pattern` · `note`

---

## 5. No Data Repeat Rules

| Situation | Rule |
|-----------|------|
| Inbox created for an order | `inbox.ref = matter.id`. Do not copy order fields into `inbox.data`. |
| Customer linked to order | Store customer ID in `matter(order).data` OR graph — never both. |
| Customer preferences | AI-inferred → S3 memory (`{scope}/memory/preference/{slug}.json`). User-entered → `matter(customer).data`. Never both. |
| Product price and stock | Both in one `matter(type=product)` row: `value=qty`, `data.price=price`. |
| Urgency | Never store. Compute from `due` at read time. |

---

## 6. S3 Rule — Semantic Split

`matter.data` holds **only essential operational fields** — the minimum needed for list views, cards, inbox, and quick operations. The full rich entity payload lives in S3.

### matter.data — essentials only
- Fields needed without opening the entity: price, sku, category, phone, etc.
- Kept small and fast. Every list and card reads only this.
- Rule: if a field is not needed to render a list row or take a quick action → it does not belong here.

### matter.file — full entity payload
- Always written alongside the `matter` row for any entity with rich data.
- S3 key format: `{scope}/{id}/full.json`
- Contains: descriptions, images, line items, variants, notes, address, form answers, attachments — everything not in `matter.data`.
- Fetched **only when the user opens the full detail page** — never for lists, inbox, or quick reads.

### What goes where (per entity)

| Entity | `matter.data` essentials | S3 full payload (`file`) |
|--------|--------------------------|--------------------------|
| product | price, category, sku | description, images, variants, tags, SEO |
| order | customer id, item count, payment type | all line items, delivery address, notes |
| customer | phone, email | full address, preferences, history |
| booking | slot, staff id, service | notes, intake form, attachments |
| invoice | total, due date, customer id | all line items, terms, bank details |
| deal | stage, value, customer id | activity notes, attachments, contacts |

### memory — S3 key-value namespace

Agent memory is stored as individual JSON files in S3, not in Turso. This keeps Turso lean and memory costs flat at any workspace scale.

| Key pattern | Content |
|---|---|
| `{scope}/memory/preference/{slug}.json` | User/customer preferences |
| `{scope}/memory/pattern/{slug}.json` | Inferred behavioural patterns |
| `{scope}/memory/note/{slug}.json` | Contextual notes |

- PUT to write or overwrite (same key = no duplicate).
- LIST `{scope}/memory/` to read all workspace memory, then GET each file.
- DELETE key to remove a specific memory item.
- Prune by S3 last-modified timestamp in scheduled Worker (180-day TTL).

---

## 7. Module Write Pattern

Every module follows this 5-step pattern. Steps 2–5 are conditional.

1. **matter** — always. Create or update the entity.
2. **motion** — only if user-visible (belongs in history/timeline).
3. **inbox** — only if a human needs to act on it.
4. **graph** — only if traversal queries are required.
5. **search_index** — only if `matter.type` is `product`, `service`, or `booking` AND the workspace is public. Write to `tar-search` DB with a fresh embedding. If the entity is voided → `DELETE FROM search_index WHERE id = '{scope}::{matter_id}'`.

> **Transaction rule:** Wrap Steps 1–4 in a single Turso transaction. Step 5 (`tar-search`) is a separate DB — execute after the transaction commits. If Step 5 fails, log and retry; it is a write-through cache and eventual consistency is acceptable.

### Per-Module Rules

**Products / Inventory**
- `matter(type=product)` — one row per product. `value` = qty, `data.price` = price.
- Atomic deduction: `UPDATE matter SET value = value - N WHERE id = ? AND value >= N`
- `motion(type=adjust)` — only for manual, user-visible adjustments.
- `inbox(type=stock, due=unixepoch())` — when `value <= data.min`.

**Orders / POS**
- `matter(type=order)` — entity. `motion(type=sale)` — event. `inbox(type=order)` — notify staff.
- Deduct product stock atomically on every sale.
- `graph(ord_id → customer → cus_id)` — only if "find all orders for customer" query is needed.

**Bookings**
- `matter(type=booking)` — entity. `motion(type=booking)` — event.
- `inbox(type=booking, due={appointment_unix_time})` — urgency auto-computed.

**CRM**
- `matter(type=customer)`, `matter(type=deal)` — entities.
- `graph(deal → customer)` — traversal needed.
- `motion(type=stage)`, `motion(type=activity)` — user-visible events.
- `inbox(type=deal, due=...)` — follow-up tasks.
- S3 memory (`{scope}/memory/{type}/{slug}.json`) — AI-inferred patterns only. PUT to write, LIST+GET to read.

**Staff / HR**
- `matter(type=staff)` — profile. `motion(type=clockin / clockout)` — attendance.
- `matter(type=payslip)` — payroll record. `inbox(type=payroll)` — approval.

**Extended Modules (Procurement, Logistics, Finance, etc.)**
- Same 4-step pattern. Pick a clear `matter.type`.
- Write `graph` only when traversal is genuinely needed.
- Always apply semantic split: essentials in `matter.data`, full payload (line items, docs, rich fields) in S3 via `matter.file`.

---

## 8. Query Rules

### Scope Validation Contract

- `scope` is always of the form `"ws:{subdomain}"` (e.g. `"ws:anjalis"`).
- **`scope` must always be resolved from the authenticated workspace session — never from user input, query parameters, or AI-generated values.**
- An agent must never accept a `scope` value from a user prompt. Doing so enables cross-workspace data access via prompt injection.
- Validate: if the resolved `scope` does not match `"ws:{subdomain}"` pattern, reject the operation entirely.

- Always filter by `scope` first.
- Entity current state → `matter`. History → `motion`.
- Never derive entity status from `motion` — use `matter.status`.
- Inbox list: `WHERE scope = ? AND status = 'open' ORDER BY due ASC NULLS LAST LIMIT 50`
- Compute urgency from `due` at read time — never stored.
- JSON read: `json_extract(data, '$.field')`
- JSON update: `json_set(data, '$.field', value)` — never overwrite the full `data` column.
- **JSON Concurrency Safety**: `json_set` partial updates are not safe from race conditions under simultaneous execution. Since workspaces are single-tenant/low-concurrency, standard `json_set` is acceptable. However, for critical concurrent operations (like stock deduction or status updates), always use atomic updates on primary columns (`UPDATE matter SET value = ...`) rather than JSON fields, or wrap in a transaction.
- Pagination: `WHERE id < {cursor}` — ULID is time-ordered so ID is the cursor. Never use `OFFSET`.

---

## 9. Write Rules

| Rule | Reason |
|------|--------|
| `scope` in every INSERT | Prevents cross-workspace data leaks |
| Never UPDATE `motion` | Events are immutable facts |
| Never hard-DELETE `matter` | Set `status` instead |
| `graph` only when traversal is needed | Avoids redundant relationship rows |
| `inbox.ref` points to `matter.id` | No field duplication between inbox and matter |
| Never store `urgency` | Compute from `due` — always accurate |
| PUT S3 `{scope}/memory/{type}/{slug}.json` | Overwrite = UPSERT — same key, no duplicates |
| `json_set` for partial data updates | Never overwrite the full `data` field |
| Atomic `value - N WHERE value >= N` | Prevents oversell and negative stock |
| `matter.data` holds essentials only | Keeps DB rows lean — fast list and card reads |
| Full entity payload in S3 via `matter.file` | Rich detail page without bloating the DB |
| S3 fetched only on detail page open | Never fetched for lists, inbox, or quick reads |
| Prune `motion` > 90 days | Not an audit system — control storage |
| Prune closed `inbox` > 30 days | Done items have no active value |
| ULID with 3-char prefix, no separator | Sortable, typed, compact — no extra timestamp needed for ordering |
| `unixepoch()` for all timestamps | Fast integer comparison, no timezone issues |

---

## 10. Delete Reference

| Table | How |
|-------|-----|
| matter | `UPDATE matter SET status = 'voided' WHERE id = ?` — never hard-DELETE |
| inbox | `UPDATE inbox SET status = 'archived'` then prune after 30 days |
| graph | Hard DELETE — rows are disposable |
| motion | Hard DELETE rows older than 90 days on schedule |
| memory (S3) | DELETE S3 key — clearable |

### Pruning Scheduler

Pruning is executed by a daily Scheduled Worker (cron job) on Cloudflare:
- Motion: `DELETE FROM motion WHERE at < unixepoch() - (90 * 86400)`
- Inbox: `DELETE FROM inbox WHERE status != 'open' AND at < unixepoch() - (30 * 86400)`
- Memory: S3 LIST `{scope}/memory/` across all workspaces → DELETE objects with last-modified older than 180 days

---

## 11. Type Reference

### matter.type
`product` · `order` · `booking` · `customer` · `staff` · `invoice` · `expense` · `deal` · `contract` · `asset` · `ticket` · `project` · `payslip` · `purchase` · `workorder` · `shipment` · `listing` · `setting`

### matter.status
`active` · `completed` · `cancelled` · `voided` · `archived`

### motion.type
`sale` · `payment` · `booking` · `change` · `clockin` · `clockout` · `adjust` · `restock` · `stage` · `activity` · `milestone` · `done`

### inbox.type
Free-form module name — `order` · `booking` · `stock` · `deal` · `invoice` · `payroll` · `ticket` · `purchase` · `approval` · *any module name*

### graph.rel
`customer` · `contains` · `assigned` · `creator` · `works` · `order` · `depends` · `member`

---

## 12. Local-First / Offline Strategy

Only 3 modules require local-first (offline-capable) access. All other modules connect directly to the remote Turso DB.

### Local-First Modules

| Module | Why |
|---|---|
| **POS** | Mid-sale cannot tolerate cloud latency or downtime |
| **Inventory** | Stock deduction happens at point of sale — must work offline |
| **Time & Expense** | Staff clock-in/out on shop floor with unreliable connectivity |

### Strategy — Turso Partial Sync (Query Bootstrap)

Use `@tursodatabase/sync` with `partialSyncExperimental` on the device. Each workspace gets its own local `.db` file, bootstrapped with only product rows.

```ts
import { connect } from '@tursodatabase/sync';

const db = await connect({
  path: `./ws-${subdomain}.db`,     // one local file per workspace
  url: workspace.url,               // from D1 workspace registry
  authToken: workspace.token,       // from D1 workspace registry
  partialSyncExperimental: {
    bootstrapStrategy: {
      kind: 'query',
      // Only download product pages locally — nothing else
      query: `SELECT * FROM matter WHERE type = 'product'`,
    },
    prefetch: true,
  },
});
```

- **Reads** (product list, price, stock) — served from local file instantly.
- **Writes** (sale, stock deduction, clock-in) — applied locally first, auto-pushed to Turso cloud when online.
- **No custom sync queue or pending_tx table needed** — Turso handles it.

### Offline Write Pattern

```ts
// Stock deduction — local first, auto-synced
await db.execute(
  `UPDATE matter SET value = value - ? WHERE id = ? AND value >= ?`,
  [qty, productId, qty]
);

// Sale event — local first, auto-synced
await db.execute(
  `INSERT INTO motion (id, type, ref, data, by, scope) VALUES (?, 'sale', ?, ?, 'agent:pos', ?)`,
  [motId, orderId, JSON.stringify(items), scope]
);
```

### Multi-Workspace on One Device

User belongs to N workspaces → N local `.db` files, one per workspace.

```
./ws-anjalis.db    ← products bootstrapped
./ws-salonx.db     ← products bootstrapped
./ws-resto.db      ← products bootstrapped
```

On workspace switch, swap the connection to the corresponding local file. First switch downloads product pages; subsequent switches are instant from the cached local file.

### Cloud-Only Modules (All Others)

All 77 remaining modules (Finance, HR, CRM, Analytics, etc.) use the remote Turso DB directly — no local file, no partial sync. These modules are always deliberate, connected actions where real-time accuracy is required.

> **Rule:** If a module does not require transaction completion during potential network loss, it is cloud-only. Never add local sync for a module unless it meets the offline-critical criteria above.
