# 12 — Code Reference

How the screens map to the tables. This is the bridge between the architecture and the actual `tarapp` code.

> ⚠️ **This doc uses the LEGACY table names** (`matter`=template, `mass`=instance, `relation`) because it describes the code as it exists today. New-model equivalents: `matter`→`form`, `mass`→`matter`, `relation`→`bond`. See [README](README.md#naming-note-legacy--new).

Companion code: `tarapp/app/home.tsx`, `tarapp/app/workspace.tsx`, `tarapp/app/pos.tsx`, `tarapp/lib/schema.ts`, `tarapp/lib/domainsData.ts` (`OPCODE_LABELS`).

---

## Part A — Home as a space-time "now-slice"

> Home is the **present moment** slicing through every open worldline.

The four tables already encode a space-time:

| Table | What it is | Role |
| :--- | :--- | :--- |
| `matter` | the entity / thing | **space** — what/who exists |
| `mass` | a slot with `start`, `end`, `active` | **time** — when a thing lives, and if still open |
| `motion` | append-only `(stream, seq)` log | **arrow of time** — what happened, irreversibly |
| `relation` | typed edges `(src, tgt, type)` | **the graph** — how points in space connect |

`mass` already carries `start`/`end`/`active` — literally a **worldline** (begin, persist, end). `motion` advances along it. The schema was a space-time from the start.

### The model
- **Workspace** = *editor of space*: defines entities (`matter`) and opens worldlines (tasks, leads, tickets, trips, invoices, shifts).
- **Home** = *observer at now*: renders every open worldline (`active=1`) intersecting now/near-future, ordered on the time axis, and lets the user push each forward.
- An **action** is the user injecting a `motion` event. A row leaves the list not because it was "checked off" but because its worldline hit a **terminal state** (`active=0`, or converted/delivered/resolved/paid).

### The now-slice query
```sql
SELECT m.id, m.matter, m.type, m.value, m.start, m.end, m.data, m.time,
       mt.title, mt.type,
       (SELECT action FROM motion WHERE stream = m.id ORDER BY seq DESC LIMIT 1) AS last_action,
       (SELECT data   FROM motion WHERE stream = m.id ORDER BY seq ASC  LIMIT 1) AS root_data
FROM mass m
LEFT JOIN matter mt ON mt.id = m.matter
WHERE m.active = 1 AND m.type IN ('lead','ticket','trip','invoice','slot')
```
- `active = 1` = the now-slice condition (only live worldlines).
- `last_action` = where the worldline sits on its track (current stage).
- `root_data` = subject/ref/source for the label.
- Converted leads (`last_action = 305`) drop even if `mass.active` lingers.
- Two DBs merged: synced workspace DB + local private DB, de-duped by `mass.id`.
- Ordered by soonest `end` (then `start`, then `time`) — overdue/imminent rise.

### Advancing (mirrors workspace.tsx exactly)
| Kind | `mass.type` | Tap emits |
| :--- | :--- | :--- |
| Task | `slot` (business) | `mass.active→0` + `504 COMPLETED` |
| Shift | `slot` (person/family) | `mass.active→0` |
| Lead | `lead` | `304 CONTACTED` → `305 CONVERTED` |
| Ticket | `ticket` | `308 RESOLVED` + `mass.active→0` |
| Trip | `trip` | `402 IN_TRANSIT` → `109 DELIVERED` |
| Invoice | `invoice` | `802 PAY_SUCCESS` + `mass.active→0` |
| Order | `order` | per-item `105→106→107→108→109`; `active→0` when all delivered |

### Orders = grouped worldline (POS → Home)
POS sale is paid instantly (`801→802` in one shot), so payment isn't an open worldline — **fulfillment** is. At checkout POS emits one `motion` per cart line on the order stream:
```
action 105 PLACED, phase 105, data = { li:1, title, qty, price }
```
- **Per-item phase**: tap an item advances just it (`105→106→107→108→109`) — a kitchen ticket.
- **Order phase = MIN of items**: only as far as the slowest line; tapping the header bumps all at the minimum.
- **Terminal**: all items at `109` → order `mass.active=0`, leaves the slice.

### Consequences
- The list shrinks as work completes. Empty Home = clear present (goal, not error).
- History is never destroyed — advancing appends/updates `motion`; the past leaves the slice but stays queryable.
- Home and Workspace can never disagree — same opcodes, same rows.
- New worldline types are free: add a `mass.type` to the `IN (...)` list + a `describe()`/`advance()` branch.

---

## Part B — Workspace action → table write matrix

Routing: personal items (`general_personal`) → local **Private DB** (`user_private_${self}.db`); everything else → **Collab DB** (`user_sync_${self}.db`).

| Action | Target | Tables written |
| :--- | :--- | :--- |
| `saveCustomer` | Collab | `matter` upsert (+ vector store) |
| `createStock` | Collab | `mass` (qty, value, `{name}`); `motion` 406 TRANSFER_IN |
| `startStockTransfer` | Collab | `mass` qty ±; `motion` 405/406 + delta |
| `createTrip` | Collab | `mass` (type trip, `{ref,driver,driverId}`); `motion` 401 DISPATCHED |
| `assignDriver` | Collab | `motion` 403 DRIVER_ASSIGNED (driver id in payload) |
| `advanceTrip` | Collab | `motion` in-place phase (401→402→109) |
| `updateTripEta` | Collab | `motion` in-place 404 ETA_UPDATE + delta |
| `logDeliveryAttempt` | Collab | `motion` in-place 410 DELIVERY_FAILED |
| `logReturnRequest` | Collab | `motion` in-place 407 RETURNED |
| `createProduct` | Collab | `matter` (type product, pricing) + vector |
| `createVariant` | Collab | `mass` (type variant, `{label}`); `motion` 406 |
| `adjustVariantStock` | Collab | `mass` qty ±10; `motion` 405/406 |
| `createModifier` | Collab | `matter` (modifier); `relation` modifier_of; `mass` (price) |
| `deactivateModifier` | Collab | `mass` active=0 |
| `publishToProfile` | Collab | `relation` published_to insert |
| `unpublishFromProfile` | Collab | `relation` published_to delete |
| `createLead` | Collab | `mass` (type lead, value); `motion` 303 NEW_LEAD |
| `advanceLead` | Collab | `motion` in-place (303→304→305) |
| `closeLead` | Collab | `mass` active=0; `motion` 303 CLOSED |
| `logQuickEvent` | Collab | `motion` 301 VISIT / 302 REVIEW / 309 OFFER |
| `createTicket` | Collab | `mass` (type ticket); `motion` 306 TICKET_OPEN |
| `submitReply` | Collab | `motion` 307 REPLIED (text in payload) |
| `resolveTicket` | Collab | `mass` active=0; `motion` in-place 308 |
| `createTask` | Private / Collab | `matter` (task); `relation` task (if shared); `mass` (slot). No motion |
| `toggleTask` | Private / Collab | `mass` active toggle + `end`. No motion |
| `createNote` | Private / Collab | `matter` (note); `relation` note (if shared) + vector |
| `createSlot` | Collab | `mass` (slot, start/end). No motion |
| `createBudgetAllocation` | Collab | `mass` (budget, limit); `motion` 806 |
| `recordExpense` | Collab | `mass` qty −amount; `motion` 806 −delta |
| `createInvoice` | Collab | `mass` (invoice, total); `motion` 801 PAY_INIT |
| `resolveInvoiceSuccess` | Collab | `mass` active=0; `motion` in-place 802 |
| `resolveInvoiceFailure` | Collab | `mass` active=0; `motion` in-place 805 |

**Status lives in the opcodes.** A `motion` row's status is conveyed entirely by `action`/`phase` integers — `appendMotion`/`phaseUpdateMotion` do **not** mirror a status string into `motion.data`. On read, the label derives from `OPCODE_LABELS[phase || action]` (e.g. `406`→"TRANSFER IN"). `data` carries only real payload (`src`, `ref`, `reason`, `rating`, phase-history `ph`). Legacy rows with a `status` field are ignored on read.

**Tasks/notes/slots carry no motion** — their state lives entirely in the `mass` slot (`active`/`end`).
