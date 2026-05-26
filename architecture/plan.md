# TAR Commerce & Agent System: 3-Day MVP Implementation Plan

Based on the finalized 5-table universal schema (`matter`, `mass`, `motion`, `relation`, `memory`), the Edge + Turso architecture, and the offline-first Event Sourcing pattern, here is the rapid 3-day implementation roadmap.

---

## Architecture Blueprint: The Offline-First Split

The database architecture is split into two distinct layers to maximize speed, enable offline functionality, and minimize Turso usage costs.

### 1. The Remote-Only Layer (`matter`, `memory`)
These massive datasets remain exclusively in the cloud. The client apps interact with them purely via APIs (Cloudflare Workers).
*   **`matter` (Global Catalog):** Products, universal users, and collab group definitions. Queried when online to cache locally into `relation`.
*   **`memory` (AI Embeddings):** Heavy vector data for semantic search and AI agents.

### 2. The Local-First Replicas (`motion`, `mass`, `relation`)
These tables exist as an embedded SQLite database (Turso libSQL) on the device (POS, driver app). They provide `< 5ms` reads/writes and work offline.
*   **`motion` (The Event Ledger):** Append-only log of every user action (`SALE_ADDED`, `ITEM_SCANNED`). Since it is append-only, offline sync collisions are virtually non-existent.
*   **`mass` (Derived State):** Representing quantities and balances. This is a materialized view calculated purely by summing the events in the `motion` ledger (Event Sourcing).
*   **`relation` (Local Links):** Caches the links between downloaded `matter` (e.g., this Store sells these specific 50 Products) for offline use.

---

## Day 1: Cloud Infrastructure & Edge Setup 
*The goal is to establish the Turso cloud databases and the Cloudflare Edge API layer.*

1. **Turso Database Provisioning**
   * Deploy the **Global DB** containing `matter` and `memory`.
   * Create templates for the **Local-First DBs** (`mass`, `motion`, `relation`). Each edge node/store gets its own isolated SQLite DB managed by Turso for instantaneous local access.

2. **Cloudflare Workers & Auth Bridge**
   * Deploy a Worker to handle Firebase Native Auth and mint scoped Turso JWTs for clients to securely access their local-first DBs.
   * Set up API endpoints to query the remote-only `matter` and `memory` tables.

3. **Durable Objects (DO) & WebSockets Setup**
   * Deploy Durable Objects to act as the single source of truth for high-contention actions (e.g., checking out the last inventory item) to prevent offline overselling.
   * Configure WebSocket hibernation to handle ephemeral streams (GPS, typing indicators) without writing to the database.

---

## Day 2: Universal App & Offline-First Development 
*Build the React Native UI to be completely dynamic and integrate the libSQL embedded replica.*

1. **React Native Offline-First Sync**
   * Integrate `@tursodatabase/sync-react-native` into the mobile app.
   * Configure the app to maintain the local `motion`, `mass`, and `relation` tables.
   * Verify background syncing of the `motion` ledger pushes successfully to the Turso cloud without conflicts.

2. **Event-Driven UI (Event Sourcing)**
   * Build UI components that read state instantly from the local `mass` table.
   * Wire user actions (Add to Cart, Clock In, Complete Task) to purely append rows to the local `motion` table.
   * Implement Turso's conflict resolution (Manual Resolution API) to gracefully handle edge cases like offline overselling (e.g., appending a compensating `REFUND` motion row if inventory dips below 0 upon sync).

---

## Day 3: Agentic AI Layer & Real-time Dashboards
*Activate AI capabilities and utilize the Edge for real-time reporting.*

1. **Vector Embeddings & Semantic Search**
   * Create a Cloudflare Worker webhook triggered by Turso when new `matter` is inserted. This worker generates an embedding via an LLM and saves it to the remote `memory` table.
   * Implement semantic search in the app by pinging the Cloudflare Worker API.

2. **Real-Time Edge Dashboards**
   * Instead of polling the database, have the Durable Objects stream finalized `motion` milestones (e.g., `DELIVERY_COMPLETE`) directly to the HQ Admin dashboard via WebSockets for real-time map updates.
   * Build lightweight local reporting on the device by querying the synced `motion` table (e.g., `SUM(amount) WHERE action='SALE' GROUP BY DATE(ts)`).
