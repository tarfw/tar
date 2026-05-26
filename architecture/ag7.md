Here are three practical, real-world use cases where the app joins tables from **`collab.db`** (shared, synced team data) and **`user.db`** (private, local-only on-device data):

### 1. Restaurant / Delivery Routing

- **Collab DB (Shared):** The live kitchen order queue (order items, delivery address, table number).
- **User DB (Private):** The delivery driver's personal contact lists, private notes, and custom shortcuts for address routes (e.g., "Gate code is #1234").
- **Join Query Usecase:** The driver runs a single query joining the **live kitchen orders** with their **private address notes** so their dashboard instantly shows specialized delivery instructions without sharing their personal address notebook with the restaurant's shared database.

---

### 2. Retail Store Inventory & Private Supplier Costs

- **Collab DB (Shared):** The active store inventory stock levels and public selling prices.
- **User DB (Private):** The owner's private purchasing deals and negotiated supplier invoice costs (kept private from employees).
- **Join Query Usecase:** The store owner views a dashboard showing **live stock counts** joined against their **private supplier cost lists** to calculate net margin and decide if they need to restock, keeping the supplier cost info completely invisible to cashiers and store staff.

---

### 3. Field Services / Plumbing Dispatch

- **Collab DB (Shared):** Today's dispatch appointments (client name, problem description, time slot).
- **User DB (Private):** The technician’s personal tool checklist, vehicle mileage logs, and individual reminders.
- **Join Query Usecase:** The app joins **today's scheduled jobs** with the **technician's personal tool inventory list** to trigger a warning if a specialized task is scheduled (e.g., "gas boiler repair") but the required tool isn't marked as present in their private list.
