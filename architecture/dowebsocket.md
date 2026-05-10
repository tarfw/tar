# Edge Architecture: Workers, Durable Objects & WebSockets

This document outlines how the TAR Commerce framework efficiently leverages Cloudflare's Edge network in conjunction with our Turso 5-Table Physics schema (`matter`, `mass`, `motion`, `relation`, `memory`) to handle real-time coordination, ephemeral state, and high-contention transactions.

## 1. Cloudflare Workers (Stateless Edge Logic & Routing)
Workers act as our ultra-fast, serverless API layer deployed globally close to the user. They are entirely stateless.

* **Auth & Turso Token Bridge:** The React Native app authenticates with Firebase natively. It then passes the Firebase token to a Worker, which verifies it and mints a **scoped Turso JWT**. This allows the client to securely perform offline-first sync.
* **AI Embedding Hooks:** When a new `matter` (product/service) is inserted, a Turso webhook triggers a Worker. The Worker calls an LLM to generate the vector embedding and instantly saves it to the `memory` table.
* **Payment & Logistics Webhooks:** Workers act as the ingestion point for third-party webhooks (e.g., Stripe/UPI success, Dunzo delivery updates). The Worker validates the payload and writes the corresponding `motion` motion (e.g., `PAYMENT_SUCCESS`) into the correct tenant's Turso DB.

## 2. Durable Objects (Stateful Coordinators & Locks)
Durable Objects (DO) guarantee strict, single-threaded execution for a specific ID globally. In a highly distributed database architecture like Turso, they prmotion race conditions.

* **High-Contention Checkout Lock:** When two customers attempt to purchase the exact same `mass` item (e.g., the last concert ticket or booking slot), the DO acts as a distributed lock. It sequentially processes the requests and determines the winner before committing the `motion` (SOLD) motion to Turso.
* **Live Store / KDS Coordinator:** A single DO is assigned to represent a physical store/restaurant. It holds the active order queue in-memory, serving as the Single Source of Truth for the Kitchen Display System (KDS), avoiding the need to constantly poll the SQLite database.
* **Sequential Token Queues:** For ticketing systems (Token Issued → Called → Served), the DO maintains the strict sequential counter.
* **Collaborative Table Sessions:** If multiple waiters are editing the same table's cart simultaneously, the DO coordinates the ephemeral data changes before writing the final batch of `motion` records.

## 3. WebSockets (Real-Time Ephemeral Streams)
WebSockets allow for persistent, bi-directional connections, eliminating the latency of polling and keeping our database clean of "junk" ephemeral data.

* **Live Fleet/Driver Tracking:** A driver app streams its GPS coordinates over a WebSocket to a Durable Object. The DO broadcasts these coordinates instantly to the customer app (moving the car on the map). This prmotion us from saving thousands of useless GPS coordinate rows into the `motion` table.
* **Instant Kitchen Ticket Pops:** When a cashier commits an order, the system fires a WebSocket message to the KDS, making the ticket appear on the kitchen screen with `< 50ms` latency—much faster than waiting for a background DB sync cycle.
* **Live CRM Support Chat:** Enables real-time typing indicators and instant message delivery for customer support tickets before permanently logging the resolved chat to the DB.
* **Admin Global Dashboard:** Streams live `SALE` motion motion directly to the HQ web dashboard, showing transactions popping up on a map in real-time.

## 4. How This Architecture Saves Massive Costs

When combining these technologies, you significantly cut down on the two most expensive aspects of modern databases: **Database Reads** and **Database Writes**.

* **Slashing Database Writes (The GPS Example):** 
  If a delivery driver updates their GPS coordinates every 3 seconds for a 30-minute ride, that's **600 database rows written** per delivery. If you do 10,000 deliveries a day, that is **6,000,000 writes/day**. By streaming this ephemeral data through WebSockets and Durable Objects, you bypass the database completely and only write *once* when the trip is `DELIVERED`. This saves millions of Turso write operations.
  
* **Slashing Database Reads (The KDS Polling Example):** 
  Normally, a Kitchen Display System (KDS) has to "poll" the database every 2 seconds to check for new orders. For 100 stores open for 12 hours, that generates **2,160,000 read queries/day**. By having a Durable Object hold the state in-memory and push updates via WebSockets, you drop database reads to near **zero** for live state syncing.

* **Cloudflare's Cheap WebSocket Pricing:** 
  Unlike standard cloud providers that charge per minute of an open WebSocket, Cloudflare only bills for the exact milliseconds the Worker/DO is actively processing a message. Idle WebSocket connections are effectively free.

## 5. Before & After: The MOTION Ledger vs. The Edge

The golden rule for this architecture: **WebSockets and Durable Objects handle the "noise", while the `motion` table only stores the "milestones".**

### Use Case A: Live Fleet Tracking (Logistics)
* **Before (Without Edge):** The driver's app writes a new `motion` row (`action: 404 - ETA_UPDATED`) to Turso every 3 seconds to update GPS coordinates. 
* **After (With Edge):** The driver streams coordinates over WebSockets to the DO. The DO instantly forwards these to the customer's map. **Zero database writes.** You only append a single `motion` row to the database when the trip hits a milestone: `action: 409 - PICKED_UP` or `action: 402 - DELIVERED`.

### Use Case B: The Strict Sequence Allocator (`seq`)
The `motion` schema has a `seq` (sequence) integer and a `UNIQUE(stream, seq)` constraint.
* **Before (Without Edge):** If two cashiers modify the same order (`stream`) at the exact same millisecond, they both try to insert `seq: 5` into the database, causing a SQLite constraint error or crash.
* **After (With Edge):** The DO acts as a strict gatekeeper. It holds the current `seq` number in-memory. Both cashiers send their actions to the DO. The DO perfectly queues them, assigns `seq: 5` to cashier A, `seq: 6` to cashier B, and cleanly writes both `motion` rows to Turso without collisions.

### Use Case C: Real-Time Fanout (Instant Distribution)
* **Before (Without Edge):** A Kitchen Display System (KDS) has to run a read query against the `motion` table every 2 seconds, asking: "Are there any new rows with `action: 206 - ORDER_FIRE`?"
* **After (With Edge):** The moment the POS app successfully appends the `ORDER_FIRE` row, it fires a tiny WebSocket ping to the DO. The DO instantly pushes that `motion` data to the kitchen screen in `< 50ms`. The KDS screen updates immediately without ever running a database read.

## 6. Cost Comparison: Pure Turso vs. Cloudflare Edge + Turso

To illustrate the financial impact of this architecture, let's look at the **Live Fleet Tracking** example at scale (10,000 drivers working 10 hours/day, updating GPS every 3 seconds).

### Scenario A: Pure Turso (Database for Every Event)
* **Write Volume:** 10,000 drivers * 12,000 updates/day (10 hours) = **120 Million writes per day**.
* **Monthly Writes:** ~3.6 Billion writes per month.
* **Estimated Cost:** Turso's Scaler plan ($24.92/month) includes generous limits, but overages for writes (typically around $1.00 per million rows written beyond limits) would accrue massively. 3.6 Billion writes would cost **~$3,600+ per month** just in database write overages.
* **Read Volume:** To show this live on a dashboard, clients must poll the DB, generating Billions of read operations, adding further overage costs.

### Scenario B: Cloudflare Edge (WebSockets + DO) + Turso (Milestones)
* **Cloudflare WebSockets (via DO):** 120 Million messages/day. Cloudflare bills WebSockets at a 20:1 ratio, meaning this is counted as 6 Million requests/day, or **180 Million requests/month**.
* **Cloudflare Cost:** The Workers Paid plan is $5/month. Additional DO requests are roughly $0.15 to $0.20 per million. 180M requests * $0.15 = **~$27 per month**. By utilizing the **WebSocket Hibernation API**, duration costs for idle connections are virtually eliminated.
* **Turso Write Volume:** We only write to Turso when a milestone is reached (e.g., `PICKED_UP`, `DELIVERED`). Assuming 200,000 total deliveries per month, that's just 400,000 writes/month.
* **Turso Cost:** Fits comfortably within the base **$4.99 Developer** or **$24.92 Scaler** plan without any overages.

### Conclusion
By offloading high-frequency ephemeral data (like GPS ticks or typing indicators) to Cloudflare's Edge, we reduce database event tracking costs from **~$3,600+/month down to ~$50/month (Cloudflare + Turso combined)**, while simultaneously achieving lower latency (< 50ms) and preventing database contention.
