# Logistics & SCM Flow — End to End

How shipping, delivery, and supply chain management work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Warehouse│───▶│ Dispatch │───▶│ In Transit│───▶│ Delivery │
│   (DO)   │    │   (DO)   │    │   (DO)   │    │   (DO)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Warehouse Operations

### Step 1: Transfer In

```sql
-- From Warehouse DO (t:warehouse_101)
INSERT INTO matter (id, form, type, qty, value, data)
VALUES ('stock_sneakers_9', 'prod_sneakers_99', 'stock', 100, 5999, '{
  "location": "rack_A1",
  "batch": "B20260616"
}');

INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_sneakers_9', 1, 406, 100.0);  -- TRANS_IN
```

### Step 2: Transfer Out

```sql
-- Stock moves to another location
INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_sneakers_9', 2, 405, -20.0);  -- TRANS_OUT

-- Stock: 100 - 20 = 80 remaining
```

---

## Part B: Dispatch

### Step 3: Create Shipment

```sql
-- From Logistics DO (t:logistics)
INSERT INTO matter (id, form, type, data)
VALUES ('ship_456', 'prod_sneakers_99', 'shipment', '{
  "carrier": "BlueDart",
  "origin": "warehouse_101",
  "destination": "cust_priya_123",
  "weight": 1.2,
  "order": "order_456"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_456', 1, 401, 401);  -- DISPATCHED
```

### Step 4: Assign Driver

```sql
UPDATE motion SET phase = 403 WHERE stream = 'ship_456';
-- DRIV_ASSIGN
```

---

## Part C: In Transit

### Step 5: Transit Out

```sql
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_456', 2, 402, 402);  -- IN_TRANSIT
```

### Step 6: ETA Update

```sql
INSERT INTO motion (stream, seq, action, delta, data)
VALUES ('ship_456', 3, 404, 2.0, '{"location":"hub_chennai"}');
-- ETA_UPDATED (2 hours)
```

### Step 7: Hub Transfer

```sql
-- Package arrives at hub
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_456', 4, 406, 406);  -- TRANS_IN (hub)

-- Package leaves hub
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_456', 5, 405, 405);  -- TRANS_OUT (hub)
```

---

## Part D: Delivery

### Step 8: Pickup Scheduled

```sql
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ship_456', 6, 408, 408);  -- PICKUP_SCH
```

### Step 9: Picked Up

```sql
UPDATE motion SET phase = 409 WHERE stream = 'ship_456';
-- PICKED_UP
```

### Step 10: Delivery Attempt

```sql
-- First attempt
INSERT INTO motion (stream, seq, action, phase, data)
VALUES ('ship_456', 7, 410, 410, '{"result":"failed","reason":"customer unavailable"}');
-- DELIV_ATTEMPT
```

### Step 11: Successful Delivery

```sql
INSERT INTO motion (stream, seq, action, phase, data)
VALUES ('ship_456', 8, 410, 109, '{"result":"delivered","received_by":"Priya"}');
-- DELIVERED
```

---

## Part E: Return Request

### Step 12: Return Initiated

```sql
INSERT INTO matter (id, form, type, data)
VALUES ('return_123', 'prod_sneakers_99', 'return', '{
  "order": "order_456",
  "reason": "Wrong size",
  "status": "pending"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('return_123', 1, 407, 407);  -- RETURN_REQ
```

### Step 13: Return Pickup

```sql
UPDATE motion SET phase = 409 WHERE stream = 'return_123';
-- PICKED_UP (return)
```

### Step 14: Return Received

```sql
UPDATE motion SET phase = 406 WHERE stream = 'return_123';
-- TRANS_IN (return received at warehouse)

-- Stock incremented
INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_sneakers_9', 3, 406, 1.0);  -- TRANS_IN
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Transfer in | 406 | t:warehouse_101 | Append |
| 2 | Transfer out | 405 | t:warehouse_101 | Append |
| 3 | Dispatched | 401 | t:logistics | Append |
| 4 | Driver assigned | 403 | t:logistics | Phase |
| 5 | In transit | 402 | t:logistics | Phase |
| 6 | ETA updated | 404 | t:logistics | Phase |
| 7 | Hub transfer in | 406 | t:logistics | Append |
| 8 | Hub transfer out | 405 | t:logistics | Append |
| 9 | Pickup scheduled | 408 | t:logistics | Phase |
| 10 | Picked up | 409 | t:logistics | Phase |
| 11 | Delivery attempt | 410 | t:logistics | Append |
| 12 | Delivered | 109 | t:logistics | Phase |
| 13 | Return request | 407 | t:logistics | Append |
| 14 | Return picked up | 409 | t:logistics | Phase |
| 15 | Return received | 406 | t:warehouse_101 | Append |
