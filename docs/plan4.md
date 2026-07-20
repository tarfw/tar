# TAR Workspace GenUI — Plan 4 (Simple & Complete)

> Grounded in the code that actually exists. Five decisions define the system:
> - **One word: `Block`.** In code a Block is a `UISection` (`layout-engine.ts`). A skill's `app_layout.sections` is just a list of Blocks.
> - **Roles = an allowed-skills list.** A member gets a subset of skills; that alone scopes canvas, chips, and intents. No per-role layouts (§7).
> - **Universal by composition.** A business type is a *set of enabled skills* over the same 4 tables, not a new module. The 14 skills express restaurant, clothing, groceries, delivery, taxi… (§12).
> - **Create = name only.** No business guessing at create time; skills are chosen afterward via the `skill-catalog` block (§13).
> - **Blocks are predefined native primitives**, composed by AI, never code-generated. One JSON escape hatch for the long tail (§14).

---

## The Whole System on One Screen

```
                          ┌───────────────────────────────┐
                          │        WORKSPACE CANVAS        │
                          │  (one screen, no navigation)   │
                          └───────────────────────────────┘
                                        ▲
          types "orders"  ┌─────────────┴──────────────┐  taps a chip
                          │       INTENT RESOLVER       │
                          │   keyword → module + blocks │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │      SKILL FILTER (role)    │
                          │  keep only allowed modules  │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │       BLOCK[]  MANIFEST     │
                          │  e.g. [data-table, metric]  │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │     COMPONENT REGISTRY      │
                          │   type string → component   │
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

## 0. Ground Truth — What Already Exists

Before adding anything, this is what's built today (do not re-invent):

| Piece | File | State |
|-------|------|-------|
| Canvas host + intent bar | `tarapp/src/app/(tabs)/workspaces.tsx` | ✅ built (intent = inline regex, to be extracted) |
| Block renderer | `tarapp/src/components/WorkspaceCanvas.tsx` | ✅ built (registry-driven) |
| Component registry | `tarapp/src/gen-ui/registry/ComponentRegistry.ts` + `builtins.ts` | ✅ built |
| Layout/YAML parser | `tarapp/src/lib/layout-engine.ts` | ✅ built (flat `app_layout.sections`) |
| 14 core skills | `taragent/src/lib/core-modules.ts` | ✅ built (flat layout, `site_pages`) |
| Action execution | `taragent` `/ai-tasks/execute`, `/tools/:name` | ✅ built |
| DB rules (source of truth) | `taragent/src/modules/dbrules.md` | ✅ built |

**Scope prefix is `w:` — not `ws:`.** `app.ts` uses `w:${subdomain}` and every route does `scope.replace('w:', '')`. All SQL and examples here use `w:`. (dbrules.md prose still says `ws:` — treat `w:` as canonical until dbrules is corrected.)

The 4 tables are fixed (dbrules §2): `matter` · `motion` · `graph` · `inbox`. Blocks read/write only these.

---

## 1. Guiding Principles

| # | Principle |
|---|-----------|
| 1 | **Blocks, not pages.** The canvas is a live composition surface. No navigation. |
| 2 | **Intent → Block[].** Typed input or a chip resolves to one or more blocks. No chat thread. |
| 3 | **Auto-clean.** `clear`/`reset`/`home` empties the canvas (already wired at `workspaces.tsx:387`). |
| 4 | **Skill-scoped by member.** A member sees only their allowed skills — that alone scopes canvas, chips, and intents. |
| 5 | **Data-direct.** Every block reads/writes `matter/motion/graph/inbox` per dbrules, always `WHERE scope = ?`. |
| 6 | **LLM last.** The input bar is a command launcher. Keyword match first; LLM only on no-match. |

---

## 2. One Concept: The Block

A **Block** is one rendered box on the canvas. In code it is a `UISection`. A skill's `app_layout.sections` is simply a **list of Blocks**.

```
   A SKILL  (orders.md)                 THE CANVAS
   ┌───────────────────────┐           ┌───────────────────────┐
   │ app_layout:           │           │  ┌─────────────────┐  │
   │   sections:           │  renders  │  │  metric-card    │  │  ← Block 1
   │     - metric-card ────┼──────────▶│  │  Today's Sales  │  │
   │     - data-table  ────┼──────────▶│  └─────────────────┘  │
   │     - quick-actions ──┼───┐       │  ┌─────────────────┐  │
   └───────────────────────┘   │       │  │  data-table     │  │  ← Block 2
                               │       │  │  Orders         │  │
      quick-actions is not a   │       │  └─────────────────┘  │
      canvas block — it feeds  └──────▶│  [ Record Sale ] chip │  ← chips (bottom bar)
      the chips row instead.           └───────────────────────┘
```

### Block Catalogue — reality, not wishlist

Ground truth: **`builtins.ts` registers exactly 8 types today** (verified against the file, not the plan). The plan previously claimed 9 and marked `status-board`/`report-chart` as built — they are **not** registered. Corrected below.

| Block type | Reads from | Renders | Status |
|------------|-----------|---------|--------|
| `quick-actions` | — | action chips (bottom bar, not canvas) | ✅ registered |
| `metric-card` | aggregate SQL | one number + label | ✅ registered |
| `data-table` | `matter WHERE type=?` | paginated rows | ✅ registered |
| `catalog-grid` | `matter type=product/listing` | product cards | ✅ registered |
| `booking-grid` | `matter type=booking` | appointment slots | ✅ registered |
| `timeline-feed` | `motion` | chronological events | ✅ registered |
| `content-card` | free text | text/image card | ✅ registered |
| `entity-navigator` | switches sub-views | CRM tab switcher | ✅ registered |
| `status-board` | `matter` grouped by `status` | kanban columns | ❌ **NOT built** (projects/support need it) |
| `report-chart` | aggregate SQL | bar/line chart | ❌ **NOT built** (reports needs it) |
| `inbox-list` | `inbox WHERE scope` | shared to-do list | 🔲 planned (§14) |
| `role-editor` | `team/members.md` | member → skills toggles | 🔲 planned (§7) |
| `pos-sale` | `matter type=product` + local Turso | cart + payment | 🔲 planned (§14) |
| `action-form` | — | dynamic form from action params | 🔲 planned (§14) |

**Rule:** a Block type exists **only when registered in `ComponentRegistry`**. No plan entry counts as real until `builtins.ts` registers it. `WorkspaceCanvas` already silently skips unknown types — keep that.

**P0 — fix the lies first:** register `status-board` + `report-chart` before anything else. The plan claimed them done; they aren't, so projects/support/reports render nothing today.

**New blocks this plan adds** (details in referenced sections): `status-board` + `report-chart` (P0), `role-editor` (§7), `workspace-form` + `skill-catalog` + `site-designer` (§6, §13), `inbox-list` + `action-form` + `pos-sale` (§14).

---

## 3. Canvas States

```
   EMPTY                    ACTIVE                    CLEARED
   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
   │ inventory +  │  type   │  one module  │  type   │  back to     │
   │ orders       │ ──────▶ │  blocks      │ ──────▶ │  EMPTY       │
   │ fallback     │"orders" │  rendered    │ "clear" │              │
   │ cards        │         │              │         │              │
   └──────────────┘         └──────────────┘         └──────────────┘
   activeWidget=null        activeWidget={module}    activeWidget=null
```

| State | Description | Where in code |
|-------|-------------|---------------|
| **Empty** | No active widget. Shows inventory + orders fallback cards. | `activeWidget === null` branch |
| **Active** | One module's blocks rendered. | `activeWidget = { moduleName }` |
| **Cleared** | `clear`/`reset`/`home`/`canvas` typed → back to Empty. | already wired (`:387`) |

Blocks are **not persisted between sessions** in v1. (Pinning/default-canvas is Appendix A.)

---

## 4. Intent Resolver — Extract What's Already There

Today intent lives as inline regex in `workspaces.tsx:387–475`. Step one: **move it into `taragent/src/lib/intent-map.ts` + a thin client resolver**, unchanged in behaviour, then grow it.

### Resolution chain (v1)

```
   "low stock"
       │
       ▼
   ┌─────────────────────────────┐   hit
   │ 1. KEYWORD MATCH (intent-map)│ ───────▶  { module: inventory, blocks: [data-table] }
   └──────────────┬──────────────┘
                  │ miss
                  ▼
   ┌─────────────────────────────┐   hit
   │ 2. MODULE-NAME MATCH         │ ───────▶  setActiveWidget(module)
   │    (scan canvasLayouts)      │
   └──────────────┬──────────────┘
                  │ miss
                  ▼
   ┌─────────────────────────────┐
   │ 3. LLM PARSE (tar.chat)      │ ───────▶  action call OR plain reply
   │    only on no-match          │
   └─────────────────────────────┘
```

Semantic embedding is **not** in v1 (Appendix A).

### Keyword → Block map (the fast path)

Each row maps input tokens → `{ module, blocks? }`. `module` drives `setActiveWidget`; if `blocks` is omitted, the module's own `app_layout.sections` is used.

| User says | Module | Blocks |
|-----------|--------|--------|
| "products", "menu", "inventory", "stock" | `inventory` | catalog-grid + metric-card (low stock) |
| "low stock", "stock alert" | `inventory` | data-table (value ≤ min) |
| "orders", "sales" | `orders` | data-table (orders) + metric-card (today) |
| "new sale", "pos", "record sale" | `orders` | quick-action → action_record_sale |
| "bookings", "appointments" | `bookings` | booking-grid |
| "customers", "contacts", "deals", "pipeline" | `crm` | entity-navigator |
| "expenses" | `expenses` | data-table |
| "staff", "employees", "clock" | `hr` | data-table + timeline-feed |
| "tasks", "projects" | `projects` | status-board |
| "tickets", "support", "help" | `support` | status-board |
| "shipments", "deliveries", "track" | `logistics` | data-table + timeline-feed |
| "listings" | `listings` | catalog-grid |
| "reports" | `reports` | metric-card + report-chart |
| "new workspace", "add workspace", "create workspace" | `workspace` | workspace-form (§6) |
| "site", "website", "storefront", "design site" | `workspace` | site-designer (§6) |

The existing `matchedModule` fallback (`workspaces.tsx:446`) already does most of this by scanning `canvasLayouts` — formalise it into the table above so it's **data, not a 20-line `||` chain**.

---

## 5. The 14 Core Skills

Unchanged from `core-modules.ts`. Each skill's frontmatter already carries `actions`, `app_layout.sections` (its Block list), and `site_pages`. Keep the **flat** `app_layout` shape — the parser depends on it.

> **Reality check + the fix (auto-attach).** Today **8 of the 11 non-CRM skills declare only `quick-actions`** in their real `app_layout.sections` — activate "expenses" and you get buttons, no list. The "Default Blocks" column below is what each skill *should* show, not what its `.md` currently declares.
>
> Rather than hand-author `sections` into 11 modules (and maintain them forever), the intent resolver **auto-attaches a default `data-table WHERE type={skill's matter.type}`** for any active skill that declares no display block. One rule closes the whole gap. A skill only needs explicit `sections` when it wants something *other* than a plain table (catalog-grid, booking-grid, status-board, entity-navigator) — those stay declared; everything else gets the table for free.
>
> So the column below reads as: **auto** = table attached by the resolver, no `.md` change; **declared** = must live in the skill's `app_layout.sections`.

| # | Skill | matter.type | Default Blocks (declared / auto) | Key actions |
|---|-------|-------------|----------------|-------------|
| 1 | orders | `order` | metric-card *(declared)* + data-table *(auto)* | record_sale, void_order |
| 2 | inventory | `product` | catalog-grid + metric-card *(declared)* | add_stock, check_stock |
| 3 | bookings | `booking` | booking-grid *(declared)* | book_slot, cancel_booking |
| 4 | crm | `customer`,`deal` | entity-navigator *(declared)* | add_contact, add_deal, log_activity |
| 5 | expenses | `expense` | data-table *(auto)* | record_expense |
| 6 | hr | `staff`,`payslip` | timeline-feed *(declared)* + data-table *(auto)* | add_employee, clock_in/out |
| 7 | projects | `project` | status-board *(declared, P0 build)* | create_task, update_status |
| 8 | support | `ticket` | status-board *(declared, P0 build)* | create_ticket |
| 9 | logistics | `shipment` | timeline-feed *(declared)* + data-table *(auto)* | create_shipment, update_tracking |
| 10 | listings | `listing` | catalog-grid *(declared)* | add_listing |
| 11 | reports | (reads all) | metric-card + report-chart *(declared, P0 build)* | daily_sales, low_stock |
| 12 | lms | `product` | catalog-grid *(auto→ product)* | create_course |
| 13 | documents | `asset` | data-table *(auto)* | upload_doc |
| 14 | team-chat | (motion only) | timeline-feed *(auto→ motion)* | send_message |

`matter.type` must be one of dbrules §11's fixed list:
`product · order · booking · customer · staff · invoice · expense · deal · contract · asset · ticket · project · payslip · purchase · workorder · shipment · listing · setting`

New entity type ⇒ add to dbrules §11 **first**, then use it.

---

## 6. Onboarding as Blocks — No Separate Screens

> Creating a workspace, choosing its skills, and designing its site are just blocks, driven by the same intent → block pipeline. Delete the `add-workspace.tsx` screen; replace it with one **`workspace` meta-skill** holding three blocks.
>
> **Create is name-only** — business type is not guessed at create time. Skill selection is a separate block (`skill-catalog`, §13) run after the scope exists: a name is identity, skills are configuration, and mixing them is what would hardcode verticals.

### The three onboarding blocks

| Block | When it shows | What it does | Wraps existing code |
|-------|---------------|--------------|---------------------|
| `workspace-form` | app has 0 workspaces, **or** intent `new workspace` | **name only** → `/workspaces/create` (0 skills or a minimal default) → new scope active | `add-workspace.tsx` name/slug + `tar.createWorkspace` |
| `skill-catalog` | fresh workspace has 0 skills, **or** intent `setup` / `add skills` | 14 toggle cards (+ optional AI prefill) → provision `skills/*.md` (§13) | `extractBusinessInfo` (server) — client keyword scan **deleted** |
| `site-designer` | intent `design site` / `site` | shows live `useSite` draft, AI-edit input, Publish button | `generateSiteLayout` + `saveDraft` + `publish` (already in `workspaces.tsx:404–421`) |

### `workspace-form` — name-only, the one scope exception

Every other block obeys "scope always from session" (dbrules §8). `workspace-form` is the **single deliberate exception**: it runs *before* a scope exists and *creates* one. It asks for **nothing but a name** (slug auto-derived). After success it sets the new scope active and hands off to `skill-catalog`.

```
   EMPTY APP  (0 workspaces)              AFTER CREATE (0 skills yet)
   ┌────────────────────────────┐        ┌────────────────────────────┐
   │  ┌──────────────────────┐  │        │  switcher: [ Anjali's ▼ ]   │
   │  │   workspace-form     │  │ submit │  ┌──────────────────────┐   │
   │  │  ────────────────    │  │ ─────▶ │  │   skill-catalog      │   │
   │  │  Name: [__________]  │  │  new   │  │  (auto-shown, §13)   │   │
   │  │       [ Create → ]   │  │  scope │  │  pick your skills →  │   │
   │  └──────────────────────┘  │ active │  └──────────────────────┘   │
   └────────────────────────────┘        └────────────────────────────┘
```

Flow (reuses `/workspaces/create`, now provisioning **no** modules up front):

```
   workspace-form submit
        │  tar.createWorkspace({ name, subdomain })     ← no `message`, no modules
        ▼
   taragent /workspaces/create
        ├─ D1 INSERT workspaces               → registry row
        ├─ getOrCreateWorkspaceDb             → Turso w:{sub}
        └─ scaffoldOkfFolders                  → S3 (no skills/*.md yet)
        │
        ▼
   setCurrentWorkspace(new)  ──▶  0 skills ⇒ skill-catalog auto-renders (§13)
```

> The client module-scan in `add-workspace.tsx` (lines 74–106) is **deleted outright.** Business inference is optional and lives in `skill-catalog` (server `extractBusinessInfo`), where the user can override every toggle.

### `site-designer` — site design is a block too

The site is stored in `matter(type=site_draft)` and already has a full hook (`useSite`) plus AI generation (`generateSiteLayout`). Today the canvas only shows a passive `SiteCard`. Make it an **active block**: the draft preview + one AI-edit input + Publish — the same three calls already wired at `workspaces.tsx:404–421`, just moved into a registered block.

```
   ┌─────────────────────────────────────┐
   │  site-designer                       │
   │  ┌───────────────────────────────┐  │
   │  │  [ live draft preview ]       │  │  ← useSite().draft
   │  │   hero · products · contact   │  │
   │  └───────────────────────────────┘  │
   │  "make hero dark, add menu" [ ↑ ]   │  ← generateSiteLayout → saveDraft
   │                        [ Publish ]  │  ← publish → {sub}.tarai.space
   └─────────────────────────────────────┘
```

| Input | Action | Existing call |
|-------|--------|---------------|
| AI edit text | regenerate draft layout | `generateSiteLayout(name, products, instruction, draft)` → `saveDraft` |
| Publish button | push draft live | `publish()` → `https://{sub}.tarai.space` |
| (auto) | render current draft | `useSite(scope).draft` |

### Site Templates — the customer frontend is a second render target

> `site-designer` is only the **editor**. What it publishes is a set of **site templates** rendered at `{sub}.tarai.space` — a completely separate render path from the canvas blocks (§2). These are **not** in `ComponentRegistry`; canvas blocks are RN-native, site templates are web. Each skill's `site_pages` frontmatter references a template by name.

Referenced by `core-modules.ts` `site_pages` today — status is honest:

| Template | Referenced by (skill → slug) | Reads | Status |
|----------|------------------------------|-------|--------|
| `hero` / `products` / `contact` sections | `useSite` draft (all) | draft JSON | 🟡 partial (`useSite` + draft exist) |
| `catalog-grid` (web) | orders `/menu`, inventory `/catalog`, listings `/catalog` | `matter type=product/listing` | 🔲 web version not built |
| `booking-widget` | bookings `/book` | `matter type=service` | 🔲 not built |
| `cart` | orders `/cart` | client cart state | 🔲 not built |
| `checkout` | orders `/checkout` | cart → `action_record_sale` | 🔲 not built |
| `contact` | crm `/contact`, support `/help` | writes `inbox`/`ticket` | 🔲 not built |

**Honest status:** the *editor* (`useSite`, `generateSiteLayout`, `publish`) exists; the *storefront templates* are ~10% built. If customer-facing sites are a hard requirement, **this table — not `site-designer` — is the real work**: a commerce workspace can't sell until `catalog-grid`(web) + `cart` + `checkout` render, and a bookings workspace needs `booking-widget`. Treat these as first-class deliverables (P1), sequenced right after roles.

---

## 7. Roles = Allowed-Skills List (the simplification)

No per-role layouts. A role is just **which skills a member can see**. One filter does everything.

```
   members.md                    LOADED SKILLS              WHAT RAVI SEES
   ┌──────────────────┐          (all 14)                   (kitchen)
   │ Ravi:            │      ┌──────────────────┐      ┌──────────────────┐
   │  skills:         │      │ orders           │      │ orders       ✅  │
   │   - orders   ────┼──┐   │ inventory        │      │ inventory    ✅  │
   │   - inventory ───┼┐ │   │ crm              │      │ ─── rest hidden ─│
   └──────────────────┘│ │   │ expenses         │      │ crm          ✗   │
                       │ └──▶│ hr               │─────▶│ expenses     ✗   │
     allowed = the     └────▶│ reports          │ .filter│ hr         ✗   │
     skills list             │ ... (14 total)   │      │ reports      ✗   │
                             └──────────────────┘      └──────────────────┘
```

### Storage — S3, one small file per workspace

`w:{subdomain}/team/members.md`

```yaml
members:
  - user: usr_abc
    name: Anjali
    skills: [*]                       # owner — all skills
  - user: usr_def
    name: Ravi
    skills: [orders, inventory]       # kitchen — only these two
  - user: usr_ghi
    name: Priya
    skills: [expenses, reports]       # billing
```

### One filter, three effects

The allowed list (`['*']` = everything; the **default when `members.md` is absent**, so nothing breaks before teams exist) gates three touch-points:

| Effect | Code touch-point | Result |
|--------|------------------|--------|
| Canvas | `activeWidget` gate | disallowed module never renders |
| Chips | `getFilteredActions()` (`:566`) | chips scope themselves |
| Intents | intent-map lookup | disallowed keywords ignored |

### `role-editor` — the block that *writes* `members.md`

The filter above only *reads* `members.md`. Something has to write it, or roles can never be assigned. That's the `role-editor` block (owner-only), shown on intent `team` / `members` / `roles` / `permissions`, or from the ⚙︎ menu.

```
   ┌─────────────────────────────────────────────┐
   │  Team & Roles                      ✕ close   │
   │  ┌─────────────────────────────────────────┐ │
   │  │ Anjali (you)              owner · all ✅ │ │  ← owner row, locked
   │  ├─────────────────────────────────────────┤ │
   │  │ Ravi                                     │ │
   │  │  orders ✅  inventory ✅  crm ▢  hr ▢    │ │  ← 14 toggles per member
   │  │  expenses ▢  reports ▢  …                │ │
   │  ├─────────────────────────────────────────┤ │
   │  │ Priya                                    │ │
   │  │  expenses ✅  reports ✅  orders ▢  …    │ │
   │  └─────────────────────────────────────────┘ │
   │  [ + Invite member ]        [ Save roles → ] │
   └─────────────────────────────────────────────┘
```

| Input | Action | Writes |
|-------|--------|--------|
| toggle a skill for a member | flips that member's allowed list | in-memory draft |
| Save roles | persist the whole roster | `PUT w:{sub}/team/members.md` (S3) |
| + Invite member | add a row (user id + name), default `skills: []` | same file on Save |

Rules: **owner-only** (a member without `[*]` can't open `role-editor` — enforced by the same filter, since `role-editor` is itself gated behind an implicit `team` capability only `[*]` holds). Owner row is always `[*]` and cannot be demoted to zero (never lock yourself out). Toggles reuse the exact 14-card grid from `skill-catalog` (§13) — same component, different write target (`members.md` vs `enabled.yaml`).

---

## 8. Data Flow (per dbrules)

### Read — block renders

```
   Block renders
        │  tar.tool('read', { table:'matter', type, scope, active:1 })
        ▼
   taragent /tools/read
        │  resolves Turso DB from scope
        ▼
   Turso w:{id}:  SELECT * FROM matter
                  WHERE scope=? AND type=? ORDER BY id DESC LIMIT 50
        │
        ▼
   rows ───▶ block props.data
```

### Write — action submit (5-step pattern, dbrules §7)

```
   action form submit
        │  tar.executeAITask(action, params, scope)     ← workspaces.tsx:547
        ▼
   taragent /ai-tasks/execute
        │
        ├─ 1. matter        (always)          create/update the entity
        ├─ 2. motion        (if user-visible)  history/timeline event
        ├─ 3. inbox         (if needs action)  human to-do
        ├─ 4. graph         (if traversal)     relationship link
        └─ 5. search_index  (if public product/service/booking)
        │
        ▼
   refreshProducts / refreshOrders ───▶ block re-reads
```

### Scope enforcement (dbrules §8)

| Rule | Enforcement |
|------|-------------|
| `scope` from session only | `currentWorkspace.scope` — never user input |
| every read/write carries `scope` | taragent resolves Turso DB from it |
| cross-workspace | only via `tar-search` ANN (not in this UI) |

---

## 9. Local-First (dbrules §12)

Only 3 modules are offline-capable via `@tursodatabase/sync` partial sync (products bootstrapped locally). All others are cloud-only.

```
   DEVICE                                     CLOUD
   ┌───────────────────┐   auto-sync when     ┌──────────────────┐
   │ ws-anjalis.db     │◀─── online ────────▶│ Turso  w:anjalis  │
   │  products only     │                      │  full data        │
   └───────────────────┘                      └──────────────────┘
   reads instant • writes local-first • pushed on reconnect
```

| Module | Offline block(s) | Why |
|--------|------------------|-----|
| POS / orders | pos-sale (future), quick-actions | mid-sale can't wait on network |
| Inventory | catalog-grid, data-table | stock deducts at point of sale |
| Time & Expense | action-form (clock-in/out) | shop-floor connectivity is unreliable |

`initWorkspaceSync` is already called on workspace switch (`workspaces.tsx:264`).

---

## 10. File Map (delta only — add/change)

```
tarapp/src/
├── app/(tabs)/workspaces.tsx        ← EXTRACT inline intent → resolver; apply skills filter
├── app/add-workspace.tsx            ← DELETE (becomes name-only workspace-form block, §6)
├── components/WorkspaceCanvas.tsx   ← keep (registry-driven)
├── lib/
│   ├── layout-engine.ts             ← keep (flat app_layout)
│   ├── intent-resolver.ts           ← NEW: input → { module, blocks? }; auto-attaches data-table (§5)
│   └── role-filter.ts               ← NEW: members.md skills → allowed module list (§7)
└── gen-ui/registry/
    ├── ComponentRegistry.ts         ← keep
    ├── builtins.ts                  ← register (P0): status-board, report-chart; then inbox-list, action-form, role-editor, pos-sale
    └── sections/
        ├── StatusBoard.tsx          ← NEW (P0): kanban — projects/support (§2 lie-fix)
        ├── ReportChart.tsx          ← NEW (P0): bar/line chart — reports (§2 lie-fix)
        ├── RoleEditor.tsx           ← NEW: owner-only team/roles editor (§7) → writes members.md
        ├── WorkspaceForm.tsx        ← NEW: name-only create gate (§6) — NOT registry, pre-scope
        ├── SkillCatalog.tsx         ← NEW: 14 toggle cards, define workspace (§13)
        ├── InboxList.tsx            ← NEW: shared inbox to-do list (§14)
        ├── ActionForm.tsx           ← NEW: dynamic form from action params (§14, write path)
        ├── PosSale.tsx              ← NEW: POS native primitive (§14) — offline, local Turso
        └── SiteDesigner.tsx         ← NEW: site editor block (§6) ⟵ SiteCard + useSite

tarapp/src/site/  (customer frontend — web render target, NOT registry)   ← NEW dir (§6 P1)
├── CatalogGridWeb.tsx               ← NEW: storefront catalog (orders/inventory/listings)
├── BookingWidget.tsx                ← NEW: public booking page (bookings)
├── Cart.tsx  · Checkout.tsx         ← NEW: commerce flow (orders /cart /checkout)
└── ContactPage.tsx                  ← NEW: contact/help form (crm/support) → writes inbox/ticket

taragent/src/
├── lib/
│   ├── core-modules.ts              ← keep flat layout (source of skill .md for skill-catalog §13)
│   └── intent-map.ts                ← NEW: keyword → module table (§4)
└── routes: /tools/:name, /ai-tasks/execute, /workspaces/create  ← create now provisions 0 skills (§6)
    + /team/members (GET/PUT members.md), /skills/enable (write enabled.yaml)

S3 per scope:
├── w:{sub}/team/members.md          ← NEW: member → allowed skills (§7) — written by role-editor
├── w:{sub}/enabled.yaml             ← NEW: enabled-skills list (§13) — one file, not N .md copies
├── w:{sub}/skills/*.md              ← existing skill *overrides* only (written lazily on customize)
└── w:{sub}/{id}/full.json           ← existing rich payloads
```

Legend: **NEW** = create · **keep** = do not touch · **EXTRACT** = move existing code out · **DELETE** = remove · **P0/P1** = build priority.

---

## 11. Implementation Checklist

| Phase | Task | File |
|-------|------|------|
| **0 — Fix the lies** | register `status-board` (kanban, group by `status`) | `StatusBoard.tsx` + `builtins.ts` |
| | register `report-chart` (bar/line from aggregate SQL) | `ReportChart.tsx` + `builtins.ts` |
| | correct dbrules prose `ws:` → `w:` (code is canonical) — *was Appendix B* | `dbrules.md` |
| | add `purpose`/`intents` to `core-modules.ts` actions (better chip labels) — *was Appendix B* | `core-modules.ts` |
| **1 — Intent** | keyword table as data (§4) | `intent-map.ts` (NEW) |
| | replace regex block; **auto-attach `data-table WHERE type={matter.type}`** when a skill declares no display block (§5) | `intent-resolver.ts` (NEW) ⟵ `workspaces.tsx:387–475` |
| | verify orders/inventory/site still render | — |
| **2 — Onboarding blocks** | `workspace-form` gate, **name-only** ⟵ `add-workspace.tsx`; delete client module-scan (lines 74–106) | `WorkspaceForm.tsx` (NEW) |
| | `/workspaces/create` provisions 0 skills (no `message`) | `taragent` route |
| | render `workspace-form` in 0-workspace empty state + `new workspace` intent | `workspaces.tsx` |
| | delete `add-workspace.tsx` + its route | `add-workspace.tsx` |
| **3 — Skill catalog (§13)** | `skill-catalog` block: 14 toggle cards + optional AI prefill | `SkillCatalog.tsx` (NEW) |
| | enable = append name to **`w:{sub}/enabled.yaml`** (one file); write `skills/{skill}.md` only on customize | `taragent /skills/enable` |
| | auto-render when workspace has 0 skills + `setup`/`add skills` intent | `workspaces.tsx` |
| **4 — Roles** | read `members.md` → allowed list (`['*']`=all, default when missing) | `role-filter.ts` (NEW) |
| | apply filter to canvas, chips, intents | `workspaces.tsx` |
| | `role-editor` block (owner-only) → `PUT members.md` (§7) | `RoleEditor.tsx` (NEW) + `taragent /team/members` |
| | test: `[orders,inventory]` member can't reach finance | — |
| **5 — Customer sites (§6)** | `site-designer` editor block ⟵ `SiteCard` + `useSite` edit/publish | `SiteDesigner.tsx` (NEW) |
| | storefront templates: `catalog-grid`(web), `cart`, `checkout` | `tarapp/src/site/*` (NEW) |
| | `booking-widget`, `contact` templates | `tarapp/src/site/*` (NEW) |
| **6 — Blocks (§14)** | register `inbox-list`, wire `/workspace/:scope/inbox` | `InboxList.tsx` + `builtins.ts` |
| | register `action-form` (dynamic form from action params) | `ActionForm.tsx` + `builtins.ts` |
| | build `pos-sale` native primitive (offline, local Turso) | `PosSale.tsx` (NEW) |
| | confirm every skill's sections use only registered types | `core-modules.ts` |

> The whole system: **intent → skill-filtered blocks (+ auto data-table) → scoped data**, roles as one filter that `role-editor` writes, customer sites as a second web render target.

---

## 12. Universal by Composition — Every Business Type, No New Modules

> Never build a module per business. A business type is a **subset of the 14 skills** over the same 4 tables — the alphabet, composed into a word. Every business type, zero marginal cost.

```
        THE 14 SKILLS (the alphabet — fixed)
   orders inventory bookings crm expenses hr projects
   support logistics listings reports lms documents team-chat
        │
        │   each business = a SUBSET, composed
        ▼
   ┌──────────────┬───────────────────────────────┬─────────────────────────┐
   │ Business     │ Enabled skills                │ matter.type used        │
   ├──────────────┼───────────────────────────────┼─────────────────────────┤
   │ Restaurant   │ orders inventory bookings hr  │ product order booking   │
   │ Clothing     │ orders inventory listings crm │ product order listing   │
   │ Groceries    │ orders inventory logistics    │ product order shipment  │
   │ Delivery     │ logistics orders crm          │ shipment order customer │
   │ Taxi         │ bookings logistics crm expenses│ booking shipment cust. │
   │ Clinic       │ bookings crm hr documents     │ booking customer staff  │
   │ Salon        │ bookings inventory crm        │ booking product customer│
   │ Agency       │ projects crm expenses hr      │ project customer expense│
   └──────────────┴───────────────────────────────┴─────────────────────────┘
                   ▲ same tables, different composition — never a new schema
```

**Two ceilings, both cheap to raise:**
- A vertical the 14 skills can't express → add a **custom skill** (deferred Skill Builder, Appendix A); it writes to the same 4 tables, no schema change.
- A new entity kind (e.g. `vehicle`) → add it to the dbrules §11 type list **once**, then any skill can use it.

**Rule:** never add a "restaurant module" or "taxi module." Add skills (reusable verbs) and entity types (nouns in dbrules §11). Verticals are compositions, chosen in `skill-catalog`.

---

## 13. The `skill-catalog` Block — Define the Workspace on the Canvas

> This is how a name-only workspace (§6) becomes a restaurant or a taxi company. One new built-in block in the `workspace` meta-skill. It renders when a workspace has 0 skills, or on the `setup` / `add skills` intent. Re-openable anytime — a shop that later adds delivery just toggles `logistics`.

```
   intent "setup" / "add skills"   (auto-shown when 0 skills enabled)
        │
        ▼
   ┌────────────────────────────────────────────────────┐
   │  skill-catalog                                      │
   │  ┌──────────────────────────────────────────────┐  │
   │  │ "what's your business?" [ sushi bar    ↑ ]   │  │ ← optional AI prefill
   │  └──────────────────────────────────────────────┘  │   (extractBusinessInfo)
   │                                                     │
   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
   │  │ orders │ │inventry│ │bookings│ │  crm   │       │
   │  │   ✅   │ │   ✅   │ │   ✅   │ │   ▢    │       │ ← 14 toggle cards
   │  └────────┘ └────────┘ └────────┘ └────────┘       │   AI pre-checks,
   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │   human overrides
   │  │   hr   │ │logistic│ │listings│ │  ...   │       │
   │  │   ✅   │ │   ▢    │ │   ▢    │ │        │       │
   │  └────────┘ └────────┘ └────────┘ └────────┘       │
   │  ┌────────┐                                         │
   │  │+ Custom│  ← Skill Builder (deferred, Appendix A) │
   │  └────────┘                                         │
   │            [ Enable 4 skills → ]                    │
   └───────────────────────┬────────────────────────────┘
                           │
                           ▼
   provision: for each enabled skill, copy CORE_MODULES[skill]
              → S3  w:{sub}/skills/{skill}.md
                           │
                           ▼
   canvas re-resolves: chips, intents, blocks for enabled skills go live
```

### Design decisions

| Decision | Choice | Why |
|----------|--------|-----|
| What "enabled" means | presence of `w:{sub}/skills/{skill}.md` in S3 | reuses the scaffold already done on create — no new registry field |
| Where AI goes | optional text box → server `extractBusinessInfo` **pre-checks** toggles | keeps the useful part of `add-workspace.tsx`; drops the client-side guessing |
| User override | toggles always editable | AI suggests, human decides — works for a business AI can't classify |
| Adding later | re-open via `add skills` intent | workspaces grow; enabling `logistics` = one toggle |
| Custom skills | `+ Custom` card → Skill Builder | escape hatch for verticals beyond the 14 (§12) |
| Source of skill `.md` | `CORE_MODULES[skill]` in `core-modules.ts` | the definitions already exist; catalog just copies them into scope |

---

## 14. Block UI Strategy — Predefined Primitives, Composed by AI

> **The finalized decision:** hand-build ~10–12 native primitive blocks once; AI only *composes* them (picks type + props + query), it never authors block code. One JSON escape hatch (`layout-block`) for the rare long-tail view. No runtime code-generation, ever.

- **Primitives (the backbone).** You design each by hand, once — you own every pixel. 8 already exist in `builtins.ts` (`metric-card`, `data-table`, `catalog-grid`, `booking-grid`, `timeline-feed`, `quick-actions`, `content-card`, `entity-navigator`). To add: `pos-sale`, `status-board`, `report-chart`, `action-form`, `inbox-list`.
- **Escape hatch (`layout-block`).** For a niche view no primitive covers (cinema seat-map, taxi live-map), AI emits a declarative JSON UI tree **once**; it's saved as that skill's section config and renders forever after with zero further AI cost. Deferred until a vertical needs it (Appendix A).
- **Never LLM code-gen.** Expo/RN can't hot-load native components shipped after app review, runtime `eval` is a security + store-rejection risk, and it would cost an LLM call every render.

**Rule to enshrine:** *AI composes blocks (picks type + config); it never authors block code. A block type is real only when registered in `ComponentRegistry` (a primitive) or expressible as `layout-block` JSON.*

### Why this is both cost- AND use-efficient — the `pos-sale` example

Build `pos-sale` **one time** as a native block (product grid + cart + payment sheet, offline via local Turso). Then every commerce business reuses it verbatim:

```
   sushi bar          clothing shop       grocery store
   skills: orders     skills: orders      skills: orders
        │                  │                   │
        └──────────────────┴───────────────────┘
                           ▼
                 SAME pos-sale block
          { type:'pos-sale', props:{ catalogType:'product' } }
                           ▼
        only the DATA differs:  matter WHERE type='product'
```

Three businesses, **one component, zero regeneration.** High-frequency UI is predefined and reused across every vertical; only the long-tail view uses the JSON hatch, generated once and cached.

---

## 15. Screen Concepts — Markdown Mockups

> Conceptual layouts of every key screen. ASCII, not pixel-final — they fix flow and hierarchy, not styling. Styling is owned by the native block components (§14).

### 15.1 First run — create workspace (name only, §6)

```
   ┌─────────────────────────────────────────────┐
   │                                             ▲ │  status bar
   │                                               │
   │   Untitled Workspace                          │  ← big title input (autofocus)
   │   ───────────────                             │
   │   anjali.tarai.space                          │  ← live slug preview
   │                                               │
   │                                               │
   │                                               │
   │                                               │
   │                                               │
   │                                               │
   │                              ┌─────────────┐  │
   │                              │  Create  →  │  │  ← enabled once name typed
   │                              └─────────────┘  │
   └─────────────────────────────────────────────┘
   No description field. No module guessing. Name → scope.
```

### 15.2 Fresh workspace — skill-catalog auto-shown (§13)

```
   ┌─────────────────────────────────────────────┐
   │  [ Anjali's ▼ ]                        ⚙︎    │  ← workspace switcher
   │                                               │
   │  Set up your workspace                        │
   │  ┌─────────────────────────────────────────┐ │
   │  │ what's your business?  [ sushi bar   ↑ ]│ │  ← optional AI prefill
   │  └─────────────────────────────────────────┘ │
   │                                               │
   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
   │  │orders │ │invntry│ │bookng │ │  crm  │     │
   │  │  ✅   │ │  ✅   │ │  ✅   │ │  ▢    │     │  ← AI pre-checked 3,
   │  └───────┘ └───────┘ └───────┘ └───────┘     │    user taps to adjust
   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
   │  │  hr   │ │logist │ │listng │ │reports│     │
   │  │  ✅   │ │  ▢    │ │  ▢    │ │  ▢    │     │
   │  └───────┘ └───────┘ └───────┘ └───────┘     │
   │  ┌───────┐                                    │
   │  │+Custom│                                    │
   │  └───────┘                                    │
   │                          [ Enable 4 → ]       │
   └─────────────────────────────────────────────┘
```

### 15.3 Canvas — EMPTY state (skills enabled, no intent yet)

```
   ┌─────────────────────────────────────────────┐
   │  [ Anjali's ▼ ]                        ⚙︎    │
   │                                               │
   │  Good morning 👋                              │
   │                                               │
   │  ┌─────────────┐  ┌─────────────┐             │  ← fallback quick cards
   │  │  Inventory  │  │   Orders    │             │    (only enabled skills)
   │  │  128 items  │  │  12 today   │             │
   │  └─────────────┘  └─────────────┘             │
   │                                               │
   │                                               │
   │                                               │
   │  ┌─────────────────────────────────────────┐ │
   │  │ 🔍 what do you need?          [ Sales ] │ │  ← intent bar + chips
   │  └─────────────────────────────────────────┘ │    (role-filtered, §7)
   └─────────────────────────────────────────────┘
```

### 15.4 Canvas — ACTIVE state (typed "orders")

```
   ┌─────────────────────────────────────────────┐
   │  [ Anjali's ▼ ]                    ✕ clear   │  ← clear = back to EMPTY
   │                                               │
   │  ┌─────────────────────────────────────────┐ │
   │  │  metric-card                            │ │  ← Block 1
   │  │  Today's Sales        ₹ 8,240           │ │
   │  └─────────────────────────────────────────┘ │
   │  ┌─────────────────────────────────────────┐ │
   │  │  data-table · Orders                    │ │  ← Block 2
   │  │  #1042  ₹640   active                   │ │
   │  │  #1041  ₹120   active                   │ │
   │  │  #1040  ₹980   voided                   │ │
   │  └─────────────────────────────────────────┘ │
   │  ┌─────────────────────────────────────────┐ │
   │  │ 🔍 ...              [ Record Sale ]     │ │  ← chip = quick-action
   │  └─────────────────────────────────────────┘ │
   └─────────────────────────────────────────────┘
```

### 15.5 pos-sale block (§14) — one component, every commerce vertical

```
   ┌─────────────────────────────────────────────┐
   │  New Sale                          ✕ close   │
   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
   │  │ Salmon│ │ Tuna  │ │ Roll  │ │ Miso  │     │  ← catalog grid
   │  │ ₹320  │ │ ₹280  │ │ ₹180  │ │ ₹90   │     │    (matter type=product)
   │  └───────┘ └───────┘ └───────┘ └───────┘     │
   │  ─────────────────────────────────────────── │
   │  Cart                                         │
   │   Salmon ×2                       ₹640        │  ← local-first, offline
   │   Miso   ×1                       ₹90         │
   │  ─────────────────────────────────────────── │
   │   Total                           ₹730        │
   │            ┌───────────────────────────────┐  │
   │            │        Charge  →              │  │  ← 5-step write (dbrules §7)
   │            └───────────────────────────────┘  │
   └─────────────────────────────────────────────┘
```

### 15.6 site-designer block (§6)

```
   ┌─────────────────────────────────────────────┐
   │  Design site                       ✕ close   │
   │  ┌─────────────────────────────────────────┐ │
   │  │  [ live draft preview ]                 │ │  ← useSite().draft
   │  │   hero · products · contact             │ │
   │  └─────────────────────────────────────────┘ │
   │  ┌─────────────────────────────────────────┐ │
   │  │ "make hero dark, add menu"          ↑   │ │  ← generateSiteLayout
   │  └─────────────────────────────────────────┘ │
   │                            [ Publish → ]      │  ← {sub}.tarai.space
   └─────────────────────────────────────────────┘
```

### 15.7 Role-scoped canvas (member Ravi, kitchen — §7)

```
   allowed skills: [orders, inventory]
   ┌─────────────────────────────────────────────┐
   │  [ Anjali's ▼ ]                        ⚙︎    │
   │                                               │
   │  ┌─────────────┐  ┌─────────────┐             │
   │  │  Inventory  │  │   Orders    │             │  ← ONLY allowed skills
   │  └─────────────┘  └─────────────┘             │    crm/hr/expenses hidden
   │                                               │
   │  ┌─────────────────────────────────────────┐ │
   │  │ 🔍 ...        [ Low Stock ] [ Orders ]  │ │  ← chips also filtered
   │  └─────────────────────────────────────────┘ │
   │  typing "expenses" → no match (not allowed)   │
   └─────────────────────────────────────────────┘
```

---

## Appendix A — Deliberately Deferred

Ideas kept out of v1 to stay simple (folded in from the deleted plan3). Add only when a concrete need appears — each is additive, none reworks Phases 1–5.

| Deferred | What it adds | Trigger to build |
|----------|--------------|------------------|
| Pinned blocks / default canvas | `matter(type=setting, title='canvas_default')` | users ask to save a view |
| Skill Builder + Subagent Runner | admin blocks to author custom skills (the `+ Custom` card, §13) | custom skills demanded |
| `layout-block` JSON escape hatch (§14) | one generic renderer for long-tail views (seat-map, live-map) | a vertical needs a view no primitive covers |
| Semantic intent match | Workers AI embeddings vs skill index | keyword map feels too rigid |
| LLM → block-manifest fallback | free-text → multi-block layout | ad-hoc queries common |
| Extra blocks `detail-view`, `metric-row` | richer UI | a skill actually needs one |
| Compound intents ("dashboard" → 3 blocks) | multi-block manifests | dashboards requested |

*(Appendix B "Consistency Fixes Owed" folded into Phase 0 of §11 — the `ws:`→`w:` scope fix and action `purpose`/`intents` fields are now scheduled work, not a floating TODO.)*
