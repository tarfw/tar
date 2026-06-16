# Services & Bookings Flow — End to End

How service bookings (salon, spa, repair, etc.) work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Customer │───▶│ Provider │───▶│ Service  │───▶│ Payment  │
│  (App)   │    │  (DO)    │    │  (DO)    │    │  (DO)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Provider Setup

### Step 1: Create Service

```sql
-- From Storefront DO (s:salon_101)
INSERT INTO form (id, type, title, data)
VALUES ('svc_haircut', 'service', 'Haircut', '{
  "duration": 30,
  "price": 500,
  "description": "Professional haircut with styling"
}');

INSERT INTO form (id, type, title, data)
VALUES ('svc_shave', 'service', 'Shave', '{
  "duration": 15,
  "price": 200,
  "description": "Classic hot towel shave"
}');
```

### Step 2: Create Time Slots

```sql
-- From Storefront DO (s:salon_101)
INSERT INTO matter (id, form, type, start, end, qty, data)
VALUES ('slot_2026_06_16_09', 'svc_haircut', 'slot',
  '2026-06-16T09:00:00Z', '2026-06-16T09:30:00Z', 1,
  '{"provider":"stylist_rahul"}');

INSERT INTO matter (id, form, type, start, end, qty, data)
VALUES ('slot_2026_06_16_09_30', 'svc_haircut', 'slot',
  '2026-06-16T09:30:00Z', '2026-06-16T10:00:00Z', 1,
  '{"provider":"stylist_rahul"}');

INSERT INTO matter (id, form, type, start, end, qty, data)
VALUES ('slot_2026_06_16_10', 'svc_haircut', 'slot',
  '2026-06-16T10:00:00Z', '2026-06-16T10:30:00Z', 1,
  '{"provider":"stylist_rahul"}');
```

---

## Part B: Customer Books

### Step 3: Customer Views Available Slots

```sql
-- From Storefront DO (s:salon_101)
SELECT * FROM matter 
WHERE form = 'svc_haircut' 
AND type = 'slot' 
AND active = 1
AND start > '2026-06-16T09:00:00Z'
ORDER BY start;
```

### Step 4: Book Slot

```sql
-- From Storefront DO (s:salon_101)
INSERT INTO matter (id, form, type, start, end, data)
VALUES ('booking_456', 'svc_haircut', 'booking',
  '2026-06-16T10:00:00Z', '2026-06-16T10:30:00Z', '{
  "customer": "cust_priya_123",
  "provider": "stylist_rahul",
  "service": "svc_haircut",
  "price": 500
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('booking_456', 1, 701, 701);  -- BOOKED

-- Mark slot as booked
UPDATE matter SET active = 0 WHERE id = 'slot_2026_06_16_10';
```

### Step 5: Confirmation

```sql
-- WebSocket broadcast
Order DO broadcasts:
  → Customer: "Booking confirmed for 10:00 AM"
  → Provider: "New booking: Priya, 10:00 AM"
```

---

## Part C: Service Delivery

### Step 6: Service Started

```sql
UPDATE motion SET phase = 202 WHERE stream = 'booking_456';
-- SHIFT_START (service started)
```

### Step 7: Service Completed

```sql
UPDATE motion SET phase = 702 WHERE stream = 'booking_456';
-- COMPLETED
```

---

## Part D: Cancellation

### Step 8: Customer Cancels

```sql
UPDATE motion SET phase = 703 WHERE stream = 'booking_456';
-- CANCELLED

-- Re-open slot
UPDATE matter SET active = 1 WHERE id = 'slot_2026_06_16_10';
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Service created | — | s:salon_101 | form |
| 2 | Slots created | — | s:salon_101 | matter |
| 3 | Booking made | 701 | s:salon_101 | Append |
| 4 | Service started | 202 | s:salon_101 | Append |
| 5 | Service completed | 702 | s:salon_101 | Phase |
| 6 | OR: Cancelled | 703 | s:salon_101 | Phase |
