# Collaboration Flow: Food Delivery

A complete end-to-end example showing how the Universal Schema handles a food delivery order across **multiple tenant databases** — each participant (customer, restaurant, rider) has their own isolated DB, while the Public Discovery DB on Turso cloud handles global search.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│              TURSO MANAGED CLOUD (Public Discovery DB)            │
│              nodes + points only — discovery & search             │
│              NO live tracking, NO events, NO sync to local        │
│                                                                   │
│  Cost: $0.25/GB sync · $1/1M writes · $1/1B reads                │
│  → Only low-frequency discovery data lives here                   │
└──────────┬───────────────────┬───────────────────┬────────────────┘
           │                   │                   │
    ┌──────┴──────┐    ┌───────┴──────┐    ┌───────┴──────┐
    │ ali.db      │    │ bab-hara.db  │    │ rami.db      │
    │ (Customer)  │    │ (Restaurant) │    │ (Rider)      │
    │             │    │              │    │              │
    │ nodes       │    │ nodes        │    │ nodes        │
    │ points      │    │ points       │    │ points       │
    │ events      │    │ events       │    │ events       │
    └─────────────┘    └──────────────┘    └──────────────┘
         SELF-HOSTED LIBSQL (per-tenant namespace)
         Local-first · High-frequency events stay here
         No per-row cost · No sync cost
```

### Why Self-Hosted LibSQL for Tenant DBs?

Turso managed cloud charges:

- **Sync:** $0.25 per GB
- **Writes:** $1 per 1 million rows
- **Reads:** $1 per 1 billion row reads

Since `events` are high-frequency (GPS pings, stock changes, task updates), putting them on Turso cloud would be expensive. By self-hosting LibSQL with a namespace per tenant, all events, nodes, and points stay local-first with zero per-row cost. The Public Discovery DB on Turso cloud only handles low-frequency discovery queries — no live tracking data.

---

### When Does the Public Discovery DB Get Updated?

The Public DB is **NOT** for live tracking. It is updated only on **low-frequency business state changes**:

| Trigger                                | What updates in Public DB                          |
| :------------------------------------- | :------------------------------------------------- |
| Restaurant publishes/edits a menu item | `nodes` + `points` (price, description)            |
| Restaurant opens/closes for the day    | `points.openNow` toggled                           |
| Driver starts shift (goes on-work)     | `points.openNow = true`, location updated          |
| Driver ends shift (goes off-work)      | `points.openNow = false`                           |
| Driver completes a delivery            | `points` location updated (available for next job) |
| Stock falls below threshold            | `points.availability` updated                      |

**NOT updated on:** individual GPS pings, order events, kitchen tasks, payment events. Those stay in tenant DBs only.

---

## The Scenario

> **Customer Ali** (`ali.db`) orders a Chicken Shawarma + Laban from **Bab Al Hara Restaurant** (`bab-hara.db`).
> The kitchen prepares it, **Driver Rami** (`rami.db`) picks it up and delivers it to Ali.

---

## Step 0: Pre-existing Data

Before any order, each tenant already has their entities set up.

### 🏪 Restaurant Tenant DB (`bab-hara.db`)

**nodes:**

| id         | parentId  | nodeType     | title            | createdAt            | payload                                                    |
| :--------- | :-------- | :----------- | :--------------- | :------------------- | :--------------------------------------------------------- |
| `rest-01`  | `null`    | `restaurant` | Bab Al Hara      | 2026-01-10T08:00:00Z | `{"address": "Al Rigga, Dubai", "phone": "+971501234567"}` |
| `menu-01`  | `rest-01` | `collection` | Main Menu        | 2026-01-10T08:05:00Z | `{}`                                                       |
| `prod-shw` | `menu-01` | `product`    | Chicken Shawarma | 2026-01-10T08:10:00Z | `{"desc": "Grilled chicken wrap with garlic sauce"}`       |
| `prod-lbn` | `menu-01` | `product`    | Laban            | 2026-01-10T08:10:00Z | `{"desc": "Traditional buttermilk drink"}`                 |

**points:**

| id            | nodeId     |    qty |  price | currency | availability | locationText       |     lat |     lng | openNow |
| :------------ | :--------- | -----: | -----: | :------- | :----------- | :----------------- | ------: | ------: | :------ |
| `pt-shw`      | `prod-shw` |    200 |  18.00 | `AED`    | `in-stock`   | `null`             |  `null` |  `null` | `true`  |
| `pt-lbn`      | `prod-lbn` |    150 |   5.00 | `AED`    | `in-stock`   | `null`             |  `null` |  `null` | `true`  |
| `pt-rest-loc` | `rest-01`  | `null` | `null` | `null`   | `open`       | Al Rigga St, Dubai | 25.2650 | 55.3320 | `true`  |

### 👤 Customer Tenant DB (`ali.db`)

**nodes:**

| id    | parentId | nodeType   | title      | createdAt            | payload                                                                   |
| :---- | :------- | :--------- | :--------- | :------------------- | :------------------------------------------------------------------------ |
| `ali` | `null`   | `customer` | Ali Hassan | 2026-02-20T12:00:00Z | `{"phone": "+971559876543", "address": "Marina Walk, Tower 3, Apt 1204"}` |

**points:**

| id           | nodeId |    qty |  price | currency | availability | locationText       |     lat |     lng | openNow |
| :----------- | :----- | -----: | -----: | :------- | :----------- | :----------------- | ------: | ------: | :------ |
| `pt-ali-loc` | `ali`  | `null` | `null` | `null`   | `null`       | Marina Walk, Dubai | 25.0780 | 55.1350 | `null`  |

### 🏍️ Rider Tenant DB (`rami.db`)

**nodes:**

| id     | parentId | nodeType | title   | createdAt            | payload                                            |
| :----- | :------- | :------- | :------ | :------------------- | :------------------------------------------------- |
| `rami` | `null`   | `driver` | Rami K. | 2026-02-01T09:00:00Z | `{"vehicle": "Motorcycle", "license": "DXB-4421"}` |

**points:**

| id            | nodeId |    qty |  price | currency | availability | locationText  |     lat |     lng | openNow |
| :------------ | :----- | -----: | -----: | :------- | :----------- | :------------ | ------: | ------: | :------ |
| `pt-rami-loc` | `rami` | `null` | `null` | `null`   | `idle`       | Near Al Rigga | 25.2640 | 55.3310 | `true`  |

### 🌐 Public Discovery DB — Turso Cloud (pre-existing)

**nodes:** (`workspaceId` identifies the owner)

| id         | workspaceId | parentId  | nodeType     | title            | payload                              |
| :--------- | :---------- | :-------- | :----------- | :--------------- | :----------------------------------- |
| `rest-01`  | `bab-hara`  | `null`    | `restaurant` | Bab Al Hara      | `{"address": "Al Rigga, Dubai"}`     |
| `prod-shw` | `bab-hara`  | `menu-01` | `product`    | Chicken Shawarma | `{"desc": "Grilled chicken wrap"}`   |
| `prod-lbn` | `bab-hara`  | `menu-01` | `product`    | Laban            | `{"desc": "Traditional buttermilk"}` |
| `rami`     | `rami`      | `null`    | `driver`     | Rami K.          | `{"vehicle": "Motorcycle"}`          |

**points:** (`workspaceId` identifies the owner)

| id            | nodeId     | workspaceId |    qty |  price | currency | availability |     lat |     lng | openNow |
| :------------ | :--------- | :---------- | -----: | -----: | :------- | :----------- | ------: | ------: | :------ |
| `pt-shw`      | `prod-shw` | `bab-hara`  |    200 |  18.00 | `AED`    | `in-stock`   |  `null` |  `null` | `true`  |
| `pt-lbn`      | `prod-lbn` | `bab-hara`  |    150 |   5.00 | `AED`    | `in-stock`   |  `null` |  `null` | `true`  |
| `pt-rest-loc` | `rest-01`  | `bab-hara`  | `null` | `null` | `null`   | `open`       | 25.2650 | 55.3320 | `true`  |
| `pt-rami-loc` | `rami`     | `rami`      | `null` | `null` | `null`   | `idle`       | 25.2640 | 55.3310 | `true`  |

---

## Step 1: 🛒 Customer Places Order

Ali browses the **Public Discovery DB** (Turso cloud), finds Chicken Shawarma, and places an order.

### `ali.db` — new order node + event

```sql
INSERT INTO nodes (id, parentId, nodeType, title, createdAt, payload) VALUES (
  'ord-5001', NULL, 'order', 'Order #5001',
  '2026-02-22T12:30:00Z',
  '{"restaurant": "bab-hara", "items": [{"id": "prod-shw", "qty": 2, "price": 18.00}, {"id": "prod-lbn", "qty": 1, "price": 5.00}], "subtotal": 41.00, "deliveryFee": 5.00, "total": 46.00, "notes": "Extra garlic sauce please"}'
);

INSERT INTO events VALUES (
  'evt-a001', 'ord-5001', 501, 'ord-5001', NULL, 46.00,
  '{"channel": "app", "restaurant": "bab-hara"}',
  '2026-02-22T12:30:00Z'
);
```

### `bab-hara.db` — restaurant receives the order

```sql
INSERT INTO nodes (id, parentId, nodeType, title, createdAt, payload) VALUES (
  'ord-5001', NULL, 'order', 'Order #5001 - Ali',
  '2026-02-22T12:30:00Z',
  '{"customer": "ali", "items": [{"id": "prod-shw", "qty": 2}, {"id": "prod-lbn", "qty": 1}], "total": 46.00, "deliveryAddress": "Marina Walk, Tower 3, Apt 1204", "notes": "Extra garlic sauce please"}'
);

INSERT INTO events VALUES (
  'evt-r001', 'ord-5001', 501, 'ord-5001', NULL, 46.00,
  '{"source": "ali", "channel": "app"}',
  '2026-02-22T12:30:01Z'
);
```

> No Public DB update — orders are private.

---

## Step 2: 🧾 Payment Processed

### `ali.db` — invoice + payment events

```sql
INSERT INTO events VALUES (
  'evt-a002', 'ord-5001', 201, 'ord-5001', NULL, 46.00,
  '{"invoiceRef": "inv-8801", "currency": "AED"}',
  '2026-02-22T12:30:05Z'
);

INSERT INTO events VALUES (
  'evt-a003', 'ord-5001', 203, 'ord-5001', NULL, 46.00,
  '{"method": "card", "cardLast4": "4242", "stripeId": "ch_abc123"}',
  '2026-02-22T12:30:10Z'
);
```

### `bab-hara.db` — restaurant sees payment confirmed

```sql
INSERT INTO events VALUES (
  'evt-r002', 'ord-5001', 203, 'ord-5001', NULL, 46.00,
  '{"status": "paid", "method": "card"}',
  '2026-02-22T12:30:10Z'
);
```

> No Public DB update — payment events are private.

---

## Step 3: 🍳 Restaurant Accepts → Kitchen Starts

### `bab-hara.db` — kitchen task events

```sql
-- Restaurant accepts
INSERT INTO events VALUES (
  'evt-r003', 'ord-5001', 301, 'ord-5001', NULL, 0,
  '{"task": "kitchen-prep", "acceptedBy": "rest-01", "estMinutes": 15}',
  '2026-02-22T12:31:00Z'
);

-- Chef starts cooking
INSERT INTO events VALUES (
  'evt-r004', 'ord-5001', 303, 'ord-5001', NULL, 0,
  '{"task": "kitchen-prep", "chef": "Hassan", "station": "grill"}',
  '2026-02-22T12:32:00Z'
);
```

### `ali.db` — customer sees status update

```sql
INSERT INTO events VALUES (
  'evt-a004', 'ord-5001', 303, 'ord-5001', NULL, 0,
  '{"status": "preparing", "estMinutes": 15}',
  '2026-02-22T12:32:00Z'
);
```

> No Public DB update — kitchen events are private.

---

## Step 4: 📦 Stock Deducted

### `bab-hara.db` — inventory events + point updates

```sql
-- Shawarma ×2 sold
INSERT INTO events VALUES (
  'evt-r005', 'ord-5001', 102, 'prod-shw', 'pt-shw', -2,
  '{"reason": "order-sale", "orderId": "ord-5001"}',
  '2026-02-22T12:32:05Z'
);
UPDATE points SET qty = 198 WHERE id = 'pt-shw';

-- Laban ×1 sold
INSERT INTO events VALUES (
  'evt-r006', 'ord-5001', 102, 'prod-lbn', 'pt-lbn', -1,
  '{"reason": "order-sale", "orderId": "ord-5001"}',
  '2026-02-22T12:32:06Z'
);
UPDATE points SET qty = 149 WHERE id = 'pt-lbn';
```

> Public DB stock update is **optional/batched** — only if a threshold is crossed (e.g. out-of-stock). Individual sale decrements don't need to hit Turso cloud in real-time.

---

## Step 5: ✅ Kitchen Done

### `bab-hara.db`

```sql
INSERT INTO events VALUES (
  'evt-r007', 'ord-5001', 305, 'ord-5001', NULL, 0,
  '{"task": "kitchen-prep", "chef": "Hassan", "actualMinutes": 12}',
  '2026-02-22T12:43:00Z'
);
```

### `ali.db` — customer notified

```sql
INSERT INTO events VALUES (
  'evt-a005', 'ord-5001', 305, 'ord-5001', NULL, 0,
  '{"status": "ready-for-pickup"}',
  '2026-02-22T12:43:00Z'
);
```

---

## Step 6: 🏍️ Driver Assigned

### `rami.db` — rider receives delivery task

```sql
INSERT INTO nodes (id, parentId, nodeType, title, createdAt, payload) VALUES (
  'ord-5001', NULL, 'delivery', 'Delivery #5001',
  '2026-02-22T12:43:30Z',
  '{"restaurant": "bab-hara", "customer": "ali", "pickupAddress": "Al Rigga St", "deliverTo": "Marina Walk, Tower 3, Apt 1204", "estMinutes": 20}'
);

INSERT INTO events VALUES (
  'evt-d001', 'ord-5001', 302, 'rami', NULL, 0,
  '{"task": "delivery", "pickupFrom": "rest-01"}',
  '2026-02-22T12:43:30Z'
);

UPDATE points SET availability = 'en-route-pickup', openNow = false WHERE id = 'pt-rami-loc';
```

### `bab-hara.db` — restaurant sees driver assigned

```sql
INSERT INTO events VALUES (
  'evt-r008', 'ord-5001', 302, 'ord-5001', NULL, 0,
  '{"driver": "rami", "eta": 5}',
  '2026-02-22T12:43:30Z'
);
```

### `ali.db` — customer sees driver assigned

```sql
INSERT INTO events VALUES (
  'evt-a006', 'ord-5001', 302, 'ord-5001', NULL, 0,
  '{"driver": "rami", "vehicle": "Motorcycle", "eta": 25}',
  '2026-02-22T12:43:30Z'
);
```

### Turso Cloud (Public DB) — driver no longer available for discovery

```sql
-- Driver is now busy, mark as unavailable for other jobs
UPDATE points SET openNow = false WHERE id = 'pt-rami-loc' AND workspaceId = 'rami';
```

> This is the **only** Public DB write during the active delivery. Driver GPS tracking happens in `rami.db` only — no Turso cloud cost for GPS pings.

---

## Step 7: 📍 Driver En Route — Live GPS

### `rami.db` — GPS pings (events + point overwrite, local only)

```sql
-- Ping #1: heading to restaurant
INSERT INTO events VALUES (
  'evt-d002', 'ord-5001', 605, 'rami', 'pt-rami-loc', 0,
  '{"heading": 45, "speed": 35}',
  '2026-02-22T12:44:00Z'
);
UPDATE points SET lat = 25.2645, lng = 55.3315 WHERE id = 'pt-rami-loc';

-- Ping #2: arrived at restaurant
INSERT INTO events VALUES (
  'evt-d003', 'ord-5001', 605, 'rami', 'pt-rami-loc', 0,
  '{"heading": 0, "speed": 0}',
  '2026-02-22T12:48:00Z'
);
UPDATE points SET lat = 25.2650, lng = 55.3320 WHERE id = 'pt-rami-loc';
```

> **No Public DB update.** All GPS pings stay in `rami.db`. Live tracking is served from the self-hosted LibSQL — zero Turso cost.

---

## Step 8: 🚚 Pickup Confirmed

### `rami.db`

```sql
INSERT INTO events VALUES (
  'evt-d004', 'ord-5001', 502, 'ord-5001', NULL, 0,
  '{"confirmedItems": 3, "pickupLocation": "rest-01"}',
  '2026-02-22T12:49:00Z'
);
UPDATE points SET availability = 'en-route-delivery' WHERE id = 'pt-rami-loc';
```

### `bab-hara.db` — restaurant confirms handoff

```sql
INSERT INTO events VALUES (
  'evt-r009', 'ord-5001', 502, 'ord-5001', NULL, 0,
  '{"pickedUpBy": "rami", "handoffConfirmed": true}',
  '2026-02-22T12:49:00Z'
);
```

### `ali.db` — customer notified

```sql
INSERT INTO events VALUES (
  'evt-a007', 'ord-5001', 502, 'ord-5001', NULL, 0,
  '{"status": "on-the-way", "driver": "rami", "eta": 16}',
  '2026-02-22T12:49:00Z'
);
```

> No Public DB update.

---

## Step 9: 📍 Driver Delivers — More GPS Pings

### `rami.db` (local only)

```sql
-- Mid-journey
INSERT INTO events VALUES (
  'evt-d005', 'ord-5001', 605, 'rami', 'pt-rami-loc', 0,
  '{"heading": 220, "speed": 40}',
  '2026-02-22T12:55:00Z'
);
UPDATE points SET lat = 25.0800, lng = 55.1400 WHERE id = 'pt-rami-loc';

-- Arrived at customer
INSERT INTO events VALUES (
  'evt-d006', 'ord-5001', 605, 'rami', 'pt-rami-loc', 0,
  '{"heading": 0, "speed": 0}',
  '2026-02-22T13:05:00Z'
);
UPDATE points SET lat = 25.0780, lng = 55.1350 WHERE id = 'pt-rami-loc';
```

> No Public DB update. GPS stays local.

---

## Step 10: ✅ Order Delivered

### `rami.db` — driver confirms delivery

```sql
INSERT INTO events VALUES (
  'evt-d007', 'ord-5001', 503, 'ord-5001', NULL, 0,
  '{"deliveredTo": "ali", "deliveryLat": 25.0780, "deliveryLng": 55.1350}',
  '2026-02-22T13:05:30Z'
);

INSERT INTO events VALUES (
  'evt-d008', 'ord-5001', 305, 'rami', NULL, 0,
  '{"task": "delivery", "actualMinutes": 22}',
  '2026-02-22T13:05:30Z'
);

UPDATE points SET availability = 'idle', openNow = true, lat = 25.0780, lng = 55.1350,
  locationText = 'Marina Walk, Dubai' WHERE id = 'pt-rami-loc';
```

### `ali.db` — customer confirms receipt

```sql
INSERT INTO events VALUES (
  'evt-a008', 'ord-5001', 503, 'ord-5001', NULL, 0,
  '{"status": "delivered", "totalMinutes": 35}',
  '2026-02-22T13:05:30Z'
);
```

### `bab-hara.db` — restaurant sees completion

```sql
INSERT INTO events VALUES (
  'evt-r010', 'ord-5001', 503, 'ord-5001', NULL, 0,
  '{"status": "completed", "deliveredBy": "rami"}',
  '2026-02-22T13:05:30Z'
);
```

### Turso Cloud (Public DB) — driver available again for discovery

```sql
-- Delivery done → driver is discoverable again with updated location
UPDATE points SET openNow = true, availability = 'idle',
  lat = 25.0780, lng = 55.1350
  WHERE id = 'pt-rami-loc' AND workspaceId = 'rami';
```

> This is the **second and final** Public DB write for this order. Driver's new location is published so the system can assign him to the next nearby job.

---

## Step 11: 💰 Payouts

### `rami.db` — driver earnings

```sql
INSERT INTO events VALUES (
  'evt-d009', 'ord-5001', 402, 'rami', NULL, 12.00,
  '{"type": "delivery-fee", "currency": "AED", "orderId": "ord-5001"}',
  '2026-02-22T13:06:00Z'
);
```

### `bab-hara.db` — restaurant earnings

```sql
INSERT INTO events VALUES (
  'evt-r011', 'ord-5001', 401, 'rest-01', NULL, 34.00,
  '{"type": "order-revenue", "currency": "AED", "orderId": "ord-5001"}',
  '2026-02-22T13:06:00Z'
);
```

> No Public DB update — financial events are private.

---

## What Each Tenant DB Sees (Final State)

> After the complete order flow, this is what `SELECT * FROM ...` returns in each DB.

---

### 👤 `ali.db` — Customer Perspective

Ali sees: his profile, his order, and a timeline of status updates. He does NOT see kitchen details, stock counts, or driver GPS history.

**`SELECT * FROM nodes;`** — 2 rows

| id         | parentId | nodeType   | title       | createdAt            | payload                                                                   |
| :--------- | :------- | :--------- | :---------- | :------------------- | :------------------------------------------------------------------------ |
| `ali`      | `null`   | `customer` | Ali Hassan  | 2026-02-20T12:00:00Z | `{"phone": "+971559876543", "address": "Marina Walk, Tower 3, Apt 1204"}` |
| `ord-5001` | `null`   | `order`    | Order #5001 | 2026-02-22T12:30:00Z | `{"restaurant": "bab-hara", "items": [...], "total": 46.00}`              |

**`SELECT * FROM points;`** — 1 row

| id           | nodeId | availability | locationText       |     lat |     lng |
| :----------- | :----- | :----------- | :----------------- | ------: | ------: |
| `pt-ali-loc` | `ali`  | `null`       | Marina Walk, Dubai | 25.0780 | 55.1350 |

**`SELECT * FROM events WHERE streamId = 'ord-5001' ORDER BY ts;`** — 8 events

|   # | id         | opcode | Name            | payload                                                  | ts       |
| --: | :--------- | -----: | :-------------- | :------------------------------------------------------- | :------- |
|   1 | `evt-a001` |    501 | ORDER_CREATE    | `{"channel": "app", "restaurant": "bab-hara"}`           | 12:30:00 |
|   2 | `evt-a002` |    201 | INVOICE_CREATE  | `{"invoiceRef": "inv-8801", "currency": "AED"}`          | 12:30:05 |
|   3 | `evt-a003` |    203 | INVOICE_PAYMENT | `{"method": "card", "cardLast4": "4242"}`                | 12:30:10 |
|   4 | `evt-a004` |    303 | TASK_START      | `{"status": "preparing", "estMinutes": 15}`              | 12:32:00 |
|   5 | `evt-a005` |    305 | TASK_DONE       | `{"status": "ready-for-pickup"}`                         | 12:43:00 |
|   6 | `evt-a006` |    302 | TASK_ASSIGN     | `{"driver": "rami", "vehicle": "Motorcycle", "eta": 25}` | 12:43:30 |
|   7 | `evt-a007` |    502 | ORDER_SHIP      | `{"status": "on-the-way", "driver": "rami", "eta": 16}`  | 12:49:00 |
|   8 | `evt-a008` |    503 | ORDER_DELIVER   | `{"status": "delivered", "totalMinutes": 35}`            | 13:05:30 |

---

### 🏪 `bab-hara.db` — Restaurant Perspective

**`SELECT * FROM nodes;`** — 5 rows (restaurant + menu + products + order)

**`SELECT * FROM points;`** — 3 rows (stock updated: Shawarma 198, Laban 149)

**`SELECT * FROM events WHERE streamId = 'ord-5001' ORDER BY ts;`** — 11 events

|   # | id         | opcode | Name            | nodeId     | pointId  | delta | payload                                      | ts       |
| --: | :--------- | -----: | :-------------- | :--------- | :------- | ----: | :------------------------------------------- | :------- |
|   1 | `evt-r001` |    501 | ORDER_CREATE    | `ord-5001` | —        | 46.00 | `{"source": "ali", "channel": "app"}`        | 12:30:01 |
|   2 | `evt-r002` |    203 | INVOICE_PAYMENT | `ord-5001` | —        | 46.00 | `{"status": "paid", "method": "card"}`       | 12:30:10 |
|   3 | `evt-r003` |    301 | TASK_CREATE     | `ord-5001` | —        |     0 | `{"task": "kitchen-prep", "estMinutes": 15}` | 12:31:00 |
|   4 | `evt-r004` |    303 | TASK_START      | `ord-5001` | —        |     0 | `{"chef": "Hassan", "station": "grill"}`     | 12:32:00 |
|   5 | `evt-r005` |    102 | SALE_OUT        | `prod-shw` | `pt-shw` |    -2 | `{"reason": "order-sale"}`                   | 12:32:05 |
|   6 | `evt-r006` |    102 | SALE_OUT        | `prod-lbn` | `pt-lbn` |    -1 | `{"reason": "order-sale"}`                   | 12:32:06 |
|   7 | `evt-r007` |    305 | TASK_DONE       | `ord-5001` | —        |     0 | `{"chef": "Hassan", "actualMinutes": 12}`    | 12:43:00 |
|   8 | `evt-r008` |    302 | TASK_ASSIGN     | `ord-5001` | —        |     0 | `{"driver": "rami", "eta": 5}`               | 12:43:30 |
|   9 | `evt-r009` |    502 | ORDER_SHIP      | `ord-5001` | —        |     0 | `{"pickedUpBy": "rami"}`                     | 12:49:00 |
|  10 | `evt-r010` |    503 | ORDER_DELIVER   | `ord-5001` | —        |     0 | `{"deliveredBy": "rami"}`                    | 13:05:30 |
|  11 | `evt-r011` |    401 | ACCOUNT_PAYIN   | `rest-01`  | —        | 34.00 | `{"type": "order-revenue"}`                  | 13:06:00 |

---

### 🏍️ `rami.db` — Rider Perspective

**`SELECT * FROM nodes;`** — 2 rows (profile + delivery task)

**`SELECT * FROM points;`** — 1 row (final: idle, Marina Walk)

**`SELECT * FROM events WHERE streamId = 'ord-5001' ORDER BY ts;`** — 9 events

|   # | id         | opcode | Name           | nodeId     | pointId       | delta | payload                                         | ts       |
| --: | :--------- | -----: | :------------- | :--------- | :------------ | ----: | :---------------------------------------------- | :------- |
|   1 | `evt-d001` |    302 | TASK_ASSIGN    | `rami`     | —             |     0 | `{"task": "delivery", "pickupFrom": "rest-01"}` | 12:43:30 |
|   2 | `evt-d002` |    605 | MOTION         | `rami`     | `pt-rami-loc` |     0 | `{"heading": 45, "speed": 35}`                  | 12:44:00 |
|   3 | `evt-d003` |    605 | MOTION         | `rami`     | `pt-rami-loc` |     0 | `{"heading": 0, "speed": 0}`                    | 12:48:00 |
|   4 | `evt-d004` |    502 | ORDER_SHIP     | `ord-5001` | —             |     0 | `{"confirmedItems": 3}`                         | 12:49:00 |
|   5 | `evt-d005` |    605 | MOTION         | `rami`     | `pt-rami-loc` |     0 | `{"heading": 220, "speed": 40}`                 | 12:55:00 |
|   6 | `evt-d006` |    605 | MOTION         | `rami`     | `pt-rami-loc` |     0 | `{"heading": 0, "speed": 0}`                    | 13:05:00 |
|   7 | `evt-d007` |    503 | ORDER_DELIVER  | `ord-5001` | —             |     0 | `{"deliveredTo": "ali"}`                        | 13:05:30 |
|   8 | `evt-d008` |    305 | TASK_DONE      | `rami`     | —             |     0 | `{"actualMinutes": 22}`                         | 13:05:30 |
|   9 | `evt-d009` |    402 | ACCOUNT_PAYOUT | `rami`     | —             | 12.00 | `{"type": "delivery-fee"}`                      | 13:06:00 |

---

### 🌐 Public Discovery DB (Turso Cloud) — Final State

No events. Only nodes + points. **Only 2 writes happened** during the entire order.

**`SELECT * FROM points WHERE workspaceId = 'rami';`**

| id            | nodeId | workspaceId | availability |         lat |         lng | openNow  |
| :------------ | :----- | :---------- | :----------- | ----------: | ----------: | :------- |
| `pt-rami-loc` | `rami` | `rami`      | **idle**     | **25.0780** | **55.1350** | **true** |

> Driver is now discoverable at his new location for the next delivery job.

---

## Key Observations

1. **Turso cloud = discovery only** — The Public DB is for finding restaurants, menu items, and available drivers. NOT for live tracking, NOT for events. This keeps Turso costs minimal.

2. **Self-hosted LibSQL = everything operational** — All events, GPS pings, stock changes, and kitchen tasks stay in per-tenant namespaces on self-hosted LibSQL. Zero per-row cost, local-first, high-frequency safe.

3. **Only 2 Public DB writes per delivery** — (1) Driver marked unavailable when assigned, (2) Driver marked available with new location after delivery. vs. 28 total events across tenant DBs.

4. **Same `streamId` across tenants** — `ord-5001` appears in all 3 tenant DBs. Each tenant sees only their relevant events.

5. **Same opcode, different payloads** — When driver is assigned (opcode 302):
   - Ali sees: `{"driver": "rami", "eta": 25}`
   - Restaurant sees: `{"driver": "rami", "eta": 5}`
   - Rami sees: `{"task": "delivery", "pickupFrom": "rest-01"}`

6. **28 events across 3 tenant DBs** (8 + 11 + 9), **2 writes to Turso cloud**. Cost-efficient at any scale.
