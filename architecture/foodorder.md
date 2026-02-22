# Example: Food Delivery Order Stream

A complete end-to-end food delivery flow using the [Shared Streams Architecture](./collab.md).

> See [collab.md](./collab.md) for the architecture overview, CF Worker setup, and cost breakdown.

---

## The Scenario

> **Customer Ali** (`ali` tenant) orders Chicken Shawarma + Laban from **Bab Al Hara** (`bab-hara` tenant).
> Kitchen prepares, **Driver Rami** (`rami` tenant) picks up and delivers.

---

## Step 0: Pre-existing Data

### Tenant DB: `bab-hara` (nodes + points)

**nodes:**

| id         | parentId  | nodeType     | title            | payload                              |
| :--------- | :-------- | :----------- | :--------------- | :----------------------------------- |
| `rest-01`  | `null`    | `restaurant` | Bab Al Hara      | `{"address": "Al Rigga, Dubai"}`     |
| `prod-shw` | `menu-01` | `product`    | Chicken Shawarma | `{"desc": "Grilled chicken wrap"}`   |
| `prod-lbn` | `menu-01` | `product`    | Laban            | `{"desc": "Traditional buttermilk"}` |

**points:**

| id            | nodeId     |    qty |  price | currency | availability |     lat |     lng | openNow |
| :------------ | :--------- | -----: | -----: | :------- | :----------- | ------: | ------: | :------ |
| `pt-shw`      | `prod-shw` |    200 |  18.00 | `AED`    | `in-stock`   |  `null` |  `null` | `true`  |
| `pt-lbn`      | `prod-lbn` |    150 |   5.00 | `AED`    | `in-stock`   |  `null` |  `null` | `true`  |
| `pt-rest-loc` | `rest-01`  | `null` | `null` | `null`   | `open`       | 25.2650 | 55.3320 | `true`  |

### Tenant DB: `rami` (nodes + points)

**points:**

| id            | nodeId | availability |     lat |     lng | openNow |
| :------------ | :----- | :----------- | ------: | ------: | :------ |
| `pt-rami-loc` | `rami` | `idle`       | 25.2640 | 55.3310 | `true`  |

---

## Step 1: 🛒 Customer Places Order

```js
// POST /api/orders
const customerDb = getTenantDb(tenantId); // ali
const restaurantDb = getTenantDb(restaurantId); // bab-hara

// 1. Order node in customer's tenant DB
await customerDb.execute({
  sql: `INSERT INTO nodes (id, nodeType, title, createdAt, payload) VALUES (?, 'order', ?, ?, ?)`,
  args: [
    orderId,
    `Order ${orderId}`,
    ts,
    JSON.stringify({ restaurant: restaurantId, items, total }),
  ],
});

// 2. Order node in restaurant's tenant DB
await restaurantDb.execute({
  sql: `INSERT INTO nodes (id, nodeType, title, createdAt, payload) VALUES (?, 'order', ?, ?, ?)`,
  args: [
    orderId,
    `${orderId} - ${tenantId}`,
    ts,
    JSON.stringify({ customer: tenantId, items, total, deliveryAddress }),
  ],
});

// 3. ONE event to shared streams DB
await streamsDb.execute({
  sql: `INSERT INTO events VALUES (?, ?, 501, ?, NULL, ?, ?, ?)`,
  args: [
    evtId,
    orderId,
    orderId,
    total,
    JSON.stringify({
      customer: tenantId,
      restaurant: restaurantId,
      items,
      deliveryAddress,
      notes,
      channel: "app",
    }),
    ts,
  ],
});
```

> 1 event written. Ali, Bab Al Hara, and later Rami all read from the same stream.

---

## Step 2: 🧾 Payment

```js
// POST /api/orders/:id/pay
await streamsDb.execute({
  sql: `INSERT INTO events VALUES (?, ?, 203, ?, NULL, ?, ?, ?)`,
  args: [
    evtId,
    orderId,
    orderId,
    46.0,
    JSON.stringify({ method: "card", cardLast4: "4242" }),
    ts,
  ],
});
```

---

## Step 3: 🍳 Restaurant Accepts → Kitchen Starts

```js
// POST /api/orders/:id/accept
await streamsDb.batch([
  {
    sql: `INSERT INTO events VALUES (?, ?, 301, ?, NULL, 0, ?, ?)`,
    args: [
      evtId1,
      orderId,
      orderId,
      JSON.stringify({ task: "kitchen-prep", estMinutes: 15 }),
      ts,
    ],
  },
  {
    sql: `INSERT INTO events VALUES (?, ?, 303, ?, NULL, 0, ?, ?)`,
    args: [
      evtId2,
      orderId,
      orderId,
      JSON.stringify({ chef: "Hassan", station: "grill" }),
      ts,
    ],
  },
]);
```

---

## Step 4: 📦 Stock Deducted

```js
// Stock update in restaurant's tenant DB (points)
const restaurantDb = getTenantDb("bab-hara");
await restaurantDb.batch([
  { sql: `UPDATE points SET qty = qty - 2 WHERE id = 'pt-shw'` },
  { sql: `UPDATE points SET qty = qty - 1 WHERE id = 'pt-lbn'` },
]);

// Record in shared stream
await streamsDb.batch([
  {
    sql: `INSERT INTO events VALUES (?, ?, 102, ?, 'pt-shw', -2, ?, ?)`,
    args: [
      evtId1,
      orderId,
      "prod-shw",
      JSON.stringify({ reason: "order-sale" }),
      ts,
    ],
  },
  {
    sql: `INSERT INTO events VALUES (?, ?, 102, ?, 'pt-lbn', -1, ?, ?)`,
    args: [
      evtId2,
      orderId,
      "prod-lbn",
      JSON.stringify({ reason: "order-sale" }),
      ts,
    ],
  },
]);
```

---

## Step 5: ✅ Kitchen Done

```js
await streamsDb.execute({
  sql: `INSERT INTO events VALUES (?, ?, 305, ?, NULL, 0, ?, ?)`,
  args: [
    evtId,
    orderId,
    orderId,
    JSON.stringify({ task: "kitchen-prep", actualMinutes: 12 }),
    ts,
  ],
});
```

---

## Step 6: 🏍️ Driver Assigned

```js
// Find nearest idle driver from Turso cloud (discovery)
const nearest = await publicDb.execute({
  sql: `SELECT workspaceId FROM points
        WHERE nodeId IN (SELECT id FROM nodes WHERE nodeType = 'driver')
        AND openNow = true AND availability = 'idle'
        ORDER BY ABS(lat - ?) + ABS(lng - ?) LIMIT 1`,
  args: [restaurantLat, restaurantLng],
});
const driverId = nearest.rows[0].workspaceId; // "rami"

// 1. Delivery task in driver's tenant DB
const driverDb = getTenantDb(driverId);
await driverDb.batch([
  {
    sql: `INSERT INTO nodes (id, nodeType, title, createdAt, payload) VALUES (?, 'delivery', ?, ?, ?)`,
    args: [
      orderId,
      `Delivery ${orderId}`,
      ts,
      JSON.stringify({
        restaurant: restaurantId,
        pickupAddress: "Al Rigga St",
        deliverTo: "Marina Walk",
      }),
    ],
  },
  {
    sql: `UPDATE points SET availability = 'en-route', openNow = false WHERE id = 'pt-rami-loc'`,
  },
]);

// 2. ONE event to shared stream
await streamsDb.execute({
  sql: `INSERT INTO events VALUES (?, ?, 302, ?, NULL, 0, ?, ?)`,
  args: [
    evtId,
    orderId,
    driverId,
    JSON.stringify({
      task: "delivery",
      driver: driverId,
      vehicle: "Motorcycle",
      eta: 20,
    }),
    ts,
  ],
});

// 3. Turso cloud — driver unavailable for discovery
await publicDb.execute({
  sql: `UPDATE points SET openNow = false WHERE id = 'pt-rami-loc' AND workspaceId = ?`,
  args: [driverId],
});
```

---

## Step 7 & 9: 📍 GPS Pings (driver tenant DB only)

```js
// POST /api/motion — rami's tenant DB only, no streams DB
const driverDb = getTenantDb(tenantId);
await driverDb.execute({
  sql: `UPDATE points SET lat = ?, lng = ? WHERE id = 'pt-rami-loc'`,
  args: [lat, lng],
});
```

> GPS pings **never touch the streams DB**. Hundreds of pings per delivery, zero extra cost.

---

## Step 8: 🚚 Pickup Confirmed

```js
await streamsDb.execute({
  sql: `INSERT INTO events VALUES (?, ?, 502, ?, NULL, 0, ?, ?)`,
  args: [
    evtId,
    orderId,
    orderId,
    JSON.stringify({ pickedUpBy: driverId, confirmedItems: 3 }),
    ts,
  ],
});
```

---

## Step 10: ✅ Order Delivered

```js
// 1. Stream events — delivery + payouts
await streamsDb.batch([
  {
    sql: `INSERT INTO events VALUES (?, ?, 503, ?, NULL, 0, ?, ?)`,
    args: [
      evtId1,
      orderId,
      orderId,
      JSON.stringify({
        deliveredBy: driverId,
        confirmedBy: customerId,
        totalMinutes: 35,
      }),
      ts,
    ],
  },
  {
    sql: `INSERT INTO events VALUES (?, ?, 402, ?, NULL, 12.00, ?, ?)`,
    args: [
      evtId2,
      orderId,
      driverId,
      JSON.stringify({ type: "delivery-fee", currency: "AED" }),
      ts,
    ],
  },
  {
    sql: `INSERT INTO events VALUES (?, ?, 401, ?, NULL, 34.00, ?, ?)`,
    args: [
      evtId3,
      orderId,
      "rest-01",
      JSON.stringify({ type: "order-revenue", currency: "AED" }),
      ts,
    ],
  },
]);

// 2. Driver back to idle (tenant DB)
const driverDb = getTenantDb(driverId);
await driverDb.execute({
  sql: `UPDATE points SET availability = 'idle', openNow = true, lat = ?, lng = ? WHERE id = 'pt-rami-loc'`,
  args: [lat, lng],
});

// 3. Turso cloud — driver discoverable again
await publicDb.execute({
  sql: `UPDATE points SET openNow = true, availability = 'idle', lat = ?, lng = ?
        WHERE id = 'pt-rami-loc' AND workspaceId = ?`,
  args: [lat, lng, driverId],
});
```

---

## Step 11: 📦 Archive & Delete Stream

```js
export async function archiveStream(streamId) {
  const events = await streamsDb.execute({
    sql: `SELECT * FROM events WHERE streamId = ? ORDER BY ts`,
    args: [streamId],
  });

  await s3.putObject({
    Bucket: "streams-archive",
    Key: `${streamId}.json`,
    Body: JSON.stringify(events.rows),
  });

  await streamsDb.execute({
    sql: `DELETE FROM events WHERE streamId = ?`,
    args: [streamId],
  });
}
```

---

## Full Event Stream: What Everyone Sees

`GET /api/streams/ord-5001` — same response for Ali, Bab Al Hara, and Rami:

|   # | opcode | Name            | nodeId     | delta | payload                                                         | ts       |
| --: | -----: | :-------------- | :--------- | ----: | :-------------------------------------------------------------- | :------- |
|   1 |    501 | ORDER_CREATE    | `ord-5001` | 46.00 | `{"customer": "ali", "restaurant": "bab-hara", "items": [...]}` | 12:30:00 |
|   2 |    203 | INVOICE_PAYMENT | `ord-5001` | 46.00 | `{"method": "card", "cardLast4": "4242"}`                       | 12:30:10 |
|   3 |    301 | TASK_CREATE     | `ord-5001` |     0 | `{"task": "kitchen-prep", "estMinutes": 15}`                    | 12:31:00 |
|   4 |    303 | TASK_START      | `ord-5001` |     0 | `{"chef": "Hassan", "station": "grill"}`                        | 12:32:00 |
|   5 |    102 | SALE_OUT        | `prod-shw` |    -2 | `{"reason": "order-sale"}`                                      | 12:32:05 |
|   6 |    102 | SALE_OUT        | `prod-lbn` |    -1 | `{"reason": "order-sale"}`                                      | 12:32:06 |
|   7 |    305 | TASK_DONE       | `ord-5001` |     0 | `{"task": "kitchen-prep", "actualMinutes": 12}`                 | 12:43:00 |
|   8 |    302 | TASK_ASSIGN     | `rami`     |     0 | `{"driver": "rami", "vehicle": "Motorcycle", "eta": 20}`        | 12:43:30 |
|   9 |    502 | ORDER_SHIP      | `ord-5001` |     0 | `{"pickedUpBy": "rami", "confirmedItems": 3}`                   | 12:49:00 |
|  10 |    503 | ORDER_DELIVER   | `ord-5001` |     0 | `{"deliveredBy": "rami", "totalMinutes": 35}`                   | 13:05:30 |
|  11 |    402 | ACCOUNT_PAYOUT  | `rami`     | 12.00 | `{"type": "delivery-fee"}`                                      | 13:06:00 |
|  12 |    401 | ACCOUNT_PAYIN   | `rest-01`  | 34.00 | `{"type": "order-revenue"}`                                     | 13:06:00 |

> **12 events, written once each.** Archived to Railway S3 on completion, deleted from active streams DB.

---

## Write Count Summary

| Target                         | What's written                  | Per order |
| :----------------------------- | :------------------------------ | --------: |
| **Streams DB**                 | All events (single write each)  |        12 |
| **Tenant: customer**           | 1 order node                    |         1 |
| **Tenant: restaurant**         | 1 order node + stock updates    |         3 |
| **Tenant: driver**             | 1 delivery node + point updates |         3 |
| **Turso cloud**                | Driver on/off availability      |         2 |
| **Total**                      |                                 |    **21** |
| GPS pings (driver tenant only) | ~200 point updates per delivery |       200 |
