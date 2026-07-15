# Database Rules

> AI must follow these rules when writing SQL, creating workspaces, and designing modules.

---

## 1. Databases

| Database | Prefix | Purpose |
|----------|--------|---------|
| `g:global` | `g:` | Shared catalog, templates, vectors |
| `ws:{id}` | `ws:` | Workspace-specific data |

**Always specify the database prefix in queries.**
```sql
-- CORRECT
SELECT * FROM g:global.catalog WHERE type = 'product';
SELECT * FROM ws:anjalis.matter WHERE type = 'stock';

-- WRONG (AI will be confused)
SELECT * FROM form WHERE type = 'product';
```

---

## 2. Tables

### Global Database (`g:global`)

| Table | Stores | Columns |
|-------|--------|---------|
| **catalog** | Product/service/action templates (shared across all workspaces) | id, type, title, data, scope |
| **embeddings** | Vector embeddings for similarity search | id, type, data, embedding, scope |

### Workspace Database (`ws:{id}`)

| Table | Stores | Columns |
|-------|--------|---------|
| **form** | Workspace-specific overrides (custom prices, custom settings) | id, type, title, value, data, scope |
| **matter** | Current state — stock, orders, staff, customers, settings | id, type, title, value, data, scope |
| **motion** | Events — every action logged (sales, clock-ins, status changes) | id, type, data, created_by, created_at, scope |
| **graph** | Relationships — links between items | src, rel, tgt, active, time |
| **inbox** | Actionable items — tasks, alerts, approvals from any module | id, scope, type, title, status, urgency, s3_key, data, created_at, due_at |
| **memory** | Workspace AI memory — customer preferences, patterns | id, type, data, embedding, scope |

---

## 3. Table Rules

### catalog (global)

```
Purpose: Shared product/service definitions. One row per item.
Type values: product, service, class, procedure, package, action, skill, layout, category
When to write: When adding a new product/service/action template
When to read: When listing available products/services/actions

Example:
  id: prod_dosa
  type: product
  title: Dosa
  data: {"price": 100, "unit": "plate", "category": "south_indian"}
  scope: global
```

### form (workspace)

```
Purpose: Workspace-specific overrides. Only store differences from global catalog.
Type values: product, service, setting, policy
When to write: When workspace changes price, adds custom product, changes setting
When to read: When showing workspace-specific data

Example:
  id: ws_anjalis_dosa
  type: product
  title: Dosa
  value: 120
  data: {"our_price": 120, "notes": "larger portion than standard"}
  scope: ws:anjalis
```

### matter (workspace)

```
Purpose: Current state. What EXISTS right now.
Type values: stock, order, appointment, project, invoice, staff, customer, setting, expense, member, patient, booking, student, task_item, asset, vendor
When to write: When creating/updating current state
When to read: When showing current data

Example:
  id: stock_dosa
  type: stock
  title: Dosa
  value: 50
  data: {"batch": "JUL-13", "location": "kitchen", "min_stock": 20}
  scope: ws:anjalis
```

### motion (workspace)

```
Purpose: Event log. What HAPPENED. Append-only, never update or delete.
Type values: sale, booking, status_change, clock_in, clock_out, stock_adjustment, restock, payment, feedback, checkin, visit, milestone, assignment, completion
When to write: When any action happens (sale, clock-in, status change)
When to read: When showing history, analytics, timeline

Example:
  id: mov_001
  type: sale
  data: {"order_id": "order_49", "item": "Dosa", "qty": 2, "total": 200, "method": "upi"}
  created_by: priya
  created_at: 2026-07-13T14:30:00Z
  scope: ws:anjalis
```

### graph (workspace)

```
Purpose: Relationships. How things connect.
Relations: belongs_to, created_by, contains, customer, in_category, works_at, specializes_in, member_of, booked, for_order, paid_by, assigned_to, depends_on
When to write: When linking two items
When to read: When traversing relationships

Example:
  src: order_49
  rel: belongs_to
  tgt: anjalis
  active: 1
  time: 2026-07-13T14:30:00Z
```

### inbox (workspace)

```
Purpose: Flat actionable items for user — tasks, approvals, alerts from ANY module.
Status values: open | done | archived
Urgency values: now | next | normal
When to write: When any module action needs human attention
When to read: When showing workspace inbox — single query, no joins

Columns:
  id          TEXT PRIMARY KEY
  scope       TEXT NOT NULL          -- workspace (e.g. ws:anjalis)
  type        TEXT NOT NULL          -- free-form module name (order, task, procurement, payroll...)
  title       TEXT NOT NULL          -- human-readable description
  status      TEXT DEFAULT 'open'    -- open | done | archived
  urgency     TEXT DEFAULT 'normal'  -- now | next | normal
  s3_key      TEXT                   -- pointer to heavy JSON in S3 (optional)
  data        TEXT                   -- small JSON for inline fields (<2KB)
  created_at  INTEGER
  due_at      INTEGER

Index: CREATE INDEX idx_inbox_scope_status ON inbox(scope, status);

Rule: If data blob > 2KB or contains arrays > 10 items → store in S3, put key in s3_key.

Example (small data, inline):
  id: inbox_001
  scope: ws:anjalis
  type: order
  title: New order #49 — Dosa x2
  status: open
  urgency: now
  data: {"order_id": "order_49", "total": 200}
  s3_key: null

Example (heavy data, S3 pointer):
  id: inbox_002
  scope: ws:anjalis
  type: procurement
  title: PO #123 awaiting approval — 47 line items
  status: open
  urgency: now
  data: {"po_id": "po_123", "amount": 85000}
  s3_key: ws:anjalis/inbox/po_123_detail.json
```

### memory (workspace)

```
Purpose: AI memory for this workspace. Customer preferences, patterns, context.
Type values: customer, preference, pattern, note
When to write: When AI learns something about a customer or pattern
When to read: When AI needs context for decisions

Example:
  id: mem_neha_001
  type: customer
  title: Neha preferences
  data: {"likes": "filter coffee", "allergic_to": "nuts", "visit_frequency": "weekly"}
  scope: ws:anjalis
```

### embeddings (global)

```
Purpose: Vector embeddings for similarity search across catalog.
When to write: When adding new catalog item
When to read: When searching for similar products/services

Example:
  id: prod_dosa
  type: product
  data: "Dosa - South Indian rice crepe"
  embedding: [0.12, -0.34, 0.56, ...]
  scope: global
```

---

## 3b. S3 Pointer Pattern

```
Rule: DB stores the index. S3 stores the payload.

Use S3 pointer when:
  - data blob > 2KB
  - arrays with > 10 items (line items, audit logs, subtasks)
  - generated reports, PDFs, exports
  - any data only needed on detail view, not list view

Keep in DB (inline data) when:
  - IDs, amounts, status flags
  - Short titles, descriptions
  - Small data needed for filtering/sorting
  - Subtasks list < 5 items

Pointer columns:
  matter.s3_key  TEXT   -- pointer to heavy entity data
  inbox.s3_key   TEXT   -- pointer to heavy task detail

S3 key convention:
  {scope}/data/{table}_{id}.json
  Example: ws:anjalis/data/matter_order_49.json
           ws:anjalis/inbox/po_123_detail.json

Access pattern:
  List view  → query DB only (no S3 fetch)
  Detail view → fetch s3_key on demand, only when record opened
```

---

## 4. Module Rules

### Orders Module

```
Tables used: catalog, matter, motion, graph, inbox

Flow:
  1. Read catalog for product definitions
  2. INSERT matter (type: order) — create order
  3. INSERT motion (type: sale) — log sale event
  4. INSERT graph — link order to workspace, customer, items
  5. INSERT inbox — notify staff (urgency: now)

SQL pattern:
  -- Create order
  INSERT INTO ws:{id}.matter (id, type, title, value, data, scope)
  VALUES ('order_{auto_id}', 'order', 'Order #{auto_id}', {total}, '{"items":[...]}', 'ws:{id}');
  
  -- Log sale
  INSERT INTO ws:{id}.motion (id, type, data, created_by, created_at, scope)
  VALUES ('mov_{auto_id}', 'sale', '{"order_id":"order_{id}","total":{total}}', '{staff_id}', datetime('now'), 'ws:{id}');
  
  -- Link order
  INSERT INTO ws:{id}.graph (src, rel, tgt, active, time)
  VALUES ('order_{id}', 'belongs_to', '{workspace_id}', 1, datetime('now'));
  
  -- Add to inbox (no assigned_to — any staff picks it up)
  INSERT INTO ws:{id}.inbox (id, scope, type, title, status, urgency, data, created_at)
  VALUES ('inbox_{auto_id}', 'ws:{id}', 'order', 'New order #{id} — {items_summary}', 'open', 'now', '{"order_id":"order_{id}","total":{total}}', unixepoch());
```

### Inventory Module

```
Tables used: matter, motion, graph

Flow:
  1. matter (type: stock) — current quantities
  2. motion (type: stock_adjustment) — every change logged
  3. motion (type: restock) — restock events
  4. graph — link stock to product in catalog

SQL pattern:
  -- Check stock
  SELECT title, value, data FROM ws:{id}.matter 
  WHERE type = 'stock' AND title = '{product}';
  
  -- Deduct stock (atomic)
  UPDATE ws:{id}.matter 
  SET value = value - {qty}, data = json_set(data, '$.last_sold', datetime('now'))
  WHERE type = 'stock' AND title = '{product}' AND value >= {qty};
  
  -- Log adjustment
  INSERT INTO ws:{id}.motion (id, type, data, created_by, created_at, scope)
  VALUES ('mov_{auto_id}', 'stock_adjustment', '{"product":"{product}","qty":-{reason}}', '{staff_id}', datetime('now'), 'ws:{id}');
```

### Bookings Module

```
Tables used: matter, motion, graph, inbox

Flow:
  1. matter (type: appointment) — booking details
  2. motion (type: booking) — booking event
  3. graph — link appointment to customer, staff, service
  4. inbox — notify assigned staff (urgency: next)

SQL pattern:
  -- Create booking
  INSERT INTO ws:{id}.matter (id, type, title, value, data, scope)
  VALUES ('appt_{auto_id}', 'appointment', '{service} - {customer}', {price}, '{"time":"{time}","staff":"{staff_id}"}', 'ws:{id}');
  
  -- Log booking
  INSERT INTO ws:{id}.motion (id, type, data, created_by, created_at, scope)
  VALUES ('mov_{auto_id}', 'booking', '{"appt_id":"appt_{id}","customer":"{customer}","service":"{service}"}', '{staff_id}', datetime('now'), 'ws:{id}');
  
  -- Add to inbox
  INSERT INTO ws:{id}.inbox (id, scope, type, title, status, urgency, data, created_at, due_at)
  VALUES ('inbox_{auto_id}', 'ws:{id}', 'booking', '{service} at {time} — {customer}', 'open', 'next', '{"appt_id":"appt_{id}","staff":"{staff_id}"}', unixepoch(), unixepoch('{due_time}'));
```

### CRM Module

```
Tables used: matter, motion, graph, memory

Flow:
  1. matter (type: customer) — customer data
  2. motion — interaction history
  3. graph — link customer to orders, bookings
  4. memory — AI learns preferences

SQL pattern:
  -- Get customer
  SELECT * FROM ws:{id}.matter WHERE type = 'customer' AND title = '{name}';
  
  -- Get customer history
  SELECT m.* FROM ws:{id}.motion m
  JOIN ws:{id}.graph g ON g.tgt = m.id
  WHERE g.src = '{customer_id}' AND g.rel = 'customer'
  ORDER BY m.created_at DESC;
  
  -- Save AI memory
  INSERT INTO ws:{id}.memory (id, type, title, data, scope)
  VALUES ('mem_{auto_id}', 'customer', '{customer} preferences', '{"likes":"...","dislikes":"..."}', 'ws:{id}');
```

### Staff Module

```
Tables used: matter, motion, graph

Flow:
  1. matter (type: staff) — staff details
  2. motion (type: clock_in/clock_out) — attendance
  3. graph — link staff to workspace, role

SQL pattern:
  -- Clock in
  INSERT INTO ws:{id}.motion (id, type, data, created_by, created_at, scope)
  VALUES ('mov_{auto_id}', 'clock_in', '{"staff":"{staff_id}","role":"{role}"}', '{staff_id}', datetime('now'), 'ws:{id}');
  
  -- Get staff hours today
  SELECT 
    json_extract(data, '$.staff') as staff_id,
    SUM(CASE WHEN type = 'clock_out' THEN json_extract(data, '$.duration') ELSE 0 END) / 60.0 as hours
  FROM ws:{id}.motion
  WHERE type IN ('clock_in', 'clock_out')
    AND created_at >= date('now')
  GROUP BY staff_id;
```

### Expenses Module

```
Tables used: matter, motion, graph

Flow:
  1. matter (type: expense) — expense record
  2. motion (type: payment) — payment event
  3. graph — link expense to category, vendor

SQL pattern:
  -- Record expense
  INSERT INTO ws:{id}.matter (id, type, title, value, data, scope)
  VALUES ('exp_{auto_id}', 'expense', '{description}', {amount}, '{"category":"{cat}","vendor":"{vendor}","status":"unpaid"}', 'ws:{id}');
  
  -- Mark paid
  UPDATE ws:{id}.matter 
  SET data = json_set(data, '$.status', 'paid', '$.paid_at', datetime('now'))
  WHERE id = '{expense_id}';
  
  INSERT INTO ws:{id}.motion (id, type, data, created_by, created_at, scope)
  VALUES ('mov_{auto_id}', 'payment', '{"expense_id":"{expense_id}","amount":{amount}}', '{staff_id}', datetime('now'), 'ws:{id}');
```

---

## 5. Query Rules

### Always Use Database Prefix

```sql
-- CORRECT
SELECT * FROM g:global.catalog WHERE type = 'product';
SELECT * FROM ws:anjalis.matter WHERE type = 'stock';

-- WRONG
SELECT * FROM form WHERE type = 'product';
SELECT * FROM matter WHERE type = 'stock';
```

### matter = Current State, motion = History

```sql
-- Current stock
SELECT * FROM ws:{id}.matter WHERE type = 'stock' AND title = 'Dosa';

-- Stock history (all changes)
SELECT * FROM ws:{id}.motion WHERE type = 'stock_adjustment' 
  AND data LIKE '%Dosa%' ORDER BY created_at DESC;
```

### Latest motion = Current Status

```sql
-- Get current status of order
SELECT data FROM ws:{id}.motion 
WHERE type = 'status_change' AND data LIKE '%order_49%'
ORDER BY created_at DESC LIMIT 1;
```

### graph for Joins

```sql
-- Get all orders for a workspace
SELECT m.* FROM ws:{id}.matter m
JOIN ws:{id}.graph g ON g.tgt = m.id
WHERE g.src = '{workspace_id}' AND g.rel = 'belongs_to' AND m.type = 'order';
```

### inbox — Single Query, No Joins

```sql
-- Get open inbox items for workspace (fast — indexed)
SELECT id, type, title, urgency, data, due_at
FROM ws:{id}.inbox
WHERE scope = 'ws:{id}' AND status = 'open'
ORDER BY
  CASE urgency WHEN 'now' THEN 1 WHEN 'next' THEN 2 ELSE 3 END,
  created_at DESC
LIMIT 50;

-- Mark done
UPDATE ws:{id}.inbox SET status = 'done' WHERE id = '{inbox_id}';

-- Any module writes to inbox the same way
INSERT INTO ws:{id}.inbox (id, scope, type, title, status, urgency, data, created_at)
VALUES ('inbox_{id}', 'ws:{id}', '{module_name}', '{description}', 'open', '{urgency}', '{small_json}', unixepoch());

-- For heavy data: store in S3, put key in inbox row
INSERT INTO ws:{id}.inbox (id, scope, type, title, status, urgency, s3_key, data, created_at)
VALUES ('inbox_{id}', 'ws:{id}', 'procurement', 'PO #123 — 47 items', 'open', 'now', 'ws:{id}/inbox/po_123_detail.json', '{"po_id":"po_123","amount":85000}', unixepoch());
```

### memory for AI Context

```sql
-- Get AI memory about a customer
SELECT * FROM ws:{id}.memory 
WHERE type = 'customer' AND title LIKE '%{customer_name}%';
```

---

## 6. Write Rules

| Rule | Why |
|------|-----|
| Always specify scope in INSERT | Prevents data leaking between workspaces |
| Never UPDATE motion | Events are immutable |
| Never DELETE motion | Events are permanent |
| Always INSERT into graph when linking | Relationships must be explicit |
| Always INSERT into inbox when action needed | Replaces tasks table — simpler, module-agnostic |
| Use json_set for partial updates | Don't overwrite entire data field |
| Use atomic SQL for stock | Prevent oversell: `UPDATE ... SET value = value - N WHERE value >= N` |
| Store data > 2KB in S3, put key in s3_key column | Keeps DB rows small, list queries fast |
| Fetch s3_key content only on detail view | Never fetch S3 on list/inbox load — list uses inline data only |
| inbox.type is free-form module name | All 80 modules write to same inbox table, no hardcoding |

---

## 7. Type Values Reference

### matter.type

| Type | Used By |
|------|---------|
| stock | Restaurant, Retail |
| order | Restaurant, Retail |
| appointment | Salon, Gym, Clinic |
| project | Agency |
| invoice | Agency, Retail |
| staff | All |
| customer | All |
| setting | All |
| expense | All |
| member | Gym |
| patient | Clinic |
| booking | Hotel |
| student | School |
| task_item | Agency |
| asset | All |
| vendor | Restaurant, Retail |
| purchase_order | Procurement |
| contract | Legal/CLM |
| payslip | HR/Payroll |
| work_order | Manufacturing |
| shipment | Logistics |
| ticket | Support |
| deal | CRM |
| listing | Real Estate |

### motion.type

| Type | Used By |
|------|---------|
| sale | Restaurant, Retail |
| booking | Salon, Gym, Clinic |
| status_change | All |
| clock_in | All |
| clock_out | All |
| stock_adjustment | Restaurant, Retail |
| restock | Restaurant, Retail |
| payment | All |
| feedback | All |
| checkin | Gym |
| visit | Clinic |
| milestone | Agency |
| assignment | All |
| completion | All |

### inbox.type (free-form module name — any of the 80 modules)

| Type | Module | Urgency |
|------|--------|---------|
| order | Orders/POS | now |
| booking | Bookings | next |
| task | Projects | now/next |
| ticket | Support | now |
| procurement | Procurement | now |
| payroll | HR/Payroll | next |
| contract | CLM | next |
| stock_alert | Inventory | now |
| deal | CRM | next |
| invoice | Finance/AR | now |
| expense | Expenses | normal |
| shipment | Logistics | now |
| any module name | Extended modules | now/next/normal |

> inbox.type is intentionally open — any of the 80 standard modules can write to inbox without any code change.

### graph.rel

| Relation | Meaning |
|----------|---------|
| belongs_to | Item belongs to workspace |
| created_by | Item created by staff |
| contains | Order contains product |
| customer | Order/booking for customer |
| in_category | Product in category |
| works_at | Staff works at workspace |
| specializes_in | Staff specializes in service |
| member_of | Person is member |
| booked | Person booked slot |
| for_order | Invoice for order |
| paid_by | Invoice paid by customer |
| assigned_to | Task assigned to staff |
| depends_on | Task depends on another task |
