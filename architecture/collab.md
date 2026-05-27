# TAR Collaborative Architecture: Clean & Simple Explanation

This document defines the simplified collaboration model for the TAR framework. It explains how databases sync, how teams work together, and how customers place orders without complexity.

---

## 1. The Three Databases on Every Device

Every phone running the app has exactly **three** small, isolated database files. They never mix:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                               Device Storage                            │
├───────────────────┬───────────────────────────────┬─────────────────────┤
│      user.db      │           collab.db           │      global.db      │
│ (Private to You)  │      (Shared Workspace)       │  (Public Catalog)   │
├───────────────────┼───────────────────────────────┼─────────────────────┤
│ Drafts, private   │ Active orders, shared stock,  │ Published menu      │
│ notes, settings,  │ shift schedules, team tasks.  │ items, price lists, │
│ backup logs.      │                              │ store details.      │
├───────────────────┼───────────────────────────────┼─────────────────────┤
│ Sync Method:      │ Sync Method:                  │ Sync Method:        │
│ Private S3 Backup │ **Official Turso Sync**       │ **API Method**      │
│ (Daily Upload)    │ (Real-time bi-directional)    │ (Read-only HTTP REST)│
└───────────────────┴───────────────────────────────┴─────────────────────┘
```

---

## 2. How Team Collaboration Works (The "Group Code" Concept)

Instead of managing complex URLs and passwords, everything is handled by a simple **6-character Group Code**.

### The Flow:
1. **The Owner's Database:** When you open the app, you are the owner of a collaborative database group (e.g., `GRP_RST`).
2. **Sharing:** You share this code (`GRP_RST`) with your 10 staff members.
3. **Joining:** Your staff members enter this code on their phones.
4. **Result:** Their apps instantly switch their local `collab.db` sync destination to your database. Now, whatever a waiter writes to their local screen is synced to your database and visible to the chef instantly.

---

## 3. How Customers Order (The Security Boundary)

Customers use the **same app**, but they are **not** part of your internal staff group. They do not get your group code.

```
 [ Customer Phone ]                 [ Cloudflare Worker ]              [ Staff Phone / KDS ]
         │                                    │                                  │
  1. Browses catalog ────────────────────────►│                                  │
  2. Submits order ──────────────────────────►│                                  │
         │                                    │ 3. Writes order                  │
         │                                    │    into Turso Cloud              │
         │                                    └─────────────────────────────────►│
         │                                                                       │ 4. Staff pulls new order
         │                                                                       │    & updates status to "Ready"
         │                                    5. Worker reads status             │
  6. Polls status ───────────────────────────►│◄─────────────────────────────────┘
```

### Why this is simple and secure:
* **Customers** browse the public catalog (`global.db`) and submit orders via secure HTTP API requests. They cannot see other tables' orders.
* **Staff** use real-time sync (`collab.db`) to manage the kitchen, service, and payments.

---

## 4. Summary Table of Operations

| Scenario | What database is used? | Sync Method Used | Who sees it? |
| :--- | :--- | :--- | :--- |
| **Writing private notes** | `user.db` | **Local Storage** (Backed up to S3 daily via HTTP PUT) | Only you. |
| **Staff placing tables' orders** | `collab.db` | **Official Turso Sync** (Bi-directional real-time push/pull) | All active staff members. |
| **Customer browsing menu** | `global.db` | **API Method** (Read-only HTTP REST fetch from Worker to local cache) | Everyone. |
| **Customer ordering food** | Web API → `collab.db` | **API Method** (Customer POSTs to Worker; Worker writes via Turso REST; Staff pulls) | Customer & Staff. |

---

## 5. Optional Integration: Real-Time Broker via Cloudflare Durable Objects

We can optionally place a **Cloudflare Durable Object (DO)** layer on top of our database architecture to coordinate real-time WebSocket communication for customers without changing the core `collab.db` design.

### How they reside together:
* **`collab.db` (Local SQLite File):** Remains the primary offline-first database. If the network goes offline, the app reads and writes orders locally to `collab.db`.
* **Durable Object (Cloud WebSocket Broker):** Holds short-term WebSocket rooms in-memory. It only acts as a real-time messaging gateway to push live status updates to the customer's phone instantly when online.

### Order Sync Flow with Durable Objects:

```
[ Customer Phone ] ◄───( WebSocket: Status Updates )───► [ Durable Object (DO) ]
                                                              ▲
                                                    ( Push Status Notification )
                                                              │
                                                     [ Cloudflare Worker ]
                                                              ▲
                                                    ( SQLite Sync: push )
                                                              │
                                                    [ Staff App (collab.db) ]
```

1. **Active Connection:** The Customer's mobile app opens a WebSocket connection to the Durable Object for their active order.
2. **Staff Update:** When the Chef finishes cooking and updates the order status in `collab.db`, the staff app executes a `.push()` to Turso Cloud.
3. **Trigger:** The Turso write triggers a Cloudflare Worker Webhook.
4. **Broadcast:** The Worker notifies the Durable Object, which instantly pushes a WebSocket message (e.g. `"Order is ready for Table 4!"`) to the customer's open screen.
