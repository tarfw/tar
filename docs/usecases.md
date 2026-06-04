# TAR Database Mapping Guide: Matter, Mass, Motion & Relation

This document details how application features, state transitions, and entities map to the four unified tables (**matter**, **mass**, **motion**, and **relation**) under the TAR local-first architecture. It serves as a blueprint for implementing database queries and understanding application data distribution using the event opcodes from [plan.md](file:///c:/tarfwk/tar/docs/plan.md).

---

## 1. Schema Roles Summary

| Table | Concept | Primary Role | Core Columns Used | Example Entities |
| :--- | :--- | :--- | :--- | :--- |
| **matter** | **Intrinsic Identity** | Static/reference definitions, templates, and profiles. | `id`, `code`, `type`, `scope`, `title`, `data` | Products, Menu items, Forms, User Profiles, Campaigns |
| **mass** | **Physical Realization** | Real-time state, quantities, location coordinates, and schedule constraints. | `id`, `matter`, `type`, `qty`, `value`, `geo`, `start`, `end` | Stock levels, Pricing tiers, Active Shifts, GPS coords, Calendars |
| **motion** | **Kinetic Ledger** | Append-only streams of actions and in-place status changes. | `id`, `stream`, `seq`, `action` (opcode), `status`, `delta` | Order progress logs, Ticketing replies, Clock-ins, Payments |
| **relation** | **Structural Network** | Directed graph relationships connecting independent entities. | `src`, `tgt`, `type`, `weight` | Product-to-Category, Order-to-Customer, Ticket-to-Order |

---

## 2. Table Mapping by Domain & Opcodes

The table below describes what data goes into each of the four tables for every major system domain.

| Domain & Opcode Range | Opcodes Referenced | `matter` (Identity) | `mass` (Realization) | `motion` (Ledger / State) | `relation` (Network Graph) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Retail & E-Commerce**<br>*(Opcodes 101–114)* | **101**: SOLD<br>**102**: CART_ADD *(Local)*<br>**103**: CART_REMOVE *(Local)*<br>**104**: CHECKOUT<br>**105**: ORDER_PLACED<br>**106**: CONFIRMED<br>**107**: PREPARING<br>**108**: READY<br>**109**: DELIVERED<br>**110**: INVOICE_GENERATED<br>**111**: REFUND<br>**112**: RENEWAL_DUE<br>**113**: COUPON_APPLIED<br>**114**: WISHLISTED *(Local)* | Product definitions (`prod_thermos`), store profiles, coupon templates (`save50`), user profiles. | Product inventory stock levels (`qty`), price (`value`), and storefront availability. | Offline shopping cart logs (`102`, `103`, `114`), order pipelines (`104`–`109`), invoice & refund ledgers (`110`, `111`). | Link product to categories, orders to customer profiles (`placed_by`), and order to products (`has_item`). |
| **POS & Restaurant**<br>*(Opcodes 201–210)* | **201**: SALE<br>**202**: SHIFT_START<br>**203**: BREAK<br>**204**: SHIFT_END<br>**205**: CASH_CLOSE<br>**206**: ORDER_FIRE<br>**207**: ITEM_READY<br>**208**: TOKEN_ISSUED<br>**209**: TOKEN_CALLED<br>**210**: TOKEN_SERVED | Menu item definitions (e.g. `dish_biryani`), POS terminal profiles, token queue settings. | Raw ingredient levels, terminal cash drawer capacity, active tables. | Active terminal shifts (`202`–`204`), till auditing (`205`), kitchen display (KDS) orders (`206`, `207`), queues (`208`–`210`). | Assign cashiers to POS terminals (`mats_assigned`), associate KDS items with server. |
| **CRM & Support**<br>*(Opcodes 301–309)* | **301**: STORE_VISIT<br>**302**: REVIEW<br>**303**: LEAD_CREATED<br>**304**: CONTACTED<br>**305**: CONVERTED<br>**306**: TICKET_OPEN<br>**307**: REPLY<br>**308**: RESOLVED<br>**309**: BIRTHDAY_OFFER_SENT | Customer profiles, help ticket categories, email feedback layouts. | Open ticket allocations, customer loyalty point balances. | Store visits (`301`), ratings (`302`), sales funnel transitions (`303`–`305`), ticket replies (`306`–`308`), promo delivery (`309`). | Connect support tickets to purchase orders (`disputes_order`), link leads to sales agents. |
| **Logistics & SCM**<br>*(Opcodes 401–410)* | **401**: DISPATCHED<br>**402**: IN_TRANSIT<br>**403**: DRIVER_ASSIGNED<br>**404**: ETA_UPDATED<br>**405**: TRANSFER_OUT<br>**406**: TRANSFER_IN<br>**407**: RETURN_REQUEST<br>**408**: PICKUP_SCHEDULE<br>**409**: PICKED_UP<br>**410**: DELIVERY_ATTEMPT | Shipping carriers, warehouse profiles (`wh_ch03`), transport vehicle models. | Vehicle GPS coordinates (`geo`), delivery windows, calculated ETAs. | Driver task tracking (`401`–`404`), warehouse entry/exit audits (`405`, `406`), return pipelines (`407`–`410`). | Associate shipments with shipping agents (`shipped_by`), connect routes to warehouse hubs. |
| **HR & Staff**<br>*(Opcodes 501–508)* | **501**: CLOCK_IN<br>**502**: CLOCK_OUT<br>**503**: PAYROLL<br>**504**: TASK_ASSIGNED *(Local)*<br>**505**: PERFORMANCE_NOTE<br>**506**: LEAVE_REQUESTED<br>**507**: APPROVED<br>**508**: REJECTED | Employee accounts, roles, leave balance policies, performance metrics. | Scheduled shift shifts (`start` / `end`), salary structures. | Clock-in/outs (`501`, `502`), salary payout logs (`503`), private tasks (`504`), leaves (`506`–`508`), manager notes (`505`). | Connect employees to departments, structure organizational manager hierarchies. |
| **Marketing & Forms**<br>*(Opcodes 601–604)* | **601**: PUSH_SENT<br>**602**: SMS_SENT<br>**603**: REFERRAL<br>**604**: FORM_SUBMIT | Marketing templates, newsletter layouts, dynamic form configurations. | Campaign run schedules, dynamic forms active duration. | Sent notification audits (`601`, `602`), promo code redemptions (`603`), custom inputs (`604`). | Link form submissions to respective form blueprints, link users to marketing lists. |
| **Services & Bookings**<br>*(Opcodes 701–703)* | **701**: BOOKED<br>**702**: COMPLETED<br>**703**: CANCELLED | Service definitions (e.g. consultations, repairs), technician accounts. | Consultant/Technician calendar availability slots (`start` / `end`). | Booking lifecycle logs (creation `701`, completions `702`, cancellations `703`). | Map booking instances to client profile and service provider. |
| **Payments & Finance**<br>*(Opcodes 801–806)* | **801**: PAYMENT_INITIATED<br>**802**: PAYMENT_SUCCESS<br>**803**: PARTIAL_PAYMENT<br>**804**: PAYOUT<br>**805**: PAYMENT_FAILED<br>**806**: EXPENSE_RECORD | Corporate payment gateways, tax accounts, budget categories. | Budget ceilings, merchant billing limit tiers. | Transaction audit states (`801`–`803`, `805`), merchant payouts (`804`), general ledger expenses (`806`). | Link payment transactions to corresponding invoices, link expenses to suppliers. |
| **ERP, Sourcing & Fleet**<br>*(Opcodes 901–907)* | **901**: BOOKING<br>**902**: ASSIGNED<br>**903**: RIDE_REQUESTED<br>**904**: DRIVER_MATCHED<br>**905**: IN_RIDE<br>**906**: RECRUIT_APPLY<br>**907**: PROCURE_REQ | Fleet vehicles, job vacancies, vendor parts catalog, lease items. | Leased hardware timer slots, active taxi coordinates (`geo`). | Heavy machinery leases (`901`, `902`), ride-hailing logs (`903`–`905`), applications (`906`), supply requests (`907`). | Link parts to vendor, link job candidates to interviewer profiles. |

---

## 3. Database Write Strategy & Routing Mechanics

When writing to these tables, the **Scope Code** (defined in [plan.md](file:///c:/tarfwk/tar/docs/plan.md)) and the **Write Strategy** dictate which database file the client writes to:

### A. Target Database Files
1. **Private Local DB (`user_${self_id}.db`)**:
   * Stores data scoped as **Personal** (`p`).
   * Used for local-only actions: `CART_ADD` (102), `CART_REMOVE` (103), `WISHLISTED` (114), and `TASK_ASSIGNED` (504).
   * **Zero cloud cost** since this data never leaves the client device.
2. **Sync-Enabled DB (`user_sync_${owner_id}.db`)**:
   * Stores collaborative data scoped to shared segments (e.g. storefront `s:102`, logistics `d`, friends `r:55`).
   * Synced to the remote cloud server (`db_${owner_id}`) via Turso background threads.
3. **Global DB (`global.db`)**:
   * Acts as a read-only cache on the client for public catalogs (scope `g`).

### B. Write Behaviors (Optimizing for cost)
* **Append**: Performs an `INSERT` statement into `motion` (e.g. Opcode 105 `ORDER_PLACED`, Opcode 501 `CLOCK_IN`). Required for immutable audit records.
* **Status Update**: Performs an `UPDATE` statement targeting the `status` column of an existing row (e.g. changing an order stream status from `PREPARING` to `READY` using Opcode 108). This minimizes data row growth.
