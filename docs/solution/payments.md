# Payments & Finance Flow — End to End

How payments, payouts, and expense tracking work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Customer │───▶│ Payment  │───▶│ Payout   │───▶│ Expense  │
│  (App)   │    │  (DO)    │    │  (DO)    │    │  (DO)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Customer Payment

### Step 1: Payment Init

```sql
-- From Order DO (o:order_456)
INSERT INTO matter (id, type, value, data)
VALUES ('pay_456', 'payment', 5999, '{
  "order": "order_456",
  "method": "upi",
  "vpa": "priya@upi"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('pay_456', 1, 801, 801);  -- PAY_INIT
```

### Step 2: Payment Success

```sql
UPDATE motion SET phase = 802 WHERE stream = 'pay_456';
-- PAY_SUCCESS
```

### Step 3: Payment Failed

```sql
UPDATE motion SET phase = 805 WHERE stream = 'pay_456';
-- PAY_FAILED
```

---

## Part B: Partial Payment

### Step 4: Partial Pay

```sql
-- Customer pays in installments
INSERT INTO motion (stream, seq, action, delta, data)
VALUES ('invoice_789', 1, 803, 3000, '{"installment": 1}');
-- PARTIAL_PAY (3000 of 10000)

INSERT INTO motion (stream, seq, action, delta, data)
VALUES ('invoice_789', 2, 803, 3000, '{"installment": 2}');
-- PARTIAL_PAY (3000 more, total 6000)

INSERT INTO motion (stream, seq, action, delta, data)
VALUES ('invoice_789', 3, 803, 4000, '{"installment": 3}');
-- PARTIAL_PAY (4000 more, total 10000 - paid in full)
```

---

## Part C: Merchant Payout

### Step 5: Payout to Merchant

```sql
-- From Workspace DO (t:store_101)
INSERT INTO matter (id, type, value, data)
VALUES ('payout_2026_06_20', 'payout', 45000, '{
  "merchant": "store_101",
  "period": "2026-06-15 to 2026-06-20",
  "orders": 25,
  "gross": 50000,
  "commission": 5000,
  "net": 45000
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('payout_2026_06_20', 1, 804, 804);  -- PAYOUT
```

---

## Part D: Expense Tracking

### Step 6: Record Expense

```sql
-- From Workspace DO (t:store_101)
INSERT INTO matter (id, form, type, qty, value, data)
VALUES ('exp_001', 'budget_supplies', 'expense', 1, 2500, '{
  "category": "supplies",
  "description": "Packaging materials",
  "vendor": "PackRight",
  "date": "2026-06-16"
}');

INSERT INTO motion (stream, seq, action, delta)
VALUES ('budget_supplies', 1, 806, -2500);  -- EXPENSE_REC
```

### Step 7: Budget Check

```sql
-- Check remaining budget
SELECT SUM(delta) FROM motion WHERE stream = 'budget_supplies';
-- Result: -2500 (spent 2500)

-- If budget was 10000, remaining = 7500
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Payment init | 801 | o:order_456 | Append |
| 2 | Payment success | 802 | o:order_456 | Phase |
| 3 | OR: Payment failed | 805 | o:order_456 | Phase |
| 4 | Partial payment | 803 | o:order_456 | Append |
| 5 | Payout to merchant | 804 | t:store_101 | Append |
| 6 | Expense recorded | 806 | t:store_101 | Append |
