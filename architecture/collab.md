# Collaboration Architecture: Shared Streams

How multiple tenants collaborate on a shared order/transaction using the Universal Schema.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│              TURSO MANAGED CLOUD (Public Discovery DB)            │
│              nodes + points — discovery & search only             │
│              NO events · NO sync to local                         │
└──────────────────────────┬────────────────────────────────────────┘
                           │
┌──────────────────────────┼────────────────────────────────────────┐
│                    OVH VPS 6 (Self-Hosted LibSQL)                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              STREAMS NAMESPACE (shared)                      │  │
│  │              events table only · ~100 MB active buffer       │  │
│  │              ALL collaborators read from here                │  │
│  │              archived to Railway S3 on completion → deleted  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ tenant-a   │  │ tenant-b   │  │ tenant-c   │  │ 220K+     │  │
│  │ nodes      │  │ nodes      │  │ nodes      │  │ tenants   │  │
│  │ points     │  │ points     │  │ points     │  │   ...     │  │
│  │ (no events)│  │ (no events)│  │ (no events)│  │           │  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │
└───────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┴────────────────────────────────────────┐
│              RAILWAY S3 (Cold Archive)                             │
│              Completed streams archived as JSON                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Three Layers

| Layer                                      | What lives here                           | Purpose                                                                 |
| :----------------------------------------- | :---------------------------------------- | :---------------------------------------------------------------------- |
| **Turso Cloud** (Public Discovery DB)      | `nodes` + `points` with `workspaceId`     | Global search, filtering, nearest-driver. Discovery only.               |
| **Self-Hosted LibSQL** — Tenant Namespaces | `nodes` + `points` (no events) per tenant | Profile, catalog, stock levels, GPS position. Local-first.              |
| **Self-Hosted LibSQL** — Streams Namespace | `events` table only                       | Shared collaboration log. One write per event, all collaborators read.  |
| **Railway S3**                             | Archived stream JSON                      | Cold storage. Completed streams persisted, then deleted from active DB. |

---

## How Streams Work

A **stream** is a collaboration between multiple tenants on a shared transaction (order, ride, booking, delivery). All events are written **once** to the shared `streams` namespace and read by every collaborator.

```
CF Worker receives API call
        │
        ├─→ WRITE tenant DB(s) — nodes + points (catalog, stock, GPS)
        │
        ├─→ WRITE streams DB — ONE event (shared, readable by all)
        │
        └─→ WRITE Turso cloud — only if discovery state changed (rare)
```

### Rules

| Rule                                       | Detail                                                                   |
| :----------------------------------------- | :----------------------------------------------------------------------- |
| **One write per event**                    | Events go to streams namespace only — no duplication across tenants      |
| **All collaborators read the same stream** | `GET /api/streams/:id` returns the same event log for everyone           |
| **Tenant DBs store state, not events**     | Nodes = entities, Points = live mutable state (stock, GPS, availability) |
| **High-frequency actions stay local**      | GPS pings update driver's tenant points only — never touch streams DB    |
| **Streams are ephemeral**                  | Archived to Railway S3 on completion, deleted from active DB             |
| **Turso cloud writes are rare**            | Only on discovery state changes (driver on/off, menu publish)            |

---

## CF Worker Setup

```js
import { createClient } from "@libsql/client/web";

const LIBSQL_URL = "https://libsql.yourserver.com";

// Per-tenant namespace — nodes + points
function getTenantDb(tenantId) {
  return createClient({
    url: `${LIBSQL_URL}/${tenantId}`,
    authToken: env.LIBSQL_TOKEN,
  });
}

// Shared streams namespace — all collaboration events
const streamsDb = createClient({
  url: `${LIBSQL_URL}/streams`,
  authToken: env.LIBSQL_TOKEN,
});

// Turso managed cloud — public discovery
const publicDb = createClient({
  url: "libsql://discovery-yourorg.turso.io",
  authToken: env.TURSO_TOKEN,
});
```

---

## Reading a Stream

All collaborators call the same endpoint, get the same full event log:

```js
// GET /api/streams/:id
export async function handleGetStream(req, env) {
  const { streamId } = req.params;

  const events = await streamsDb.execute({
    sql: `SELECT * FROM events WHERE streamId = ? ORDER BY ts`,
    args: [streamId],
  });

  return Response.json(events.rows);
}
```

---

## Archiving a Completed Stream

Once a stream is settled (order delivered, ride completed, booking checked-out), archive and delete:

```js
export async function archiveStream(streamId) {
  // 1. Read all events
  const events = await streamsDb.execute({
    sql: `SELECT * FROM events WHERE streamId = ? ORDER BY ts`,
    args: [streamId],
  });

  // 2. Archive to Railway S3
  await s3.putObject({
    Bucket: "streams-archive",
    Key: `${streamId}.json`,
    Body: JSON.stringify(events.rows),
  });

  // 3. Delete from active streams DB
  await streamsDb.execute({
    sql: `DELETE FROM events WHERE streamId = ?`,
    args: [streamId],
  });
}
```

> The active streams DB never grows beyond ~100 MB — it's a **hot buffer**, not a warehouse.

---

## When Does Turso Cloud Get Updated?

The Public Discovery DB is for search and matching — not for live tracking or event logs.

| Trigger                            | What updates                                       |
| :--------------------------------- | :------------------------------------------------- |
| Merchant publishes/edits a product | `nodes` + `points` (price, description)            |
| Merchant opens/closes for the day  | `points.openNow` toggled                           |
| Driver starts shift                | `points.openNow = true`, location updated          |
| Driver ends shift                  | `points.openNow = false`                           |
| Driver completes a delivery/ride   | `points` location updated (available for next job) |
| Stock falls below threshold        | `points.availability` updated                      |

**NOT updated on:** individual GPS pings, stream events, payment events, kitchen tasks.

---

## Stream Types (Examples)

The same stream architecture handles all commerce verticals:

| Stream Type           | Collaborators                      | Typical Events | Avg Duration |
| :-------------------- | :--------------------------------- | -------------: | :----------- |
| 🍔 Food delivery      | Customer + Restaurant + Driver     |            ~12 | 30-60 min    |
| 🚕 Taxi ride          | Passenger + Driver                 |             ~8 | 15-45 min    |
| 🛒 Grocery delivery   | Customer + Store + Picker + Driver |            ~10 | 1-3 hrs      |
| 📦 E-commerce package | Buyer + Seller + Courier           |            ~10 | 1-7 days     |
| 🔧 Service booking    | Customer + Service Provider        |             ~8 | 1-4 hrs      |
| 🏠 Rental/property    | Guest + Host                       |             ~6 | 1-30 days    |

> See [foodorder.md](./foodorder.md) for a complete food delivery example with CF Worker code.

---

## Why Self-Hosted LibSQL?

Turso managed cloud pricing:

- **Sync:** $0.25 per GB
- **Writes:** $1 per 1 million rows
- **Reads:** $1 per 1 billion reads

At scale, high-frequency writes (GPS pings, stream events) would cost lakhs on Turso. Self-hosted LibSQL has zero per-row cost — only the VPS fee.

---

## Operational Cost: Chennai Scale (10M Population)

### Scale Parameters

| Metric                                                    |           Value |
| :-------------------------------------------------------- | --------------: |
| Population                                                |      10 million |
| Active merchants (all commerce)                           |         200,000 |
| Active riders/drivers                                     |          20,000 |
| Streams per day (food + taxi + grocery + ecom + services) |      ~1,000,000 |
| **Streams per month**                                     | **~30 million** |
| Events per stream (avg)                                   |             ~10 |
| Total stream events/month                                 |    ~300 million |
| GPS pings/month (20K drivers × 10hrs × 360/hr)            |   ~2.16 billion |

### Streams DB Lifecycle

| State                  |                   Streams |         Size | Duration         |
| :--------------------- | ------------------------: | -----------: | :--------------- |
| Active (in-progress)   |                 ~50K-100K |  **~100 MB** | 30 min - few hrs |
| Archived (Railway S3)  |                 30M/month | ~60 GB/month | Permanent        |
| Deleted from active DB | Immediately after archive |            0 | —                |

### Monthly Infrastructure Cost

| Component                | Service                        | What it handles                                                                      |      Monthly Cost |
| :----------------------- | :----------------------------- | :----------------------------------------------------------------------------------- | ----------------: |
| **Tenant DBs + Streams** | OVH VPS 6 (self-hosted LibSQL) | 220K tenant namespaces + streams namespace. Nodes, points, GPS, stream events.       |        **₹2,500** |
| **Discovery DB**         | Turso managed cloud            | Public nodes + points. ~62M writes/month (menu edits + driver on/off + 2 per order). |        **₹5,200** |
| **Cold Archive**         | Railway S3                     | Completed streams as JSON. ~60 GB/month, ~720 GB/year.                               |          **₹200** |
| **API Layer**            | Cloudflare Workers             | Orchestration, routing, auth. Free tier covers 100K req/day.                         |     **₹0 - ₹400** |
|                          |                                | **Total**                                                                            | **~₹8,300/month** |

### Turso Cloud Write Breakdown

| Trigger                                  |     Writes/month |
| :--------------------------------------- | ---------------: |
| Menu edits (200K merchants × 5/month)    |              ~1M |
| Driver shift on/off (20K × 2/day × 30)   |            ~1.2M |
| Driver assigned per order (1M/day × 30)  |             ~30M |
| Driver delivered per order (1M/day × 30) |             ~30M |
| **Total Turso writes**                   |         **~62M** |
| **Cost** ($1 per 1M writes)              | **$62 = ₹5,200** |

### Cost Per Transaction

```
₹8,300/month ÷ 30M streams/month = ₹0.00028 per order

That's roughly 1 paisa per 36 orders.
```

### If Everything Was on Turso Cloud Instead

| Item                     |                Cost |
| :----------------------- | ------------------: |
| 300M stream event writes |             ₹25,000 |
| 2.16B GPS writes         |           ₹1,80,000 |
| Storage (500+ GB)        |             ₹10,000 |
| **Turso total**          | **₹2,15,000/month** |
| **Your architecture**    |    **₹8,300/month** |
| **Savings**              |    **~26x cheaper** |
