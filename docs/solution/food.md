# Food Order Flow — End to End

How a food order works in TAR, from customer browsing to delivery.

---

## Overview

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Customer │───▶│ Store   │───▶│ Payment │───▶│ Kitchen │───▶│ Driver  │
│  (App)   │    │  (DO)   │    │  (DO)   │    │  (KDS)  │    │  (KV)   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

---

## Step 1: Customer Browses Menu

### What happens

```
Customer opens restaurant page
  → App fetches from Storefront DO (s:rest_123)
  → Reads: form (menu items), matter (stock, prices)
```

### Data read

```sql
-- From Storefront DO (s:rest_123)
SELECT * FROM form WHERE type = 'product';     -- menu items
SELECT * FROM matter WHERE type = 'stock';     -- stock levels
```

### Example

```
form:
  id: "item_biryani"
  type: "product"
  title: "Chicken Biryani"
  data: '{"price":180, "image":"biryani.jpg"}'

matter:
  id: "stock_biryani"
  form: "item_biryani"
  type: "stock"
  qty: 25
  value: 180
```

---

## Step 2: Customer Adds to Cart

### What happens

```
Customer taps "Add to Cart"
  → Cart stored locally (Personal DB, p)
  → No network call, instant response
```

### Data written

```sql
-- From Personal DB (user_${self}.db)
INSERT INTO motion (stream, seq, action, data)
VALUES ('cart_user123', 1, 102, '{"item":"item_biryani", "qty":2}');
```

### Opcode

| Action | Code | Strategy |
|--------|------|----------|
| CART_ADD | 102 | Local (never synced) |

---

## Step 3: Customer Checks Out

### What happens

```
Customer taps "Checkout"
  → App creates Order DO (o:order_42)
  → Order DO spawns, holds all parties
```

### Data written

```sql
-- From Order DO (o:order_42)
INSERT INTO matter (id, type, value, data)
VALUES ('order_42', 'order', 360, '{"items":[...], "customer":"usr_123"}');

INSERT INTO motion (stream, seq, action, phase, data)
VALUES ('order_42', 1, 104, 104, '{"cart":"cart_user123"}');
```

### Opcodes

| Action | Code | Strategy | Written To |
|--------|------|----------|------------|
| CHECKOUT | 104 | Phase | o:order_42 |
| ORDER_PLACED | 105 | Append | o:order_42 |

---

## Step 4: Payment

### What happens

```
Customer confirms payment
  → Payment Worker processes
  → Order DO receives PAY_SUCCESS
```

### Data written

```sql
-- From Order DO (o:order_42)
INSERT INTO motion (stream, seq, action, phase)
VALUES ('order_42', 2, 801, 801);  -- PAY_INIT

UPDATE motion SET phase = 802 WHERE stream = 'order_42' AND seq = 2;
-- PAY_SUCCESS
```

### Opcodes

| Action | Code | Strategy | Phase Update |
|--------|------|----------|--------------|
| PAY_INIT | 801 | Append | — |
| PAY_SUCCESS | 802 | Phase | 801 → 802 |

---

## Step 5: Restaurant Confirms

### What happens

```
Restaurant owner sees order on POS screen
  → Taps "Confirm"
  → Order DO receives CONFIRMED
  → Kitchen Display System (KDS) shows order
```

### Data written

```sql
-- From Order DO (o:order_42)
UPDATE motion SET phase = 106 WHERE stream = 'order_42';
-- CONFIRMED
```

### Real-time

```
Order DO broadcasts via WebSocket:
  → Customer app: "Order confirmed!"
  → KDS screen: New order pops up
```

---

## Step 6: Kitchen Prepares

### What happens

```
Kitchen starts preparing
  → KDS taps "Preparing"
  → Order DO receives PREPARING
  → When done, KDS taps "Ready"
```

### Data written

```sql
-- From Order DO (o:order_42)
UPDATE motion SET phase = 107 WHERE stream = 'order_42';
-- PREPARING

UPDATE motion SET phase = 207 WHERE stream = 'order_42';
-- ITEM_READY

UPDATE motion SET phase = 108 WHERE stream = 'order_42';
-- READY
```

### Opcodes

| Action | Code | Strategy |
|--------|------|----------|
| PREPARING | 107 | Phase |
| ITEM_READY | 207 | Phase |
| READY | 108 | Phase |

---

## Step 7: Stock Decrement

### What happens

```
Order confirmed → stock decremented
  → Written to Storefront DO (s:rest_123)
  → NOT to Order DO (stock lives in storefront)
```

### Data written

```sql
-- From Storefront DO (s:rest_123)
INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_biryani', 1, 101, -2.0);  -- SOLD

-- Stock recomputed: SUM(delta) from motion
-- 25 + (-2) = 23 remaining
```

### Key rule

```
Stock truth lives in Storefront DO (s:rest_123)
Order DO only references it by ID
```

---

## Step 8: Find Driver

### What happens

```
Order DO needs a driver
  → Worker searches nearby drivers via KV
  → Assigns closest free driver
```

### Location search

```javascript
// Customer location
const customerLat = 13.0827;
const customerLng = 80.2707;

// Convert to H3 hex
const customerHex = h3.latLngToCell(customerLat, customerLng, 8);
// Result: "8a2a1072b59ffff"

// Get 7 nearby hexes
const nearbyHexes = h3.gridDisk(customerHex, 1);
// Result: ["8a2a1072b59ffff", "8a2a1072b5a7fff", ...]

// Read from KV (parallel)
const results = await Promise.all(
  nearbyHexes.map(hex => KV.get(`geo:${hex}`))
);

// Filter free drivers
const freeDrivers = results
  .filter(data => data !== null)
  .flatMap(data => Object.entries(data))
  .filter(([id, info]) => info.status === "free");

// Result: [["driver_44", { name:"Ravi", lat:13.08, ... }]]
```

### Driver assigned

```sql
-- From Order DO (o:order_42)
INSERT INTO motion (stream, seq, action, phase, data)
VALUES ('order_42', 3, 403, 403, '{"driver":"driver_44"}');
-- DRIV_ASSIGN

-- From KV
KV.put('geo:8a2a1072b59ffff', {
  "driver_44": { "status": "onTrip" }
}, { expirationTtl: 30 });
```

---

## Step 9: Driver Picks Up

### What happens

```
Driver arrives at restaurant
  → Taps "Picked Up"
  → Order DO receives PICKED_UP
  → Customer sees "Driver picked up your order"
```

### Data written

```sql
-- From Order DO (o:order_42)
UPDATE motion SET phase = 409 WHERE stream = 'order_42';
-- PICKED_UP
```

---

## Step 10: In Transit

### What happens

```
Driver is moving
  → Pings location every 5s to KV
  → Order DO receives IN_TRANSIT
  → Customer sees live map
```

### Data written

```sql
-- From Order DO (o:order_42)
UPDATE motion SET phase = 402 WHERE stream = 'order_42';
-- IN_TRANSIT
```

### Driver location pings

```javascript
// Every 5 seconds
await KV.put('geo:8a2a1072b59ffff', {
  "driver_44": { "lat": newLat, "lng": newLng, "status": "onTrip" }
}, { expirationTtl: 30 });
```

---

## Step 11: Delivered

### What happens

```
Driver delivers food
  → Taps "Delivered"
  → Order DO receives DELIVERED
  → Order lifecycle complete
```

### Data written

```sql
-- From Order DO (o:order_42)
UPDATE motion SET phase = 109 WHERE stream = 'order_42';
-- DELIVERED

-- Order DO marks matter as inactive
UPDATE matter SET active = 0 WHERE id = 'order_42';
```

---

## Step 12: Archive & Cleanup

### What happens

```
Order complete
  → Order DO archives motion to R2/S3
  → Order DO deletes itself
  → Cost: zero (ephemeral)
```

### Archive flow

```
Order DO (o:order_42):
  1. Export motion table → Parquet file
  2. Upload to R2: order/order_42.parquet
  3. DELETE FROM motion WHERE stream = 'order_42'
  4. state.storage.deleteAll()  // DO self-destructs
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Add to cart | 102 | Personal DB | Local |
| 2 | Checkout | 104 | o:order_42 | Phase |
| 3 | Order placed | 105 | o:order_42 | Append |
| 4 | Payment init | 801 | o:order_42 | Append |
| 5 | Payment success | 802 | o:order_42 | Phase |
| 6 | Confirm | 106 | o:order_42 | Phase |
| 7 | Stock decrement | 101 | s:rest_123 | Append |
| 8 | Driver assigned | 403 | o:order_42 | Phase |
| 9 | Picked up | 409 | o:order_42 | Phase |
| 10 | In transit | 402 | o:order_42 | Phase |
| 11 | Delivered | 109 | o:order_42 | Phase |
| 12 | Archive | — | R2/S3 | Export |
| 13 | Delete DO | — | — | Self-destruct |

---

## Data Flow Diagram

```
                         ┌─────────────────────────────┐
                         │      Storefront DO (s:rest)  │
                         │  ┌─────────┐ ┌─────────┐    │
                         │  │  form   │ │ matter  │    │
                         │  │ (menu)  │ │ (stock) │    │
                         │  └────┬────┘ └────┬────┘    │
                         │       │           │         │
                         │       └─────┬─────┘         │
                         │             │               │
                         └─────────────┼───────────────┘
                                       │
                                       │ stock decrement
                                       │
┌──────────┐     ┌──────────────────────┴──────────────────────┐
│ Customer │────▶│              Order DO (o:order_42)           │
│   App    │     │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
└──────────┘     │  │ matter  │ │ motion  │ │  bond   │       │
     │           │  │ (order) │ │ (log)   │ │ (links) │       │
     │           │  └─────────┘ └─────────┘ └─────────┘       │
     │           └──────────────────────┬──────────────────────┘
     │                                  │
     │           ┌──────────────────────┴──────────────────────┐
     │           │              Workers KV                      │
     │           │  ┌─────────────────────────────────────┐   │
     │◀──────────┤  │ geo:8a2a1072b59ffff                 │   │
     │  live map │  │   driver_44: {lat, lng, status}     │   │
     │           │  │   driver_91: {lat, lng, status}     │   │
     │           │  └─────────────────────────────────────┘   │
     │           └─────────────────────────────────────────────┘
     │
     │           ┌─────────────────────────────────────────────┐
     └──────────▶│              Kitchen (KDS)                   │
                 │  Shows order, advances phases               │
                 └─────────────────────────────────────────────┘
```

---

## Cost per Order

| Component | Cost |
|-----------|------|
| Order DO (ephemeral) | ~$0.00001 |
| KV reads (driver search) | ~$0.0000035 |
| KV writes (driver pings) | ~$0.00001 |
| R2 archive | ~$0.000001 |
| **Total** | **~$0.000025** |

**~25,000 orders per cent.**
