# CRM & Support Flow — End to End

How customer relationship management and support tickets work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Customer │───▶│   Lead   │───▶│  Agent   │───▶│ Ticket   │
│  (App)   │    │  (DO)    │    │  (App)   │    │  (DO)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Lead Management

### Step 1: Store Visit

```
Customer visits store
  → Sales staff logs visit
  → Lead created in Storefront DO
```

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, type, value, data)
VALUES ('lead_456', 'lead', 5000, '{
  "name": "Priya",
  "phone": "+919876543210",
  "interest": "Sneakers",
  "source": "walk-in"
}');

INSERT INTO motion (stream, seq, action, data)
VALUES ('lead_456', 1, 301, '{"store":"store_101"}');  -- STORE_VISIT
```

### Step 2: Review

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('lead_456', 2, 302, '{
  "rating": 4,
  "notes": "Interested in Nike Air Max"
}');
-- REVIEW
```

### Step 3: Contacted

```sql
UPDATE motion SET phase = 304 WHERE stream = 'lead_456';
-- CONTACTED
```

### Step 4: Converted

```
Customer makes purchase
  → Lead converted to customer
```

```sql
UPDATE motion SET phase = 305 WHERE stream = 'lead_456';
-- CONVERTED

-- Create customer profile
INSERT INTO form (id, type, title, data)
VALUES ('cust_priya_123', 'profile', 'Priya', '{
  "phone": "+919876543210",
  "email": "priya@email.com"
}');
```

---

## Part B: Ticket Management

### Step 5: Ticket Open

```
Customer reports issue
  → Support agent creates ticket
  → Ticket in Storefront DO
```

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, type, data)
VALUES ('ticket_789', 'ticket', '{
  "subject": "Wrong size delivered",
  "customer": "cust_priya_123",
  "order": "order_456",
  "priority": "high"
}');

INSERT INTO motion (stream, seq, action, data)
VALUES ('ticket_789', 1, 306, '{
  "agent": "agent_rahul",
  "channel": "whatsapp"
}');
-- TICKET_OPEN
```

### Step 6: Reply

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('ticket_789', 2, 307, '{
  "from": "agent_rahul",
  "text": "I apologize for the inconvenience. We will arrange a pickup today."
}');
-- REPLY
```

### Step 7: Customer Reply

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('ticket_789', 3, 307, '{
  "from": "cust_priya_123",
  "text": "Thank you. When will the pickup happen?"
}');
-- REPLY
```

### Step 8: Resolved

```sql
UPDATE motion SET phase = 308 WHERE stream = 'ticket_789';
-- RESOLVED

UPDATE matter SET active = 0 WHERE id = 'ticket_789';
```

---

## Part C: Birthday Offers

### Step 9: Auto Birthday Offer

```
AI agent checks birthdays daily
  → Auto-generates birthday coupon
  → Push notification to customer
```

```sql
-- From Storefront DO (s:store_101)
INSERT INTO motion (stream, seq, action, data)
VALUES ('cust_priya_123', 1, 309, '{
  "type": "birthday_offer",
  "discount": 20,
  "code": "BDAY20",
  "expires": "2026-06-30"
}');
-- B_DAY_OFFER
```

---

## Part D: Ticket Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Ticket Lifecycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │  OPEN   │───▶│CONTACTED│───▶│  WORKING │───▶│RESOLVED │ │
│  │  (306)  │    │  (304)  │    │  (307)   │    │  (308)  │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │                                             │       │
│       │            ┌─────────┐                      │       │
│       └───────────▶│ CLOSED  │◀─────────────────────┘       │
│                    │  (308)  │                               │
│                    └─────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Store visit | 301 | s:store_101 | Append |
| 2 | Review | 302 | s:store_101 | Append |
| 3 | Lead created | 303 | s:store_101 | Append |
| 4 | Contacted | 304 | s:store_101 | Phase |
| 5 | Converted | 305 | s:store_101 | Phase |
| 6 | Ticket open | 306 | s:store_101 | Append |
| 7 | Reply | 307 | s:store_101 | Append |
| 8 | Resolved | 308 | s:store_101 | Phase |
| 9 | Birthday offer | 309 | s:store_101 | Append |
