# TAR Workspace GenUI — Plan 4+5 (Component-First Architecture & OKF-Native)

> Grounded in existing code and Google's Open Knowledge Format (OKF). Key decisions:
> - **One word: `Block`.** In code a Block is a `UISection` (`layout-engine.ts`). A skill's `app_layout.sections` is a list of Blocks.
> - **100% Native Component Registry:** Every UI tool is a pure React Native component registered in `ComponentRegistry.ts` ([builtins.ts](file:///c:/tarfwk/tar/tarapp/src/gen-ui/registry/builtins.ts)).
> - **OKF-First Storage:** Layout (`canvas.md`) and Roles (`members.md`) live in S3 (`w:{sub}/...`) as human/agent-readable OKF Markdown files with YAML frontmatter.
> - **Roles = Allowed-skills list.** S3 `members.md` frontmatter defines roles and member mappings. No per-role layouts (§6).
> - **Universal by composition.** A business type is a *set of enabled skills* over the 4 core Turso tables (`matter`, `motion`, `graph`, `inbox`). 14 skills express restaurant, clothing, groceries, delivery, taxi… (§7).
> - **Create = name only.** No business guessing at create time; skills are added directly to the canvas afterward (§8).
> - **Native Master Primitives.** `data-grid`, `metric-card`, `quick-actions`, `status-board`, `pos-sale` cover 100% of workspace UI needs (§3). Web Views serve only as an optional external URL escape hatch (`custom-view`).
> - **Auto-clean.** Canvas starts empty or loads default layout; `"clear"` / `"home"` resets active blocks.
> - **LLM last.** In-memory keyword index compiled on workspace load matches direct intents first; LLM tool-calling agent runs only on no-match (§5).
> - **`role` column on `matter`.** Entities keep their fast-indexed `type` field AND gain an additive `role` column for semantic sub-classification. No JSON extraction needed (§10).
> - **Named `motion` taxonomy.** Every event written to `motion` uses a defined type vocabulary (`sale`, `shipment`, `clock-in`, …) not free-form strings (§10).
> - **Named `graph` vocabulary.** Every relationship edge uses a defined `rel` name (`placed_by`, `assigned_to`, …) not vague strings (§10).

---

## 1. The Whole System on One Screen

```
                          ┌───────────────────────────────┐
                          │        WORKSPACE CANVAS        │
                          │      Renders canvas.md        │
                          └───────────────────────────────┘
                                        ▲
          types "orders"  ┌─────────────┴──────────────┐  taps a chip
                          │       INTENT RESOLVER       │
                          │   in-memory keyword index   │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │      SKILL FILTER (role)    │
                          │  from members.md frontmatter│
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │       canvas.md BLOCKS      │
                          │  [ {type, props: {...}} ]   │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │ NATIVE COMPONENT REGISTRY   │
                          │ (React Native Primitives)   │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │   TURSO  w:{id}  (scoped)   │
                          │  matter · motion · graph ·  │
                          │           inbox             │
                          └─────────────────────────────┘
```

Read it top to bottom: **you type or tap → resolver picks a module → role filter allows it → blocks are chosen → registry renders them → each block reads/writes scoped data.**

---

## 2. Ground Truth — What Already Exists

Before adding anything, this is what's built today (do not re-invent):

| Piece | File | State |
|-------|------|-------|
| Canvas host + intent bar | `tarapp/src/app/(tabs)/workspaces.tsx` | ✅ built (intent = inline regex, to be extracted) |
| Block renderer | `tarapp/src/components/WorkspaceCanvas.tsx` | ✅ built (registry-driven) |
| Component registry | `tarapp/src/gen-ui/registry/ComponentRegistry.ts` + `builtins.ts` | ✅ built |
| Layout/YAML parser | `tarapp/src/lib/layout-engine.ts` | ✅ built (flat `app_layout.sections`) |
| 14 core skills | `taragent/src/lib/core-modules.ts` | ✅ built (flat layout) |
| Action execution | `taragent` `/ai-tasks/execute`, `/tools/:name` | ✅ built |
| OKF File storage (S3) | `taragent/src/lib/okf.ts` + `/okf/*` routes | ✅ built |
| DB rules (source of truth) | `taragent/src/modules/dbrules.md` | ✅ built |
| `matter.role` column | `tarapp/src/lib/schema.ts` + `tools.ts` | ⬜ to add (Phase 5) |

**Scope prefix is `w:` — not `ws:`.** `app.ts` uses `w:${subdomain}` and every route does `scope.replace('w:', '')`. All SQL and examples here use `w:`.

---

## 3. Pre-Designed Component Catalogue (Native Primitives)

Rather than maintaining 15 hyper-specific components, the UI registry uses **Native React Native Master Primitives** with display mode & variant configuration:

| Master Primitive | Purpose & Modes | JSON Props Contract (Schema) |
|------------------|-----------------|-----------------------------|
| `quick-actions` | Action chips and dynamic input forms | `{ "actions": [{ "name": "record_sale", "label": "Record Sale" }] }` |
| `metric-card` | Large KPI summary cards & Hero analytics charts (`variant: "hero-chart"`) | `{ "title": "Request", "subtitle": "Analytics", "variant": "hero-chart", "value": "893,283", "unit": "All Time" }` |
| `data-grid` | Unified list/grid view (`table`, `catalog`, `inbox`, `booking`, `timeline` modes) | `{ "type": "product", "mode": "table", "filters": { "status": "active" } }` |
| `status-board` | Kanban column board for entity states | `{ "type": "task", "groupBy": "status" }` |
| `pos-sale` | Native POS Billing Register (offline Turso replica, barcode camera, thermal printer) | `{ "catalogType": "product", "allowDiscounts": true, "taxRate": 0.05 }` |
| `custom-view` | *(Optional)* Webview loader for external URLs / iFrames | `{ "url": "https://external-dashboard.com" }` |

*Note: Legacy builtins (`catalog-grid`, `booking-grid`, `timeline-feed`, `content-card`, `entity-navigator`) map directly as preset aliases of `data-grid` to keep registry code minimal.*

---

## 4. Canvas States

| State | Description | Where in code |
|-------|-------------|---------------|
| **Empty** | No active widget. Shows default workspace summary cards. | `activeWidget === null` branch |
| **Active** | Active module/skill blocks rendered from S3 `canvas.md`. | `activeWidget = { moduleName }` |
| **Cleared** | `clear`/`reset`/`home`/`canvas` typed → back to Empty. | already wired (`workspaces.tsx:387`) |

---

## 5. Skill Registry & Dynamic Intent Map

Today intent lives as inline regex in `workspaces.tsx:387–475`. Since skills are OKF Markdown/YAML files:
1. On workspace load, `intent-resolver` loads active skill frontmatter into an in-memory index (`{ "orders": "orders_module", "stock": "inventory_module" }`).
2. **Resolution chain (v1):** In-memory keyword match → module-name match (`canvasLayouts`) → LLM parse / tool calling (only on no-match). LLM calls `/canvas/add` tool for semantic & complex requests.
3. **Fallback UI:** If LLM resolver fails to match, display suggestion chips ("Did you mean: orders, inventory...?") to avoid dead-ends (maximum 1 automatic LLM retry).

---

## 6. Roles = OKF Channel-Led Access Control (CLAC)

Permissions are delegated to group chats (Telegram, Google Chat, Discord, Slack) and mapped in S3 `w:{subdomain}/team/members.md`.

### Storage — OKF Format `w:{subdomain}/team/members.md`

```markdown
---
type: TeamConfiguration
title: Team Access & Channel Mappings
timestamp: 2026-07-22T01:20:00Z
roles:
  Staff: [orders, inventory]
  Delivery: [logistics]
  Admin: [*]
members:
  - email: "ravi@gmail.com"
    role: "Staff"
  - email: "kumar@gmail.com"
    role: "Admin"
---

# Channel Mappings

| Channel Name   | Platform   | Channel ID | Mapped Role / Skills |
|----------------|------------|------------|----------------------|
| Kitchen Team   | googlechat | spaces/ABC | Staff (orders, stock)|
| Delivery Staff | telegram   | -10019283  | Delivery (logistics) |
| Management     | discord    | 1234567890 | Admin (*)            |
```

* **Machine Fast Path**: `tarapp` / `taragent` reads the YAML frontmatter (`roles` and `members`) directly for instant type-safe access control.
* **Human / Agent Readable Path**: External bots update the Markdown table body when `/link` is executed.
* **Universal Native `tarapp` Verification (Zero Email / 100% In-App)**:
  1. User types `/link` in ANY chat group (Telegram, Google Chat, Slack, Discord, WhatsApp).
  2. CF Worker bot replies with:
     - **1-Tap Deep Link**: `tarapp://link?code=849201`
     - **Manual Code**: `849-201`
  3. User taps link or opens native `tarapp` on phone (where they are logged in via Google SSO).
  4. `tarapp` pairs their authenticated email with the code ➔ calls `/okf/edit` to update S3 `members.md` status to `verified`.

---

## 7. Universal by Composition

A business type is a *set of enabled skills* over the 4 core tables. The `matter.type` column stays specific and indexed; the additive `matter.role` column adds semantic sub-classification where needed.

| Business | Enabled skills | matter.type | matter.role (where used) |
|----------|---------------|-------------|---------------------------|
| Restaurant | orders inventory bookings hr | product, order, booking | staff, manager |
| Clothing | orders inventory listings crm | product, order, listing | customer, contact |
| Groceries | orders inventory logistics | product, order, shipment | customer |
| Delivery | logistics orders crm | shipment, order | customer, driver |
| Taxi | bookings logistics crm expenses | booking, shipment | customer, driver |
| Clinic | bookings crm hr documents | booking, document | customer, staff, doctor |
| Salon | bookings inventory crm | booking, product | customer, staff |
| Agency | projects crm expenses hr | project, expense | customer, staff, manager |

**Rule:** `matter.type` = what the record *is* (product, order, booking…). `matter.role` = who or what subtype within that entity (customer, staff, driver…). Both columns are independently indexed — no JSON extraction required.

---

## 8. Canvas-First Skill Management (OKF Format)

The canvas itself is the single source of truth for active tools/skills, stored in standard OKF format:

### Storage — OKF concept `w:{subdomain}/team/canvas.md`

```markdown
---
type: CanvasLayout
title: Workspace Active Canvas
timestamp: 2026-07-22T01:20:00Z
blocks:
  - title: "Billing Counter"
    type: "pos-sale"
    props: { "catalogType": "product", "taxRate": 0.05 }
  - title: "Current Stock"
    type: "data-grid"
    props: { "type": "product", "mode": "table" }
  - title: "Monthly Sales Report"
    type: "metric-card"
    props: { "title": "Request", "subtitle": "Analytics", "variant": "hero-chart", "value": "893,283", "unit": "All Time" }
---

# Active Workspace Canvas Layout

Enumerates current active blocks rendered on the canvas host.
```

### `/canvas/add` & `/canvas/remove` Endpoints

Modifies the `blocks` array in `w:{subdomain}/team/canvas.md` using standard OKF S3 edit functions (`okf.ts`).

---

## 9. Phased Implementation Roadmap

Legend: **NEW** = create · **keep** = do not touch · **DELETE** = remove.

| Phase | Task | File |
|-------|------|------|
| **0 — Native Primitives & Registry** | Consolidate core blocks into Native Master Primitives (`data-grid`, `metric-card`, `quick-actions`, `status-board`, `pos-sale`) | `tarapp/src/gen-ui/registry/builtins.ts` + primitives |
| | Correct dbrules prose `ws:` → `w:` (code is canonical) | `dbrules.md` |
| **1 — In-Memory Intent Resolver** | Compile active OKF skill keywords on workspace load for $O(1)$ lookup | `intent-resolver.ts` (NEW) ⟵ `workspaces.tsx:387–475` |
| **2 — Onboarding Block** | Name-only workspace creation via standard registry component (`quick-actions` / `action-form`) | delete old `add-workspace.tsx` |
| **3 — OKF Canvas Management** | S3 `team/canvas.md` CRUD endpoints (`/canvas/add`, `/canvas/remove`) | `taragent` routes + `WorkspaceCanvas.tsx` |
| **4 — OKF Role Filter (CLAC)** | Read YAML frontmatter from S3 `team/members.md` for role-based skill filtering | `role-filter.ts` (NEW) |
| **5 — Entity Role Column** | `ALTER TABLE matter ADD COLUMN role TEXT` + index + update `generateEntityId()` to entity-level prefixes + update all skill `.md` queries | `schema.ts`, `tools.ts`, `dbrules.md`, skill files |

---

## 10. Entity Roles, Motion Taxonomy & Graph Vocabulary

*Adopted from plan5. Additive — does not replace any plan4 foundation.*

### 10.1 `matter.role` — Additive Column, Indexed

The `matter` table gains one new column. **`type` is never removed or generalised** — it stays the primary discriminator for fast indexed queries.

```sql
-- One migration, backward-compatible
ALTER TABLE matter ADD COLUMN role TEXT;
CREATE INDEX IF NOT EXISTS idx_matter_scope_type_role ON matter(scope, type, role);
```

| `matter.type` | `matter.role` values | Example |
|--------------|---------------------|----------|
| `product` | *(none needed)* | Inventory item |
| `order` | *(none needed)* | Sales order |
| `booking` | *(none needed)* | Appointment |
| `customer` | `vip`, `wholesale`, `retail` | Loyalty tier |
| `staff` | `manager`, `admin`, `driver`, `doctor` | Sub-role within staff |
| `listing` | `real-estate`, `subscription`, `catalog` | Listing subtype |
| `expense` | `travel`, `salary`, `vendor` | Expense category |

**Query pattern — both styles work, both hit an index:**
```sql
-- Fast, specific (preferred for UI queries)
SELECT * FROM matter WHERE scope = 'w:acme' AND type = 'staff';

-- Role-filtered (used by agent when semantic sub-role matters)
SELECT * FROM matter WHERE scope = 'w:acme' AND type = 'staff' AND role = 'manager';
```

**`generateEntityId()` stays type-based** (`stf`, `cus`, `prd`…). No change to existing IDs.

---

### 10.2 `motion` Event Taxonomy — Named Type Vocabulary

Every event written to `motion` must use a type from this vocabulary. No free-form strings.

| Category | `motion.type` values |
|----------|---------------------|
| **Transaction** | `sale`, `refund`, `payment` |
| **Logistics** | `shipment`, `delivery`, `tracking` |
| **Schedule** | `booking`, `cancellation` |
| **Work** | `clock-in`, `clock-out`, `assignment` |
| **Money** | `expense`, `write-off` |
| **Pipeline** | `deal`, `stage` |
| **Inventory** | `adjust`, `restock` |
| **System** | `status-change`, `activity` |

Skill `.md` files reference these types in their action definitions so the agent knows which `motion.type` to write for each action.

---

### 10.3 `graph` Relationship Vocabulary — Named `rel` Values

Every edge written to `graph` must use a `rel` name from this vocabulary.

| `rel` | `src` type | `tgt` type | Meaning |
|-------|-----------|-----------|----------|
| `placed_by` | `order` | `customer` | Order belongs to customer |
| `booked_by` | `booking` | `customer` | Booking belongs to customer |
| `fulfils` | `shipment` | `order` | Shipment fulfils order |
| `assigned_to` | `project` | `staff` | Project assigned to staff |
| `works_at` | `staff` | `company` | Staff member works at company |
| `supplied_by` | `product` | `company` | Product supplied by vendor |
| `tagged` | any | any | Generic label/tag edge |

When an agent writes a `sale` motion it also writes a `graph(src=order_id, rel='placed_by', tgt=customer_id)` edge — this is now explicit, not implicit.

---

### 10.4 OKF ↔ Turso Bridge (Where Data Lives)

| OKF File (brain — *how*) | Turso table (memory — *what*) |
|--------------------------|-------------------------------|
| `team/members.md` | `matter` (`type='staff'`) |
| `skills/orders.md` | `motion` (`type='sale'`) |
| `products/catalog.md` | `matter` (`type='product'`) |
| `site/layouts/*.json` | `graph` (layout relationships) |
| `team/canvas.md` | `inbox` (pending canvas tasks) |

---

## Future v2 Deferred Tasks
* **Customer storefront sites** — Cart, checkout, booking widgets, and storefront grid layouts kept in a separate project to focus purely on internal workspace efficiency.
* **Full entity unification** (`type='person'` + `json role`) — only worth doing if the same human genuinely appears as both customer and staff and the `role` column alone is insufficient. Requires json_extract indexes (SQLite generated columns) and a full data migration.
