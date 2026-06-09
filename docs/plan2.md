# Plan: Unified Logistics & SCM Management in Workspace Hub

Yes, Logistics and Supply Chain Management (SCM) can be managed directly in the same **Workspace Hub (`workspace.tsx`)** screen. 

Because the TAR framework uses a unified schema (**matter**, **mass**, **motion**, and **relation**) and a generic database interface, the Workspace Hub is already structured as a type-dispatched dashboard. By expanding the entity filters and rendering specific components dynamically based on the selected entity's type, SCM and Logistics fit naturally alongside CRM and tasks.

This plan details how to integrate Logistics & SCM into the existing screen.

---

## 1. Data Schema Mapping for SCM & Logistics

We will utilize the existing 4-table TAR architecture with Logistics/SCM specific configurations (scoped to `w:{id}` for warehouses and `d` for global logistics/trips):

```
 WAREHOUSE PROFILE (matter)            STOCK ITEM (mass)
 ┌─────────────────────────┐           ┌─────────────────────────┐
 │ id:    wh_ch03          │           │ id:     mas_stock_wh03  │
 │ type:  'warehouse'      │           │ matter: wh_ch03         │
 │ scope: 'w:ch03'         │           │ type:   'stock'         │
 │ qty:    500             │           │ value:  25.00           │
 └─────────────────────────┘           └────────────┬────────────┘
                                                    │
                                                    ▼
                                       motion (TRANSFER OUT / IN)
                                       ┌─────────────────────────┐
                                       │ stream: mas_stock_wh03  │
                                       │ action: 405 / 406       │
                                       │ delta:  -50.0 / +100.0  │
                                       └─────────────────────────┘

 CARRIER/VEHICLE (matter)              TRIP / SHIPMENT (mass)
 ┌─────────────────────────┐           ┌─────────────────────────┐
 │ id:    carrier_dhl      │           │ id:     mas_trip_dhl01  │
 │ type:  'carrier'        │           │ matter: carrier_dhl     │
 │ scope: 'd'              │           │ type:   'trip'          │
 │ title: 'DHL Express'    │           │ geo:    '833075fffffff' │
 └─────────────────────────┘           └────────────┬────────────┘
                                                    │
                                                    ▼
                                       motion (DISPATCHED/IN TRANSIT)
                                       ┌─────────────────────────┐
                                       │ stream: mas_trip_dhl01  │
                                       │ action: 401 / 402 / 404 │
                                       │ phase:  active transit  │
                                       └─────────────────────────┘
```

### Table Roles in SCM Domain:
* **`matter`**: Defines structural assets: Warehouses (`type = 'warehouse'`) and Carrier/Vehicles (`type = 'carrier'`).
* **`mass`**: Represents physical state:
  * **Stock** (`type = 'stock'`): Holds item counts and valuations located inside a warehouse.
  * **Trips** (`type = 'trip'`): Represents active delivery journeys, including GPS H3 coordinates (`geo`), driver shifts, and delivery window start/end times.
* ****motion****: Operational ledgers tracking transitions:
  * **Logistics Events (401–410)**: `DISPATCHED` (401), `IN_TRANSIT` (402), `DRIVER_ASSIGNED` (403), `ETA_UPDATED` (404), `TRANSFER_OUT` (405), `TRANSFER_IN` (406), `RETURN_REQUEST` (407), `PICKUP_SCHEDULE` (408), `PICKED_UP` (409), `DELIVERY_ATTEMPT` (410).
* **`relation`**: Maps physical links (e.g. linking a Trip to a Customer Order profile or associate stock transfers with storefront destinations).

---

## 2. UI/UX Changes in `workspace.tsx`

The screen layout will dynamically branch when a Logistics entity is selected in the directory sidebar/list.

### A. Directory List Expansion
1. **Directory Query Update**: Expand the database load query to fetch warehouses and carriers.
   ```sql
   SELECT id, code, type, title, owner, data, time 
   FROM matter 
   WHERE type IN ('customer', 'business', 'person', 'family', 'warehouse', 'carrier') 
     AND scope = ? 
   ORDER BY time DESC
   ```
2. **Directory Item Indicators**: Render distinct icons and colors for SCM:
   * **Warehouse** 🏢 (`#8b5cf6` Violet): Uses `business-outline` or `cube-outline`.
   * **Carrier / Vehicle** 🚚 (`#a78bfa` Light Purple): Uses `car-sport-outline` or `bus-outline`.

### B. Warehouse View (Selected Entity)
When a `warehouse` is selected:
1. **Inventory Stock List (`mass`)**: Shows active products/stock in the warehouse (`type = 'stock'`).
   * Displays SKU, Item name, quantity (`qty`), value, and last updated time.
   * *Add Stock* button: Opens modal to increment inventory balance.
2. **Stock Transfers & Audits (`motion`)**:
   * Shows transfer ledger (`TRANSFER_OUT (405)` and `TRANSFER_IN (406)`).
   * Displays details like destination store (`dest`), source warehouse (`src`), and quantity offset.
   * *Log Transfer* button: Quick access to move stock to a retail storefront (e.g., `s:101`).

### C. Carrier / Trip View (Selected Entity)
When a `carrier` or `vehicle` is selected:
1. **Active Trips & Shipments (`mass`)**:
   * Shows active trips (`type = 'trip'`).
   * Displays trip ID, quantity of items onboard, current H3 geo index, and ETA.
   * *Start Trip* button: Dispatches a new trip.
2. **Trip Event Controls (`motion`)**:
   * For selected trips, inline controls allow:
     * **Assign Driver (403)**: Selects user profile and registers driver.
     * **Update ETA (404)**: Slide or inputs minutes/hours delta.
     * **Log Transit State**: Toggle from `DISPATCHED` (401) to `IN_TRANSIT` (402) or attempt delivery.

### D. Creation Modal Segment Selector
The "Add contact / entity" bottom sheet is extended to include SCM options in the Segment selector:
* Segments: `[Customer | Business | Team | Warehouse | Carrier]`
* Dynamically displays custom input fields (e.g., Warehouse Capacity & Dock Count vs Carrier Vehicle type & dispatch tier).

---

## 3. Implementation Step-by-Step

### Step 1: Database Operations Update
1. Update `loadCustomers` and queries in `workspace.tsx` to handle `warehouse` and `carrier` types.
2. Update `loadCustomerDetail` to dynamically query SCM tables when a warehouse or carrier is active:
   * **If Warehouse**:
     ```sql
     SELECT id, matter, type, qty, value, active, start, end, data, time 
     FROM mass 
     WHERE matter = ? AND type = 'stock'
     ```
   * **If Carrier**:
     ```sql
     SELECT id, matter, type, qty, value, active, geo, start, end, data, time 
     FROM mass 
     WHERE matter = ? AND type = 'trip'
     ```

### Step 2: SCM Forms Addition in Bottom Sheet Drawer
Add specific forms inside the `<Modal>` sheet:
* **Warehouse Form**: Adds fields for Capacity (limit) and Dock count. Saves as JSON in `data`.
* **Carrier Form**: Adds fields for Dispatch Tier (`air`, `ground`) and vehicle model details.
* **Stock Transfer Form**: Triggers a dual write (decrements source stock, logs `TRANSFER_OUT` in motion).
* **Trip Dispatch Form**: Creates a `mass` slot of type `trip` with H3 geo coordinate.

### Step 3: View Layout Branching
In the main render flow of `workspace.tsx`, replace the CRM details list with SCM lists when selected:
```tsx
{selectedCustomer.type === "warehouse" && (
  <>
    <SectionHeader title="Inventory Stock" tables="mass (stock)" />
    {/* Render Warehouse Stock list & Add Stock button */}
    
    <SectionHeader title="Warehouse Activity Logs" tables="motion" />
    {/* Render Stock Transfer Logs */}
  </>
)}

{selectedCustomer.type === "carrier" && (
  <>
    <SectionHeader title="Active Trips & Routes" tables="mass (trip)" />
    {/* Render Trips list with Geo / Driver stats */}
    
    <SectionHeader title="Transit Activity Logs" tables="motion" />
    {/* Render Trip Progress Logs (DISPATCHED, IN_TRANSIT, etc.) */}
  </>
)}
```

---

## 4. Summary of Benefits
* **Zero Schema Changes**: Reuses existing local-first synchronized database structure.
* **Unified UI Pattern**: Reduces application size and complexity by reusing lists, row details, action ledger chips, and modal sheets.
* **Cross-Domain Correlation**: Simplifies linking CRM customer orders directly to warehouse stocks and carrier trips via the `relation` network.
