# 01 — Data Model

Schemas, naming, opcodes, scope routing, and conflict resolution.

---

## 1. Naming Model

| Layer | DO (truth) | Turso (AI) | Meaning |
|:------|:-----------|:-----------|:--------|
| Blueprint | `form` | `knowledge` | Template: what an entity *could be* |
| Instance | `matter` | `context` | Realized record: this stock/slot/order |
| Event | `motion` | — | Append-only ledger of what happened |
| Link | `bond` | — | Graph edge between entities |
| Recall | `memory` | `memory` | Vector embedding for search |

> **Physics:** *matter takes form, driven by motion, joined by bond, leaving memory.*
> **AI:** *form becomes knowledge, matter becomes context, memory stays memory.*

---

## 2. Table Schemas

### `form` — blueprint

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | TEXT PK | Unique template id (`form_thermos_99`) |
| `code` | TEXT | SKU or barcode |
| `type` | TEXT | `product`, `profile`, `form`, `task`, `note`, `project` |
| `title` | TEXT | Human-readable title |
| `public` | INT | 1 = projectable to Turso |
| `active` | INT | 1 = active |
| `data` | TEXT(JSON) | Flexible payload |
| `time` | TEXT | ISO-8601 (LWW watermark) |

### `matter` — instance

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | TEXT PK | Unique instance id |
| `form` | TEXT | FK → `form.id` |
| `type` | TEXT | `stock`, `variant`, `order`, `trip`, `slot` |
| `qty` | REAL | Stock, balance, count |
| `value` | REAL | Price, valuation |
| `active` | INT | 1 = active |
| `geo` | TEXT | H3 hex coordinate |
| `start` | TEXT | Interval start |
| `end` | TEXT | Interval end |
| `data` | TEXT(JSON) | Flexible payload |
| `time` | TEXT | Last update (LWW) |

### `motion` — ledger

| Column | Type | Description |
|:-------|:-----|:------------|
| `stream` | TEXT PK(1/2) | Timeline group (matches `matter.id` or `form.id`) |
| `seq` | INT PK(2/2) | Monotonic integer |
| `action` | INT | Opcode (e.g., 101 = SOLD) |
| `phase` | INT | Lifecycle state index |
| `delta` | REAL | Offset for `matter.qty` |
| `client_ref` | TEXT | Client temp id for matching |
| `data` | TEXT(JSON) | Payload + phase history |
| `time` | TEXT | Event timestamp |

### `bond` — graph

| Column | Type | Description |
|:-------|:-----|:------------|
| `src` | TEXT PK(1/3) | Source node |
| `tgt` | TEXT PK(2/3) | Target node |
| `type` | TEXT PK(3/3) | `parent-child`, `published_to`, `assigned_to`, `blocked_by` |
| `weight` | REAL | Sorting weight |
| `active` | INT | 1 = bonded |
| `time` | TEXT | Bond timestamp |

### `memory` — vector recall

| Column | Type | Description |
|:-------|:-----|:------------|
| `id` | TEXT PK | Bridge key → `form.id` / `matter.id` |
| `kind` | TEXT | `form` or `matter` |
| `vec` | F32_BLOB(768) | Embedding |
| `model` | TEXT | Embed model id |
| `text` | TEXT | Denormalized snippet |
| `scope` | TEXT | Origin scope |
| `time` | TEXT | Watermark |

---

## 3. Two-Tier Topology

| DO (truth) | → | Turso (AI) | Transform |
|:-----------|:--|:-----------|:----------|
| `form` (public=1) | project | `knowledge` | faithful copy |
| `matter` (public) | echo | `context` | lossy snapshot |
| `motion` | ✗ | — | private ledger |
| `bond` | ✗ | — | private graph |
| `memory` | re-embed | `memory` | embedding + snapshot |

Turso is disposable: drop and rebuild by replaying publishes.

---

## 4. Conflict Resolution

### LWW (form, matter, bond)

```sql
INSERT INTO form (id, code, type, title, public, active, data, time)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title  = CASE WHEN excluded.time > form.time THEN excluded.title  ELSE form.title  END,
  active = CASE WHEN excluded.time > form.time THEN excluded.active ELSE form.active END,
  data   = CASE WHEN excluded.time > form.time THEN excluded.data   ELSE form.data   END,
  time   = CASE WHEN excluded.time > form.time THEN excluded.time   ELSE form.time   END;
```

### Ledger Folding (matter.qty)

```sql
SELECT SUM(delta) FROM motion WHERE stream = 'matter_stock_99';
```

### Phase History Union (motion.data)

Append to `ph` map: `{"ph":{"107":1718300050000,"108":1718300055000}}`. On conflict, key-union, keep latest per key.

---

## 5. Scope Routing

| Prefix | Class | Local DB | Remote DO |
|:-------|:------|:---------|:----------|
| `p` | Personal | `user_${self}.db` | none |
| `g` | Global | `global.db` | Turso |
| `s:{id}` | Storefront | `user_sync_${owner}.db` | `s:${owner}` |
| `t:{id}` | Workspace | `user_sync_${owner}.db` | `t:${owner}` |
| `o:{id}` | Order | ephemeral | `o:${order_id}` |

**Access:** scope string → deterministic DO name → `idFromName()` → `get().fetch()`.

### Lazy Schema Init

| DO Type | Tables Created |
|:--------|:---------------|
| `s:`, `t:` | form, matter, motion, bond |
| `o:` | matter, motion |
| `p` | form, matter, motion, bond |

---

## 6. Opcode Write Strategy

| Tier | Where | Synced? |
|:-----|:------|:--------|
| Local | `user_${self}.db` | never |
| Collab | `user_sync_${owner}.db` | via DO |
| S3 | R2/S3 | cold archive |

| Strategy | Effect | Saving |
|:---------|:-------|:-------|
| Local | stored only locally | 100% |
| Phase Update | mutates `phase` in-place | 70-85% |
| Append | inserts rows (archived to S3) | standard |

---

## 7. Motion Sharding

Time-partitioned by month:

| Table | Purpose | Retention |
|:------|:--------|:----------|
| `motion_2026_06` | Hot | In DO |
| `motion_2026_07` | Hot | In DO |
| `motion_cold` | Archive | R2/Parquet |

Compaction = `DROP TABLE motion_2026_05` (no DELETE + VACUUM).

---

## 8. Opcode Directory

| ID | Opcode | Strat | ID | Opcode | Strat | ID | Opcode | Strat |
|:---|:-------|:------|:---|:-------|:------|:---|:-------|:------|
| 101 | SOLD | Append | 301 | STORE_VISIT | Append | 506 | LEAVE_REQ | Append |
| 102 | CART_ADD | Local | 302 | REVIEW | Append | 507 | APPROVED | Phase |
| 103 | CART_REMOVE | Local | 303 | LEAD_CREATED | Append | 508 | REJECTED | Phase |
| 104 | CHECKOUT | Phase | 304 | CONTACTED | Phase | 601 | PUSH_SENT | Append |
| 105 | ORDER_PLACED | Append | 305 | CONVERTED | Phase | 602 | SMS_SENT | Append |
| 106 | CONFIRMED | Phase | 306 | TICKET_OPEN | Append | 603 | REFERRAL | Append |
| 107 | PREPARING | Phase | 307 | REPLY | Append | 604 | FORM_SUBMIT | Append |
| 108 | READY | Phase | 308 | RESOLVED | Phase | 701 | BOOKED | Append |
| 109 | DELIVERED | Phase | 309 | B_DAY_OFFER | Append | 702 | COMPLETED | Phase |
| 110 | INVOICE_GEN | Append | 401 | DISPATCHED | Append | 703 | CANCELLED | Phase |
| 111 | REFUND | Append | 402 | IN_TRANSIT | Phase | 801 | PAY_INIT | Append |
| 112 | RENEWAL_DUE | Append | 403 | DRIV_ASSIGN | Phase | 802 | PAY_SUCCESS | Phase |
| 113 | COUPON_APP | Append | 404 | ETA_UPDATED | Phase | 803 | PARTIAL_PAY | Phase |
| 114 | WISHLISTED | Local | 405 | TRANS_OUT | Append | 804 | PAYOUT | Append |
| 201 | SALE | Append | 406 | TRANS_IN | Append | 805 | PAY_FAILED | Phase |
| 202 | SHIFT_START | Append | 407 | RETURN_REQ | Append | 806 | EXPENSE_REC | Append |
| 203 | BREAK | Append | 408 | PICKUP_SCH | Phase | 901 | BOOKING | Append |
| 204 | SHIFT_END | Append | 409 | PICKED_UP | Phase | 902 | ASSIGNED | Phase |
| 205 | CASH_CLOSE | Append | 410 | DELIV_ATTEMPT | Phase | 903 | RIDE_REQ | Append |
| 206 | ORDER_FIRE | Append | 501 | CLOCK_IN | Append | 904 | DRIV_MATCH | Phase |
| 207 | ITEM_READY | Phase | 502 | CLOCK_OUT | Append | 905 | IN_RIDE | Phase |
| 208 | TOKEN_ISSUED | Append | 503 | PAYROLL | Append | 906 | RECRUIT_APPL | Append |
| 209 | TOKEN_CALLED | Phase | 504 | TASK_ASSIGN | Local | 907 | PROCURE_REQ | Append |
| 210 | TOKEN_SERVED | Phase | 505 | PERF_NOTE | Append | — | — | — |

---

## 9. Dynamic Forms

| Stage | Table | Shape |
|:------|:------|:------|
| Definition | `form` | `id=formdef_${name}`, `type='form'` |
| Assignment | `matter` | `id=matter_formrun_${sub}`, `form=formdef_${name}` |
| Submission | `motion` | `stream=matter_formrun_${sub}`, `action=604` |
