Based on the architecture docs, here is how the **TAR framework** works — the 6 agents operate on the **5 Tables of Physics**:

### Core Database Tables

| Table      | Concept         | What it stores                                                  | Analogy                                                 |
| ---------- | --------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `matter`   | **Substance**   | Entities (product, customer, order, etc.) — the abstract "what" | A product SKU, a customer profile, a service listing    |
| `mass`     | **Realization** | Physical properties — quantity, price, location, time window    | Stock level ₹200, geo-coordinates, appointment slot 5pm |
| `motion`   | **Kinetics**    | Append-only event log of every action/transition                | "Order placed", "Payment failed", "Item transferred"    |
| `relation` | **Network**     | Links between matter entities                                   | Product → Category, Customer → Order                    |
| `memory`   | **Cognition**   | Vector embeddings for AI semantic search                        | "Find similar products" via F32_BLOB(384)               |

### How the 6 Agents Interact with the Tables

| Agent           | Reads                                                  | Writes / Mutates                                                 | Example                                                                              |
| --------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 🛍️ Commerce     | `matter` (catalog), `mass` (pricing/qty)               | `matter` (product), `mass` (stock/price), `motion` (cart, order) | "New shirt added" → creates `matter`, sets `mass.value`, emits `ORDER_PLACED` motion |
| 🚚 Operations   | `mass` (geo, start/end), `motion` (status)             | `mass` (available), `motion` (delivery status, assignment)       | "Driver assigned" → writes `DRIVER_ASSIGNED` motion, updates `mass.geo`              |
| 📢 Growth       | `matter` (customer), `motion` (visit/purchase history) | `mass` (loyalty balance), `motion` (campaign, push sent)         | "Birthday offer" → emits `BIRTHDAY_OFFER_SENT` motion, deducts loyalty `mass`        |
| 💼 Manager      | `matter` (employee/service), `mass` (slots)            | `motion` (booking, task, attendance), `mass` (slot availability) | "Book tutor" → sets `mass.available=0`, emits `BOOKED` motion                        |
| 💰 Finance      | `motion` (sale, payout), `mass` (value)                | `motion` (invoice, cash close, payroll)                          | "Daily close" → aggregates `SALE` motions, emits `CASH_CLOSE`                        |
| 🌐 Site Builder | `matter` (page/section/banner/menu)                    | `matter` (store page, nav), `data` JSON payloads                 | "Generate landing page" → creates `matter` type=page with layout JSON                |

### Flow: How a Request is Processed

```
 User Action / Text
      ↓
 ┌─────────────────────────────┐
 │  One or more AI Agents      │  ← Each agent has specialized
 │  detect the intent & act    │     prompts, permissions, skills
 └──────┬──────────────────────┘
        │
   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
   │ matter  │    │  mass   │    │ motion  │
   │ (create │    │(update  │    │(append  │
   │ entity) │    │ qty/val)│    │  event) │
   └─────────┘    └─────────┘    └─────────┘
        │
        ▼
   Turso Sync (edge ← → local)
        │
        ▼
   User's App sees updates
   in real-time via motion feed
```

### Core Philosophy (from `tarfw.md`)

- **`matter`** = abstract idea ("Buy groceries")
- **`mass`** = physical realization in space & time ("at Adyar Supermarket, 5pm, ₹500 budget")
- **`motion`** = the record of what happened ("paid ₹450 at 5:10pm → status = DONE")

All 6 agents share the same database but are restricted by their **prompts, permissions, and focus areas** — they never step on each other's toes because each owns a specific domain.
