# 04 — Search & Real-Time

Vector search, geo presence, and order coordination.

---

## 1. Search: Recall → Hydrate

Two-step search: semantic recall (Turso), then live truth (DO).

| Step | Engine | Returns |
|:-----|:-------|:--------|
| 1. Recall | Turso `memory` (vector) | candidate IDs + cached snapshot |
| 2. Hydrate | DO `form`/`matter` | live price, stock |
| 3. Act | DO `motion` | write event |

**Why staleness is fine:** 30s-old price is fine for ranking. Exactness bought at **action time** (checkout reads DO, not Turso).

### Category → Engine Routing

| Category | Query | Find via | Live from | Geo? |
|:---------|:------|:---------|:----------|:-----|
| Shopping | "what is this" | Turso memory | merchant DO | no |
| Food | "what + near me" | Turso + H3 | restaurant DO | optional |
| Transport | "who is near me now" | **KV k-ring** | driver DO | **yes** |
| Tickets | "what event" | Turso memory | event DO | no |
| Hotels | "what + where + dates" | Turso + H3 | hotel DO | optional |
| Services | "who serves near me" | Turso + H3 | provider DO | optional |

### Search Example

```javascript
// 1. Vector search in Turso
const results = await turso.execute({
  sql: "SELECT id, scope FROM memory WHERE vec MATCH ? LIMIT 10",
  args: [embeddingVector]
});

// 2. Hydrate from DOs
for (const result of results) {
  const storeDO = await getDO(result.scope);
  const product = await storeDO.fetch(`/form/${result.id}`);
  const stock = await storeDO.fetch(`/matter?form=${result.id}`);
}
```

---

## 2. Geospatial Presence (Workers KV)

Ephemeral driver/location presence using H3 hex grid + KV with TTL.

### How It Works

```
Driver pings GPS every 5s → Worker writes to KV

Key:   geo:8a2a1072b59ffff
Value: { "driver_44": { "lat":13.08, "lng":80.27, "status":"free" } }
TTL:   30 seconds (auto-expires)
```

### Finding Nearby Drivers

```javascript
// 1. Customer location → hex ID
const customerHex = h3.latLngToCell(13.0827, 80.2707, 8);

// 2. Get 7 nearby hexes (center + 6 neighbors)
const nearbyHexes = h3.gridDisk(customerHex, 1);

// 3. Read from KV (parallel)
const results = await Promise.all(
  nearbyHexes.map(hex => KV.get(`geo:${hex}`))
);

// 4. Filter free drivers
const freeDrivers = results
  .filter(data => data !== null)
  .flatMap(data => Object.entries(data))
  .filter(([id, info]) => info.status === "free");
```

### Driver Movement

| Movement | Action | Frequency |
|:---------|:-------|:----------|
| Within hex | Update KV value | every 5s |
| Cross hex | Delete old key, write new | at boundary |

### KV vs DO for Geo

| | DO (old) | KV (new) |
|:--|:---------|:---------|
| Storage | SQLite (permanent) | Key-value (ephemeral) |
| Cleanup | Manual DELETE | Auto-expires (TTL) |
| Cost (10k drivers) | ~$27/mo | ~$5/mo |

---

## 3. Order Coordinator DO

Every multi-party transaction gets one short-lived DO.

### Lifecycle

| Phase | State | Cost |
|:------|:------|:-----|
| Created | tap "order" → `o:order_42` | active |
| Active | all parties WebSocket | active |
| Idle | hibernates | ~free |
| Final | DELIVERED / CANCELLED | active |
| Archive | motion → R2 | — |
| Delete | self-destruct | zero |

### Who Joins

| Party | Action | Permanent Data |
|:------|:-------|:---------------|
| Customer | places order | receipt → local DB |
| Restaurant (`s:`) | confirm/reject | stock → `s:rest` DO |
| Kitchen (`t:`) | prepare | — |
| Driver | deliver | position → KV |

### Example: Food Order

| # | Event | Opcode | Written To |
|:--|:------|:-------|:-----------|
| 1 | Add to cart | 102 | Local DB |
| 2 | Checkout | 104 | o:order_42 |
| 3 | Order placed | 105 | o:order_42 |
| 4 | Payment init | 801 | o:order_42 |
| 5 | Payment ok | 802 | o:order_42 |
| 6 | Confirm | 106 | o:order_42 |
| 7 | Fire to kitchen | 206 | o:order_42 |
| 8 | Preparing | 107 | o:order_42 |
| 9 | Item ready | 207 | o:order_42 |
| 10 | Ready | 108 | o:order_42 |
| 11 | Stock decrement | 101 | **s:rest** |
| 12 | Find driver | 903 | KV search |
| 13 | Driver matched | 403 | o:order_42 |
| 14 | Picked up | 409 | o:order_42 |
| 15 | In transit | 402 | o:order_42 |
| 16 | ETA update | 404 | o:order_42 |
| 17 | Delivered | 109 | o:order_42 |

### Join Authorization

| Party | JWT Claim | Can Do |
|:------|:----------|:-------|
| Customer | `o:order_42` | read all, cancel |
| Restaurant | `s:rest` | confirm/reject |
| Kitchen | `t:rest` | advance prep |
| Driver | `o:order_42` | advance delivery |

---

## 4. Future Motion (Reminders)

A reminder = a `motion` with a future `time`. Home screen queries `ORDER BY time DESC`, so future rows float to top.

| Field | Value |
|:------|:------|
| `stream` | task ID |
| `action` | 105 (reminder) |
| `phase` | PENDING |
| `time` | future timestamp |

AI agent polls `WHERE action=105 AND phase=PENDING AND time <= now`, sends push, marks SENT.
