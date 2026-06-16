# 02 — Collaboration

Why sync exists, how it works, and how auth/revocation work.

---

## 1. Why Sync Exists (Collaboration)

### The Problem

```
Without sync:
┌─────────────┐                    ┌─────────────┐
│  Cashier A  │                    │  Cashier B  │
│  (Phone)    │                    │  (Tablet)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  Local DB   │                    │  Local DB   │
│  stock = 25 │                    │  stock = 25 │
│  (stale!)   │                    │  (stale!)   │
└─────────────┘                    └─────────────┘

Both sell the same item → stock goes negative!
```

### The Solution

```
With sync:
┌─────────────┐         ┌─────────────────────────────────────┐
│  Cashier A  │◄───────▶│         Durable Object              │
│  (Phone)    │  WS     │         s:store_101                  │
└─────────────┘         │                                     │
                        │  ┌─────────────────────────────┐   │
┌─────────────┐         │  │  SQLite: stock = 25          │   │
│  Cashier B  │◄───────▶│  │  Single-threaded             │   │
│  (Tablet)   │  WS     │  │  No race conditions          │   │
└─────────────┘         │  └─────────────────────────────┘   │
                        └─────────────────────────────────────┘

Both see the same stock → only one can sell the last item!
```

### What "Collaborative" Means

```
┌─────────────────────────────────────────────────────────────┐
│                    Collaboration Use Cases                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. RESTAURANT                                              │
│     Cashier (Phone) + Kitchen (KDS) + Manager (Tablet)      │
│     All see the same orders in real-time                    │
│                                                             │
│  2. STORE                                                   │
│     Cashier + Inventory Manager + Owner                     │
│     Stock updates instantly across all devices              │
│                                                             │
│  3. DELIVERY                                                │
│     Restaurant + Driver + Customer                          │
│     Order status updates in real-time                       │
│                                                             │
│  4. TEAM                                                    │
│     Manager + Staff + HR                                     │
│     Tasks, attendance, payroll sync instantly               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Sync Architecture                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐   │
│  │ Client A │────▶│ Worker   │────▶│ Durable Object   │   │
│  │ (Phone)  │ WS  │ Gateway  │     │ s:store_101      │   │
│  └──────────┘     └──────────┘     │                  │   │
│                                     │ ┌──────────────┐│   │
│  ┌──────────┐     ┌──────────┐     │ │ SQLite DB    ││   │
│  │ Client B │────▶│ Worker   │────▶│ │ form         ││   │
│  │ (Tablet) │ WS  │ Gateway  │     │ │ matter       ││   │
│  └──────────┘     └──────────┘     │ │ motion       ││   │
│                                     │ │ bond         ││   │
│                                     │ └──────────────┘│   │
│                                     └────────┬────────┘   │
│                                              │             │
│                                              ▼             │
│                                     ┌──────────────────┐   │
│                                     │ R2 / S3 Archive   │   │
│                                     └──────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Sync Protocol

### Two Watermarks

```
┌─────────────────────────────────────────────────────────────┐
│                    Sync Watermarks                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. last_synced_seq                                         │
│     - Highest seq synced from motion                        │
│     - Used for: motion table (append-only)                  │
│     - Example: 1718300000000                                │
│                                                             │
│  2. last_synced_time                                        │
│     - Last synced time for form/matter/bond                 │
│     - Used for: LWW tables (mutable)                       │
│     - Example: "2026-06-13T12:00:00.000Z"                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Handshake Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Sync Handshake                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Client connects                                    │
│  ┌──────────┐                                              │
│  │ Client   │──WS Connect (JWT + scope=s:store_101)──▶     │
│  └──────────┘                                              │
│                                                             │
│  Step 2: Client sends watermarks                            │
│  ┌──────────┐                                              │
│  │ Client   │──client-init { last_synced_seq, time }──▶    │
│  └──────────┘                                              │
│                                                             │
│  Step 3: DO sends changes                                   │
│  ┌──────────┐                                              │
│  │ DO       │──server-sync { motion, form, matter, bond }──▶│
│  └──────────┘                                              │
│                                                             │
│  Step 4: Client sends local changes                         │
│  ┌──────────┐                                              │
│  │ Client   │──client-sync { motion, form, matter, bond }──▶│
│  └──────────┘                                              │
│                                                             │
│  Step 5: DO acknowledges                                    │
│  ┌──────────┐                                              │
│  │ DO       │──client-sync-ack { count: N }──▶              │
│  └──────────┘                                              │
│                                                             │
│  Step 6: DO broadcasts to other clients                     │
│  ┌──────────┐                                              │
│  │ DO       │──broadcast { new rows }──▶ Client B          │
│  └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Message Formats

**client-init:**
```json
{
  "type": "client-init",
  "scope": "s:store_101",
  "last_synced_seq": 1718300000000,
  "last_synced_time": "2026-06-13T12:00:00.000Z"
}
```

**server-sync:**
```json
{
  "type": "server-sync",
  "motion": [
    { "stream":"stock_biryani", "seq":1, "action":101, "delta":-2.0 }
  ],
  "form": [
    { "id":"item_biryani", "type":"product", "title":"Chicken Biryani" }
  ],
  "matter": [],
  "bond": []
}
```

**client-sync:**
```json
{
  "type": "client-sync",
  "motion": [
    { "stream":"stock_biryani", "seq":2, "action":102, "delta":1.0 }
  ],
  "form": [],
  "matter": [
    { "id":"stock_biryani", "qty":23.0, "value":180 }
  ],
  "bond": []
}
```

---

## 4. Offline → Online Reconciliation

```
┌─────────────────────────────────────────────────────────────┐
│                    Offline → Online                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: OFFLINE                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User edits offline                                  │   │
│  │ → Append to local motion                            │   │
│  │ → Write to local form/matter/bond                   │   │
│  │ → DO is inactive                                    │   │
│  │ → Local cache, monotonic keys prevent collisions    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Phase 2: RECONNECT                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Network restored                                    │   │
│  │ → Send client-init with both watermarks             │   │
│  │ → Worker validates JWT, wakes DO                    │   │
│  │ → Aligns logical + physical clocks                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Phase 3: CATCH-UP                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pull remote changes                                 │   │
│  │ → Apply server-sync rows                            │   │
│  │ → DO queries: seq > last_synced_seq OR time > ...   │   │
│  │ → Server-first integration                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Phase 4: UPLOAD                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Push local changes                                  │   │
│  │ → Send client-sync rows                             │   │
│  │ → DO inserts rows, acks, broadcasts                 │   │
│  │ → Sub-50ms fan-out                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Phase 5: RESOLVE                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Consolidate                                         │   │
│  │ → Fold motion for views                             │   │
│  │ → Daily compaction → R2/S3                          │   │
│  │ → No merge conflicts (monotonic / LWW)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Conflict Resolution

```
┌─────────────────────────────────────────────────────────────┐
│                    Per-Table Conflicts                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  motion (concurrent phase updates)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Strategy: CRDT merge of ph map                      │   │
│  │ Result: Union of all transitions                    │   │
│  │                                                     │   │
│  │ Example:                                            │   │
│  │ Client A: {"ph":{"107": 1000}}                      │   │
│  │ Client B: {"ph":{"108": 2000}}                      │   │
│  │ Merged:   {"ph":{"107":1000,"108":2000}}            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  matter (concurrent qty edits)                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Strategy: Ledger folding of motion.delta            │   │
│  │ Result: Balances recalculated                       │   │
│  │                                                     │   │
│  │ Example:                                            │   │
│  │ motion: delta = -2, -3, +1                          │   │
│  │ qty = SUM(delta) = -4                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  bond (concurrent link/unlink)                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Strategy: PK constraint + LWW on time               │   │
│  │ Result: Correct graph state                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  form (concurrent metadata)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Strategy: LWW on time                               │   │
│  │ Result: Most recent wins                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### LWW SQL Example

```sql
-- Last-Write-Wins for form/matter/bond
INSERT INTO form (id, code, type, title, public, active, data, time)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title  = CASE WHEN excluded.time > form.time THEN excluded.title  ELSE form.title  END,
  active = CASE WHEN excluded.time > form.time THEN excluded.active ELSE form.active END,
  data   = CASE WHEN excluded.time > form.time THEN excluded.data   ELSE form.data   END,
  time   = CASE WHEN excluded.time > form.time THEN excluded.time   ELSE form.time   END;
```

### Ledger Folding

```sql
-- Stock balance recomputed from motion
SELECT SUM(delta) FROM motion WHERE stream = 'stock_biryani';
-- Result: -5.0 (sold 5 units)
-- Current stock = initial + SUM(delta)
-- 25 + (-5) = 20 remaining
```

---

## 6. Auth & Revocation

### Token Exchange

```
┌─────────────────────────────────────────────────────────────┐
│                    Auth Flow                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: User signs in                                      │
│  ┌──────────┐                                              │
│  │ Client   │──Native Google sign-in──▶                    │
│  └──────────┘                                              │
│                                                             │
│  Step 2: Exchange for scoped JWT                            │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │ Client   │────▶│ Worker   │────▶│ Google   │           │
│  │          │     │ /api/auth│     │ Auth API │           │
│  └──────────┘     └──────────┘     └──────────┘           │
│                       │                                    │
│                       │ Verify signature                   │
│                       │ Query permitted scopes             │
│                       │ Mint custom JWT (15-min)           │
│                       │                                    │
│  ┌──────────┐◀───────┘                                    │
│  │ Client   │──JWT { userId, scopes: ["s:102"] }──▶      │
│  └──────────┘                                              │
│                                                             │
│  Step 3: Client uses JWT for sync                           │
│  ┌──────────┐                                              │
│  │ Client   │──WS Connect (Bearer JWT)──▶ DO              │
│  └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Gateway Routing Code

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const scopeCode = url.searchParams.get("scope"); // "s:store_101"
    const token = request.headers.get("Authorization")?.split(" ")[1];

    try {
      // 1. Verify JWT
      const payload = await verifyJwt(token, env.JWT_SECRET);
      
      // 2. Check scope permission
      if (!payload.scopes.includes(scopeCode)) {
        return new Response("Unauthorized Scope", { status: 403 });
      }
      
      // 3. Get DO by name (deterministic)
      const doId = env.SYNC_DO.idFromName(scopeCode);
      const doStub = env.SYNC_DO.get(doId);
      
      // 4. Forward request to DO
      return doStub.fetch(request);
      
    } catch {
      return new Response("Invalid Token", { status: 401 });
    }
  }
};
```

### Immediate Revocation

```
┌─────────────────────────────────────────────────────────────┐
│                    Revocation Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin detects compromised account                          │
│  │                                                          │
│  ▼                                                          │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │ Admin    │────▶│ Worker   │────▶│ DO       │           │
│  │ POST     │     │ /kick    │     │ s:store  │           │
│  └──────────┘     └──────────┘     └──────────┘           │
│                        │                │                   │
│                        │                ▼                   │
│                        │         ┌──────────────┐          │
│                        │         │ Close WS for │          │
│                        │         │ usr_revoked  │          │
│                        │         └──────────────┘          │
│                        │                                   │
│                        ▼                                   │
│                  ┌──────────────┐                          │
│                  │ User kicked  │                          │
│                  │ Cannot re-   │                          │
│                  │ connect      │                          │
│                  │ (JWT expires │                          │
│                  │  in 15 min)  │                          │
│                  └──────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```javascript
// Admin Worker
await env.SYNC_DO.get(env.SYNC_DO.idFromName(scopeCode))
  .fetch("https://do/kick", { 
    method: "POST", 
    body: JSON.stringify({ userId: "usr_revoked" }) 
  });
```

### Identity Provider

| System | Holds |
|:-------|:------|
| Firebase Auth | Identity (email, Google UID, passwords) |
| TAR DO/Turso | App data (profile, balances, actions) |

Firebase Auth = free for unlimited MAUs.

---

## 7. Storage Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Lifecycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. DO Alarm fires (3:00 AM daily)                          │
│     │                                                       │
│     ▼                                                       │
│  2. Export old motion → Parquet → R2                         │
│     │                                                       │
│     ▼                                                       │
│  3. Truncate: DELETE FROM motion WHERE seq <= ?; VACUUM      │
│     │                                                       │
│     ▼                                                       │
│  4. Record compaction watermark                              │
│     │                                                       │
│     ▼                                                       │
│  5. Clients don't request deleted rows on next handshake     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Cloudflare caps DO SQLite at 10 GB; TAR keeps scopes under ~5-10 MB.
```
