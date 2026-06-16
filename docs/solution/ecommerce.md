# E-Commerce Flow — End to End

How online product selling works in TAR, from product listing to delivery.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Merchant │───▶│ Customer │───▶│ Payment  │───▶│ Warehouse│───▶│ Shipper  │
│  (App)   │    │  (App)   │    │  (Worker)│    │   (DO)   │    │   (DO)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Step 1: Merchant Lists Product

### What happens

```
Merchant creates product in Storefront DO (s:store_101)
  → form: product definition
  → matter: variants, stock, pricing
  → bond: product → store link
```

### Data written

```sql
-- From Storefront DO (s:store_101)
INSERT INTO form (id, type, title, public, data)
VALUES ('prod_sneakers_99', 'product', 'Nike Air Max', 1, '{
  "brand": "Nike",
  "image": "https://...",
  "category": "footwear"
}');

INSERT INTO matter (id, form, type, qty, value, data)
VALUES ('var_sneakers_9', 'prod_sneakers_99', 'variant', 50, 5999, '{"size":"9"}');

INSERT INTO matter (id, form, type, qty, value, data)
VALUES ('var_sneakers_10', 'prod_sneakers_99', 'variant', 30, 5999, '{"size":"10"}');

INSERT INTO bond (src, tgt, type)
VALUES ('prod_sneakers_99', 'store_101', 'published_to');
```

---

## Step 2: Publish to Marketplace

### What happens

```
Merchant taps "Publish to Marketplace"
  → Worker pushes to Turso (global search)
  → Product discoverable via vector search
```

### Publish flow

```
Storefront DO → Worker /api/publish → Turso
  1. form → knowledge (product definition)
  2. matter → context (stock, price, location)
  3. Workers AI embeds → memory (vector search)
```

### Turso data

```sql
-- Turso global.db
INSERT INTO knowledge (id, title, type, verified, brand)
VALUES ('prod_sneakers_99', 'Nike Air Max', 'product', 0, 'Nike');

INSERT INTO context (id, knowledge, store, value, stock, geo)
VALUES ('var_sneakers_9', 'prod_sneakers_99', 'store_101', 5999, 1, '8a2a1072b59ffff');
```

---

## Step 3: Customer Discovers Product

### What happens

```
Customer searches "Nike shoes"
  → Turso vector search (memory table)
  → Returns product IDs
  → Hydrate live data from Storefront DO
```

### Search flow

```javascript
// Step 1: Vector search in Turso
const results = await turso.execute({
  sql: "SELECT id, scope FROM memory WHERE vec MATCH ? LIMIT 10",
  args: [embeddingVector]  // from Workers AI
});

// Step 2: Hydrate from Storefront DO
for (const result of results) {
  const storeDO = await getDO(result.scope);
  const product = await storeDO.fetch(`/form/${result.id}`);
  const stock = await storeDO.fetch(`/matter?form=${result.id}`);
  // Merge: product + live stock + price
}
```

---

## Step 4: Customer Adds to Cart

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
VALUES ('cart_user123', 1, 102, '{
  "item": "var_sneakers_9",
  "qty": 1,
  "price": 5999
}');
```

---

## Step 5: Customer Checks Out

### What happens

```
Customer taps "Checkout"
  → App creates Order DO (o:order_456)
  → Order DO spawns, holds all parties
```

### Data written

```sql
-- From Order DO (o:order_456)
INSERT INTO matter (id, type, value, data)
VALUES ('order_456', 'order', 5999, '{
  "items": [{"variant":"var_sneakers_9", "qty":1}],
  "shipping": {"name":"Priya", "address":"..."}
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('order_456', 1, 104, 104);  -- CHECKOUT
```

---

## Step 6: Payment

### What happens

```
Customer pays via Stripe/Razorpay
  → Payment webhook hits Worker
  → Order DO receives PAY_SUCCESS
```

### Data written

```sql
-- From Order DO (o:order_456)
INSERT INTO motion (stream, seq, action, phase)
VALUES ('order_456', 2, 801, 801);  -- PAY_INIT

UPDATE motion SET phase = 802 WHERE stream = 'order_456' AND seq = 2;
-- PAY_SUCCESS
```

---

## Step 7: Stock Decrement

### What happens

```
Payment confirmed → stock decremented
  → Written to Storefront DO (s:store_101)
  → Marketplace context updated
```

### Data written

```sql
-- From Storefront DO (s:store_101)
INSERT INTO motion (stream, seq, action, delta)
VALUES ('var_sneakers_9', 1, 101, -1.0);  -- SOLD

-- Stock recomputed: 50 - 1 = 49 remaining
```

---

## Step 8: Merchant Confirms

### What happens

```
Merchant sees order
  → Taps "Confirm"
  → Order DO receives CONFIRMED
```

### Data written

```sql
-- From Order DO (o:order_456)
UPDATE motion SET phase = 106 WHERE stream = 'order_456';
-- CONFIRMED
```

---

## Step 9: Warehouse Prepares

### What happens

```
Warehouse team packs order
  → Taps "Packed"
  → Order DO receives PREPARING → READY
```

### Data written

```sql
-- From Order DO (o:order_456)
UPDATE motion SET phase = 107 WHERE stream = 'order_456';
-- PREPARING

UPDATE motion SET phase = 108 WHERE stream = 'order_456';
-- READY
```

---

## Step 10: Shipping

### What happens

```
Shipper picks up package
  → Logistics DO (t:logistics) tracks shipment
  → Customer sees tracking info
```

### Data written

```sql
-- From Logistics DO (t:logistics)
INSERT INTO matter (id, form, type, data)
VALUES ('ship_789', 'prod_sneakers_99', 'shipment', '{
  "carrier": "BlueDart",
  "tracking": "BD123456789",
  "order": "order_456"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_789', 1, 401, 401);  -- DISPATCHED
```

---

## Step 11: Delivery

### What happens

```
Shipper delivers to customer
  → Customer confirms receipt
  → Order complete
```

### Data written

```sql
-- From Order DO (o:order_456)
UPDATE motion SET phase = 402 WHERE stream = 'order_456';
-- IN_TRANSIT

UPDATE motion SET phase = 109 WHERE stream = 'order_456';
-- DELIVERED
```

---

## Step 12: Archive & Cleanup

### What happens

```
Order complete
  → Order DO archives to R2/S3
  → Order DO self-destructs
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Product listed | — | s:store_101 | form + matter |
| 2 | Published to marketplace | — | Turso | knowledge + context |
| 3 | Customer searches | — | Turso | memory (vector) |
| 4 | Add to cart | 102 | Personal DB | Local |
| 5 | Checkout | 104 | o:order_456 | Phase |
| 6 | Payment init | 801 | o:order_456 | Append |
| 7 | Payment success | 802 | o:order_456 | Phase |
| 8 | Stock decrement | 101 | s:store_101 | Append |
| 9 | Confirm | 106 | o:order_456 | Phase |
| 10 | Preparing | 107 | o:order_456 | Phase |
| 11 | Ready | 108 | o:order_456 | Phase |
| 12 | Dispatched | 401 | t:logistics | Append |
| 13 | In transit | 402 | o:order_456 | Phase |
| 14 | Delivered | 109 | o:order_456 | Phase |
| 15 | Archive | — | R2/S3 | Export |
| 16 | Delete DO | — | — | Self-destruct |
