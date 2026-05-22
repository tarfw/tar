**Scope possibilities** (where/which channel/segment the mass applies):

- `retail`, `online`, `wholesale`, `delivery`, `pickup`, `shift_morning`, `shift_evening`, `adyar`, `tnagar`, `warehouse`, `store`, `salon`, `restaurant`

**Type possibilities** (what kind of realization it is):

- `stock`, `price`, `slot`, `coupon`, `bundle`, `loyalty`, `availability`, `capacity`, `quota`, `reservation`, `listing`, `variance`

Created realization.tsx

Created. Now let me give you the promised scope/type clarification:

---

## `realization.tsx` — What was built

A standalone modal screen at `app/realization.tsx` that creates a new `mass` row. It mirrors `matter.tsx`'s header exactly — a simple `Save` text button on the right, a close `×` on the left.

New additions over the bare `mass.tsx`:

- **ChipPicker** — tap a preset chip to fill the field, or type your own custom value
- **QtyStepper** — `−` / `+` counter, same component as in `matter.tsx`'s modal
- **Inline hints** under each field explaining the semantic purpose
- Accepts an optional `matterId` route param to pre-fill the matter reference

---

## Scope & Type — Clarified from the architecture

|                       | `type`                                       | `scope`                                   |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| **Question answered** | _What kind of physical realization is this?_ | _Where / in which channel does it apply?_ |
| **Cardinality**       | 1 per mass row                               | 1 per mass row                            |
| **Index**             | `idx_mass_scope_type` (both)                 | `idx_mass_scope_type` (both)              |

### `type` possibilities (what it is)

| Value         | Use case from architecture                      |
| ------------- | ----------------------------------------------- |
| `stock`       | Inventory qty at a location (`qty = 50 units`)  |
| `price`       | Channel-specific price (`value = ₹180`)         |
| `slot`        | Time-block appointment / shift / class seat     |
| `coupon`      | Usage-limited discount (`qty = uses remaining`) |
| `quota`       | Capacity ceiling (seats, licences)              |
| `loyalty`     | Points / credits balance for a customer matter  |
| `listing`     | Marketplace / storefront visibility entry       |
| `variant`     | SKU-level size/color differentiation            |
| `reservation` | Confirmed hold on a table, room, or cab         |
| `bundle`      | Aggregated offer grouping child items           |
| `payout`      | Seller or staff settlement amount               |
| `deposit`     | Pre-auth or security hold on value              |

### `scope` possibilities (where it applies)

| Value        | Use case from architecture            |
| ------------ | ------------------------------------- |
| `retail`     | Physical shop floor                   |
| `online`     | E-commerce / web store                |
| `wholesale`  | B2B bulk pricing                      |
| `delivery`   | Swiggy / Zomato / own-fleet           |
| `pickup`     | Click-and-collect / takeaway          |
| `warehouse`  | Back-store or hub stock               |
| `shift_am`   | Morning shift window                  |
| `shift_pm`   | Afternoon / evening shift             |
| `restaurant` | Dine-in context                       |
| `salon`      | Appointment / service context         |
| `global`     | Applies everywhere (default fallback) |
| `b2b`        | Enterprise / partner pricing          |

Both fields are **free-text** in the schema — these are just the canonical vocabulary derived from `usecases.md`. The chip picker lets you tap a preset or type anything custom.

## Tasks, Reminders & Notes in TAR — Simply

Everything maps to just 2 tables: **`matter`** + **`mass`** + **`motion`**.

---

### 📝 Note

A note is pure **idea** — no time, no location, no action needed.

```
matter:
  title = "Buy groceries"
  type  = "note"
  data  = { "body": "Milk, eggs, bread" }
```

That's it. Just a `matter` row. Nothing else needed.

---

### ✅ Task (To-Do)

A task is a note that **needs to be done**. Still just `matter`:

```
matter:
  title = "Call the plumber"
  type  = "task"
  data  = { "priority": "high" }
```

When the user **completes** it, you append a `motion`:

```
motion:
  stream = "mat_call_plumber_id"
  action = TASK_DONE
  status = "COMPLETED"
  time   = now
```

The home screen feed shows it as ✅ Done automatically — because home is just the `motion` ledger.

---

### ⏰ Reminder

A reminder is a task that **occupies a point in time**. That time-block = `mass`.

```
matter:
  title = "Pay electricity bill"
  type  = "task"

mass:
  matter = above matter id
  type   = "slot"
  scope  = "reminder"
  start  = "2026-05-22 09:00"    ← when to ping
  value  = null
  qty    = null
```

> Rule from `tarfw.md`: _"If it occupies a block of time on a calendar → `mass`. If it's just a quick ping → `motion` payload."_

The AI agent queries:

```sql
SELECT * FROM mass
WHERE type = 'slot' AND scope = 'reminder'
AND start <= CURRENT_TIMESTAMP
AND active = 1;
```

Finds it → sends push notification → marks `active = 0`.

---

### 🗓️ Scheduled Task (Deadline)

Has both a **due date** (mass) and tracks **progress** (motion):

```
matter:  title="Submit tax report", type="task"
mass:    start="2026-03-31", type="slot", scope="deadline"
motion:  TASK_STARTED → TASK_DONE  (when user acts)
```

---

### The Simple Map

```
Note       →  matter only          (just an idea)
Task       →  matter + motion      (idea + what happened to it)
Reminder   →  matter + mass        (idea + when to ring the bell)
Scheduled  →  matter + mass + motion  (all three)
```

---

### Why this is powerful

You **never need a separate reminders table or notes table**. The `type` field on `matter` tells you what category it is. The home screen (`motion` feed) automatically shows:

```
[ FUTURE ]
🔔 Pay electricity bill  →  Tomorrow 9 AM  (from mass.start)

[ ─── NOW ─── ]

[ PAST ]
✅ Call the plumber  →  Completed 2h ago  (from motion)
📝 Buy groceries     →  Created yesterday  (from motion)
```

One query, one feed, everything unified.

1 Global DB → matter + memory (public)
1 DB per business → their mass + motion + relation
1 DB per user → their mass + motion

Tenant DB = shared private space (for a team / business)
User DB = personal private space (for one person)

"Just their phone" — what it means
With Turso embedded replica, data syncs to devices you authorise.

Tenant DB → synced to multiple devices (all staff phones, POS terminals)
User DB → synced to only 1 device (that person's phone)

an example for restaurant

## Adyar Biryani House — Team of 10, 3 DBs

**The team:**
Owner: Rajesh · Head Chef: Kumar · Chefs: Muthu, Mani · Waiters: Arun, Siva · Cashier: Priya · Delivery: Ravi, Karthik · Inventory: Deepa

---

## DB 1 — Global Public DB

_One database. The whole world can read it. Describes what things ARE._

**`matter` table**

| id      | title               | type    | scope      | data                                       |
| ------- | ------------------- | ------- | ---------- | ------------------------------------------ |
| mat_abh | Adyar Biryani House | store   | restaurant | `{gstin, fssai, hours}`                    |
| mat_bry | Chettinad Biryani   | product | food       | `{veg:false, calories:650}`                |
| mat_las | Mango Lassi         | product | food       | `{veg:true}`                               |
| mat_ful | Full Meals          | product | food       | `{veg:true, items:["rice","dal","curry"]}` |
| mat_raj | Rajesh              | person  | owner      | `{phone, role:"owner"}`                    |
| mat_kum | Kumar               | person  | chef       | `{phone, speciality:"biryani"}`            |
| mat_pri | Priya               | person  | cashier    | `{phone}`                                  |
| mat_rav | Ravi                | person  | delivery   | `{vehicle:"bike", license:"TN09"}`         |

_Everyone (customers, AI agents, other apps) can search this._

---

## DB 2 — Tenant DB: Adyar Biryani House

_One database. Only the 10 staff access it. Describes what the business HAS and DOES._

**`mass` table** — stock, prices, availability

| id     | matter  | type  | scope    | qty  | value | start | end   | geo   |
| ------ | ------- | ----- | -------- | ---- | ----- | ----- | ----- | ----- |
| ms_001 | mat_bry | stock | kitchen  | 80   | null  | null  | null  | Adyar |
| ms_002 | mat_bry | price | dine_in  | null | 180   | null  | null  | null  |
| ms_003 | mat_bry | price | online   | null | 165   | null  | null  | null  |
| ms_004 | mat_bry | slot  | delivery | null | null  | 11:00 | 15:00 | null  |
| ms_005 | mat_las | stock | kitchen  | 40   | null  | null  | null  | Adyar |
| ms_006 | mat_las | price | dine_in  | null | 60    | null  | null  | null  |
| ms_007 | mat_abh | slot  | shift_am | 5    | null  | 08:00 | 16:00 | null  |
| ms_008 | mat_abh | slot  | shift_pm | 5    | null  | 16:00 | 23:00 | null  |

**`motion` table** — everything that happened today

| id     | stream    | action         | status  | delta | scope    | data                            |
| ------ | --------- | -------------- | ------- | ----- | -------- | ------------------------------- |
| mo_001 | mat_kum   | SHIFT_START    | DONE    | null  | shift_am | `{time:"08:00"}`                |
| mo_002 | mat_pri   | SHIFT_START    | DONE    | null  | shift_am | `{time:"09:00"}`                |
| mo_003 | order_101 | ORDER_PLACED   | PENDING | 540   | dine_in  | `{table:4, items:[biryani x3]}` |
| mo_004 | order_101 | KDS_FIRED      | DONE    | null  | kitchen  | `{chef:kumar}`                  |
| mo_005 | order_101 | ITEM_READY     | DONE    | null  | kitchen  | null                            |
| mo_006 | order_101 | SERVED         | DONE    | null  | dine_in  | `{waiter:arun}`                 |
| mo_007 | order_101 | PAYMENT_DONE   | DONE    | 540   | cash     | `{cashier:priya}`               |
| mo_008 | order_102 | ORDER_PLACED   | PENDING | 165   | online   | `{platform:swiggy}`             |
| mo_009 | mat_rav   | DELIVERY_START | ACTIVE  | null  | delivery | `{order:102}`                   |
| mo_010 | mat_dep   | STOCK_UPDATED  | DONE    | null  | kitchen  | `{item:biryani, qty:80}`        |

**`relation` table** — this store's product links (local cache)

| src     | tgt     | type         | weight |
| ------- | ------- | ------------ | ------ |
| mat_abh | mat_bry | SELLS        | 1.0    |
| mat_abh | mat_las | SELLS        | 1.0    |
| mat_abh | mat_ful | SELLS        | 1.0    |
| mat_kum | mat_bry | COOKS        | 1.0    |
| mat_rav | mat_abh | DELIVERS_FOR | 1.0    |

_All 10 staff devices sync to this one Tenant DB. Rajesh sees everything. Kumar sees only kitchen motions. Ravi sees only delivery motions — access filtered by the app, same DB._

---

## DB 3 — User DBs (10 separate DBs, one per person)

_Each person's private life — tasks, notes, reminders, personal feed._

**Rajesh's User DB** (owner)

| table  | example                                             |
| ------ | --------------------------------------------------- |
| motion | TASK: "Renew FSSAI license by June"                 |
| motion | NOTE: "Talk to Kumar about new menu"                |
| mass   | REMINDER: slot, start=tomorrow 10am, scope=reminder |
| motion | Personal salary transfer received ₹80,000           |

**Kumar's User DB** (head chef)

| table  | example                                            |
| ------ | -------------------------------------------------- |
| motion | TASK: "Order fresh chicken — 20kg"                 |
| motion | NOTE: "New spice mix ratio — data:{ratio:...}"     |
| mass   | REMINDER: "Marinate chicken", start=tomorrow 06:00 |

**Ravi's User DB** (delivery)

| table  | example                                              |
| ------ | ---------------------------------------------------- |
| motion | RIDE_COMPLETED, delta=₹50 (his delivery earning log) |
| mass   | Fuel expense reminder                                |
| motion | Personal task: "Renew vehicle insurance"             |

---

## Who sees what — one line summary

```
Global DB    →  customers, AI agents, any app  (read only, no secrets)
Tenant DB    →  all 10 staff                   (business secrets, shared)
User DB      →  only that one person           (personal, fully private)
```

The TAR app on Ravi's phone talks to **two DBs at once**:

- Tenant DB → to receive delivery orders
- His own User DB → for his personal tasks and reminders
