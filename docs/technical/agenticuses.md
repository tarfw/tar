# Agentic Use Cases & Capabilities Matrix

This document outlines the possible agentic capabilities (LLM-driven actions and inquiries) from both the **App User (Merchant / Business / Staff)** and the **Customer (Client / Shopper)** perspectives. It maps each use case to the underlying data architecture (`matter`, `mass`, `motion`, `relation`) and details whether the action is supported in the app.

---

## 1. App User / Merchant Perspective (Business Operations)

These agentic capabilities allow merchants or operators to query their business state, coordinate logistics, and manage CRM/tasks via natural language commands.

| Agentic Use Case / Command Example | Core Database Tables | Possible in App? | Implementation Details / How It Works |
| :--- | :--- | :--- | :--- |
| **"What is my current stock level for Sneakers?"** | `mass`, `matter` | **Yes** | Queries `matter` for the product SKU/definition and aggregates current inventory counts from associated `mass` rows of type `'variant'` or `'stock'`. |
| **"Which orders are delayed or need driver assignment?"** | `mass`, `relation`, `motion` | **Yes** | Scans `mass` rows of type `'trip'` or `'order'` that are active (`active = 1`) and matches them against `relation` or `motion` state logs where no driver ID is assigned. |
| **"What is the estimated arrival time for Trip ID `trip_123`?"** | `mass`, `motion` | **Yes** | Reads the `start` timestamp of the delivery `mass` slot and parses the latest `ETA_UPDATED` (404) offsets logged in the `motion` ledger. |
| **"Summarize open support tickets and draft replies."** | `mass`, `motion` | **Yes** | Fetches active `mass` rows of type `'ticket'` and reads conversation details / past updates in the `motion` stream. |
| **"Check budget usage: How much is remaining in the Supplies budget?"** | `mass`, `motion` | **Yes** | Reads the `qty` balance on the budget pool `mass` record, which reflects initial allocation minus debited expenses logged under opcode 806. |
| **"Analyze sales performance for today."** | `mass`, `motion` | **Yes** | Tallies total revenue by aggregating transaction amounts (`value`) on `mass` order logs or matching `SALE` (201) / `PAYMENT_SUCCESS` (802) ledger records. |
| **"Create a new personal task: Call supplier tomorrow."** | `matter`, `mass` | **Yes** | Inserts a new personal `task` into `matter` and routes it to the local-only `user_${self_id}.db` for private data isolation. |
| **"Assign driver John Doe to the pending delivery for order #456."** | `relation`, `motion`, `mass` | **Yes** | Triggers `assignDriver()` which updates `mass` metadata and writes a `DRIVER_ASSIGNED` (403) phase update to the motion timeline. |

---

## 2. Customer Perspective (Consumer / Client)

These capabilities allow customers to self-serve, check their order statuses, book appointments, and interact with the storefront.

| Agentic Use Case / Inquiry Example | Core Database Tables | Possible in App? | Implementation Details / How It Works |
| :--- | :--- | :--- | :--- |
| **"What is the status of my order and when will it arrive?"** | `mass`, `motion` | **Yes** | Retrieves active `order` or `trip` `mass` records and tracks transit status (`IN_TRANSIT` 402, `DELIVERED` 109) and ETAs directly from the `motion` phase history. |
| **"Is the Pepperoni Pizza in stock right now?"** | `mass`, `matter` | **Yes** | Reads product definitions from `matter` and checks stock quantity balances (`qty > 0`) in the storefront's synced `mass` table. |
| **"File a complaint: My item was damaged."** | `mass`, `motion` | **Yes** | Creates a new support `ticket` `mass` slot and appends a `TICKET_OPEN` (306) timeline ledger entry with client details. |
| **"Are there any available slots for booking tomorrow afternoon?"** | `mass` | **Yes** | Scans `mass` rows of type `'slot'` under the team scope to find unallocated or retired blocks (`active = 0` or unused schedule windows). |
| **"Can I cancel my delivery request?"** | `mass`, `motion` | **Yes** | Updates the target trip/order `mass` status and appends a `CANCELLED` (703) phase update to the ledger. |
| **"Submit payment verification code/ref for my invoice."** | `mass`, `motion` | **Yes** | Updates invoice `mass` states and logs payment initiation (`PAY_INIT` 801) / payment success (`PAY_SUCCESS` 802) phase records. |
| **"What are the customizable options / modifiers for this item?"** | `matter`, `relation` | **Yes** | Resolves modifiers by querying the `relation` graph (where `type = 'modifier_of'`) to link options back to the main product matter catalog. |
| **"Can I get a refund on my sneaker purchase?"** | `mass`, `motion` | **Yes** | Locates the order `mass` record, flags it, and appends a `REFUND` (111) transaction line item in the kinetic ledger. |
