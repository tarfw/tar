---
type: Schema
title: Matter table
description: The matter table holds all business entities — products, orders, expenses, documents, and more.
resource: docs://schemas/matter
tags: [schema, matter, table]
timestamp: 2026-07-04T00:00:00Z
---

# Matter table

Every business entity that has quantity, value, or lifecycle goes in `matter`.

## Columns

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | Unique ID (e.g., `m_8001`, `exp_8001`) |
| `form` | TEXT | FK to `form.id` in global Turso (null for custom items) |
| `title` | TEXT NOT NULL | Human-readable name |
| `type` | TEXT | Entity type: product, service, order, expense, document, lead, task... |
| `qty` | REAL | Quantity (stock count, units) |
| `unit` | TEXT | Unit of measure: piece, kg, litre, metre, bag, box, dozen |
| `value` | REAL | Selling price or amount |
| `data` | TEXT | JSON blob for type-specific fields |
| `scope` | TEXT | Workspace scope: `w:rest-101` |
| `active` | INTEGER | 1 = active, 0 = soft-deleted |
| `start` | TEXT | Birth timestamp (ISO 8601) |
| `end` | TEXT | Death timestamp (null = perpetual) |
| `life` | INTEGER | Duration in seconds from start |

## Matter types

| type | What it holds | Key data fields |
|---|---|---|
| `product` | Inventory item | cost_price, mrp, min_stock, batch, hsn |
| `service` | Bookable service | duration_min, category |
| `order` | Simple POS order | items, total, payment_method |
| `expense` | Business expense | category, vendor, payment_method, status |
| `document` | File attachment | file_name, mime_type, storage_key |
| `lead` | CRM lead | phone, source, status |
| `task` | Project task | assignee, due_date, priority |
| `payment` | Payment record | method, txn_id, status |

## Examples

### Pepsi (global product, workspace stock)

```
Global form (g:global):
  id: f_p001
  title: Pepsi
  data: { variants: [{name:"500ml", cost:20, mrp:24}] }

WorkspaceDO (w:rest-101):
  id: m_p001
  form: f_p001
  title: Pepsi 500ml
  type: product
  qty: 50
  unit: piece
  value: 22
  data: { cost_price: 18, mrp: 24, hsn: "2202" }
  scope: w:rest-101
  start: "2026-07-01T10:00:00Z"
  end: null  -- perpetual
```

### Expense (recurring rent)

```
id: exp_8001
title: Office Rent - July
type: expense
value: 15000
data: {
  "category": "rent",
  "vendor": "Landlord - Rajesh",
  "payment_method": "upi",
  "status": "paid",
  "recurring": true,
  "recurring_interval": "monthly"
}
scope: w:rest-101
```

## Related

- [Data Model](/architecture/data-model.md) — overview of all 5 tables
- [Motion types](/schemas/motion.md) — what goes in motion vs matter
- [Form](/schemas/form.md) — the global catalog that matter references
