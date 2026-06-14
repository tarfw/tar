# 05 — Domain & Opcode Map

How every business domain maps onto the 4 tables. One model covers all verticals — no per-feature schemas. Opcodes are defined in [01-data-model.md §7](01-data-model.md#7-opcode-directory).

> New table names: `form` (identity/blueprint), `matter` (realization/state), `motion` (ledger), `bond` (graph). Current code still uses legacy `matter`/`mass`/`relation`.

---

## 1. Table roles

| Table | Concept | Role | Core columns | Examples |
| :--- | :--- | :--- | :--- | :--- |
| `form` | Intrinsic identity | Static definitions, templates, profiles | `id`, `code`, `type`, `scope`, `title`, `data` | Products, menu items, forms, profiles, campaigns |
| `matter` | Physical realization | Real-time state, qty, location, schedule | `id`, `form`, `type`, `qty`, `value`, `geo`, `start`, `end` | Stock levels, pricing tiers, shifts, GPS, calendars |
| `motion` | Kinetic ledger | Append-only actions + in-place phase changes | `stream`, `seq`, `action`, `phase`, `delta` | Order progress, ticket replies, clock-ins, payments |
| `bond` | Structural network | Directed graph between entities | `src`, `tgt`, `type`, `weight` | Product→category, order→customer, ticket→order |

---

## 2. Domain mapping

### Retail & E-Commerce (101–114)
`101 SOLD · 102 CART_ADD(local) · 103 CART_REMOVE(local) · 104 CHECKOUT · 105 ORDER_PLACED · 106 CONFIRMED · 107 PREPARING · 108 READY · 109 DELIVERED · 110 INVOICE_GEN · 111 REFUND · 112 RENEWAL_DUE · 113 COUPON_APP · 114 WISHLISTED(local)`

| Table | Holds |
| :--- | :--- |
| `form` | Product definitions, store profiles, coupon templates, user profiles |
| `matter` | Inventory stock (`qty`), price (`value`), storefront availability |
| `motion` | Offline cart logs (102/103/114), order pipeline (104–109), invoice/refund (110/111) |
| `bond` | Product→category, order→customer (`placed_by`), order→products (`has_item`) |

### POS & Restaurant (201–210)
`201 SALE · 202 SHIFT_START · 203 BREAK · 204 SHIFT_END · 205 CASH_CLOSE · 206 ORDER_FIRE · 207 ITEM_READY · 208 TOKEN_ISSUED · 209 TOKEN_CALLED · 210 TOKEN_SERVED`

| Table | Holds |
| :--- | :--- |
| `form` | Menu item definitions, POS terminal profiles, queue settings |
| `matter` | Ingredient levels, cash-drawer capacity, active tables |
| `motion` | Shifts (202–204), till audit (205), KDS orders (206/207), queues (208–210) |
| `bond` | Cashier→terminal, KDS item→server |

### CRM & Support (301–309)
`301 STORE_VISIT · 302 REVIEW · 303 LEAD_CREATED · 304 CONTACTED · 305 CONVERTED · 306 TICKET_OPEN · 307 REPLY · 308 RESOLVED · 309 B_DAY_OFFER`

| Table | Holds |
| :--- | :--- |
| `form` | Customer profiles, ticket categories, feedback layouts |
| `matter` | Open-ticket allocations, loyalty balances |
| `motion` | Visits (301), ratings (302), funnel (303–305), tickets (306–308), promos (309) |
| `bond` | Ticket→order (`disputes_order`), lead→agent |

### Logistics & SCM (401–410)
`401 DISPATCHED · 402 IN_TRANSIT · 403 DRIVER_ASSIGN · 404 ETA_UPDATED · 405 TRANS_OUT · 406 TRANS_IN · 407 RETURN_REQ · 408 PICKUP_SCH · 409 PICKED_UP · 410 DELIV_ATTEMPT`

| Table | Holds |
| :--- | :--- |
| `form` | Carriers, warehouse profiles, vehicle models |
| `matter` | Vehicle GPS (`geo`), delivery windows, ETAs |
| `motion` | Driver tracking (401–404), warehouse in/out (405/406), returns (407–410) |
| `bond` | Shipment→agent (`shipped_by`), route→hub |

### HR & Staff (501–508)
`501 CLOCK_IN · 502 CLOCK_OUT · 503 PAYROLL · 504 TASK_ASSIGN(local) · 505 PERF_NOTE · 506 LEAVE_REQ · 507 APPROVED · 508 REJECTED`

| Table | Holds |
| :--- | :--- |
| `form` | Employee accounts, roles, leave policies, metrics |
| `matter` | Scheduled shifts (`start`/`end`), salary structures |
| `motion` | Clock in/out (501/502), payroll (503), private tasks (504), leave (506–508), notes (505) |
| `bond` | Employee→department, manager hierarchy |

### Marketing & Forms (601–604)
`601 PUSH_SENT · 602 SMS_SENT · 603 REFERRAL · 604 FORM_SUBMIT`

| Table | Holds |
| :--- | :--- |
| `form` | Marketing templates, newsletter layouts, form configs |
| `matter` | Campaign schedules, form active duration |
| `motion` | Notification audits (601/602), referrals (603), submissions (604) |
| `bond` | Submission→form blueprint, user→marketing list |

### Services & Bookings (701–703)
`701 BOOKED · 702 COMPLETED · 703 CANCELLED`

| Table | Holds |
| :--- | :--- |
| `form` | Service definitions, technician accounts |
| `matter` | Provider calendar availability (`start`/`end`) |
| `motion` | Booking lifecycle (701–703) |
| `bond` | Booking→client, booking→provider |

### Payments & Finance (801–806)
`801 PAY_INIT · 802 PAY_SUCCESS · 803 PARTIAL_PAY · 804 PAYOUT · 805 PAY_FAILED · 806 EXPENSE_REC`

| Table | Holds |
| :--- | :--- |
| `form` | Payment gateways, tax accounts, budget categories |
| `matter` | Budget ceilings, billing tiers |
| `motion` | Transaction states (801–803/805), payouts (804), expenses (806) |
| `bond` | Payment→invoice, expense→supplier |

### ERP, Sourcing & Fleet (901–907)
`901 BOOKING · 902 ASSIGNED · 903 RIDE_REQ · 904 DRIV_MATCH · 905 IN_RIDE · 906 RECRUIT_APPL · 907 PROCURE_REQ`

| Table | Holds |
| :--- | :--- |
| `form` | Fleet vehicles, job vacancies, vendor parts catalog, lease items |
| `matter` | Leased-hardware timers, live taxi coords (`geo`) |
| `motion` | Leases (901/902), ride-hailing (903–905), applications (906), procurement (907) |
| `bond` | Part→vendor, candidate→interviewer |

---

## 3. Write routing recap

| Target DB | Scope | Holds |
| :--- | :--- | :--- |
| `user_${self}.db` | `p` (Personal) | local-only: 102, 103, 114, 504 — zero cloud cost |
| `user_sync_${owner}.db` | shared (`s:`, `d`, `r:`…) | collaborative, synced via DO |
| `global.db` | `g` (Global) | read-only public catalog cache |

**Write behaviors:** *Append* = `INSERT` into `motion` (immutable audit, e.g. 105, 501). *Phase Update* = in-place `UPDATE phase` on an existing stream (e.g. 107→108), minimizing row growth.
