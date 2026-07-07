# Skill: Restaurant Workspace

> **Workspace type:** `restaurant`
> This skill defines the data model, write paths, and storage routing for a restaurant workspace in the TAR system. It covers dine-in, takeaway, and delivery operations.

---

## Data Topology

Every piece of restaurant data falls into one of three buckets:

| Layer | Technology | Rule |
|---|---|---|
| **Operational state** | Turso (`ws-{subdomain}`) | Mutable — needs UPDATE / DELETE |
| **Event stream** | S2.dev stream | Immutable append — things that *happened* |
| **Historical archive** | Railway S3 (Parquet) | Queried offline via DuckDB WASM |

---

## What Goes Where

### 🟢 Turso — Mutable Operational State

These records are live, actively queried, and need to be updated or deleted.

| Data | Table | Why Turso |
|---|---|---|
| **Menu items** (name, price, category, image) | `matter` (`type='item'`) | Prices change, items get disabled |
| **Current ingredient stock** | `matter` (`type='stock'`) | Qty decremented on every sale |
| **Active table orders** | `matter` (`type='order'`, status=`open`) | Items added/removed until bill is closed |
| **Active takeaway orders** | `matter` (`type='order'`, status=`pending/preparing`) | Status changes through lifecycle |
| **Active delivery orders** | `matter` (`type='order'`, status=`assigned/en-route`) | Driver assignment, ETA updates |
| **Staff roster / shifts** | `matter` (`type='staff'`) | Assignments change daily |
| **Table layout / floor plan** | `matter` (`type='table'`) | Seats, merge/split, status (`free/occupied`) |
| **Reservations** | `matter` (`type='reservation'`) | Edited, cancelled, seated |
| **Active tasks** | `task` | Assigned, reassigned, edited |
| **Workspace settings** | `matter` (`type='config'`) | Hours, tax rate, printer config |

---

### 🔵 S2.dev — Immutable Event Streams

These are **facts that happened**. Written once, never updated. Streamed directly from device to S2 — Worker not in the hot path.

| Event | S2 Stream | Trigger |
|---|---|---|
| **Bill closed / payment received** | `ws/{id}/sales` | POS cashier closes table |
| **Kitchen ticket fired** | `ws/{id}/kitchen` | Waiter sends order to kitchen |
| **Item voided** | `ws/{id}/voids` | Manager voids a line item |
| **Order status transition** | `ws/{id}/motion` | `pending → preparing → ready → delivered` |
| **Driver GPS location** | `drivers/{driverId}` | Driver app, every 5s during delivery |
| **Staff clock-in / clock-out** | `ws/{id}/attendance` | Staff taps in/out |
| **Stock adjustment event** | `ws/{id}/stock-log` | Delta: "used 2kg flour for order #42" |
| **Reservation seated / no-show** | `ws/{id}/reservations` | Host marks outcome |
| **Customer feedback / rating** | `ws/{id}/feedback` | Post-delivery or post-meal submission |

> **Stream naming convention:** permanent streams. 1 per workspace per event type. Never deleted — S2 retention handles expiry.

---

### 🟠 S3 Parquet — Historical Archive

The nightly cron job (Cloudflare Cron Trigger) tails each S2 stream, batches records, and writes compressed Parquet files to Railway S3. DuckDB WASM on the client queries these directly.

| S2 Stream | S3 Path | DuckDB use case |
|---|---|---|
| `ws/{id}/sales` | `{id}/analytics/sales/YYYY-MM.parquet` | Revenue by day / item / staff |
| `ws/{id}/kitchen` | `{id}/analytics/kitchen/YYYY-MM.parquet` | Avg ticket time, busy hours |
| `ws/{id}/voids` | `{id}/analytics/voids/YYYY-MM.parquet` | Void rate by staff, patterns |
| `ws/{id}/motion` | `{id}/analytics/orders/YYYY-MM.parquet` | Order lifecycle durations |
| `ws/{id}/stock-log` | `{id}/analytics/stock/YYYY-MM.parquet` | Consumption trends, waste |
| `ws/{id}/attendance` | `{id}/analytics/staff/YYYY-MM.parquet` | Hours worked, attendance patterns |
| `ws/{id}/feedback` | `{id}/analytics/feedback/YYYY-MM.parquet` | Rating trends, NPS over time |
| `drivers/{id}` (GPS) | `{id}/analytics/delivery/YYYY-MM.parquet` | Route replay, delivery duration |

> **Cron schedule:** Daily at midnight. Tails from last checkpoint stored in D1.
> **Retention:** S2 streams keep 7 days. Parquet in S3 is permanent.

---

## Order Lifecycle (Dine-in)

```
Waiter creates order
       │
       ▼
matter (type='order', status='open')   ← Turso (mutable)
       │
       ├── Waiter adds items → UPDATE matter (Turso)
       ├── Kitchen ticket fired → append to ws/{id}/kitchen (S2)
       │
       ▼
Bill closed / payment taken
       │
       ├── UPDATE matter status='closed'     → Turso (final state)
       ├── Append sale record                → ws/{id}/sales (S2)
       ├── Append stock delta events         → ws/{id}/stock-log (S2)
       └── UPDATE matter stock qty = qty - N → Turso (atomic)
```

## Order Lifecycle (Delivery)

```
Customer places order
       │
       ▼
matter (type='order', status='pending')   ← Turso
       │
       ├── status='preparing'  → UPDATE Turso + append ws/{id}/motion (S2)
       ├── status='assigned'   → UPDATE Turso + write driver token for S2 stream
       ├── Driver GPS updates  → append drivers/{driverId} (S2) every 5s
       ├── status='delivered'  → UPDATE Turso + append ws/{id}/motion (S2)
       │
       └── Bill finalized
             ├── Append sale → ws/{id}/sales (S2)
             └── Append stock delta → ws/{id}/stock-log (S2)
```

---

## Write Path Rules (Restaurant)

| Write type | Path |
|---|---|
| Stock deduction (sale) | Via Worker `POST /tools/update` → atomic `UPDATE matter SET qty = qty - N WHERE qty >= N` |
| New menu item / price edit | Direct to local replica → Turso sync push |
| Payment / closed bill | Local → `ws/{id}/sales` S2 stream (Worker issues token once) |
| Kitchen ticket | Direct from POS device → `ws/{id}/kitchen` S2 stream |
| Staff clock-in | Direct from staff device → `ws/{id}/attendance` S2 stream |
| GPS location | Direct from driver app → `drivers/{driverId}` S2 stream |
| Draft menu / layout edits | Local-only `p:` DB only — synced to Turso on Publish |

---

## Token Strategy

| Device / Role | Turso Access | S2 Access |
|---|---|---|
| **Worker** | Full group token (`tar-workspaces`) | Create streams, issue tokens |
| **Owner** | Full scoped token (read/write/delete) | All streams in workspace |
| **Waiter / POS** | `data_read`, `matter:data_update`, `motion:data_add` | Write to `sales`, `kitchen`, `motion` streams |
| **Kitchen display** | `data_read` only | Read from `kitchen` stream |
| **Driver app** | `data_read` (assigned order only) | Write to `drivers/{self}` stream only |
| **Customer** | None (public order status endpoint) | Read from `drivers/{driverId}` stream (delivery window only) |

---

## Analytics Queries (DuckDB WASM, client-side)

These run **on-device** against Parquet files in S3 — zero server cost.

```sql
-- Daily revenue
SELECT date(fired_at) as day, SUM(total) as revenue
FROM read_parquet('s3://railway/{id}/analytics/sales/2026-07.parquet')
GROUP BY 1 ORDER BY 1;

-- Top selling items this month
SELECT item_name, SUM(qty) as sold
FROM read_parquet('s3://railway/{id}/analytics/sales/2026-07.parquet')
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- Average kitchen ticket time
SELECT AVG(epoch(ready_at) - epoch(fired_at)) / 60 as avg_minutes
FROM read_parquet('s3://railway/{id}/analytics/kitchen/2026-07.parquet');

-- Staff hours this week
SELECT staff_id, SUM(duration_minutes) as total_minutes
FROM read_parquet('s3://railway/{id}/analytics/staff/2026-07.parquet')
WHERE date(clock_in) >= current_date - INTERVAL 7 DAYS
GROUP BY 1;
```

---

## Cron Handler Responsibilities

The Cloudflare Cron Trigger runs daily and handles:

1. **S2 → Parquet archival** — tail all workspace streams from last checkpoint, write Parquet to S3, update D1 checkpoint
2. **Expired reservations** — query Turso for reservations past `expected_time` with no update → mark `no-show`
3. **Abandoned orders** — open orders older than 4 hours → flag for review
4. **Stock low alerts** — query Turso for `qty < reorder_threshold` → push notification to owner

---

## Skill Summary

| Question | Answer |
|---|---|
| Where is the live menu? | Turso `matter` table |
| Where is current stock level? | Turso `matter` table |
| Where do completed sales go? | S2 stream → S3 Parquet |
| Where do GPS updates go? | S2 stream (`drivers/{id}`) |
| Where do kitchen tickets go? | S2 stream (`ws/{id}/kitchen`) |
| Where do analytics queries run? | On-device (DuckDB WASM) against S3 Parquet |
| Does the Worker handle GPS? | No — device writes directly to S2 |
| Does the Worker handle kitchen tickets? | No — POS writes directly to S2 |
| What does the Worker do? | Atomic stock writes, workspace provisioning, timeline API, cron archival |
