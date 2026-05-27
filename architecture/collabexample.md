# Collaborative Database Sharing & Switching Examples

Yes, your understanding is correct. Because the app supports switching database contexts, users can join different groups depending on the context of their work or personal life.

---

## 1. Restaurant Collaboration (Work Context)

You share your active restaurant database code with your 10 staff members. While at work, their apps connect to your database.

| User | Default (Own) Database | Active Connection (At Work) | Can see restaurant orders/stock? |
| :--- | :--- | :--- | :--- |
| **You (Owner)** | `GRP_RESTR` (Restaurant) | **`GRP_RESTR`** | Yes (Owner) |
| **Staff 1 (Chef)** | `GRP_CHEF1` (Not in use) | **`GRP_RESTR`** (Joined yours) | Yes |
| **Staff 2 (Waiter)** | `GRP_WAIT2` (Not in use) | **`GRP_RESTR`** (Joined yours) | Yes |

---

## 2. Family Collaboration (Personal Context)

For household tasks or shopping lists, you share a separate family database code with your family. 

*Note: Since a device connects to one `collab.db` at a time, you or your staff switch active groups when transitioning between work and home.*

| User | Active Connection (At Home) | Can see family tasks/lists? | Can see restaurant orders? |
| :--- | :--- | :--- | :--- |
| **You (Owner)** | **`GRP_FAMIL`** (Family) | Yes | No (Isolated) |
| **Your Spouse** | **`GRP_FAMIL`** (Joined yours) | Yes | No (Isolated) |
| **Staff 1 (Chef)** | **`GRP_CHEF_FAM`** (Their own family) | Yes (Their family only) | No |

---

## 3. Limits & Rules

1. **How many teams can a person join?**
   * **Unlimited.** A user can join as many collaborative groups/teams as they want. 
   * **Active Constraint:** The app displays and synchronizes with exactly **one** group's `collab.db` at a time on their screen.
2. **One Active Sync at a Time:** A device is connected to exactly **one** group code's `collab.db` at any given time.
3. **Easy Switching:** When you leave work, you tap "Switch to Family Database" to load your family task list. Your staff members do the same to load their own personal family databases.
4. **No Data Leakage:** Work orders/inventory and family tasks never mix because they reside in separate, isolated Turso cloud database files.

---

## 4. How a Food Order Works (Step-by-Step Lifecycle)

Here is exactly how a customer's food order transitions through our hybrid databases step-by-step:

| Step | Action | Actor | Database Touched | Sync/Network Action |
| :--- | :--- | :--- | :--- | :--- |
| **1. Browse Menu** | Views available dishes & prices (e.g. Biryani). | Waiter or Customer | `global.db` (Local public catalog) | **Offline-first read:** No network sync needed; catalog was pre-cached on startup. |
| **2. Draft Order** | Waiter builds order cart draft for Table 4. | Waiter | Waiter's `user.db` | **Local-only write:** Cart items are drafted in `user.db.motion`. Fast, zero latency. |
| **3. Place Order** | Waiter submits the order to the kitchen. | Waiter | Restaurant's shared `collab.db` | **Sync Push:** Inserts order (`ORDER_PLACED`) to `collab.db.motion` and triggers automatic `.push()` to Turso Cloud. |
| **4. Receive Order** | Kitchen display screen shows the new order. | Chef / Kitchen Tablet | Chef's local `collab.db` | **Sync Pull:** Chef's device calls `.pull()` from Turso Cloud, receiving the order event instantly. |
| **5. Cook & Prepare** | Chef begins cooking, then marks order as ready. | Chef | Chef's local `collab.db` | **Sync Push:** Chef marks status as `READY_FOR_PICKUP` in `collab.db.motion`, triggering `.push()` to Turso Cloud. |
| **6. Serve & Complete** | Waiter gets alert, serves food, completes order. | Waiter | Waiter's local `collab.db` | **Sync Pull & Push:** Waiter's device pulls the ready status, waiter serves food, and pushes final `SERVED` status. |

---

## 5. Security & Access Comparison: Staff vs. Customers

| Dimension | Staff (Waiters, Chefs, Admins) | Customers (Guests, Self-Ordering) |
| :--- | :--- | :--- |
| **Target Database** | `collab.db` (Shared operational database) | `global.db` (Public menu catalog) |
| **Credentials Required** | **1 Shared Group Code** (exchanges for Turso sync URL & JWT token) | **None** (Public web traffic only) |
| **Access Permission** | Read & Write (Direct SQLite engine access) | Read-Only (Catalog) / HTTP POST (Order submissions) |
| **Sync Method** | Real-time bi-directional SQLite sync (`push`/`pull`) | HTTP REST fetch to Cloudflare Worker API |
| **Why not direct?** | Needs real-time, low-latency status updates to run the business. | For security and privacy; a customer must never see other tables' orders. |

