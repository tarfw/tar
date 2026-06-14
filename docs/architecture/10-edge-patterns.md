# 10 — Edge Patterns (Workers, DO, WebSockets)

How Workers, Durable Objects, and WebSockets divide labor — and the cost rule that drives the whole design. This is the "why" behind the geo cells (03) and order DO (03); here it's generalized.

> **Golden rule:** WebSockets + Durable Objects handle the **noise**; the `motion` ledger only stores the **milestones**.

---

## 1. Workers — stateless edge logic

Globally deployed, entirely stateless API layer.

| Use | What it does |
| :--- | :--- |
| Auth / token bridge | verify Firebase token → mint scoped JWT for sync (see [02 §4](02-sync-protocol.md#4-auth--access-revocation)) |
| AI embedding hooks | on new `form`/`matter`, a webhook triggers a Worker → embed via Workers AI → write `memory` |
| Payment / logistics webhooks | ingest Stripe/UPI/delivery callbacks, validate, write the `motion` (e.g. `PAY_SUCCESS`) to the right scope |

---

## 2. Durable Objects — stateful coordinators & locks

A DO guarantees strict single-threaded execution for one id globally — it prevents race conditions.

| Pattern | Why a DO |
| :--- | :--- |
| **High-contention checkout lock** | two buyers race for the last ticket/slot → DO serializes, picks winner, then commits `SOLD` |
| **Live store / KDS coordinator** | one DO per store holds the active order queue in-memory → KDS reads it, no DB polling |
| **Sequential token queue** | DO holds the strict counter (Token Issued → Called → Served) |
| **Collaborative session** | multiple staff editing one cart → DO batches ephemeral edits before the final write |
| **`seq` allocator** | `motion` has `UNIQUE(stream, seq)`. Two writers at the same ms would collide on `seq:5`. The DO holds `seq` in-memory and hands out `5`, `6` cleanly |

---

## 3. WebSockets — real-time ephemeral streams

Persistent bi-directional connections; keep ephemeral "junk" out of the DB.

| Use | Benefit |
| :--- | :--- |
| Live fleet / driver GPS | driver streams coords → DO broadcasts to customer map. **Zero DB writes** for ticks |
| Instant kitchen ticket pops | cashier commits → WS ping → KDS shows ticket in <50ms |
| Live support chat | typing indicators + instant delivery before logging the resolved chat |
| Admin global dashboard | live `SALE` stream to HQ map in real time |

---

## 4. Noise vs. milestones (the core discipline)

| Use case | Without edge (naïve) | With edge (TAR) |
| :--- | :--- | :--- |
| **Fleet tracking** | write `motion` 404 every 3s for GPS | stream coords over WS to DO; write `motion` only at `PICKED_UP`/`DELIVERED` |
| **`seq` allocation** | two cashiers both insert `seq:5` → crash | DO queues, assigns `5`/`6`, writes both cleanly |
| **KDS fanout** | poll `motion` every 2s for `ORDER_FIRE` | POS appends row + WS ping → DO pushes to kitchen <50ms, zero reads |

---

## 5. The cost impact

Offloading high-frequency ephemeral data to the edge slashes the two expensive DB operations: **reads** and **writes**.

**GPS example (10k drivers, 10h/day, every 3s):**

| | Pure DB | Edge (WS + DO) + DB milestones |
| :--- | :--- | :--- |
| Writes | ~120M/day (~3.6B/mo) | only at milestones — ~400k/mo (200k deliveries × 2) |
| Est. cost | **~$3,600+/mo** in write overages | DB fits base plan; CF WS (20:1) ~180M req/mo ≈ **~$27/mo** |
| Latency | poll-bound | **<50ms** |
| Contention | constraint crashes | DO-serialized, none |

**Net:** ~$3,600/mo → **~$50/mo** combined, lower latency, no contention. Idle WS connections are near-free via the **Hibernation API** (Cloudflare bills active processing ms, not open-connection minutes).

---

## 6. Turso client (on-device) note

The on-device DB historically used `@tursodatabase/sync-react-native` (embedded SQLite + optional Turso Cloud sync). TAR has since moved collaborative sync to the **DO model** ([02](02-sync-protocol.md)); Turso now serves only as the global AI/`memory` index. The local SDK is still relevant for:

- **Embedded SQLite** on device (offline-first, concurrent writes, checksums, encryption at rest).
- **On-device vector search** (`F32_BLOB(384)`) for private `memory`.

```typescript
import { Database, getDbPath } from "@tursodatabase/sync-react-native";
const db = new Database({ path: getDbPath("tar.db"), url: "libsql://<db>.turso.io", authToken: "<token>" });
await db.connect();
```

**Gotcha:** pass the whole schema string to `db.exec(SCHEMA_SQL)` directly — do **not** `.split(";")` and run statement-by-statement. Manual splitting breaks the tokenizer (`unexpected token ')' at offset 0`). `exec()` handles multiple `;`-separated statements natively.

*(Collaborative `db.pull()`/`db.push()` are superseded by the DO WebSocket sync in [02](02-sync-protocol.md). Local `get`/`all`/`run`/`exec` remain in use.)*
