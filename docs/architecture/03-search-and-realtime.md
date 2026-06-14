# 03 — Search & Real-Time

How discovery, geospatial matching, and multi-party transactions work. Covers the SuperAgent search screen, geo presence cells, and the order coordinator DO.

---

## 1. Search — recall then hydrate

Search is **two steps**: recall (semantic, from Turso) then hydrate (live truth, from the DO). Turso never holds volatile state.

| Step | Engine | Returns |
| :--- | :--- | :--- |
| 1. Recall | Turso `memory` (vector) | candidate `id`s + `scope` + cached `knowledge`/`context` snapshot |
| 2. Hydrate | owning DO (`form`/`matter`) | exact live price, stock, availability |
| 3. Act | owning DO (`motion`) | write the event (sold, booked, paid) |

**Why staleness is fine:** a 30-second-old price is fine for ranking and display. Exactness is bought at **action time** — checkout reads the DO, not Turso.

### Category → engine routing (SuperAgent screen)

| Category | Query is really… | Find via | Live data from | Geo cell? |
| :--- | :--- | :--- | :--- | :--- |
| 🛒 Shopping (`product`) | "what is this" | Turso `memory` | merchant DO `matter` | no |
| 🍔 Food (`restaurant`) | "what + near me" | Turso `memory` + H3 | restaurant DO | optional |
| 🚕 Transport (`transport`) | "who is moving near me **now**" | **`geo:{h3}` k-ring** | driver DO (live pos) | **yes — core** |
| 🎫 Tickets (`event`) | "what event" | Turso `memory` | event DO (seats) | no |
| 🏨 Hotels (`hotel`) | "what + where + dates" | Turso `memory` + H3 | hotel DO (rooms) | optional |
| 🏠 Services (`service`) | "who serves near me + slot" | Turso `memory` + H3 | provider DO (slots) | optional (mobile: yes) |

**Rule:** partition by the dimension you query on. Meaning → vector (Turso). Static place → H3 tag on `memory`. Live moving place → `geo:{h3}` DO. Truth → operational DO.

| Endpoint | Use |
| :--- | :--- |
| `POST /api/global/search` | semantic recall (5 of 6 categories) |
| `POST /api/geo/nearby` | H3 k-ring live presence (Transport) |

### Booking flow
```text
Search → Vector search (Turso memory) → form results
       → select form → load matter (live, from DO)
       → select matter → create motion → order / booking
```

---

## 2. Per-category sample data

The same model fits every vertical with no per-feature schema. (`form` = what exists, `matter` = what's available, `motion` = what happened.)

**Shopping**
```json
form:   { "id":"form_nike_airmax", "type":"product", "scope":"g", "title":"Nike Air Max 90" }
matter: [ { "id":"var_8","form":"form_nike_airmax","type":"variant","qty":12,"value":5999,"data":{"size":"8"} },
          { "id":"var_9","form":"form_nike_airmax","type":"variant","qty":8,"value":5999,"data":{"size":"9"} } ]
```

**Food**
```json
form:   { "id":"form_biryani_hut", "type":"restaurant", "scope":"g", "title":"Biryani Hut" }
matter: [ { "id":"item_chicken","form":"form_biryani_hut","type":"item","value":180,"data":{"name":"Chicken Biryani"} },
          { "id":"item_mutton","form":"form_biryani_hut","type":"item","value":220,"data":{"name":"Mutton Biryani"} } ]
```

**Transport** (note `geo` on each unit)
```json
form:   { "id":"form_taxi_dzire", "type":"transport", "scope":"g", "title":"Maruti Dzire" }
matter: [ { "id":"driver_1","form":"form_taxi_dzire","type":"unit","value":180,"geo":"13.0827,80.2707","data":{"driver":"Ravi","eta":4} },
          { "id":"driver_2","form":"form_taxi_dzire","type":"unit","value":200,"geo":"13.0700,80.2500","data":{"driver":"Suresh","eta":6} } ]
```

**Tickets**
```json
form:   { "id":"form_kgf3", "type":"event", "scope":"g", "title":"KGF Chapter 3" }
matter: [ { "id":"gold","form":"form_kgf3","type":"seat","qty":50,"value":250 },
          { "id":"silver","form":"form_kgf3","type":"seat","qty":120,"value":180 } ]
```

**Hotels**
```json
form:   { "id":"form_taj", "type":"hotel", "scope":"g", "title":"Taj Coromandel" }
matter: [ { "id":"deluxe","form":"form_taj","type":"room","qty":12,"value":12000 },
          { "id":"suite","form":"form_taj","type":"room","qty":4,"value":22000 } ]
```

**Services**
```json
form:   { "id":"form_clean", "type":"service", "scope":"g", "title":"SparkClean" }
matter: [ { "id":"slot_9am","form":"form_clean","type":"slot","start":"2026-06-12T09:00:00Z","end":"2026-06-12T11:00:00Z","value":799 } ]
```

**Motion** (the universal "what happened")
```json
{ "stream":"form_taxi_dzire", "action":903, "matter":"driver_1", "scope":"c:user123",
  "data":{ "pickup":"Anna Nagar", "drop":"Airport" } }
```

---

## 3. Geospatial presence

Real-time "who/what is near me now" never scans millions of DOs. **Place is the shard.**

### The `geo:{h3}` cell DO
One DO per H3 hex (a few hundred metres) — a live registry of who is present in that cell.

```text
geo:8a2a1072b59ffff   (one hex cell)
  ├─ driver_44 | lat,lng | free   | 2s ago
  ├─ driver_91 | lat,lng | onTrip | 1s ago
  └─ driver_12 | lat,lng | free   | 4s ago
```

H3 ownership by speed of change:

| H3 use | Owner | Stored as | Changes |
| :--- | :--- | :--- | :--- |
| static place (store/hotel address) | `matter.geo` | a column value | almost never |
| search snapshot (area filter) | `memory` (Turso) | denormalized copy | on publish |
| live moving body (taxi) | **`geo:{h3}` DO** | the **DO name itself** | per-second |

### Finding the 7 nearby cells (pure math, no search)

| Step | Action | Result |
| :--- | :--- | :--- |
| 1 | `h3.latLngToCell(lat,lng,res)` | rider's center hex id |
| 2 | `h3.gridDisk(id, 1)` | 7 ids (center + 6 neighbors) |
| 3 | each H3 id **is** a DO name | `idFromName("geo:"+h3id)` |
| 4 | open those 7 DOs | live free drivers nearby |
| 5 | none? `gridDisk(id, 2)` | widen to 19 cells |

The H3 id **is** the DO address → 7 hex ids = 7 known DO names = 7 direct reads, **bounded regardless of global driver count**.

### Driver movement

| Driver moves… | DO action | Frequency |
| :--- | :--- | :--- |
| within same hex | update lat/lng in same `geo:` DO | every ping (~5s) |
| crosses hex edge | leave old cell DO, join new cell DO | only at boundary |

Pick a hex size (e.g. res 8 ≈ 460 m edge) where crossings are minutes apart at city speed.

---

## 4. Order coordinator DO (transaction agent)

Every multi-party transaction (order, ride, booking) gets **one short-lived DO** — the "agent" all parties share. Solves distributed-transaction problems: one owner, one timeline, atomic lifecycle.

### Lifecycle
| Phase | DO state | Cost |
| :--- | :--- | :--- |
| Created | tap "order" → `o:order_42` spawns | active |
| Active | all parties read/write, one WebSocket room | active (only while in use) |
| Idle between steps | hibernates | ~free |
| Final phase | DELIVERED / CANCELLED | active |
| Close | `motion` ledger → R2/S3 archive | — |
| Delete | DO destroyed | **zero** |

### Who joins, and what stays permanent
| Party | Does what | Permanent data lives in |
| :--- | :--- | :--- |
| Customer | places order, watches status | receipt → customer local DB |
| Restaurant owner (`s:`) | confirm / reject | menu, **stock** → `s:rest` DO |
| Kitchen team (`t:`) | prepare, mark ready | — |
| Driver + `geo:` | pick up, transit, deliver | position → `geo:`/driver DO |

> The order DO is **temporary glue** holding the shared lifecycle. Permanent things (stock, menu, profiles, position) stay in their own scope DOs — the order DO only references them by `id`.

### Example: a food order (`o:order_42` owns the stream)
| # | Event | Opcode | Written to | Strategy |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Add to cart | CART_ADD 102 | customer local | Local |
| 2 | Checkout | CHECKOUT 104 | `o:order_42` | Phase |
| 3 | Order placed | ORDER_PLACED 105 | `o:order_42` | Append |
| 4 | Payment init | PAY_INIT 801 | `o:order_42` | Append |
| 5 | Payment ok | PAY_SUCCESS 802 | `o:order_42` | Phase |
| 6 | Confirm | CONFIRMED 106 | `o:order_42` | Phase |
| 7 | Fire to kitchen | ORDER_FIRE 206 | `o:order_42` (by `t:rest`) | Append |
| 8 | Preparing | PREPARING 107 | `o:order_42` | Phase |
| 9 | Item ready | ITEM_READY 207 | `o:order_42` | Phase |
| 10 | Order ready | READY 108 | `o:order_42` | Phase |
| 11 | Stock decrement | SOLD 101 | **`s:rest`** (`matter.qty` fold) | Append |
| 12 | Find driver | RIDE_REQ 903 | `geo:{h3}` / `d` | Append |
| 13 | Driver matched | DRIV_ASSIGN 403 | `o:order_42` (by driver) | Phase |
| 14 | Picked up | PICKED_UP 409 | `o:order_42` | Phase |
| 15 | In transit | IN_TRANSIT 402 | `o:order_42` | Phase |
| 16 | ETA update | ETA_UPDATED 404 | `o:order_42` | Phase (in-place) |
| 17 | Delivered | DELIVERED 109 | `o:order_42` | Phase |

**Pattern:** one `stream = order_42` shared by all parties; lifecycle steps mutate one `phase` row in-place (cheap), logs append. No DO writes to another DO — the Worker routes each motion. Stock truth (`SOLD 101`) only touches `s:rest`, never Turso. `bond` rows link `order_42 → form(item)`, `order_42 → driver`.

### Join authorization (JWT scope claims)
| Party | Allowed because token holds | Can do |
| :--- | :--- | :--- |
| Customer | `o:order_42` (issued at checkout) | read all, cancel before CONFIRMED |
| Restaurant owner | `s:rest` (owns storefront) | confirm/reject, fire to kitchen |
| Kitchen team | `t:rest` | advance prep phases |
| Driver | `o:order_42` (granted on DRIV_MATCH) | advance delivery phases |

The order DO **issues** the customer's and driver's `o:` claims; the merchant's right comes from owning `s:rest`. No claim → rejected at the DO boundary; `/kick` revokes live sockets.

### Archive + delete (who owns it)
| Step | Owner | Action |
| :--- | :--- | :--- |
| Final phase reached | order DO | flips to closeable |
| Archive | order DO | full `motion` ledger → R2/S3 key `order/${id}` |
| Receipt copies | each party | already hold their own |
| Delete | order DO | `state.storage.deleteAll()` → cost 0 |

Deletion is safe: the order DO held only the shared lifecycle. Every permanent fact (stock, position, receipt) lives elsewhere and survives. The S3 archive is the cold, queryable record.

---

## 5. "Future motion" — reminders & to-dos

A reminder is just a **`motion` that hasn't happened yet** — a row with a future `time`.

| Field | Value |
| :--- | :--- |
| `stream` | `task_99` (the matter/form it's about) |
| `action` | `105` (reminder opcode) |
| `phase` | PENDING |
| `time` | future timestamp |

Because the home screen queries `SELECT * FROM motion ORDER BY time DESC`, future rows float to the top — one unified timeline (scroll up = future to-dos, down = past activity). An AI agent polls `WHERE action=105 AND phase=PENDING AND time <= now`, sends the push, then marks it SENT. No extra tables, offline-ready.

**Rule of thumb:** occupies a calendar block → `matter` (`start`/`end`). Just a "ping me later" alert → `motion` (JSON payload).
