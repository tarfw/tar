# 07 — Domains & Opcodes

9 verticals mapped to the 4-table schema, plus AI agent commands.

---

## 1. Domain Mapping

One model covers all verticals — no per-feature schemas.

### Retail & E-Commerce (101-114)

| Table | Holds |
|:------|:------|
| `form` | Products, store profiles, coupons |
| `matter` | Stock (`qty`), price (`value`), availability |
| `motion` | Cart logs (102/103), order pipeline (104-109), invoice (110/111) |
| `bond` | Product→category, order→customer |

### POS & Restaurant (201-210)

| Table | Holds |
|:------|:------|
| `form` | Menu items, POS terminals, queue settings |
| `matter` | Ingredient levels, cash-drawer, active tables |
| `motion` | Shifts (202-204), till audit (205), KDS orders (206/207), queues (208-210) |
| `bond` | Cashier→terminal, KDS item→server |

### CRM & Support (301-309)

| Table | Holds |
|:------|:------|
| `form` | Customer profiles, ticket categories |
| `matter` | Open-ticket allocations, loyalty balances |
| `motion` | Visits (301), ratings (302), funnel (303-305), tickets (306-308) |
| `bond` | Ticket→order, lead→agent |

### Logistics & SCM (401-410)

| Table | Holds |
|:------|:------|
| `form` | Carriers, warehouses, vehicles |
| `matter` | Vehicle GPS (`geo`), delivery windows, ETAs |
| `motion` | Driver tracking (401-404), warehouse in/out (405/406), returns (407-410) |
| `bond` | Shipment→agent, route→hub |

### HR & Staff (501-508)

| Table | Holds |
|:------|:------|
| `form` | Employee accounts, roles, policies |
| `matter` | Scheduled shifts, salary structures |
| `motion` | Clock in/out (501/502), payroll (503), tasks (504), leave (506-508) |
| `bond` | Employee→department, manager hierarchy |

### Marketing & Forms (601-604)

| Table | Holds |
|:------|:------|
| `form` | Marketing templates, form configs |
| `matter` | Campaign schedules, form duration |
| `motion` | Push/SMS audits (601/602), referrals (603), submissions (604) |
| `bond` | Submission→form, user→marketing list |

### Services & Bookings (701-703)

| Table | Holds |
|:------|:------|
| `form` | Service definitions, technician accounts |
| `matter` | Provider calendar availability |
| `motion` | Booking lifecycle (701-703) |
| `bond` | Booking→client, booking→provider |

### Payments & Finance (801-806)

| Table | Holds |
|:------|:------|
| `form` | Payment gateways, tax accounts |
| `matter` | Budget ceilings, billing tiers |
| `motion` | Transaction states (801-803/805), payouts (804), expenses (806) |
| `bond` | Payment→invoice, expense→supplier |

### ERP, Sourcing & Fleet (901-907)

| Table | Holds |
|:------|:------|
| `form` | Fleet vehicles, job vacancies, vendor parts |
| `matter` | Leased-hardware timers, live taxi coords |
| `motion` | Leases (901/902), ride-hailing (903-905), applications (906), procurement (907) |
| `bond` | Part→vendor, candidate→interviewer |

---

## 2. Write Routing

| Target DB | Scope | Holds |
|:----------|:------|:------|
| `user_${self}.db` | `p` | local-only: 102, 103, 114, 504 |
| `user_sync_${owner}.db` | `s:`, `t:` | collaborative, synced via DO |
| `global.db` | `g` | read-only catalog cache |

---

## 3. AI Agent Commands

Every agentic action reduces to 4 moves:

| Intent | Operation |
|:-------|:----------|
| "what is / how much" | **read** `form` + `matter` |
| "what happened" | **read** `motion` |
| "how connected" | **traverse** `bond` |
| "do this" | **write** `motion` |

### Merchant Commands

| Command | Tables | How |
|:--------|:-------|:----|
| "Stock level for Sneakers?" | matter, form | aggregate qty from matter |
| "Which orders need driver?" | matter, bond, motion | scan active matter, check motion |
| "ETA for trip?" | matter, motion | read slot start, parse ETA_UPDATED |
| "Summarize tickets" | matter, motion | fetch active tickets, read conversation |
| "Budget remaining?" | matter, motion | qty balance = allocation - expenses |
| "Today's sales?" | matter, motion | aggregate value on SALE/PAY_SUCCESS |
| "Create task" | form, matter | insert task in local DB |
| "Assign driver" | bond, motion, matter | updates matter + DRIVER_ASSIGNED |

### Customer Commands

| Command | Tables | How |
|:--------|:-------|:----|
| "Order status?" | matter, motion | read order, track IN_TRANSIT/DELIVERED |
| "In stock?" | matter, form | check qty > 0 |
| "File complaint" | matter, motion | create ticket + TICKET_OPEN |
| "Booking slots?" | matter | scan slot type |
| "Cancel order" | matter, motion | update matter + CANCELLED |
| "Submit payment" | matter, motion | update invoice + PAY_SUCCESS |
| "Refund" | matter, motion | locate order + REFUND |
