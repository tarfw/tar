# POS & Restaurant Flow — End to End

How point-of-sale and restaurant operations work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Cashier  │───▶│   POS    │───▶│ Kitchen  │───▶│ Customer │
│  (App)   │    │   (DO)   │    │  (KDS)   │    │  (App)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Shift Management

### Step 1: Start Shift

```sql
-- From Storefront DO (s:rest_123)
INSERT INTO matter (id, form, type, start, data)
VALUES ('shift_2026_06_16_1', 'emp_ravi', 'slot', 
  '2026-06-16T09:00:00Z', '{"cashier":"Ravi"}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('shift_2026_06_16_1', 1, 202, 202);  -- SHIFT_START
```

### Step 2: Break

```sql
INSERT INTO motion (stream, seq, action, phase)
VALUES ('shift_2026_06_16_1', 2, 203, 203);  -- BREAK
```

### Step 3: End Shift

```sql
UPDATE motion SET phase = 204 WHERE stream = 'shift_2026_06_16_1';
-- SHIFT_END

UPDATE matter SET active = 0, end = '2026-06-16T17:00:00Z' 
WHERE id = 'shift_2026_06_16_1';
```

### Step 4: Cash Close

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('shift_2026_06_16_1', 3, 205, '{
  "opening": 5000,
  "closing": 15000,
  "sales": 10000,
  "diff": 0
}');
-- CASH_CLOSE
```

---

## Part B: In-Store Sale

### Step 5: Customer Orders

```
Customer at counter
  → Cashier taps items on POS
  → Sale recorded in Storefront DO
```

```sql
-- From Storefront DO (s:rest_123)
INSERT INTO matter (id, type, value, data)
VALUES ('sale_2026_06_16_001', 'sale', 350, '{
  "items": [
    {"item": "item_biryani", "qty": 1, "price": 180},
    {"item": "item_coke", "qty": 2, "price": 40}
  ]
}');

INSERT INTO motion (stream, seq, action, delta)
VALUES ('sale_2026_06_16_001', 1, 201, 350);  -- SALE
```

### Step 6: Stock Decrement

```sql
-- Biryani stock: 25 - 1 = 24
INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_biryani', 1, 101, -1.0);

-- Coke stock: 100 - 2 = 98
INSERT INTO motion (stream, seq, action, delta)
VALUES ('stock_coke', 1, 101, -2.0);
```

---

## Part C: Restaurant Order (Dine-In)

### Step 7: Token Issued

```
Customer sits down
  → Cashier creates order
  → Token issued
```

```sql
-- From Storefront DO (s:rest_123)
INSERT INTO matter (id, type, data)
VALUES ('token_42', 'token', '{
  "table": 5,
  "customer": "Guest",
  "items": [{"item":"item_biryani","qty":1}]
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('token_42', 1, 208, 208);  -- TOKEN_ISSUED
```

### Step 8: Fire to Kitchen

```sql
UPDATE motion SET phase = 206 WHERE stream = 'token_42';
-- ORDER_FIRE
```

### Step 9: Kitchen Prepares

```sql
-- Kitchen Display System (KDS) updates
UPDATE motion SET phase = 107 WHERE stream = 'token_42';
-- PREPARING

UPDATE motion SET phase = 207 WHERE stream = 'token_42';
-- ITEM_READY
```

### Step 10: Token Called

```sql
UPDATE motion SET phase = 209 WHERE stream = 'token_42';
-- TOKEN_CALLED (food ready for pickup)
```

### Step 11: Token Served

```sql
UPDATE motion SET phase = 210 WHERE stream = 'token_42';
-- TOKEN_SERVED (customer received food)
```

---

## Part D: Kitchen Display System (KDS)

### Real-time flow

```
┌─────────────────────────────────────────────────────────────┐
│                    KDS Screen                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Token 1 │ │ Token 2 │ │ Token 3 │ │ Token 4 │          │
│  │ Table 3 │ │ Table 7 │ │ Table 1 │ │ Table 5 │          │
│  │ 2 items │ │ 1 item  │ │ 3 items │ │ 1 item  │          │
│  │ 🔴 New  │ │ 🟡 Prep │ │ 🟢 Done │ │ 🔴 New  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket events

```javascript
// Cashier fires order
await orderDO.fetch('/fire', { method: 'POST' });

// KDS receives in <50ms via WebSocket
ws.onmessage = (event) => {
  const { action, token } = JSON.parse(event.data);
  if (action === 206) showNewOrder(token);  // ORDER_FIRE
  if (action === 207) markReady(token);     // ITEM_READY
};
```

---

## Part E: Online Order (via App)

### Step 12: Customer Orders via App

```
Customer orders on phone
  → Order DO (o:order_789) spawns
  → Same flow as food-order-flow.md
```

### Key difference

| Aspect | In-Store | Online |
|--------|----------|--------|
| DO type | s:rest_123 (direct) | o:order_789 (ephemeral) |
| Payment | Cash/UPI at counter | Online payment |
| Token | Physical token | Digital token |
| Driver | Not needed | Required |

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Shift start | 202 | s:rest_123 | Append |
| 2 | Sale | 201 | s:rest_123 | Append |
| 3 | Stock decrement | 101 | s:rest_123 | Append |
| 4 | Token issued | 208 | s:rest_123 | Append |
| 5 | Fire to kitchen | 206 | s:rest_123 | Append |
| 6 | Preparing | 107 | s:rest_123 | Phase |
| 7 | Item ready | 207 | s:rest_123 | Phase |
| 8 | Token called | 209 | s:rest_123 | Phase |
| 9 | Token served | 210 | s:rest_123 | Phase |
| 10 | Break | 203 | s:rest_123 | Append |
| 11 | Shift end | 204 | s:rest_123 | Phase |
| 12 | Cash close | 205 | s:rest_123 | Append |
