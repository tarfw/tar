# TAR Database Topology: Use Case Map

This document maps all common use cases to the 5-table schema (`matter`, `mass`, `motion`, `relation`, and `memory`).

---

## 1. Matter (What things ARE)
*Defines static identities and core entities. Describes the item itself (no quantities, prices, or time).*

| Use Case | Table | `type` | Example `title` | Example `data` (JSON) |
|---|---|---|---|---|
| **Product / Menu Item** | `matter` | `product` or `food` | `"Chettinad Biryani"` | `{ "veg": false, "spicy": "high" }` |
| **Physical Location** | `matter` | `store` or `warehouse`| `"Adyar Outlet"` | `{ "address": "12 Main St", "gstin": "33..." }` |
| **Staff Member** | `matter` | `person` | `"Kumar"` | `{ "role": "chef", "phone": "98..." }` |
| **Customer** | `matter` | `person` | `"Rajesh"` | `{ "loyalty_tier": "gold", "phone": "91..." }` |
| **Plain Task / To-Do** | `matter` | `task` | `"Renew FSSAI License"` | `{ "priority": "high" }` |
| **Note / Raw Idea** | `matter` | `note` | `"Recipe for Mango Lassi"` | `{ "body": "1 cup yogurt, 0.5 cup mango pulp..." }` |
| **AI / System Agent** | `matter` | `agent` | `"Order Dispatcher"` | `{ "version": "v1.2", "channel": "whatsapp" }` |

---

## 2. Mass (What things HAVE)
*Defines allocations of state in space, value, and time. Tracks amounts, prices, limits, and calendar slots.*

| Use Case | Table | `type` | `scope` (Where it applies) | Core Columns (`qty` / `value` / `start` / `end` / `geo`) |
|---|---|---|---|---|
| **Inventory Stock** | `mass` | `stock` | `"kitchen"` or `"warehouse"` | `qty = 80`, `geo = "Adyar"` |
| **Selling Price** | `mass` | `price` | `"dine_in"`, `"online"`, `"delivery"`| `value = 180.00` |
| **Shift Schedule** | `mass` | `slot` | `"shift_am"` or `"shift_pm"` | `start = "08:00"`, `end = "16:00"` |
| **Reminder Alert** | `mass` | `slot` | `"reminder"` | `start = "2026-05-22 09:00:00"`, `active = 1` |
| **Task Deadline** | `mass` | `slot` | `"deadline"` | `start = "2026-05-31"`, `active = 1` |
| **Discount Coupon** | `mass` | `coupon` | `"promo_may"` | `qty = 100` (uses remaining) |
| **Loyalty Balance** | `mass` | `loyalty` | `"customer_points"` | `qty = 450` |

---

## 3. Motion (What things DO)
*The append-only ledger of events. Tracks transactions, updates, state changes, and logs.*

| Use Case | Table | `action` (Opcode) | `status` | `delta` (Quantity change) | Example `data` (JSON) |
|---|---|---|---|---|---|
| **Dine-in Sale** | `motion` | `1` (SALE) | `"DONE"` | `value_delta = 540` | `{ "items": ["biryani x3"] }` |
| **Inventory Restock** | `motion` | `100` (UPDATE) | `"DONE"` | `qty_delta = +50` | `{ "supplier": "A1 Poultry" }` |
| **Clock-In Shift** | `motion` | `100` (UPDATE) | `"DONE"` | — | `{ "clock_in_time": "08:02" }` |
| **KDS Kitchen Order** | `motion` | `100` (UPDATE) | `"PENDING"` | — | `{ "table": 4, "kds_screen": "main" }` |
| **KDS Order Ready** | `motion` | `100` (UPDATE) | `"DONE"` | — | `{ "chef": "kumar", "prep_time_secs": 640 }` |
| **Task Started** | `motion` | `200` (TASK) | `"STARTED"` | — | `{ "assigned_to": "priya" }` |
| **Task Completed** | `motion` | `200` (TASK) | `"COMPLETED"` | — | `{ "completed_at": "11:30" }` |
| **Reminder Triggered**| `motion` | `105` (REMINDER) | `"COMPLETED"` | — | `{ "triggered_at": "2026-05-22 09:00:01" }` |

---

## 4. Relation (How things LINK)
*Defines links and weights in the graph database layer.*

| Use Case | Table | `src` (Matter ID) | `tgt` (Matter ID) | `type` (Link) |
|---|---|---|---|---|
| **Store sells product** | `relation` | `mat_store_adyar` | `mat_product_biryani` | `"SELLS"` |
| **Staff works at store** | `relation` | `mat_person_kumar` | `mat_store_adyar` | `"WORKS_AT"` |
| **Chef cooks product** | `relation` | `mat_person_kumar` | `mat_product_biryani` | `"COOKS"` |
| **Delivery driver role** | `relation` | `mat_person_ravi` | `mat_store_adyar` | `"DELIVERS_FOR"` |
| **Customer has task** | `relation` | `mat_person_rajesh` | `mat_task_fssai` | `"HAS_TASK"` |

---

## 5. Input Channel Efficiency: AI vs. Manual GUI

For cost-effective and highly responsive operation, match your data creation task to the correct input channel (LLM vs. Native UI).

### Recommended Routing Table

| Use Case Category | Target Table | Best Input Channel | Why it works best there | Cost Impact |
|---|---|---|---|---|
| **Plain Text Notes & Tasks** | `matter` (type = `note`, `task`) | **Manual GUI** | Typing simple items directly has no variables to extract. AI parsing is pure token waste. | **Zero** |
| **Reminders & Deadlines** | `mass` (type = `slot`, scope = `reminder`, `deadline`) | **AI / LLM** | LLMs excel at translating human times (*"next Friday at 3pm"*, *"by EOD Monday"*) into ISO dates. Native date-pickers are tedious. | **Low (high value)** |
| **Menu Catalog Entries** | `matter` (type = `product`, `food`) | **Manual GUI** | Standardized catalog fields require exact titles, categories, codes, and options. Voice/AI is error-prone. | **Zero** |
| **Sales Logs (Checkout)** | `motion` (action = `1` / `SALE`) | **Manual GUI** | Tapping items on a POS screen or scanning barcodes is instantaneous, deterministic, and doesn't incur LLM latency/cost. | **Zero** |
| **Voice Order Taking** | `motion` (action = `1` / `SALE`) | **AI / LLM** | Custom speech-to-text parsing extracts item quantities and modifiers (*"2 spicy chicken biryani and a lassi"*) automatically. | **Moderate** |
| **Stock Adjustments** | `mass` (type = `stock`) | **Manual GUI** | A simple `+` / `-` qty stepper or numeric input field on the screen is instant and free of API costs. | **Zero** |
| **Shift Scheduling** | `mass` (type = `slot`, scope = `shift`) | **Manual GUI** | Best managed via a standard calendar UI, shift calendar templates, or simple toggle cards. | **Zero** |
| **Completing Tasks** | `motion` (action = `200` / `TASK`) | **Manual GUI** | Clicking a checkbox to log a task state mutation to `COMPLETED` is much faster and cheaper than telling an agent to do it. | **Zero** |
| **Complex Multi-entity Events** | Multiple (`matter` + `mass` + `relation`) | **AI / LLM** | E.g., *"Set up a recurring shift for Kumar at Adyar from 8am to 4pm every Monday."* LLMs handle multi-row relational mapping easily in one go. | **High Value** |

