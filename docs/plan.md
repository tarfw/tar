# Database Schemas & Cost-Sync Optimization

This document defines the database schemas, optimized scope codes, event opcodes, Google Identity integration, and dynamic routing of the TAR local-first sync architecture under the **Database-per-User (Owner-Database)** model.

---

## 1. Schema Definitions

The application defines four unified tables representing the physical, kinetic, and structural components of the system. Depending on the data's scope, these tables are instantiated across different isolated database files on the device.

### A. matter
*Intrinsic Identity (What it is — global catalog or definition template)*

| Column | Type | Details | Use Case |
| :--- | :--- | :--- | :--- |
| **id** | TEXT | PRIMARY KEY | Unique ID (e.g., `prod_thermos_99`, `usr_googleid`). |
| **code** | TEXT | UNIQUE | Human-readable unique code/SKU (e.g., `THERMOS_99`). |
| **type** | TEXT | NOT NULL | Entity category (e.g., `'product'`, `'task'`, `'profile'`, `'form'`). |
| **scope** | TEXT | NOT NULL | Scope code (e.g., `g`, `p`, `s:102`). See Scope Code Guide. |
| **owner** | TEXT | - | Entity creator or department (e.g., `'store_owner'`). |
| **title** | TEXT | - | Display title (e.g., `"Water Heater Pressure Leak"`). |
| **public** | INT | DEFAULT 0 | Visibility toggle (`1` = public catalog, `0` = private). |
| **data** | TEXT | - | Dynamic custom fields stored as stringified JSON. |
| **time** | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation audit timestamp. |

### B. mass
*Physical Realization (Where / How much / Price / Time slots)*

| Column | Type | Details | Use Case |
| :--- | :--- | :--- | :--- |
| **id** | TEXT | PRIMARY KEY | Unique slot/realization ID (e.g., `mas_stock_99`). |
| **matter** | TEXT | REFERENCES matter(id) | Links back to the core `matter` identity record. |
| **type** | TEXT | NOT NULL | Realization category (e.g., `'stock'`, `'slot'`). |
| **scope** | TEXT | NOT NULL | Physical slot partition scope code. |
| **qty** | REAL | - | Inventory stock level, weight, or slot count. |
| **value** | REAL | - | Currency price, valuation, or cost (e.g. `899.00`). |
| **active** | INT | DEFAULT 1 | Active control flag (`1` = active alert/slot, `0` = completed). |
| **geo** | TEXT | - | H3 spatial hexagon coordinates or lat/long. |
| **start** | TEXT | - | Start timestamp for shift roster, booking, or alarm. |
| **end** | TEXT | - | End timestamp for shift roster, booking, or task deadline. |
| **data** | TEXT | - | Dynamic attributes specific to the physical context. |
| **time** | TEXT | DEFAULT CURRENT_TIMESTAMP | Registration audit timestamp. |

### C. motion
*Kinetic Ledger (What happened — append-only stream of actions)*

| Column | Type | Details | Use Case |
| :--- | :--- | :--- | :--- |
| **id** | TEXT | PRIMARY KEY | Unique transaction log ID (e.g., `mot_deliv_101`). |
| **stream** | TEXT | NOT NULL | Timeline group ID (typically matches a `matter.id`). |
| **seq** | INT | NOT NULL | Monotonic sequential index to prevent out-of-order execution. |
| **action** | INT | NOT NULL | Action category numeric opcode (e.g., `105`, `802`). |
| **status** | TEXT | - | Phase in the state machine (e.g., `'READY'`, `'DELIVERED'`). |
| **delta** | REAL | - | Quantifiable change/offset (e.g., value adjustment `+250.00`). |
| **scope** | TEXT | NOT NULL | Context bucket of transaction execution. |
| **data** | TEXT | - | JSON payload storing context-specific details. |
| **time** | TEXT | DEFAULT CURRENT_TIMESTAMP | Execution timestamp. |

### D. relation
*Structural Network (How they connect — directed graph links)*

| Column | Type | Details | Use Case |
| :--- | :--- | :--- | :--- |
| **src** | TEXT | PRIMARY KEY (1/3) | Source matter entity identifier (`matter.id`). |
| **tgt** | TEXT | PRIMARY KEY (2/3) | Target matter entity identifier (`matter.id`). |
| **type** | PRIMARY KEY (3/3) | Relationship class (e.g., `'parent-child'`, `'blocked_by'`). |
| **weight** | REAL | DEFAULT 1.0 | Link strength, display sort index, or coefficient value. |
| **time** | TEXT | DEFAULT CURRENT_TIMESTAMP | Relation establishment timestamp. |

---

## 2. Scope Code System & Database Mapping

Verbose scope strings are encoded into compact, prefixed tokens to shrink database size, reduce Turso sync bandwidth usage, and speed up SQLite index performance. 

Under the **Database-per-User** model, each user owns a remote database (`db_${owner_id}`). The client device routes data queries to the correct physical SQLite file based on the scope code.

| Scope Category | Target Local DB (Device) | Remote Sync DB (Turso Cloud) | Code Prefix | Domain | Use Case / Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal** | `user_${self_id}.db` | *None (Local Only)* | `p` | Private | Personal drafts, tasks, alarms (`p`). |
| **Global** | `global.db` (Cache) | API Cache / Workers | `g` | Public | Global product lists, standard menus (`g`). |
| **Family** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `f:{id}` | Social | Family-shared chores, lists (`f:402`). |
| **Team / Work** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `t:{id}` | Org / Projects | Co-worker task boards, project boards (`t:99`). |
| **Friends** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `r:{id}` | Social | Shared itineraries, split expenses (`r:55`). |
| **Storefront** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `s:{id}` | Commerce | Retail layout configs, local menus (`s:102`). |
| **Warehouse** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `w:{id}` | Logistics / SCM | Stock quantities in shipping centers (`w:ch03`). |
| **Client / CRM** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `c:{id}` | CRM | Target customer profiles, leads, tickets (`c:vip`). |
| **Campaigns** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `m:{id}` | Marketing | Marketing campaign templates (`m:push`). |
| **Forms / Submissions** | `user_sync_${owner_id}.db`| `db_${owner_id}` | `x:{id}` | Surveys / ERP | Form blueprints and submission logs (`x:f01`). |
| **HR / Staff** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `h:{id}` | HR / ERP | Employee rosters, recruit pipelines (`h:staff`). |
| **Logistics** | `user_sync_${owner_id}.db` | `db_${owner_id}` | `d` | Operations | Delivery tracking, drivers, routes (`d`). |

---

## 3. finalized Opcode Write Matrix

Opcodes enforce write behavior to minimize storage growth and synchronization transfer payloads.

* **Local User**: Kept in local-only `user_${self_id}.db` (100% cost savings, never synced).
* **Status Update**: Edits the `status` column of an existing row in-place in `user_sync_${owner_id}.db` (50%-80% cost savings).
* **Append**: Inserts a new row in `user_sync_${owner_id}.db` (0% cost savings, reserved for ledgers and audit logs).

| ID | Opcode | Write Strategy | Target DB | Use Case / Domain |
| :--- | :--- | :--- | :--- | :--- |
| **101** | `SOLD` | **Append** | `user_sync_${owner_id}.db` | Retail inventory deduct events. |
| **102** | `CART_ADD` | **Local User** | `user_${self_id}.db` | Local shopping cart additions. |
| **103** | `CART_REMOVE` | **Local User** | `user_${self_id}.db` | Local shopping cart removals. |
| **104** | `CHECKOUT` | **Status Update** | `user_sync_${owner_id}.db` | Cart conversion progress state. |
| **105** | `ORDER_PLACED` | **Append** | `user_sync_${owner_id}.db` | Initial order ledger entry. |
| **106** | `CONFIRMED` | **Status Update** | `user_sync_${owner_id}.db` | Store manager accepts order 105. |
| **107** | `PREPARING` | **Status Update** | `user_sync_${owner_id}.db` | Order is in the kitchen/assembly. |
| **108** | `READY` | **Status Update** | `user_sync_${owner_id}.db` | Package ready for pickup/delivery. |
| **109** | `DELIVERED` | **Status Update** | `user_sync_${owner_id}.db` | Customer received items successfully. |
| **110** | `INVOICE_GENERATED`| **Append** | `user_sync_${owner_id}.db` | Standard tax billing invoice logs. |
| **111** | `REFUND` | **Append** | `user_sync_${owner_id}.db` | Refund ledger entry. |
| **112** | `RENEWAL_DUE` | **Append** | `user_sync_${owner_id}.db` | Subscription recurring billing check. |
| **113** | `COUPON_APPLIED` | **Append** | `user_sync_${owner_id}.db` | Promotion validation tracking log. |
| **114** | `WISHLISTED` | **Local User** | `user_${self_id}.db` | Private item watchlist state. |
| **201** | `SALE` | **Append** | `user_sync_${owner_id}.db` | Till Point-of-Sale cash transaction. |
| **202** | `SHIFT_START` | **Append** | `user_sync_${owner_id}.db` | Till shift log activation. |
| **203** | `BREAK` | **Append** | `user_sync_${owner_id}.db` | Roster clock pause for staff break. |
| **204** | `SHIFT_END` | **Append** | `user_sync_${owner_id}.db` | Till shift closure logs. |
| **205** | `CASH_CLOSE` | **Append** | `user_sync_${owner_id}.db` | End of shift cash till auditing balance. |
| **206** | `ORDER_FIRE` | **Append** | `user_sync_${owner_id}.db` | Sends order to Kitchen Display System. |
| **207** | `ITEM_READY` | **Status Update** | `user_sync_${owner_id}.db` | Line cook flags item completed. |
| **208** | `TOKEN_ISSUED` | **Append** | `user_sync_${owner_id}.db` | Ticket queue token issued (Service/POS). |
| **209** | `TOKEN_CALLED` | **Status Update** | `user_sync_${owner_id}.db` | Counter calls token. |
| **210** | `TOKEN_SERVED` | **Status Update** | `user_sync_${owner_id}.db` | Token served and closed. |
| **301** | `STORE_VISIT` | **Append** | `user_sync_${owner_id}.db` | Customer brick-and-mortar visitation tag. |
| **302** | `REVIEW` | **Append** | `user_sync_${owner_id}.db` | Customer review and rating feedback. |
| **303** | `LEAD_CREATED` | **Append** | `user_sync_${owner_id}.db` | Initial CRM lead folder entry. |
| **304** | `CONTACTED` | **Status Update** | `user_sync_${owner_id}.db` | Sales representative contact event. |
| **305** | `CONVERTED` | **Status Update** | `user_sync_${owner_id}.db` | Lead converted to paying account. |
| **306** | `TICKET_OPEN` | **Append** | `user_sync_${owner_id}.db` | Customer support ticket folder. |
| **307** | `REPLY` | **Append** | `user_sync_${owner_id}.db` | Support chat reply log in ticket. |
| **308** | `RESOLVED` | **Status Update** | `user_sync_${owner_id}.db` | Resolves support ticket 306. |
| **309** | `BIRTHDAY_OFFER_SENT`|**Append**| `user_sync_${owner_id}.db` | Automatic customer promo trigger log. |
| **401** | `DISPATCHED` | **Append** | `user_sync_${owner_id}.db` | Initial logistics delivery task. |
| **402** | `IN_TRANSIT` | **Status Update** | `user_sync_${owner_id}.db` | Package is moving (GPS offloaded). |
| **403** | `DRIVER_ASSIGNED` | **Status Update** | `user_sync_${owner_id}.db` | Assigns carrier/courier to order. |
| **404** | `ETA_UPDATED` | **Status Update** | `user_sync_${owner_id}.db` | Recalculated destination ETA slot. |
| **405** | `TRANSFER_OUT` | **Append** | `user_sync_${owner_id}.db` | SCM warehouse exit inventory log. |
| **406** | `TRANSFER_IN` | **Append** | `user_sync_${owner_id}.db` | SCM warehouse entry inventory log. |
| **407** | `RETURN_REQUEST` | **Append** | `user_sync_${owner_id}.db` | Customer reverse logistics request. |
| **408** | `PICKUP_SCHEDULE` | **Status Update** | `user_sync_${owner_id}.db` | Courier scheduled pickup timing. |
| **409** | `PICKED_UP` | **Status Update** | `user_sync_${owner_id}.db` | Courier picks up reverse shipment. |
| **410** | `DELIVERY_ATTEMPT`| **Status Update**| `user_sync_${owner_id}.db` | Failed/reattempt delivery update. |
| **501** | `CLOCK_IN` | **Append** | `user_sync_${owner_id}.db` | HR staff attendance check-in. |
| **502** | `CLOCK_OUT` | **Append** | `user_sync_${owner_id}.db` | HR staff attendance check-out. |
| **503** | `PAYROLL` | **Append** | `user_sync_${owner_id}.db` | Employee financial payout ledger logs. |
| **504** | `TASK_ASSIGNED` | **Local User** | `user_${self_id}.db` | Private todo lists/alarms. |
| **505** | `PERFORMANCE_NOTE`|**Append** | `user_sync_${owner_id}.db` | Internal employee review remarks. |
| **506** | `LEAVE_REQUESTED` | **Append** | `user_sync_${owner_id}.db` | HR employee leave submission form. |
| **507** | `APPROVED` | **Status Update** | `user_sync_${owner_id}.db` | Approves leave request 506. |
| **508** | `REJECTED` | **Status Update** | `user_sync_${owner_id}.db` | Denies leave request 506. |
| **601** | `PUSH_SENT` | **Append** | `user_sync_${owner_id}.db` | Marketing push campaign logs. |
| **602** | `SMS_SENT` | **Append** | `user_sync_${owner_id}.db` | SMS dispatch analytics tracking. |
| **603** | `REFERRAL` | **Append** | `user_sync_${owner_id}.db` | Referral promo redemption records. |
| **604** | `FORM_SUBMIT` | **Append** | `user_sync_${owner_id}.db` | Dynamic landing page form submissions. |
| **701** | `BOOKED` | **Append** | `user_sync_${owner_id}.db` | Service reservation creation. |
| **702** | `COMPLETED` | **Status Update** | `user_sync_${owner_id}.db` | Service appointment concluded. |
| **703** | `CANCELLED` | **Status Update** | `user_sync_${owner_id}.db` | Service appointment cancelled. |
| **801** | `PAYMENT_INITIATED`|**Append** | `user_sync_${owner_id}.db` | Payment transaction registration. |
| **802** | `PAYMENT_SUCCESS` | **Status Update** | `user_sync_${owner_id}.db` | Completes transaction 801. |
| **803** | `PARTIAL_PAYMENT` | **Status Update** | `user_sync_${owner_id}.db` | Logs split/partial payments to 801. |
| **804** | `PAYOUT` | **Append** | `user_sync_${owner_id}.db` | Vendor pay distribution audit logs. |
| **805** | `PAYMENT_FAILED` | **Status Update** | `user_sync_${owner_id}.db` | Rejects/fails transaction 801. |
| **806** | `EXPENSE_RECORD` | **Append** | `user_sync_${owner_id}.db` | General ledgers/split-bill logs. |
| **901** | `BOOKING` | **Append** | `user_sync_${owner_id}.db` | Sourcing/rentals bookings. |
| **902** | `ASSIGNED` | **Status Update** | `user_sync_${owner_id}.db` | Vendor assignment state. |
| **903** | `RIDE_REQUESTED` | **Append** | `user_sync_${owner_id}.db` | Logistics ride-sharing/fleet request. |
| **904** | `DRIVER_MATCHED` | **Status Update** | `user_sync_${owner_id}.db` | Fleet driver matched. |
| **905** | `IN_RIDE` | **Status Update** | `user_sync_${owner_id}.db` | Fleet passenger in-transit status. |
| **906** | `RECRUIT_APPLY` | **Append** | `user_sync_${owner_id}.db` | ERP applicant recruitment profile log. |
| **907** | `PROCURE_REQ` | **Append** | `user_sync_${owner_id}.db` | ERP procurement request template. |

---

## 4. Google Identity & Profile Sync

| System Layer | Integration Blueprint | Purpose / Offline Benefit |
| :--- | :--- | :--- |
| **Local Isolation** | Private database file: `user_${google_user_id}.db` | Secures private client state offline on device. |
| **User Profile Cache** | `matter` row: `id = usr_${google_user_id}`, `type = 'profile'`, `scope = p`, `title = displayName`, `data = {"email", "photoUrl"}` | Cached on device, syncing via shared workspaces. |
| **Offline Rendering** | Syncs `profile` row to other members inside `user_sync_${owner_id}.db` | Renders user names and avatar image thumbnails offline. |
| **Sync Access (JWT)** | JWT claims: `sub = google_user_id`, `db_url = libsql://db_owner_id.turso.io`, `scopes = ["t:99", "f:402"]` | Restricts background Turso syncs to authorized scopes on target database. |

---

## 5. Dynamic Forms & Custom Input Management (SKIPPED FOR NOW)

| Form Phase | Target DB Table | Schema Mapping Blueprint | Purpose / Metadata |
| :--- | :--- | :--- | :--- |
| **A. Blueprint Definition** | `matter` | `id = form_${form_name}`, `type = 'form'`, `data = {"fields": [{"name", "type", "label", "required"}]}` | Defines form structure, fields, validation offline. |
| **B. Assignment / Task** | `mass` | `id = mas_form_run_${submission_id}`, `matter = form_${form_name}`, `type = 'form_task'`, `active = 1` | Schedules form execution window (`start`/`end`). |
| **C. Submission Log** | `motion` | `id = mot_form_submit_${id}`, `stream = mas_form_run_${submission_id}`, `action = 604`, `data = {"values": {}}` | Captures completed user inputs in immutable log. |

---

## 6. Application Tiers & Pricing Plans

| Plan Tier | Price (INR) | Additional AI Fees | Included Core Features |
| :--- | :--- | :--- | :--- |
| **Plan 1** (Free / Local Only) | **Free** | ₹0.00 | Offline-only workspace, global AI search, commerce storefront catalog browsing, and gigs matching. |
| **Plan 2** (Paid Collaboration) | **₹500 / month** | **₹30 / million tokens** | All collaboration features (Turso cloud synchronization, real-time team sharing). |
| **Community Plan** | **Free** *(Selected)* | **₹10 / million tokens** | Full Plan 2 collaboration features unlocked for selected accounts. |

---

## 7. Turso Scaler Plan & Cost Optimization (Chennai Metropolitan Scale)

Calculates the operational database sync costs for a full Chennai deployment (population ~12 Million, estimating 5 Million active users generating 80 Million total transactional sync writes across all business domains: CRM, POS, SCM, logistics, ERP, forms, HR, and accounting).

* **Billing Base**: Turso Scaler Plan at **$24.92 / month (₹2,081 / month)**.
* **Exchange Rate**: Converted at 1 USD = 83.5 INR.
* **Database Licensing**: Turso allows **unlimited databases** on the paid Scaler plan with no monthly active database overage limits under their current model. Overage cost for running 100,000 distinct user/owner databases is **$0.00**.

| Resource Metric | Included in Base Plan | Overage Rate (USD) | Overage Rate (INR) | Chennai Scale Usage | Overage Bill (USD) | Overage Bill (INR) | Final Consolidated Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rows Read** | 100 Billion | $0.80 / 1 Billion | ₹66.80 / 1 Billion | ~200 Billion | $0.80 | ₹66.80 | Included in final cost |
| **Rows Written** | 100 Million | $0.80 / 1 Million | ₹66.80 / 1 Million | 80 Million | $0.00 | ₹0.00 | Included in final cost |
| **Storage (Database)**| 24 GB | $0.50 / 1 GB | ₹41.75 / 1 GB | 18 GB | $0.00 | ₹0.00 | Included in final cost |
| **Databases** | **Unlimited** | $0.00 | ₹0.00 | 100,000 databases | $0.00 | ₹0.00 | Included in final cost |
| **Sync Bandwidth** | 24 GB | $0.25 / 1 GB | ₹20.88 / 1 GB | **9,600 GB** *(Double Optimized)* | $2,394.00 | ₹1,99,899.00 | **$2,418.92 / month**<br>**₹2,01,980 / month** |

---

## 8. Profit & Cost Projection (Chennai Scale)

Consolidated monthly business P&L projection for Chennai metro operations with 100,000 active collaborating users on Plan 2.

| P&L Category | Item Description | Monthly Amount (USD) | Monthly Amount (INR) | Margin % / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Gross Revenue** | 100k Subscriptions (₹500 / user) + AI usage | $634,730.00 | ₹5,30,00,000.00 | 100.00% |
| **Infrastructure Cost**| Turso Scaler Plan + Overage sync transfer | $2,418.92 | ₹2,01,980.00 | 0.38% of revenue |
| **Hosting & Network** | Cloudflare Workers & Durable Objects | $500.00 | ₹41,750.00 | 0.08% of revenue |
| **AI Token Cost** | Cloud LLM token wholesale queries | $11,976.00 | ₹10,00,000.00 | 1.89% of revenue |
| **Total Expenses** | Database sync + Hosting + AI tokens | $14,894.92 | ₹12,43,730.00 | **2.35% Total Cost** |
| **Net Profit** | **Operating Surplus** | **$619,835.08** | **₹5,17,56,270.00** | **97.65% Net Margin** |
