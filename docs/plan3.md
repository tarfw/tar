Searched for "OPCODE_LABELS"
Viewed domainsData.ts:570-621
Searched for "toggleTask"
Searched for "appendMotion"
Viewed workspace.tsx:650-750
Viewed workspace.tsx:750-860
Viewed workspace.tsx:860-920
Viewed workspace.tsx:920-950

Yes, all the core TAR architecture operations and opcodes for CRM, tasks, notes, SCM, and logistics are fully covered and functional inside `workspace.tsx`.

Here is the complete mapping of how these domains and opcodes are integrated on this screen:

| Domain                 | Opcode  | Label               | Trigger Event in UI                                         | Underlying TAR Tables Used                       |
| :--------------------- | :-----: | :------------------ | :---------------------------------------------------------- | :----------------------------------------------- |
| **CRM (Quick Events)** | **301** | `STORE VISIT`       | Tapping the "Visit" quick action chip                       | `motion`                                         |
|                        | **302** | `REVIEW`            | Submitting a rating & review comment modal                  | `motion`                                         |
|                        | **309** | `BIRTHDAY OFFER`    | Tapping the "Offer" quick action chip                       | `motion`                                         |
| **CRM (Leads)**        | **303** | `LEAD CREATE`       | Adding a new lead via the Lead form drawer                  | `mass` + `motion`                                |
|                        | **304** | `CONTACTED`         | Tapping the lead checkbox for the first time                | `motion`                                         |
|                        | **305** | `CONVERTED`         | Tapping the lead checkbox to finalize/win                   | `motion`                                         |
| **CRM (Support)**      | **306** | `TICKET OPEN`       | Submitting a new support ticket form                        | `mass` + `motion`                                |
|                        | **307** | `REPLY`             | Submitting a reply thread text message                      | `motion`                                         |
|                        | **308** | `RESOLVED`          | Tapping the trash/delete icon on a ticket                   | `mass` + `motion`                                |
| **Notes**              |    —    | —                   | Submitting a note (vector-embedded automatically)           | `matter` + `relation`                            |
| **Tasks**              | **504** | `TASK ASSIGNED`     | Creating a personal task or assigning it to an entity       | `matter` + `relation` + `mass` (slot) + `motion` |
|                        | **504** | `DONE` / `REOPENED` | Tapping the checkbox circle next to a task item             | `mass` + `motion`                                |
| **SCM (Shifts)**       | **501** | `SHIFT START`       | Adding a schedule/shift slot in Team/Family mode            | `mass` + `motion`                                |
| **SCM (Inventory)**    | **406** | `TRANSFER IN`       | Adding a stock SKU, or tapping the green Log In (📥) button | `mass` + `motion`                                |
|                        | **405** | `TRANSFER OUT`      | Tapping the blue Log Out (📤) button next to stock          | `mass` + `motion`                                |
| **Logistics**          | **401** | `DISPATCHED`        | Creating a trip shipment dispatch                           | `mass` + `motion`                                |
|                        | **402** | `IN TRANSIT`        | First status advancement of a carrier shipment trip         | `motion`                                         |
|                        | **109** | `DELIVERED`         | Second status advancement (marks trip completed)            | `mass` + `motion`                                |
|                        | **404** | `ETA UPDATE`        | Tapping the Clock button to append a transit delay          | `motion`                                         |

Searched for "relation"
Viewed workspace.tsx:470-520
Viewed workspace.tsx:740-770
Viewed workspace.tsx:700-739
Viewed workspace.tsx:770-830
Viewed workspace.tsx:870-920
Viewed workspace.tsx:250-280
Viewed workspace.tsx:400-460
Viewed workspace.tsx:1300-1320
Viewed workspace.tsx:1330-1360
Viewed workspace.tsx:1360-1400
Viewed workspace.tsx:75-88
Edited workspace.tsx
Viewed workspace.tsx:220-240
Edited workspace.tsx
Viewed workspace.tsx:520-570
Viewed workspace.tsx:570-585
Edited workspace.tsx
Viewed workspace.tsx:650-690
Viewed workspace.tsx:690-740
Edited workspace.tsx
Viewed workspace.tsx:1720-1750
Viewed workspace.tsx:1800-1845
Viewed workspace.tsx:1845-1895
Edited workspace.tsx
Viewed workspace.tsx:1370-1410
Viewed workspace.tsx:1410-1470
Edited workspace.tsx
Ran command: `npx tsc --noEmit`
Viewed workspace.tsx:580-595
Viewed workspace.tsx:720-745
Viewed workspace.tsx:565-580
Edited workspace.tsx
Viewed workspace.tsx:722-732
Edited workspace.tsx
Ran command: `npx tsc --noEmit`

I have successfully implemented both requested features:

### 1. Storefront Destination & Cross-Domain Relations

- **Interactive Transfer Form (`sheet === "transfer"`)**: Tapping the inbound (📥) or outbound (📤) transfer button now opens a detailed transfer drawer rather than an immediate alert.
- **Storefront Association**: The drawer prompts the user for quantity and renders a horizontal selector of storefronts (entities of type `"business"`).
- **Graph Relations & Ledger Linkage**:
  - If a storefront is selected, a new record is written to the `relation` table (`addRelation(db, stock.id, storefrontId, "storefront_transfer")`) to establish the link between the SCM stock item and the CRM retail shop ID.
  - The selected storefront details are saved into the `motion` payload (under `dest` or `src` properties for outbound/inbound transfers).

### 2. Warehouse Capacity Constraints

- **Capacity Limit Resolution**: When creating inventory items or executing stock transfers, the application dynamically resolves the warehouse's capacity limit from its matter payload (defaulting to `10000`).
- **Active Quantity Check**:
  - Calculates the current sum of all active stock item quantities inside the warehouse via `SELECT SUM(qty)`.
  - Preemptively validates the transaction in both `createStock` and `confirmStockTransfer` to block any addition that would exceed the capacity. If blocked, a warning alert is displayed.
