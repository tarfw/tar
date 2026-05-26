# TAR Database Topology: Use Case Map

This document maps all common use cases to the 5-table schema (`matter`, `mass`, `motion`, `relation`, and `memory`).

---

## 1. Matter (What things ARE)

_Defines static identities and core entities. Describes the item itself (no quantities, prices, or time)._

| Use Case                | Table    | DB Layer          | `type`                 | Example `title`            | Example `data` (JSON)                               |
| ----------------------- | -------- | ----------------- | ---------------------- | -------------------------- | --------------------------------------------------- |
| **Product / Menu Item** | `matter` | `globaldb`        | `product` or `food`    | `"Chettinad Biryani"`      | `{ "veg": false, "spicy": "high" }`                 |
| **Physical Location**   | `matter` | `globaldb`        | `store` or `warehouse` | `"Adyar Outlet"`           | `{ "address": "12 Main St", "gstin": "33..." }`     |
| **Staff Member**        | `matter` | `globaldb`        | `person`               | `"Kumar"`                  | `{ "role": "chef", "phone": "98..." }`              |
| **Customer**            | `matter` | `globaldb`        | `person`               | `"Rajesh"`                 | `{ "loyalty_tier": "gold", "phone": "91..." }`      |
| **Plain Task / To-Do**  | `matter` | `user private db` | `task`                 | `"Renew FSSAI License"`    | `{ "priority": "high" }`                            |
| **Note / Raw Idea**     | `matter` | `user private db` | `note`                 | `"Recipe for Mango Lassi"` | `{ "body": "1 cup yogurt, 0.5 cup mango pulp..." }` |
| **AI / System Agent**   | `matter` | `globaldb`        | `agent`                | `"Order Dispatcher"`       | `{ "version": "v1.2", "channel": "whatsapp" }`      |

---

## 2. Mass (What things HAVE)

_Defines allocations of state in space, value, and time. Tracks amounts, prices, limits, and calendar slots._

| Use Case            | Table  | DB Layer          | `type`    | `scope` (Where it applies)            | Core Columns (`qty` / `value` / `start` / `end` / `geo`) |
| ------------------- | ------ | ----------------- | --------- | ------------------------------------- | -------------------------------------------------------- |
| **Inventory Stock** | `mass` | `collab db`       | `stock`   | `"kitchen"` or `"warehouse"`          | `qty = 80`, `geo = "Adyar"`                              |
| **Selling Price**   | `mass` | `collab db`       | `price`   | `"dine_in"`, `"online"`, `"delivery"` | `value = 180.00`                                         |
| **Shift Schedule**  | `mass` | `collab db`       | `slot`    | `"shift_am"` or `"shift_pm"`          | `start = "08:00"`, `end = "16:00"`                       |
| **Reminder Alert**  | `mass` | `user private db` | `slot`    | `"reminder"`                          | `start = "2026-05-22 09:00:00"`, `active = 1`            |
| **Task Deadline**   | `mass` | `user private db` | `slot`    | `"deadline"`                          | `start = "2026-05-31"`, `active = 1`                     |
| **Discount Coupon** | `mass` | `collab db`       | `coupon`  | `"promo_may"`                         | `qty = 100` (uses remaining)                             |
| **Loyalty Balance** | `mass` | `collab db`       | `loyalty` | `"customer_points"`                   | `qty = 450`                                              |

---

## 3. Motion (What things DO)

_The append-only ledger of events. Tracks transactions, updates, state changes, and logs._

| Use Case               | Table    | DB Layer          | `action` (Opcode) | `status`      | `delta` (Quantity change) | Example `data` (JSON)                        |
| ---------------------- | -------- | ----------------- | ----------------- | ------------- | ------------------------- | -------------------------------------------- |
| **Dine-in Sale**       | `motion` | `collab db`       | `1` (SALE)        | `"DONE"`      | `value_delta = 540`       | `{ "items": ["biryani x3"] }`                |
| **Inventory Restock**  | `motion` | `collab db`       | `100` (UPDATE)    | `"DONE"`      | `qty_delta = +50`         | `{ "supplier": "A1 Poultry" }`               |
| **Clock-In Shift**     | `motion` | `collab db`       | `100` (UPDATE)    | `"DONE"`      | —                         | `{ "clock_in_time": "08:02" }`               |
| **KDS Kitchen Order**  | `motion` | `collab db`       | `100` (UPDATE)    | `"PENDING"`   | —                         | `{ "table": 4, "kds_screen": "main" }`       |
| **KDS Order Ready**    | `motion` | `collab db`       | `100` (UPDATE)    | `"DONE"`      | —                         | `{ "chef": "kumar", "prep_time_secs": 640 }` |
| **Task Started**       | `motion` | `collab db`       | `200` (TASK)      | `"STARTED"`   | —                         | `{ "assigned_to": "priya" }`                 |
| **Task Completed**     | `motion` | `collab db`       | `200` (TASK)      | `"COMPLETED"` | —                         | `{ "completed_at": "11:30" }`                |
| **Reminder Triggered** | `motion` | `user private db` | `105` (REMINDER)  | `"COMPLETED"` | —                         | `{ "triggered_at": "2026-05-22 09:00:01" }`  |

---

## 4. Relation (How things LINK)

_Defines links and weights in the graph database layer._

| Use Case                 | Table      | DB Layer          | `src` (Matter ID)   | `tgt` (Matter ID)     | `type` (Link)    |
| ------------------------ | ---------- | ----------------- | ------------------- | --------------------- | ---------------- |
| **Store sells product**  | `relation` | `collab db`       | `mat_store_adyar`   | `mat_product_biryani` | `"SELLS"`        |
| **Staff works at store** | `relation` | `collab db`       | `mat_person_kumar`  | `mat_store_adyar`     | `"WORKS_AT"`     |
| **Chef cooks product**   | `relation` | `collab db`       | `mat_person_kumar`  | `mat_product_biryani` | `"COOKS"`        |
| **Delivery driver role** | `relation` | `collab db`       | `mat_person_ravi`   | `mat_store_adyar`     | `"DELIVERS_FOR"` |
| **Customer has task**    | `relation` | `user private db` | `mat_person_rajesh` | `mat_task_fssai`      | `"HAS_TASK"`     |

---

## 5. Input Channel Efficiency: AI vs. Manual GUI

For cost-effective and highly responsive operation, match your data creation task to the correct input channel (LLM vs. Native UI).

### Recommended Routing Table

| Use Case Category               | Target Table                                           | DB Layer                        | Best Input Channel | Why it works best there                                                                                                                        | Cost Impact          |
| ------------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Plain Text Notes & Tasks**    | `matter` (type = `note`, `task`)                       | `user private db`               | **Manual GUI**     | Typing simple items directly has no variables to extract. AI parsing is pure token waste.                                                      | **Zero**             |
| **Reminders & Deadlines**       | `mass` (type = `slot`, scope = `reminder`, `deadline`) | `user private db`               | **AI / LLM**       | LLMs excel at translating human times (_"next Friday at 3pm"_, _"by EOD Monday"_) into ISO dates. Native date-pickers are tedious.             | **Low (high value)** |
| **Menu Catalog Entries**        | `matter` (type = `product`, `food`)                    | `globaldb`                      | **Manual GUI**     | Standardized catalog fields require exact titles, categories, codes, and options. Voice/AI is error-prone.                                     | **Zero**             |
| **Sales Logs (Checkout)**       | `motion` (action = `1` / `SALE`)                       | `collab db`                     | **Manual GUI**     | Tapping items on a POS screen or scanning barcodes is instantaneous, deterministic, and doesn't incur LLM latency/cost.                        | **Zero**             |
| **Voice Order Taking**          | `motion` (action = `1` / `SALE`)                       | `collab db`                     | **AI / LLM**       | Custom speech-to-text parsing extracts item quantities and modifiers (_"2 spicy chicken biryani and a lassi"_) automatically.                  | **Moderate**         |
| **Stock Adjustments**           | `mass` (type = `stock`)                                | `collab db`                     | **Manual GUI**     | A simple `+` / `-` qty stepper or numeric input field on the screen is instant and free of API costs.                                          | **Zero**             |
| **Shift Scheduling**            | `mass` (type = `slot`, scope = `shift`)                | `collab db`                     | **Manual GUI**     | Best managed via a standard calendar UI, shift calendar templates, or simple toggle cards.                                                     | **Zero**             |
| **Completing Tasks**            | `motion` (action = `200` / `TASK`)                     | `user private db` / `collab db` | **Manual GUI**     | Clicking a checkbox to log a task state mutation to `COMPLETED` is much faster and cheaper than telling an agent to do it.                     | **Zero**             |
| **Complex Multi-entity Events** | Multiple (`matter` + `mass` + `relation`)              | `collab db` / `user private db` | **AI / LLM**       | E.g., _"Set up a recurring shift for Kumar at Adyar from 8am to 4pm every Monday."_ LLMs handle multi-row relational mapping easily in one go. | **High Value**       |

Here is the detailed mapping of what the `tarapp/app/home.tsx` screen displays with respect to the `architecture/ag6.md` schema use cases:

- **[ FUTURE ] Timeline Section**:
  - **Mapped Use Cases**: Maps to **2. Mass (What things HAVE)**, specifically **Reminder Alerts** and **Task Deadlines** (`type = 'slot'` and `scope = 'reminder'` or `'deadline'`).
  - **Data Rendered**: Displays future scheduled items where the `start` time is in the future.

- **[ NOW ] Timeline Section**:
  - **Active Slots (Mass)**: Displays currently active time-slots (e.g., active **Shift Schedules** or active **Reminder Alerts** occurring right now).
  - **Pending Tasks (Matter)**: Queries the `matter` table for `type = 'task'` that have not been completed. This corresponds to the **Plain Task / To-Do** use case.
  - **Pending Motions (Motion)**: Displays append-only ledger entries from the `motion` table that are still in progress (e.g., **KDS Kitchen Orders** in `PENDING` status or **Tasks Started** in `STARTED` status).

- **[ PAST ] Timeline Section**:
  - **Completed Events (Motion)**: Displays completed ledger events from the `motion` table.
  - **Direct Checkout Sales**: Opcode `1` (or `201`) maps to the **Dine-in Sale** use case (rendered as _"Sale Logged"_ cards showing item lists and monetary delta).
  - **Inventory Adjustments**: Opcodes `51-100` map to **Inventory Restocks** or stock level updates.
  - **Triggered Reminders**: Opcodes `101-150` map to **Reminder Triggered** events.
  - **Completed Tasks**: Opcodes `151-250` map to **Task Completed** events.

- **Database Topology Segregation**:
  - `home.tsx` pulls from both `getUserDb()` (**User Private DB**) and `getCollabDb()` (**Collab DB**), implementing the database separation rules documented in `ag6.md`:
    - Personal notes, reminders, and user tasks come from `user private db`.
    - Shared business sales, shifts, KDS entries, and inventory levels come from `collab db`.
