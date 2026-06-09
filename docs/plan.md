# Database Schemas & Cost-Sync Optimization

This document defines the schemas, scope codes, event opcodes, identity model, and routing of the TAR local-first sync architecture under the Database-per-User model.

---

## Table of Contents
1. [Schema Definitions](#1-schema-definitions)
2. [Scope Code & Database Routing](#2-scope-code--database-routing)
3. [Storefront & CMS Layout](#3-storefront--cms-layout)
4. [Opcode Write Strategy & Storage Tiers](#4-opcode-write-strategy--storage-tiers)
5. [Identity & Profile Sync](#5-identity--profile-sync)
6. [Dynamic Forms](#6-dynamic-forms)
7. [Pricing, Turso Costs & P&L](#7-pricing-turso-costs--pl)

---

## 1. Schema Definitions

### matter (Core Catalog / Blueprints)
| Column | Type | Details |
| :--- | :--- | :--- |
| **id** | TEXT | PRIMARY KEY (e.g. `prod_thermos_99`, `usr_googleid`) |
| **code** | TEXT | UNIQUE SKU or code |
| **type** | TEXT | NOT NULL (`'product'`, `'task'`, `'profile'`, `'form'`, `'note'`) |
| **scope** | TEXT | NOT NULL routing scope code (e.g., `g`, `p`, `s:102`) |
| **owner** | TEXT | Creator ID |
| **title** | TEXT | Display title |
| **public** | INT | Visibility toggle (1 = public, 0 = private) |
| **data** | TEXT | Custom fields stored as JSON |
| **time** | TEXT | Creation audit timestamp |

### mass (Realizations / Stock / Slot / Variants)
| Column | Type | Details |
| :--- | :--- | :--- |
| **id** | TEXT | PRIMARY KEY (e.g., `mas_stock_99`) |
| **matter** | TEXT | References matter(id) |
| **type** | TEXT | NOT NULL (`'stock'`, `'slot'`, `'cart'`, `'ticket'`, `'lead'`, `'trip'`) |
| **scope** | TEXT | Slot partition scope code |
| **qty** | REAL | Stock count, weight, or slot count |
| **value** | REAL | Price / valuation / cost |
| **active** | INT | Active toggle (1 = active, 0 = retired) |
| **variant**| INT | Variant ordinal index (option array index) |
| **mark** | INT | Last sequence folded into qty (compaction watermark) |
| **geo** | TEXT | H3 spatial hexagon coordinates |
| **start** | TEXT | Start timestamp (shifts / rosters / bookings) |
| **end** | TEXT | End timestamp (shifts / rosters / bookings) |
| **data** | TEXT | Dynamic attributes |
| **time** | TEXT | Registration audit timestamp |

### motion (Kinetic Ledger / Append-only & Phase updates)
`WITHOUT ROWID` with PRIMARY KEY `(stream, seq)`
| Column | Type | Details |
| :--- | :--- | :--- |
| **stream** | TEXT | PK (1/2) - Timeline group ID (matches `mass.id` or `matter.id`) |
| **seq** | INT | PK (2/2) - Offline monotonic sequence (unixepoch_ms * 1000 + nonce) |
| **action** | INT | NOT NULL - Action opcode |
| **phase** | INT | In-place lifecycle state index (mutated in-place to save sync cost) |
| **delta** | REAL | Numeric offset / change value |
| **data** | TEXT | JSON payload (with event timeline history in `ph`) |

### relation (Structural Network Graph)
| Column | Type | Details |
| :--- | :--- | :--- |
| **src** | TEXT | PK (1/3) - Source entity ID (`matter.id`) |
| **tgt** | TEXT | PK (2/3) - Target entity ID (`matter.id`) |
| **type** | TEXT | PK (3/3) - Link class (`'parent-child'`, `'blocked_by'`, `'assigned_to'`, `'submits_to'`) |
| **weight**| REAL | Order sort index / link strength coefficient |
| **time** | TEXT | Relation establishment timestamp |

---

## 2. Scope Code & Database Routing

Queries route to physical SQLite files based on scope code prefixes:

| Scope Prefix | Scope Class | Target Local DB (Device) | Remote Sync DB (Turso Cloud) |
| :--- | :--- | :--- | :--- |
| `p` | Personal | `user_${self_id}.db` | *None (Local Only)* |
| `g` | Global | `global.db` (Local Cache) | API Cache / Workers |
| `f:{id}` | Family | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `t:{id}` | Team / Work | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `r:{id}` | Friends | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `s:{id}` | Storefront | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `w:{id}` | Warehouse | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `c:{id}` | Client / CRM| `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `m:{id}` | Campaign | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `x:{id}` | Surveys / ERP| `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `h:{id}` | HR / Staff | `user_sync_${owner_id}.db` | `db_${owner_id}` |
| `d` | Logistics | `user_sync_${owner_id}.db` | `db_${owner_id}` |

---

## 3. Storefront & CMS Layout

```text
  ╔═════════════════════════════════════════════════════════════════════╗
  ║ Storefront & CMS Layout Architecture Mapping                        ║
  ╠═════════════════════════════════════════════════════════════════════╣
  ║  1. Matter (Core Identity / Blueprint Template)                     ║
  ║  ┌───────────────────────────────────────────────────────────────┐  ║
  ║  │  id:    "comp_product_grid"    type:  "layout"                │  ║
  ║  │  data:  {"style": "masonry_3_cols", "limit": 6}               │  ║
  ║  └───────────────────────────────────────────────────────────────┘  ║
  ║                                  │                                  ║
  ║                                  ▼ Defines Structure                ║
  ║  2. Mass (Specific Page Slot Realization)                           ║
  ║  ┌───────────────────────────────────────────────────────────────┐  ║
  ║  │  id:     "slot_home_featured"  type:   "slot"                 │  ║
  ║  │  matter: "comp_product_grid"   scope:  "s:102/homepage"       │  ║
  ║  └───────────────────────────────────────────────────────────────┘  ║
  ║             │                                       │               ║
  ║             ▼ Arranged via relation                 ▼ Logged in     ║
  ║                                                     │  motion       ║
  ║  3. Relation (Hierarchy & Order)                    ▼               ║
  ║  ┌─────────────────────────────────┐   4. Motion (Interactions)     ║
  ║  │ src:    "slot_home_featured"    │   ┌────────────────────────┐   ║
  ║  │ tgt:    "prod_tshirt"           │   │ stream: "slot_ho..."   │   ║
  ║  │ type:   "parent-child"          │   │ action: 601 (Impress)  │   ║
  ║  │ weight: 1.0                     │   │ data:   {"click": true}│   ║
  ║  └─────────────────────────────────┘   └────────────────────────┘   ║
  ╚═════════════════════════════════════════════════════════════════════╝
```

---

## 4. Opcode Write Strategy & Storage Tiers

### Storage Tiers & Lifecycle
* **Local (Stays Local)**: Private client state stored in `user_${self_id}.db` (e.g., carts, wishlists, personal todos). Never synced to cloud.
* **Collab (Collaborative Sync)**: Active operational data in `user_sync_${owner_id}.db` synced via Turso (e.g., active orders, stock levels).
* **S3 (Archival)**: Historical `motion` ledgers are deleted from Turso and archived to S3 during day-close compaction. Active balances fold into `mass.qty` (monitored via `mass.mark` watermark).

### Opcode Write Strategies
* **Local User**: Stored only in **Local** database (100% sync cost savings).
* **Phase Update**: Updates `phase` column in-place in **Collab** database (70%-85% sync cost savings).
* **Append**: Appends new rows to **Collab** database (standard insert for ledgers, archived to **S3** at day-close).

| Opcode Group | Write Strategy | Target DB | Example Opcodes |
| :--- | :--- | :--- | :--- |
| **Local Cart & Wishlist** | **Local User** | `user_${self_id}.db` | `CART_ADD (102)`, `CART_REMOVE (103)`, `WISHLISTED (114)` |
| **Local Private Tasks** | **Local User** | `user_${self_id}.db` | `TASK_ASSIGNED (504)` |
| **Sales & Payments Logs** | **Append** | `user_sync_${owner_id}.db` | `SOLD (101)`, `SALE (201)`, `PAYMENT_INITIATED (801)` |
| **Order & Job Lifecycle** | **Phase Update**| `user_sync_${owner_id}.db` | `CHECKOUT (104)`, `CONFIRMED (106)`, `PREPARING (107)`, `READY (108)`, `DELIVERED (109)` |
| **Ticket & Helpdesk Jobs** | **Phase Update**| `user_sync_${owner_id}.db` | `RESOLVED (308)`, `TOKEN_CALLED (209)`, `TOKEN_SERVED (210)` |
| **CRM Leads & Operations** | **Phase Update**| `user_sync_${owner_id}.db` | `CONTACTED (304)`, `CONVERTED (305)` |
| **Logistics & Transit States**| **Phase Update**| `user_sync_${owner_id}.db` | `IN_TRANSIT (402)`, `DRIVER_ASSIGNED (403)`, `ETA_UPDATED (404)` |
| **ERP, SCM & Admin Logs** | **Append** | `user_sync_${owner_id}.db` | `SHIFT_START (202)`, `SHIFT_END (204)`, `PAYROLL (503)`, `INVOICE_GENERATED (110)` |

### Complete Opcode Directory
| ID | Opcode | Strategy | ID | Opcode | Strategy | ID | Opcode | Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **101** | `SOLD` | Append | **301** | `STORE_VISIT` | Append | **506** | `LEAVE_REQ` | Append |
| **102** | `CART_ADD` | Local | **302** | `REVIEW` | Append | **507** | `APPROVED` | Phase |
| **103** | `CART_REMOVE` | Local | **303** | `LEAD_CREATED`| Append | **508** | `REJECTED` | Phase |
| **104** | `CHECKOUT` | Phase | **304** | `CONTACTED` | Phase | **601** | `PUSH_SENT` | Append |
| **105** | `ORDER_PLACED` | Append | **305** | `CONVERTED` | Phase | **602** | `SMS_SENT` | Append |
| **106** | `CONFIRMED` | Phase | **306** | `TICKET_OPEN` | Append | **603** | `REFERRAL` | Append |
| **107** | `PREPARING` | Phase | **307** | `REPLY` | Append | **604** | `FORM_SUBMIT` | Append |
| **108** | `READY` | Phase | **308** | `RESOLVED` | Phase | **701** | `BOOKED` | Append |
| **109** | `DELIVERED` | Phase | **309** | `B_DAY_OFFER` | Append | **702** | `COMPLETED` | Phase |
| **110** | `INVOICE_GEN` | Append | **401** | `DISPATCHED` | Append | **703** | `CANCELLED` | Phase |
| **111** | `REFUND` | Append | **402** | `IN_TRANSIT` | Phase | **801** | `PAY_INIT` | Append |
| **112** | `RENEWAL_DUE` | Append | **403** | `DRIV_ASSIGN` | Phase | **802** | `PAY_SUCCESS` | Phase |
| **113** | `COUPON_APP` | Append | **404** | `ETA_UPDATED` | Phase | **803** | `PARTIAL_PAY` | Phase |
| **114** | `WISHLISTED` | Local | **405** | `TRANS_OUT` | Append | **804** | `PAYOUT` | Append |
| **201** | `SALE` | Append | **406** | `TRANS_IN` | Append | **805** | `PAY_FAILED` | Phase |
| **202** | `SHIFT_START` | Append | **407** | `RETURN_REQ` | Append | **806** | `EXPENSE_REC` | Append |
| **203** | `BREAK` | Append | **408** | `PICKUP_SCH` | Phase | **901** | `BOOKING` | Append |
| **204** | `SHIFT_END` | Append | **409** | `PICKED_UP` | Phase | **902** | `ASSIGNED` | Phase |
| **205** | `CASH_CLOSE` | Append | **410** | `DELIV_ATTEMPT`| Phase | **903** | `RIDE_REQ` | Append |
| **206** | `ORDER_FIRE` | Append | **501** | `CLOCK_IN` | Append | **904** | `DRIV_MATCH` | Phase |
| **207** | `ITEM_READY` | Phase | **502** | `CLOCK_OUT` | Append | **905** | `IN_RIDE` | Phase |
| **208** | `TOKEN_ISSUED` | Append | **503** | `PAYROLL` | Append | **906** | `RECRUIT_APPL`| Append |
| **209** | `TOKEN_CALLED` | Phase | **504** | `TASK_ASSIGN` | Local | **907** | `PROCURE_REQ` | Append |
| **210** | `TOKEN_SERVED` | Phase | **505** | `PERF_NOTE` | Append | — | — | — |

---

## 5. Identity & Profile Sync

* **Local Isolation**: Private data stays in local-only `user_${google_user_id}.db`.
* **Profile Cache**: Public attributes cached in `matter` (`usr_${id}`, `type = 'profile'`).
* **JWT Access Claims**: `db_url = libsql://db_owner_id.turso.io`, `scopes = ["t:99", "f:402"]` to restrict Turso sync access.

---

## 6. Dynamic Forms

* **Definition (matter)**: `id = form_${name}`, `type = 'form'`, `data = {"fields": [...]}`.
* **Assignment (mass)**: `id = mas_form_run_${sub_id}`, `matter = form_${name}`, `type = 'form_task'`.
* **Submission (motion)**: `stream = mas_form_run_${sub_id}`, `seq = unixepoch_ms * 1000 + nonce`, `action = 604`, `data = values`.

---

## 7. Pricing, Turso Costs & P&L

### Pricing Plans
* **Free Tier**: Local only, global search, storefront browsing.
* **Collaboration Tier**: ₹500/month per user (Turso cloud sync, real-time sharing).

### Turso Chennai Scale Overage Cost (100k active DBs, 80M writes/mo)
* **Base Plan**: Turso Scaler Plan ($24.92/mo or ₹2,081/mo).
* **Sync Bandwidth (Overage)**: 9,600 GB @ $0.25/GB = $2,394.00/mo.
* **Consolidated Sync Cost**: **$2,418.92/month (₹2,01,980/month)**.

### Monthly P&L Projection (100k Plan 2 Users)
| Category | Monthly Amount (USD) | Monthly Amount (INR) | Margin % / Notes |
| :--- | :--- | :--- | :--- |
| **Gross Revenue** | $634,730.00 | ₹5,30,00,000.00 | 100.00% |
| **Database Sync (Turso)**| $2,418.92 | ₹2,01,980.00 | 0.38% |
| **Hosting & Network** | $500.00 | ₹41,750.00 | 0.08% |
| **AI LLM wholesales** | $11,976.00 | ₹10,00,000.00 | 1.89% |
| **Total Expenses** | $14,894.92 | ₹12,43,730.00 | **2.35%** |
| **Net Operating Profit**| **$619,835.08** | **₹5,17,56,270.00** | **97.65% Net Margin** |
