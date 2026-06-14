# 01 — Data Model

Naming, schemas, conflict-free merge, scope routing, opcodes, identity, and dynamic forms.

---

## 1. Naming Model — two vocabularies

The same data has a **physics name** (source of truth, in the DO) and an **AI name** (projection for search, in Turso). The word tells you which tier you're looking at.

| Layer | DO term (truth) | Turso term (AI) | Physics meaning | AI / system meaning |
| :--- | :--- | :--- | :--- | :--- |
| Blueprint | `form` | `knowledge` | Aristotle's *form* (eidos) — the pattern matter takes on | Template/class: what an entity *could be* (product, profile, task def) |
| Instance | `matter` | `context` | *Hyle* — substrate receiving form, occupying space-time | Realized record: this stock/lead/slot, with qty/value/geo/time |
| Event | `motion` | — | *Kinesis* — change of state; applied force | Append-only opcode ledger of what happened |
| Link | `bond` | — | Atomic bond — joins bodies into structure | Graph edge (parent-child, published_to, task) |
| Recall | `memory` | `memory` | Resonance — trace a body leaves | Vector embedding + snapshot for semantic search |

> **Physics (DO):** *matter takes form, driven by motion, joined by bond, leaving memory.*
> **AI (Turso):** *form becomes knowledge, matter becomes context, memory stays memory.*

Publishing = **collapsing physics into AI**: `form` → `knowledge`, `matter` → `context`, both found via `memory`.

**Naming rule:**

| If the schema is… | Then the name is… |
| :--- | :--- |
| identical across tiers (faithful projection) | shared word (`memory`) |
| transformed for AI consumption | new AI word (`knowledge`, `context`) |
| private to the DO, never projected | physics word only (`motion`, `bond`) |

---

## 2. Schemas (DO side)

All 5 tables live in the per-scope Durable Object SQLite. `scope`/`owner` are implicit on the edge DO (encoded in container name) but explicit on the merged local client DB.

### `form` — blueprint / potential
| Column | Type | Definition |
| :--- | :--- | :--- |
| `id` | TEXT PK | Unique template id (`form_thermos_99`, barcode, slug) |
| `code` | TEXT | UNIQUE SKU or barcode |
| `type` | TEXT NOT NULL | `product`, `profile`, `form`, `task`, `note`, `project` |
| `title` | TEXT | Human-readable title |
| `public` | INT | 1 = eligible to project to Turso, 0 = private |
| `active` | INT | 1 = active, 0 = retired |
| `data` | TEXT(JSON) | `verified`, `brand`, `image_url`, `manufacturer_id`, `theme` |
| `time` | TEXT | ISO-8601 timestamp (LWW watermark) |

### `matter` — instance / space-time
| Column | Type | Definition |
| :--- | :--- | :--- |
| `id` | TEXT PK | Unique instance id (`matter_stock_99`, `store_101_pepsi`) |
| `form` | TEXT | FK → `form.id` (the blueprint) |
| `type` | TEXT | `lead`, `ticket`, `stock`, `variant`, `slot`, `trip`, `budget`, `invoice`, `order` |
| `qty` | REAL | Stock, balance, weight, or slot count |
| `value` | REAL | Price, valuation, or cost |
| `active` | INT | 1 = active, 0 = retired |
| `geo` | TEXT | Space coordinate (H3 hexagon) |
| `start` | TEXT | Interval start (shift/booking) |
| `end` | TEXT | Interval end |
| `data` | TEXT(JSON) | `label`, `store_id`, `geo_h3`, variant props |
| `time` | TEXT | Last state update (LWW watermark) |

*"Matter takes form": `matter.form` points back to its blueprint.*

### `motion` — ledger / force
Never projected to Turso; archived to S3 at day-close.

| Column | Type | Definition |
| :--- | :--- | :--- |
| `stream` | TEXT PK(1/2) | Timeline group id (matches `matter.id` or `form.id`) |
| `seq` | INT PK(2/2) | DO-assigned monotonic integer |
| `action` | INT NOT NULL | Opcode (e.g. `101` SOLD) |
| `phase` | INT | In-place lifecycle state index |
| `delta` | REAL | Offset applied to `matter.qty` (`-1.0`, `+5.0`) |
| `client_ref` | TEXT | UNIQUE temp client id for match confirmation |
| `data` | TEXT(JSON) | Payload + phase-history map (`ph`) |
| `time` | TEXT | Event timestamp |

### `bond` — link / topology
Soft-deleted via `active` so offline breaks sync cleanly.

| Column | Type | Definition |
| :--- | :--- | :--- |
| `src` | TEXT PK(1/3) | Source node (`form.id` or `matter.id`) |
| `tgt` | TEXT PK(2/3) | Target node |
| `type` | TEXT PK(3/3) | `parent-child`, `published_to`, `task`, `note`, `modifier_of`, `assigned_to`, `blocked_by` |
| `weight` | REAL | Sorting weight / priority |
| `active` | INT | 1 = bonded, 0 = broken |
| `time` | TEXT | Bond timestamp |

### `memory` — recall / resonance
Same schema in **both** DO (private recall) and Turso (global recall), bridged by `id`.

| Column | Type | Definition |
| :--- | :--- | :--- |
| `id` | TEXT PK | Bridge key → `form.id` / `matter.id` |
| `kind` | TEXT | `form` \| `matter` \| `note` |
| `vec` | F32_BLOB(768) | Embedding (Workers AI) |
| `model` | TEXT | Embed model id (for re-embed migrations) |
| `text` | TEXT | Denormalized title/snippet for display |
| `scope` | TEXT | Origin scope (`s:102`) for filtering |
| `time` | TEXT | Watermark / re-embed trigger |

*(Turso adds vector index `libsql_vector_idx(vec)`.)*

---

## 3. Two-tier topology

| | Durable Object SQLite | Turso `global.db` |
| :--- | :--- | :--- |
| Role | Operations / source of truth | AI front / discovery |
| Workload | Write-heavy, transactional, private | Read-mostly, semantic, public |
| Tables | `form`, `matter`, `motion`, `bond`, `memory` | `knowledge`, `context`, `memory` |
| Per | Scope (one DO per `s:`/`c:`/`o:`…) | One global DB |
| Truth? | **Yes** | No — derived, rebuildable |

| DO (truth) | → | Turso (AI) | Transform |
| :--- | :--- | :--- | :--- |
| `form` (public=1) | project | `knowledge` | faithful copy of definition |
| `matter` (public) | echo | `context` | lossy snapshot: price, in-stock bool, geo, time |
| `motion` | ✗ | — | private ledger |
| `bond` | ✗ | — | private graph |
| `memory` | re-embed | `memory` | embedding + snapshot, same schema |

Turso is **disposable**: drop and rebuild by replaying publishes; swap embedding models without touching any DO. Exact/live truth (price at checkout, stock decrement) is always read from the DO at action time.

---

## 4. Conflict-free merge

**4.1 Last-Write-Wins** (`form`, `matter`, `bond`) — `ON CONFLICT` compares `time`, newer wins.
```sql
INSERT INTO form (id, code, type, title, public, active, data, time)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title  = CASE WHEN excluded.time > form.time THEN excluded.title  ELSE form.title  END,
  active = CASE WHEN excluded.time > form.time THEN excluded.active ELSE form.active END,
  data   = CASE WHEN excluded.time > form.time THEN excluded.data   ELSE form.data   END,
  time   = CASE WHEN excluded.time > form.time THEN excluded.time   ELSE form.time   END;
```

**4.2 Ledger folding** (balances) — clients append `motion.delta`; quantity is recomputed:
```sql
SELECT SUM(delta) FROM motion WHERE stream = 'matter_stock_99';
```

**4.3 Phase history union** (lifecycles) — in-place phase updates append to the `ph` map in `motion.data` (e.g. `{"ph":{"107":1718300050000,"108":1718300055000}}`). On conflict, key-union the two maps, keep latest timestamp per key, select highest-timestamp phase as active.

---

## 5. Scope codes & routing

| Prefix | Class | Local DB | Remote DO |
| :--- | :--- | :--- | :--- |
| `p` | Personal | `user_${self}.db` | none (local only) |
| `g` | Global | `global.db` (cache) | Turso / Workers |
| `f:{id}` | Family | `user_sync_${owner}.db` | `f:${owner}` |
| `t:{id}` | Team / Work | `user_sync_${owner}.db` | `t:${owner}` |
| `r:{id}` | Friends | `user_sync_${owner}.db` | `r:${owner}` |
| `s:{id}` | Storefront | `user_sync_${owner}.db` | `s:${owner}` |
| `w:{id}` | Warehouse | `user_sync_${owner}.db` | `w:${owner}` |
| `c:{id}` | Client / CRM | `user_sync_${owner}.db` | `c:${owner}` |
| `m:{id}` | Campaign | `user_sync_${owner}.db` | `m:${owner}` |
| `x:{id}` | Surveys / ERP | `user_sync_${owner}.db` | `x:${owner}` |
| `h:{id}` | HR / Staff | `user_sync_${owner}.db` | `h:${owner}` |
| `d` | Logistics | `user_sync_${owner}.db` | `d` |
| `o:{id}` | Order (transaction agent) | ephemeral | `o:${order_id}` — archived & deleted |
| `geo:{h3}` | Geo presence cell | n/a | `geo:${h3id}` — live hex registry |

**How a DO is accessed** (no lookup, no registry): the scope string *deterministically becomes* the DO address.

| Step | Mechanism |
| :--- | :--- |
| 1 | Client → Worker: one HTTPS call |
| 2 | Worker derives DO name from scope (`"s:" + id`) |
| 3 | `env.SYNC.idFromName("s:id")` → stable id |
| 4 | `env.SYNC.get(id).fetch(...)` → call the DO |
| 5 | DO runs SQL on its own SQLite |
| 6 | Live clients get WebSocket push (hibernatable) |

---

## 6. Opcode write strategy

| Tier | Where | Synced? |
| :--- | :--- | :--- |
| Local | `user_${self}.db` — carts, wishlists, private tasks | never |
| Collab | `user_sync_${owner}.db` — operational data | via Workers + DO |
| S3 | R2/S3 — historical `motion` at day-close | cold archive |

| Strategy | Effect | Saving |
| :--- | :--- | :--- |
| Local User | stored only locally | 100% sync cost |
| Phase Update | mutates `phase` in-place | 70–85% |
| Append | inserts new rows (archived to S3) | standard |

---

## 7. Opcode directory

| ID | Opcode | Strat | ID | Opcode | Strat | ID | Opcode | Strat |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
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

Per-domain breakdown of which table each opcode touches is in [05-domain-opcode-map.md](05-domain-opcode-map.md).

---

## 8. Identity & profile sync

- **Local isolation:** private data stays in local-only `user_${google_user_id}.db`.
- **Profile cache:** public attributes cached in `form` (`usr_${id}`, `type='profile'`).
- **JWT access claims:** validate Google ID token at `/api/auth`; return short-lived (15-min) custom JWT with scope bindings:
  ```json
  { "userId": "usr_google123", "scopes": ["s:102", "f:402"], "exp": 1718300900 }
  ```
- **Real-time revocation:** admin POSTs `/kick` to the specific DO; it drops the user's WebSocket immediately.

Full auth + revocation implementation in [02-sync-protocol.md](02-sync-protocol.md).

---

## 9. Dynamic forms

| Stage | Table | Shape |
| :--- | :--- | :--- |
| Definition | `form` | `id=formdef_${name}`, `type='form'`, `data={"fields":[...]}` |
| Assignment | `matter` | `id=matter_formrun_${sub}`, `form=formdef_${name}`, `type='form_task'` |
| Submission | `motion` | `stream=matter_formrun_${sub}`, `seq=unixepoch_ms*1000+nonce`, `action=604`, `data=values` |

---

## 10. Storefront/CMS layout (the model is universal)

```text
  1. form (blueprint)     id: "comp_product_grid"  type: "layout"
                          data: {"style":"masonry_3","limit":6}
                               │ defines structure
                               ▼
  2. matter (page slot)   id: "slot_home_featured" type: "slot"
                          form: "comp_product_grid" scope: "s:102/home"
          │ arranged via bond            │ logged in motion
          ▼                              ▼
  3. bond                         4. motion
     src: "slot_home_featured"      stream: "slot_home..."
     tgt: "form_tshirt"             action: 601 (impression)
     type: "parent-child"           data: {"click": true}
```

The same 4 tables model shopping, food, transport, tickets, hotels, services, CRM, HR, logistics, finance — no per-feature schemas. See [05-domain-opcode-map.md](05-domain-opcode-map.md).
