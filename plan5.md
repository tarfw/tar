cHere's the complete model following the "one entity, many roles" pattern, with all the details from your original spec:

---

## Workspace Entity Model

```
WORKSPACE (w:{subdomain})
│
├── PERSON (who)
│   ├── Team Member (internal)
│   │   ├── Staff
│   │   ├── Manager
│   │   └── Admin
│   │
│   └── External (outside the org)
│       ├── Customer (buyer)
│       └── Contact (vendor, partner)
│
├── COMPANY (organization)
│   ├── Business
│   ├── Vendor
│   └── Partner
│
├── ITEM (what)
│   ├── Product (physical goods)
│   ├── Listing (catalog/real estate)
│   ├── Service (appointments, offerings)
│   ├── Document (files, contracts)
│   └── Asset (equipment, tools)
│
├── EVENT (what happened)
│   ├── Transaction
│   │   ├── Sale
│   │   └── Refund
│   │
│   ├── Logistics
│   │   ├── Shipment
│   │   └── Delivery
│   │
│   ├── Schedule
│   │   ├── Booking
│   │   └── Cancellation
│   │
│   ├── Work
│   │   ├── Clock In / Out
│   │   └── Project / Assignment
│   │
│   ├── Money
│   │   ├── Expense
│   │   └── Write Off
│   │
│   ├── Pipeline
│   │   ├── Deal
│   │   └── Stage
│   │
│   └── Inventory
│       ├── Adjust
│       └── Write Off
│
├── TASK (pending actions)
│   ├── Pending
│   ├── In Progress
│   └── Done
│
└── RELATIONSHIP (who links to whom)
    ├── order  → customer
    ├── booking → customer
    ├── ticket → customer
    ├── shipment → order
    ├── assigned_to → project → person
    ├── works_at → person → company
    └── vendor_for → company → item
```

---

## Person Roles

| Role | Type | Context | Example |
|------|------|---------|---------|
| Staff | Internal | Day-to-day operations | Cashier, front desk |
| Manager | Internal | Oversight, approvals | Store manager |
| Admin | Internal | Full workspace control | Owner |
| Customer | External | Transaction party | Buyer, client |
| Contact | External | Business relationship | Vendor rep, partner |

**One table, one entity. Role is just a field.**

---

## Company Types

| Type | Purpose | Example |
|------|---------|---------|
| Business | Primary organization | Your company |
| Vendor | Supplier | Wholesaler, distributor |
| Partner | Collaborative org | Referral partner |

---

## Item Types

| Type | Purpose | Example |
|------|---------|---------|
| Product | Physical goods | Inventory, merchandise |
| Listing | Catalog items | Real estate, subscriptions |
| Service | Time-based offerings | Appointments, consultations |
| Document | Files/contracts | Receipts, agreements |
| Asset | Equipment/tools | Computers, furniture |

---

## Event Types

| Event | What Happened | Links To |
|-------|---------------|----------|
| Sale | Transaction completed | Order |
| Refund | Money returned | Order |
| Status Change | State updated *(Inline entity state transition / event side-effect)* | Any entity |
| Booking | Appointment made | Booking |
| Cancel | Booking cancelled | Booking |
| Clock In | Staff arrived | Person |
| Clock Out | Staff left | Person |
| Tracking | Shipment updated | Shipment |
| Delivered | Shipment fulfilled | Shipment |
| Stage | Deal advanced *(Inline entity state transition / CRM Pipeline view)* | Deal |
| Activity | Call/meeting logged | Deal, Person |
| Adjust | Stock changed | Product |
| Write Off | Stock removed | Product |
| Expense | Cost recorded | Expense |
| Assignment | Task assigned | Project |

---

## Turso Tables

| Table | Stores | Key Fields |
|-------|--------|------------|
| `matter` | Person, Company, Item | id, type, title, value, status, data |
| `motion` | Events (what happened) | id, type, ref, by, data, timestamp |
| `graph` | Relationships | src, rel, tgt |
| `inbox` | Pending tasks | id, type, title, ref, due, status |

---

## OKF Structure (S3 Config)

```
workspaces/{scope}/
│
├── index.md              → WorkspaceRoot (name, modules)
├── business/
│   └── profile.md        → BusinessProfile (who you are)
├── people/
│   └── roles.md          → RoleConfiguration (role → skills)
├── team/
│   ├── members.md        → TeamConfiguration (staff + channels)
│   └── canvas.md         → CanvasLayout (active UI blocks)
├── products/
│   └── catalog.md        → ProductCatalog (item listings)
├── skills/
│   └── {module}.md       → Skill (agent instructions)
├── site/
│   ├── brand.md          → BrandTokens (design tokens)
│   ├── design.md         → DesignSystem (full design)
│   ├── pages.md          → SitePages (routing)
│   ├── layouts/*.json    → PageLayout (JSON structure)
│   └── posts/*.md        → Post (content)
├── faqs/
│   └── common.md         → FAQ (questions + answers)
├── policies/
│   └── {name}.md         → Policy (business rules)
└── inbox/
    └── index.md          → Notifications
```

---

## How They Connect

| OKF (brain — knows how) | Turso (memory — knows what) |
|--------------------------|----------------------------|
| `team/members.md` | `person` (role=staff) |
| `skills/orders.md` | `motion` (type=sale) |
| `products/catalog.md` | `matter` (type=product) |
| `site/layouts/*.json` | `graph` (relationships) |
| `team/canvas.md` | `inbox` (pending tasks) |

---

## Agent Resolution Flow

```
User: "Record a sale"
         │
         ▼
    ┌─────────────────┐
    │ WHICH module?   │ ← intent-resolver → orders skill
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ WHAT items?     │ ← matter WHERE type='product'
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ HOW to pay?     │ ← action_record_sale params
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ EXECUTE         │
    │  • motion (sale)
    │  • graph (placed_by)
    │  • inbox (order)
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ UPDATE UI       │ ← canvas.md (refresh blocks)
    └─────────────────┘
```

---

**Learning is sold as a commodity** — courses and training are `matter` items (`type=product` or `type=service`). No separate LMS entity model.
