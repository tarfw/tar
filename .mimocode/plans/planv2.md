# tarai + tarflue-v2 Unified Rebuild Plan v3 (Workspace Edition)

> Single source of truth. Merged from swift-river plan + cost analysis + workspace system design.
> Aligned with `docs/plan.md` cost model: ₹500/user, ₹400 profit. DO SQLite-first, Turso for form catalog + vector search. 5 tables, 6 tools, cheap LLMs. Universal workspace support.

---

## Table of Contents

1. [Goal](#goal)
2. [Cost Constraint](#cost-constraint)
3. [Core Principles](#core-principles)
4. [Architecture](#architecture)
5. [Scopes & Data Routing](#scopes--data-routing)
6. [Flue Primitives Coverage](#flue-primitives-coverage)
7. [Naming Reconciliation](#naming-reconciliation)
8. [tarai Client](#tarai-client)
9. [tarflue-v2 Backend](#tarflue-v2-backend)
10. [Tools, Actions, Skills, Workflows, Agents](#tools-actions-skills-workflows-agents)
11. [Collaboration & Teams](#collaboration--teams)
12. [Marketplace](#marketplace)
13. [Home Screen / Timeline](#home-screen--timeline)
14. [Workspace & Inventory](#workspace--inventory)
15. [Hybrid Order Routing](#hybrid-order-routing)
16. [Channel Routing (D1 + group-level ACL)](#channel-routing-d1--group-level-acl)
17. [Real-time Updates](#real-time-updates)
18. [DO Namespaces](#do-namespaces)
19. [LLM Cost Control](#llm-cost-control)
20. [Action Memory System (Inline Card Replay)](#action-memory-system-inline-card-replay)
21. [Storage Cost Analysis](#storage-cost-analysis)
22. [DO SQLite Cost Optimization](#do-sqlite-cost-optimization)
23. [OrderDO vs Inbox Split](#orderdo-vs-inbox--data-split)
24. [Implementation Phases](#implementation-phases)
25. [Verification Checklist](#verification-checklist)
26. [Keep It Simple Rules](#keep-it-simple-rules)
27. [Finalized Decisions](#finalized-decisions-2026-07-02)
28. [Workspace Creation Flow](#workspace-creation-flow)
29. [Local-first POS](#local-first-pos)
30. [Workspace Site Generation](#workspace-site-generation)
31. [Future Thoughts](#future-thoughts-not-immediate)

---

## Goal

Rebuild tarai/ as a thin 3-tab Expo React Native client:
1. **Home** — role-based timeline / inbox (across all workspaces)
2. **Chat** — AI agent (creates workspaces, runs workflows)
3. **Explore** — search, marketplace, workspace settings

One workspace = one business. Channels (Telegram, Slack, Discord) are how people reach that workspace. Users can own multiple workspaces.

All business logic stays in tarflue-v2 on Cloudflare Workers + DO SQLite.

---

## Cost constraint

| Item | Amount |
|---|---|
| End-user price | ₹500/month |
| Target profit | ₹400/month |
| Max cost per user | ~₹100/month |
| LLM budget | ₹40 per million IO tokens |

This forces a **DO SQLite-first** architecture for workspace operations. Turso is used for form catalog, user Inboxes (unlimited databases on paid plans), and vector search.

---

## Core principles

1. **5 tables:** `form`, `matter`, `motion`, `graph`, `memory`. `attr` is removed.
2. **6 tools:** `create`, `read`, `update`, `delete`, `link`, `search`.
3. **DO-first for operational hot paths.** Turso only for global vector search and universal product catalog.
4. **Actions as JSON.** User-facing business actions are JSON step sequences.
5. **Workflows orchestrate actions.** Branches, parallel, retries, rollback.
6. **Flue skills as markdown.** Agent instructions loaded from `SKILL.md` or `form.type='skill'`.
7. **Agents pick workflows.** LLM only for intent detection, not for every action.
8. **No new primitives.** Reuse Flue tools, actions, skills, agents, workflows, channels.
9. **Cheap LLMs only.** DeepSeek, Gemini Flash, Llama 8B, Groq small models.
10. **Batch writes, cache reads.** Group SQLite writes in transactions, cache hot reads in KV.
11. **Let DOs hibernate.** Don't keep-alive. Wake on demand, sleep after 10s.
12. **Action memory.** Cache agent decisions as inline replay cards. First time = LLM. Every replay = zero LLM cost.

---

## Architecture

```
tarai/ (thin client)
  ├── Home tab  → role-based timeline (reads from user's Inbox Turso DB)
  ├── Chat tab  → agent intent → workflow (creates workspaces)
  └── Explore tab → search + marketplace + workspace settings

tarflue-v2 (Cloudflare Workers)
  ├── 6 tools (create, read, update, delete, link, search)
  ├── JSON actions (stored in Turso form)
  ├── Workflows (orchestrate actions)
  ├── Agents (pick workflows via cheap LLM — Groq for routing, MiMo v2.5 for site gen)
  ├── Flue skills (markdown instructions — 11 capability modules)
  ├── Channels: Telegram, Slack, Discord, WhatsApp
  ├── Global Turso (g:global) — form catalog (products, actions, workflows, skills, layouts), user profiles, vectors
  ├── WorkspaceDO (w:) — per-workspace stock, services, config (matter only — references g:global)
  ├── OrderDO      (o:) — per-order state machine + payment (delivery, taxi, logistics)
  ├── u:user Turso DB — per-user personal timeline + accessible scopes
  │   Note: scope-level Turso DBs removed. User DB holds timeline and scope list.
  ├── D1 — channel routing + team membership
  ├── KV — site cache (95% hit rate)
  ├── CF Worker — renders workspace site from layout JSON
  └── Marketplace (global memory + templates)
```

---

## Scopes & data routing

| Prefix | Scope | Store | Holds |
|---|---|---|---|
| `w:` | Workspace | WorkspaceDO | Stock quantities, selling price, services, workspace orders. **No product catalog — references g:global.** |
| `o:` | Order | OrderDO | Per-order state machine: checkout, delivery, taxi, logistics + payment. |
| `p:` | Personal | Local SQLite | Cart, drafts, wishlist, personal cache, offline POS cache |
| `g:` | Global | Turso global DB | **Universal form catalog** (products, actions, workflows, skills, layouts), user profiles, marketplace vectors, agent configs |

**Scope ID format:** `{prefix}:{identifier}` — e.g., `w:pet_202`, `o:order_789`.

> **Inbox is per-user.** Each user has one Turso DB (`u:{userId}`) called their **Inbox**. All tasks, orders, deliveries, and actions assigned to them land here. Team = Telegram/Slack/Discord group for access control only — no separate team databases.

> **One user, multiple workspaces.** A user can own or be staff at several workspaces. Graph table links: `user:ravanan → w:rest-101 (owner)`, `user:ravanan → w:pet-202 (owner)`.

## All databases in the system

| # | Name | Scope prefix | Storage | Purpose | Schema tables |
|---|---|---|---|---|---|
| 1 | **WorkspaceDO** | `w:` | DO SQLite | Per-workspace stock, services, config (matter only) — no product catalog | `matter`, `motion`, `graph` |
| 2 | **OrderDO** | `o:` | DO SQLite | Per-order state machine + payment (delivery, taxi) | `matter`, `motion`, KV alarms |
| 3 | **Inbox** | `u:{userId}` | Turso cloud | Personal inbox — all assigned tasks, orders, deliveries | `motion`, `memory` |
| 4 | **Turso global DB** | `g:global` | Turso cloud (shared) | Universal form catalog (products, actions, workflows, skills, layouts), user profiles, marketplace vectors, agent configs | `form`, `matter`, `memory`, `graph` |
| 5 | **D1** | — | Cloudflare D1 | Channel routing (group → scope) | `channel_groups` table |
| 6 | **Local SQLite** | `p:` | Device SQLite | POS offline cache, cart, drafts, personal cache | `form`, `matter`, `motion`, `graph` |

### Shared schema (all use the same 5 tables)

| Table | WorkspaceDO | OrderDO | Inbox (Turso) | Global Turso | Local |
|---|---|---|---|---|---|
| `form` | — (removed) | Order templates | Marketplace listings, user profiles | **Universal form catalog** (products, actions, skills, layouts) | Saved preferences |
| `matter` | Stock quantities, selling price, services | Order state + payment | Cross-scope entities | Product variants | Cart items, offline cache |
| `motion` | Order events, stock changes | Delivery phase changes | Unified timeline (assigned items) | — | Activity log |
| `graph` | Stock ↔ global product links | Driver ↔ order links | User ↔ workspace index | Product relationships | Personal links |
| `memory` | — | — | Vector search, AI context | Marketplace vectors | — |

### Graph table schema (weight column removed)

```sql
CREATE TABLE graph (
  src TEXT NOT NULL,
  rel TEXT NOT NULL,
  tgt TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  time TEXT,
  PRIMARY KEY (src, rel, tgt)
);
```

All relationships are binary — edge exists or doesn't. No weighted edges needed.

### Universal form catalog (g:global)

Products, actions, workflows, skills, and layouts are defined once in global Turso, referenced by all workspaces:

| Data | Location | Who sets it |
|------|----------|-------------|
| Product name, description, image | Global catalog (form) | Brand/manufacturer |
| Variants (500ml, 1L, etc.) | Global catalog (form.data) | Brand/manufacturer |
| Cost price, MRP | Global catalog (form.data) | Brand/manufacturer |
| Selling price | WorkspaceDO matter.value | Workspace owner |
| Stock quantity | WorkspaceDO matter.qty | Workspace owner |

**Example — Pepsi:**
```
Global catalog (form):
  id: f_p001
  title: Pepsi
  data: { variants: [{name:"500ml", cost:20, mrp:24}] }

WorkspaceDO (matter):
  id: m_p001
  form: f_p001        -- FK to global catalog
  title: Pepsi 500ml
  qty: 50              -- stock count
  value: 22            -- this workspace's selling price
```

**Pricing model:** MRP is fixed globally. Each workspace sets its own selling price between cost and MRP.

---

## Flue primitives coverage

| Primitive | How it is used | Location |
|---|---|---|
| **Tools** | 6 generic tools only (agent sees all 6) | `src/tools/index.ts` + `src/lib/engine.ts` |
| **Actions** | JSON action steps and workflow steps call tools | `src/actions/` + `form.type='action'` |
| **Skills** | Markdown instructions for agents | `src/skills/*/SKILL.md` + `form.type='skill'` |
| **Agents** | Cheap LLM intent detection + workflow picker | `src/agents/master.ts` + profiles |
| **Subagents** | Per-vertical scoped agents | `src/agents/profiles/*.ts` |
| **Workflows** | Orchestrate skills: branches, parallel, rollback | `src/workflows/*.ts` |
| **Channels** | Telegram, Slack, Discord, WhatsApp | `src/channels/*.ts` |
| **Marketplace** | Global `memory` + local `form` install | Turso + DO SQLite |

---

## Naming reconciliation

| `flue.md` | `docs/plan.md` / this plan | Notes |
|---|---|---|
| `graph` table | `graph` table | Keep as-is. Relationships/edges. |
| `attr` table | Removed | Hot fields move into `matter.data` / `form.data`. |
| 12 named tools | 6 generic tools only | Agents see 6 tools. No wrappers exposed. |
| `tool_create_matter` | `create(table='matter')` | Internal mapping, not exposed. |
| `tool_link_graph` | `link(src, rel, tgt)` | Internal mapping, not exposed. |
| `tool_traverse_graph` | `read(table='graph', ...)` | Internal mapping, not exposed. |
| `tool_set_attr` | `update(table='matter')` | Internal mapping, not exposed. |
| `StorefrontDO` | `WorkspaceDO` | Renamed to cover all business types, not just stores. |
| `s:{store}` | `w:{workspace}` | Scope prefix updated. |

### What changes in tarflue-v2

Current tarflue-v2 uses `graph` and 12 explicit `defineTool` calls. Refactor to:

1. **Keep `graph` table.** No rename to `bond`. Remove `weight` column.
2. **Remove `attr` table.** Move all hot fields into `matter.data` or `form.data`.
3. **Remove `form` table from WorkspaceDO.** Product catalog + actions + workflows + skills move to global Turso (g:global).
4. **Add a shared `execute(operation, table, params)` helper** for the 6-tool engine.
5. **Drop 12 named tools from agent.** Agent sees only 6 tools: `create`, `read`, `update`, `delete`, `link`, `search`. Agent calls `create(table='matter')` not `create_matter`. Fewer tokens = cheaper LLM calls.
6. **Access = group membership via D1.** No per-user write ACL. If you're in the Telegram group mapped to the scope, you have full access. Roles (owner/staff/viewer) are agent logic, not enforced at the tool level.
7. **Rename `StorefrontDO` to `WorkspaceDO`.** Scope prefix changes from `s:` to `w:`.

---

## tarai client

### Screen structure

```
src/app/
  _layout.tsx              # Root providers
  index.tsx                # Redirect → /auth or /(tabs)
  auth.tsx                 # Google sign-in
  (tabs)/
    _layout.tsx            # Bottom tab: Home | Chat | Explore
    home.tsx               # Role-based timeline / inbox
    chat.tsx               # Chat with agent
    explore.tsx            # Search + verticals + teams + marketplace + settings
  vertical/[id].tsx        # Vertical detail
```

### Core client API

`src/lib/tarflue.ts` exposes:

```typescript
tarflue.chat(sessionId, message)       // POST /agents/master/:sessionId
tarflue.tool(name, input)              // POST /tools/:name
tarflue.workflow(name, input)          // POST /workflows/:name
tarflue.search(query)                  // vector search
tarflue.listTeams()                    // read teams from D1 channel_groups
tarflue.addTeamMember(teamId, userId)  // implicit via Telegram group membership
tarflue.installTemplate(id, scope)     // copy marketplace skill to team scope
```

---

## tarflue-v2 backend

### 6 tools (agent-facing + engine)

| Tool | Operation | Tables | Agent example |
|---|---|---|---|
| `create` | INSERT | form, matter, motion, graph | `create(table='matter', type='lead')` |
| `read` | SELECT | form, matter, motion, graph | `read(table='matter', type='product', scope='w:pet-202')` |
| `update` | UPDATE | form, matter, motion | `update(table='matter', id='m123', data:{stock:7})` |
| `delete` | SOFT DELETE | form, matter, graph | `delete(table='matter', id='m123')` |
| `link` | INSERT/TOGGLE graph edge | graph | `link(src='user:ravanan', tgt='workspace:pet-202', rel='owner')` |
| `search` | VECTOR SEARCH | memory (Turso) | `search(query='pepsi orders', scope='w:pet-202')` |

Agent never sees `create_matter`, `append_motion`, etc. Only the 6 generic tools.

---

## Tools, actions, skills, workflows, agents

```text
User input
  ↓
Agent (cheap LLM) → detects intent → picks workflow
  ↓
Workflow → orchestrates skills/actions
  ↓
Skills/Actions → call 6 tools directly
  ↓
6 tools → SQL on DO SQLite / Turso
```

| Layer | What it is | Example |
|---|---|---|
| **Tools (6)** | Generic DB operations | `create`, `read`, `update`, `delete`, `link`, `search` |
| **Core actions** | Reusable business code | `action_notify`, `action_advance_stage` |
| **JSON actions** | User-defined step sequences in `form` | `action_create_lead`, `action_record_sale` |
| **Workflows** | Orchestrate actions with branches/parallel | `wf_record_sale`, `wf_checkout` |
| **Flue skills** | Markdown instructions for agents | `src/skills/sales-crm/SKILL.md` |
| **Agents** | Cheap LLM intent detector + workflow picker | Master agent, subagent profiles |

### Example: "Record sale of 3 Pepsi"

1. Agent LLM detects `intent = "record_sale"`, params `{ item: "pepsi", qty: 3 }`.
2. Agent loads workflow `wf_record_sale`.
3. Workflow runs action `check_stock` → `read(table='matter')`.
4. Workflow branches: stock 10 > 3.
5. Workflow runs parallel actions:
   - `deduct_stock` → `update(table='matter')`
   - `create_sale_motion` → `create(table='motion')`
6. Workflow runs action `send_receipt` → `action_notify`.
7. Reply: *"3 Pepsi sold. Stock: 10 → 7."*

**Key cost point:** The LLM runs once. Everything after that is deterministic JSON execution.

### Actions

Actions are JSON step sequences stored in `form`. Example:

```json
{
  "id": "tool_create_lead",
  "name": "Create Lead",
  "vertical": "crm",
  "fields": [
    { "name": "name", "type": "text" },
    { "name": "phone", "type": "phone" }
  ],
  "steps": [
    { "tool": "create", "table": "matter", "type": "lead", "scope": "t:sales" },
    { "tool": "create", "table": "motion", "action": 99993 },
    { "tool": "link", "src": "{userId}", "tgt": "{matterId}", "rel": "owns" }
  ]
}
```

### Workflows

```json
{
  "id": "wf_record_sale",
  "steps": [
    { "action": "check_stock" },
    { "if": "$.stock > 0", "then": [
      { "parallel": [
        { "action": "deduct_stock" },
        { "action": "create_sale_motion" }
      ]},
      { "action": "send_receipt" }
    ]}
  ]
}
```

### Skills (Flue native)

```markdown
---
name: sales-crm
description: How to handle CRM leads
---
# CRM Sales Skill

When a user mentions a lead:
1. Ask for name and phone if missing.
2. Use the create_lead action.
3. Confirm the lead was created.
```

Skills are imported into agents:

```typescript
import salesCrm from '../skills/sales-crm/SKILL.md' with { type: 'skill' };

export default defineAgent(() => ({
  model: 'groq/openai/gpt-oss-120b',
  skills: [salesCrm],
  tools: allTools,
}));
```

### Agents

```text
User input
  → LLM detects intent ("record_sale")
  → RBAC check
  → Load workflow
  → Run workflow (no LLM)
  → Reply
```

### Universal vertical coverage

The same agent, tools, workflows, actions, skills, and schema handle **any business domain**. No code changes needed.

| To add a new vertical | What the user does |
|---|---|
| Define entity types | Create `form` rows with `type='pipeline'` or `type='skill'` |
| Add business actions | Create JSON actions |
| Add orchestration | Create workflows |
| Add expertise | Create `SKILL.md` files or `form.type='skill'` rows |
| Add agent behavior | Update master agent instructions or add a subagent profile |

Supported verticals without new code: CRM, POS, e-commerce, inventory, food delivery, taxi/logistics, HR, payroll, attendance, bookings, services, project management, LMS, real estate.

### Channels

| Channel | Cost | Use |
|---|---|---|
| In-app / Push / Email | Free | Primary alerts |
| Telegram | Free | External support |
| Slack | Free | Team notifications |
| Discord | Free | Community/support |
| WhatsApp Support | Free (<1K/mo), then owner-paid | Customer support |
| WhatsApp Marketing | ₹0.90/conversation (owner-paid) | Promotions |

```
src/channels/
  ├── telegram.ts   → /channels/telegram/webhook
  ├── slack.ts      → /channels/slack/events
  ├── discord.ts    → /channels/discord/webhook
  └── whatsapp.ts   → /channels/whatsapp/webhook (owner-configured)
```

### Mini apps

Telegram, Slack, and Discord mini apps are webviews that call tarflue-v2 tools/workflows directly. They bypass the LLM.

---

## Collaboration & teams

**A team IS a Telegram/Slack/Discord group.** The channel group maps to a workspace scope via D1. Team membership is implicit — if you're in the group, you have access to that workspace's data.

### How it works

```
Telegram Group "Kitchen Team"
  → D1 channel_groups: chat_id(-100123456) → scope(w:rest-101)
  → Anyone in the group = has access to w:rest-101
```

### What goes where

| Data | Storage | Why |
|---|---|---|
| Workspace inventory, products, services | WorkspaceDO (`w:{workspaceId}`) | Shared across all users with access |
| Assignments to user | User's Inbox (`u:{userId}`) | Personal task list — like email |
| Workspace operations | WorkspaceDO | Shared, serialized writes |

### ACL

| Check | How |
|---|---|
| Can user access workspace? | D1 query: is their Telegram group mapped to this workspace scope? |
| Can user perform action? | Agent logic: role-based (owner/staff/viewer) |

### Shared workspace across multiple Telegram groups

```text
Telegram Group A → w:rest-101
Telegram Group B → w:rest-101

Both groups access the same WorkspaceDO
Inventory lives in WorkspaceDO(w:rest-101)
```

When one group reserves stock, WorkspaceDO serializes the write. The other group sees the updated stock because both hit the same DO.

### One user, multiple workspaces

| Scenario | How it works |
|---|---|
| User owns restaurant + pet salon | 2 workspaces: `w:rest-101`, `w:pet-202` |
| User is staff at a clinic | Workspace `w:clinic-303` with staff role |
| User switches workspace | App dropdown — changes active scope |
| Data isolation | Each workspace = separate WorkspaceDO instance |
| Home screen | Shows all workspaces user has access to |

Graph table holds membership:
- `user:ravanan → w:rest-101 (owner)`
- `user:ravanan → w:pet-202 (owner)`
- `user:thamizhi → w:clinic-303 (staff)`

### What goes where

| Data | Storage |
|---|---|
| Workspace inventory, products, orders | WorkspaceDO (`w:`) — shared across all users with access |
| User assignments, tasks | User's Inbox (`u:{userId}`) — personal task list |

---

## Marketplace

| Flow | Store |
|---|---|
| Browse / search | `memory` in Turso (global vector search) |
| Install (actions, workflows, skills) | Copy `form` row into workspace scope |
| Install (templates) | Copy full workspace blueprint — actions, workflows, skills, layout |
| Use | Agent reads `form` rows from the local scope |

### Marketplace templates

Pre-built workspace configs stored in Turso global. Install in seconds, zero LLM cost.

| Template | Bundled capabilities | Best for |
|---|---|---|
| `restaurant` | Orders + Inventory + Bookings + CRM | Cafes, food delivery |
| `clinic` | Bookings + CRM + Projects + Support | Dentists, doctors, vets |
| `retail` | Orders + Inventory + CRM | Clothing, electronics |
| `salon` | Bookings + CRM + Orders | Hair, spa, grooming |
| `gym` | Bookings + CRM + LMS + HR | Fitness, yoga |
| `school` | LMS + CRM + Projects + HR | Coaching, training |
| `courier` | Orders + Logistics + CRM | Delivery companies |
| `property` | Listings + CRM + Projects | Property agents |

Template installation: user describes business → agent finds matching template → confirms name → copies template rows to Turso → generates site layout with one LLM call → workspace goes live in under 10 seconds.

---

## Home screen / timeline

**Key insight:** Motion table is an ACTION QUEUE — only events needing user action are stored. Analytics queries go directly to DO SQLite. Home screen queries each tenant Turso DB in parallel, merges results on worker.

### How it works

```
WorkspaceDO confirms order → writes motion to user's Turso DB
OrderDO assigns driver      → writes motion to user's Turso DB
WorkspaceDO creates task    → writes motion to user's Turso DB
Agent creates lead          → writes motion to user's Turso DB
       |
       v
  ALL events land in USER's Turso DB (e.g., u:ravanan)
       |
       v
  Home screen: ONE query to user's Turso DB
```

### What goes in motion vs stays in DOs

| Event | Stored where | Why |
|---|---|---|
| Order placed (pending confirm) | Turso motion | Needs user action |
| Order confirmed (pending ready) | Turso motion | Needs user action |
| Delivery assigned (pending accept) | Turso motion | Needs user action |
| Task created (pending complete) | Turso motion | Needs user action |
| Stock alert (low stock) | Turso motion | Needs restock action |
| Order delivered | DO SQLite only | Done — no action needed |
| Delivery completed | DO SQLite only | Done — no action needed |
| Chat message | DO SQLite only | Not actionable |
| Revenue report data | DO SQLite only | Analytics, not timeline |

Motion table = action queue. DOs = source of truth for analytics and history.

### User timeline DB

Each user has their own Turso DB for their personal timeline. DOs write motion events to the user's DB, not to scope DBs.

```typescript
// Each user has one Turso DB
const userDb = `u:${userId}`;
// e.g., u:ravanan, u:thamizhini
```

Workspace scope (w:pet-202) holds operational data (products, inventory) for vector search. But the TIMELINE lives in the user's Inbox (u:{userId}).

### The query (single query to user's DB)

```typescript
// Query user's Turso DB directly
const timeline = await turso.query(
  `SELECT * FROM motion
   WHERE created_at > (now - interval '7 days')
   ORDER BY created_at DESC
   LIMIT 50`,
  { url: `libsql://u:${userId}-tarapp.turso.io` }
);
```

**One query. One DB. ~20ms latency.**

**One query to user's DB (~20ms). No merge needed.**

### Example: Ravanan has 4 roles on one screen

| Role | Source | motion.type | Card shown | Actions |
|---|---|---|---|---|
| Restaurant owner (`w:rest-101`) | WorkspaceDO writes to `u:ravanan` | `order` | OrderCard: 5 Burgers, 2 min ago | Confirm / Mark Ready |
| Delivery person | OrderDO writes to `u:ravanan` | `delivery` | DeliveryCard: Order #789, Anna Nagar | Accept / Delivered |
| Project member | Task assigned writes to `u:ravanan` | `task` | TaskCard: Fix AC, due today | Complete / Reassign |
| Marketplace buyer | Order writes to `u:ravanan` | `order` | OrderCard: Printer, shipped | Track / Confirm receipt |

**All motions land in Ravanan's Inbox (`u:ravanan`).** One query to his personal DB shows everything.

### Card rendering by motion.type

| `motion.type` | Card component | Fields shown | Actions available |
|---|---|---|---|
| `order` | `OrderCard` | item, qty, customer, status | Confirm, Ready, Cancel |
| `delivery` | `DeliveryCard` | order, address, driver | Accept, Delivered |
| `task` | `TaskCard` | title, assignee, due date | Complete, Reassign |
| `stock_alert` | `StockCard` | product, current qty, threshold | Restock, Dismiss |
| `lead` | `LeadCard` | name, phone, source | Contact, Convert |
| `chat` | `ChatCard` | sender, preview, channel | Reply |

Card component is chosen by `motion.type`. Actions shown depend on `motion.phase` + user's role (ACL).

### Full vertical × motion type matrix

| Vertical | motion.type | What triggers it | Who sees it | Card fields | Actions |
|---|---|---|---|---|---|
| **CRM** | `lead` | New lead created | Sales team | name, phone, source, status | Contact, Convert, Delete |
| | `deal` | Deal stage changed | Sales team | deal name, value, stage | Advance, Reject, Note |
| | `follow_up` | Follow-up reminder | Assigned salesperson | lead name, due date, notes | Complete, Reschedule, Skip |
| **POS / E-commerce** | `order` | Customer places order | Store owner, staff | item, qty, total, customer | Confirm, Ready, Cancel |
| | `payment` | Payment received | Store owner | order id, amount, method | Refund, Receipt |
| | `refund` | Refund requested | Store owner | order id, amount, reason | Approve, Reject |
| **Food delivery** | `order` | Customer orders food | Restaurant owner | items, qty, customer, address | Confirm, Reject |
| | `order_item` | Kitchen receives item | Kitchen staff | item, qty, special instructions | Mark done, Delay |
| | `delivery` | Driver assigned | Delivery person | order, pickup, drop, distance | Accept, Decline |
| | `delivery_status` | Delivery phase change | Customer | driver name, ETA, status | Track, Call driver |
| **Taxi / Logistics** | `ride` | Ride booked | Driver, customer | pickup, drop, fare estimate | Accept, Decline |
| | `ride_status` | Ride phase change | Both parties | driver/location, ETA, fare | Cancel, Rate |
| | `shipment` | Package shipped | Sender, receiver | tracking id, origin, destination | Track, Confirm receipt |
| **HR / Payroll** | `attendance` | Check-in/out logged | Manager, employee | employee, time, location | Approve, Flag |
| | `leave_request` | Leave applied | Manager | employee, dates, type, reason | Approve, Reject |
| | `payroll` | Salary processed | Finance, employee | employee, amount, period | Download slip, Dispute |
| **Project management** | `task` | Task created/assigned | Team members | title, assignee, due, priority | Complete, Reassign, Note |
| | `sprint` | Sprint started/ended | Project lead | sprint name, goals, burndown | View, Close |
| | `milestone` | Milestone reached | Stakeholders | milestone name, date, status | Celebrate, Extend |
| **Booking / Services** | `booking` | Appointment booked | Service provider, customer | service, date, time, customer | Confirm, Reschedule, Cancel |
| | `reminder` | Upcoming appointment | Both parties | service, time, location | Confirm, Cancel |
| **Real estate** | `listing` | Property listed | Agent, buyer | property, price, location | Schedule visit, Update |
| | `inquiry` | Buyer inquiry | Agent | buyer name, property, budget | Call, Email, Schedule |
| **LMS** | `course_enrollment` | Student enrolls | Instructor, student | course, student, date | View progress, Message |
| | `assignment` | Assignment submitted | Instructor | student, course, submission | Grade, Feedback |
| | `completion` | Course completed | Student, admin | course, score, certificate | Download, Share |
| **Inventory** | `stock_alert` | Low stock detected | Store manager | product, current qty, threshold | Restock, Dismiss |
| | `restock` | Stock replenished | Store manager | product, qty added, supplier | Confirm, Edit |
| | `expiry` | Product expiring | Store manager | product, expiry date, qty | Discount, Discard |
| **General / Chat** | `chat_message` | Message in team chat | Team members | sender, preview, channel | Reply |
| | `notification` | System alert | User | title, body, severity | Dismiss, Action |
| | `system` | Workflow completed | User | workflow name, result, status | View details |

**32 unique motion.types across 11 verticals.**

### Motion types per vertical

| Vertical | Unique motion.types | Avg motions/tenant/month |
|---|---|---|
| CRM | 3 (lead, deal, follow_up) | 500 |
| POS / E-commerce | 3 (order, payment, refund) | 5,000 |
| Food delivery | 4 (order, order_item, delivery, delivery_status) | 8,000 |
| Taxi / Logistics | 3 (ride, ride_status, shipment) | 3,000 |
| HR / Payroll | 3 (attendance, leave_request, payroll) | 1,000 |
| Project management | 3 (task, sprint, milestone) | 2,000 |
| Booking / Services | 2 (booking, reminder) | 1,500 |
| Real estate | 2 (listing, inquiry) | 500 |
| LMS | 3 (course_enrollment, assignment, completion) | 500 |
| Inventory | 3 (stock_alert, restock, expiry) | 2,000 |
| General | 3 (chat_message, notification, system) | 5,000 |
| **Total** | **32 unique types** | **~5,000/tenant/month** |

> Only actionable motion types stored in Turso. Completed/delivered/done events stay in DO SQLite for analytics.

### Motion row lifecycle (hot/warm/cold)

Motion rows grow fast. Archival keeps costs manageable:

| Stage | Storage | Retention | Query speed | Cost |
|---|---|---|---|---|
| **Hot** (active) | Turso tenant DB `motion` table | 3-7 days | Fast (indexed) | ~$0.01/1K reads |
| **Warm** (recent) | Turso `motion_archive` table | 90 days | Medium | ~$0.005/1K reads |
| **Cold** (historical) | Turso `motion_cold` or export to R2 | Indefinite | Slow (on-demand) | ~$0.001/1K reads |

**Cron job:** Daily archival — trim rows older than 7 days to `motion_archive` once per day (e.g., 3 AM UTC).

### Storage per tenant

| Metric | Calculation | Value |
|---|---|---|
| Motions per month | ~5,000 (actionable only) | 5K rows |
| Row size (avg) | text + JSON data + metadata | ~200 bytes |
| Storage per tenant/month | 5K x 200 bytes | 1MB |
| Storage per tenant/year | 1MB x 12 | 12MB |
| Storage at 1K tenants/year | 12MB x 1,000 | 12GB |

### Turso pricing (unlimited databases)

| Plan | Price | Databases | Storage | Reads | Writes |
|---|---|---|---|---|---|
| Free | $0 | 100 | 5GB | 500M | 10M |
| Developer | $4.99/mo | **Unlimited** | 9GB (+$0.75/GB) | 2.5B (+$1/B) | 25M (+$1/M) |
| Scaler | $24.92/mo | **Unlimited** | 24GB (+$0.50/GB) | 100B (+$0.80/B) | 100M (+$0.80/M) |

**Databases are free.** You only pay for storage, reads, writes, sync.

### Turso global DB cost
| Metric | Value |
|---|---|
| Database | 1 shared DB (g:global) |
| Storage | ~1GB (user profiles, agent configs) |
| Reads | ~100M/month (auth, user profiles) |
| Writes | ~10M/month (profile updates) |
| Cost | Included in Developer plan ($4.99/mo) |

### Home screen UI diagram (Ravanan — 4 roles)

```
┌──────────────────────────────────────────────────────────┐
│  HOME                                    Ravanan ● ● ●     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ── RESTAURANT ORDERS ─────────────────────────────────  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Order #789                   2m ago     │  │
│  │  │ 🍔   │  5 Burgers · Customer: Aisha             │  │
│  │  └──────┘  Status: PENDING                         │  │
│  │            ┌──────────┐  ┌──────────┐  ┌────────┐  │  │
│  │            │ Confirm  │  │  Ready   │  │ Cancel │  │  │
│  │            └──────────┘  └──────────┘  └────────┘  │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  ┌──────┐  Order #790                   15m ago    │  │
│  │  │ 🍔   │  12 Pepsi · Customer: Bob                │  │
│  │  └──────┘  Status: CONFIRMED                       │  │
│  │            ┌──────────┐  ┌──────────┐              │  │
│  │            │  Ready   │  │ Cancel   │              │  │
│  │            └──────────┘  └──────────┘              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── DELIVERIES ─────────────────────────────────────────  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Delivery #201                  5m ago   │  │
│  │  │ 🚚   │  Order #789 → Anna Nagar                │  │
│  │  └──────┘  Status: PENDING                         │  │
│  │            ┌──────────┐  ┌──────────┐              │  │
│  │            │  Accept  │  │ Decline  │              │  │
│  │            └──────────┘  └──────────┘              │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  ┌──────┐  Delivery #200                 20m ago   │  │
│  │  │ 🚚   │  Order #785 → KK Nagar                  │  │
│  │  └──────┘  Status: OUT_FOR_DELIVERY                │  │
│  │            ┌──────────┐                             │  │
│  │            │ Delivered│                             │  │
│  │            └──────────┘                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── MY TASKS ───────────────────────────────────────────  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Fix AC in kitchen                 due  │  │
│  │  │ ✅   │  Assigned to: Ravanan · Due: Today         │  │
│  │  └──────┘  Priority: HIGH                          │  │
│  │            ┌──────────┐  ┌──────────┐  ┌────────┐  │  │
│  │            │ Complete │  │Reassign  │  │  Note  │  │  │
│  │            └──────────┘  └──────────┘  └────────┘  │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  ┌──────┐  Update menu prices                 1d  │  │
│  │  │ 📝   │  Assigned to: Ravanan · Due: Tomorrow      │  │
│  │  └──────┘  Priority: MEDIUM                        │  │
│  │            ┌──────────┐  ┌──────────┐              │  │
│  │            │ Complete │  │Reassign  │              │  │
│  │            └──────────┘  └──────────┘              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── MARKETPLACE ORDERS ──────────────────────────────────  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Order #ORD-123                  1h ago  │  │
│  │  │ 📦   │  Printer Paper A4 · Qty: 5               │  │
│  │  └──────┘  Status: SHIPPED                         │  │
│  │            ┌──────────┐  ┌──────────┐              │  │
│  │            │  Track   │  │ Confirm  │              │  │
│  │            └──────────┘  └──────────┘              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│    [ 🏠 Home ]    [ 💬 Chat ]    [ 🔍 Explore ]         │
└──────────────────────────────────────────────────────────┘
```

**How it renders:** Home screen queries Ravanan's Inbox (`u:ravanan`). All motions (orders, deliveries, tasks) assigned to him appear here. Grouped by type for display.

### ACL filtering

| User's role | Can see | Can act |
|---|---|---|
| Workspace owner | All workspace motions | All actions |
| Staff/member | Motions assigned to them | Role-based actions |
| No relation | Nothing | Nothing |
| `manages` (workspace manager) | Workspace motions | Workspace actions |
| No relation | Nothing | Nothing |

ACL check is built into the query — `WHERE scope IN user_accessible_scopes` filters by what the user can access.

### Action handling from home screen

When user taps an action on a card (e.g., "Confirm" on an order card):

```typescript
// User taps "Confirm" on OrderCard
async function onCardAction(card: MotionCard, action: string) {
  // Map card action to workflow
  const workflow = ACTION_WORKFLOW_MAP[card.type][action];
  // e.g., ACTION_WORKFLOW_MAP.order.confirm = "wf_confirm_order"

  // Execute directly — no LLM call
  await tarflue.workflow(workflow, {
    orderId: card.data.orderId,
    scope: card.scope
  });

  // New motion event appears on home screen automatically
  // (DO writes to Turso, client polls or gets WebSocket push)
}
```

### Food delivery example (full lifecycle on home screen)

| Time | Who sees it | motion.type | Card | Action taken |
|---|---|---|---|---|
| 10:00 | Customer | `order` | "5 Burgers ordered" | (read only) |
| 10:00 | Restaurant owner | `order` | "5 Burgers ordered" | Taps "Confirm" |
| 10:01 | Kitchen | `order_item` | "5 Burgers to prepare" | Taps "Mark done" |
| 10:15 | Restaurant owner | `order` | "Ready for pickup" | (read only) |
| 10:15 | Delivery person | `delivery` | "Pickup at Store-101" | Taps "Accept" |
| 10:15 | Customer | `delivery` | "Driver assigned" | (read only) |
| 10:30 | Delivery person | `delivery` | "Delivered" | Taps "Delivered" |
| 10:30 | Customer | `order` | "Order delivered" | Taps "Rate" |
| 10:30 | Restaurant owner | `order` | "Order completed" | (auto-archived) |

Each row is a `motion` event written to Turso by the relevant DO. Everyone sees their version of the same order lifecycle on their home screen.

### How DOs write to tenant Turso DBs

DOs write motion events to the tenant's Turso DB via the Worker:

```typescript
// Inside any DO (e.g., WorkspaceDO)
async onOrderConfirmed(orderId: string) {
  // 1. Update DO-internal SQLite
  await this.ctx.storage.sql.exec(
    "UPDATE matter SET data = json_set(data, '$.status', 'confirmed') WHERE id = ?",
    [orderId]
  );

  // 2. Write motion event to user's Turso DB via fetch
  await this.env.TARFLUE.fetch("https://tarflue.internal/tools/create", {
    method: "POST",
    body: JSON.stringify({
      tenantDb: `s:${this.storeId}`,
      action: 1001,
      data: { orderId, status: "confirmed" },
      scope: `s:${this.storeId}`
    })
  });

  // 3. Push event to user's single WebSocket
  await this.env.TARFLUE.fetch("https://tarflue.internal/ws/push", {
    method: "POST",
    body: JSON.stringify({
      userId: ravanan,
      type: "motion",
      data: { orderId, action: 1001 }
    })
  });
}
```

### Client flow (tarai home screen)

```typescript
// src/app/(tabs)/home.tsx
export default function HomeScreen() {
  const [motions, setMotions] = useState([]);

  // 1. Query user's timeline from their Turso DB
  useEffect(() => {
    tarflue.tool("read", { table: "motion", limit: 50 })
      .then(setMotions); // single query to user's Turso DB
  }, [userId]);

  // 3. Group motions by type for section rendering
  const sections = groupMotionsByType(motions);
  // → { order: [...], delivery: [...], task: [...] }

  return (
    <ScrollView>
      {sections.order?.length > 0 && (
        <Section title="Orders">
          {sections.order.map(m => <OrderCard key={m.id} motion={m} onAction={handleAction} />)}
        </Section>
      )}
      {sections.delivery?.length > 0 && (
        <Section title="Deliveries">
          {sections.delivery.map(m => <DeliveryCard key={m.id} motion={m} onAction={handleAction} />)}
        </Section>
      )}
      {sections.task?.length > 0 && (
        <Section title="My Tasks">
          {sections.task.map(m => <TaskCard key={m.id} motion={m} onAction={handleAction} />)}
        </Section>
      )}
    </ScrollView>
  );
}
```

### Realtime updates (single WebSocket per user)

One socket per user. All DOs and agent push events through it.

```
wss://tarflue.ws/user:ravanan

WorkspaceDO writes order   → push to Ravanan's socket
OrderDO writes delivery     → push to Ravanan's socket
Turso writes task           → push to Ravanan's socket
Agent replies to chat       → push to Ravanan's socket
```

Client sorts by `type` field:
```typescript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'motion') updateHomeScreen(msg.data);
  if (msg.type === 'chat') appendChatMessage(msg.data);
};
```

| Before | After |
|---|---|
| 4 sockets per user | 1 socket per user |
| 4x battery drain | 1x battery drain |
| 4x bandwidth | 1x bandwidth |

If client is offline: Expo push notification + pull-to-refresh on next open.

### Home screen → Action Memory connection

The home screen feeds the action memory system:

| Home screen event | Becomes action memory |
|---|---|
| User taps "Confirm" on order card 3 times | Memory: "Confirm order {orderId}" with workflow `wf_confirm_order` |
| User taps "Accept" on delivery card 5 times | Memory: "Accept delivery {orderId}" with workflow `wf_accept_delivery` |
| User taps "Restock" on stock card 2 times | Memory: "Restock {product} qty {qty}" with workflow `wf_restock` |

Next time user types "Con..." in chat → autocomplete shows "Confirm order" → card appears → user edits → executes. Same pattern as the taxi example.

---

## Workspace & inventory

### Storage

| Data | Store |
|---|---|
| Product catalog | `form` in Global Turso (g:global) — universal, one source of truth |
| Stock quantities, selling price | `matter` in WorkspaceDO — references global catalog via FK |
| Services (bookings, appointments) | `matter` in WorkspaceDO — service name, price, duration |
| Orders | `matter` in WorkspaceDO (simple) OR OrderDO (state-machine) |
| Cart reservations | WorkspaceDO memory |
| Checkout state | WorkspaceDO for simple; OrderDO for multi-step |

### Inventory flow

```text
Product: matter(type='product', data={ stock: 10 })

Reserve:  WorkspaceDO memory only
Commit:   update matter.data.stock + append motion
Release:  update matter.data.stock + append motion
```

WorkspaceDO serializes reservations to prevent oversell. DB writes only on commit/release.

### Orders and payments

**Simple orders** (POS, quick sale) — handled in WorkspaceDO:
```
matter row: type='order', data={items:[...], total:224, status:'completed'}
```

**Complex orders** (delivery, taxi, logistics) — handled in OrderDO:
```
Order: o:order-5001
  customer: thamizhi
  store: w:rest-101
  items: [{form: f_p001, qty: 2, price: 22}, {form: f_p002, qty: 1, price: 180}]
  total: ₹224
  status: confirmed → preparing → dispatched → delivered
  payment: pay_8001
```

**Payment** stored as matter row in OrderDO:
```
id: pay_8001
type: payment
title: UPI
value: 224
data: {"method":"upi","txn_id":"TXN123","status":"completed"}
```

**OrderDO state machine:**
```
created → confirmed → preparing → dispatched → delivered
                                         ↓
                                      cancelled
```

Each transition serialized through the DO — no race conditions on status updates.

**Stock flow on order:**
1. User places order → OrderDO created (status: created)
2. WorkspaceDO: m_p001.qty decremented atomically
3. Payment recorded in OrderDO
4. Status transitions through state machine

---

## Hybrid order routing

| Order type | Store | Reason |
|---|---|---|
| Simple/POS orders | `w:{workspaceId}` | One-step create → pay → done. |
| Delivery, taxi, logistics, SCM | `o:{orderId}` | Multi-step lifecycle with async events, retries, timers. |

### Lifecycle: food delivery

```text
Order placed
  → create OrderDO(o:order_789)
  → reserve stock in WorkspaceDO(w:rest-101)
  → state: confirmed

Kitchen marks ready
  → OrderDO updates state → ready_for_pickup
  → append motion to Turso timeline

Driver accepts
  → OrderDO updates state → out_for_delivery

Delivered
  → OrderDO commits stock deduction in WorkspaceDO
  → OrderDO archives final state to WorkspaceDO or Turso
  → OrderDO can be destroyed
```

## OrderDO vs Inbox — data split

### Food delivery order #789

| Data point | OrderDO SQLite | User Inbox (Turso) | Why split |
|---|---|---|---|
| Order ID | `o:order_789` (primary key) | `data.orderId` (reference) | DO owns identity |
| Items | Full array with prices | Item name + qty only | Summary for display |
| Customer | Full profile with phone | Name only | Phone excluded from timeline |
| Driver | Full profile with phone | Name only | Phone excluded |
| Address | Full address object | Not stored | Derived from scope |
| GPS | Real-time coordinates | Not stored | Ephemeral data |
| Current phase | Current state string | Not stored | Motion rows track transitions |
| Phase history | Timestamp array | 5 separate motion rows | One row per state change |
| Payment | Method + amount | Not stored | Financial data stays in DO |
| Alarm timers | setAlarm calls | Not stored | DO-only feature |
| Stock reservation | Reserved flag | Not stored | WorkspaceDO owns stock |

### Size per order
| Database | Size | Lifecycle |
|---|---|---|
| OrderDO SQLite | ~2KB | Destroyed after completion |
| Turso motion rows | ~1KB (5 rows x 200 bytes) | Persists until archived |

### Why double data is worth it
| Concern | Answer |
|---|---|
| Is it duplicate? | Yes — OrderDO has full order, Turso has summary |
| Full copy? | No — motion row is 200 bytes action summary, full order is 2KB in DO |
| Why keep both? | OrderDO is ephemeral. Turso persists history after DO is destroyed |
| Cost | ~$2/mo for Turso motion rows (reduced from ~$6 due to fewer rows) |
| Only Turso? | No state machine, no alarms, no WebSocket, no stock safety |
| Only OrderDO? | No timeline after order completes |

### How one food delivery order reaches everyone

| Who | Their Inbox | What they see |
|---|---|---|
| Restaurant owner | `u:owner_101` | order placed, confirmed, ready |
| Kitchen staff | `u:kitchen_456` | order_item to prepare, mark done |
| Delivery driver | `u:driver_789` | delivery assigned, accepted, delivered |
| Customer | `u:customer_123` | order placed, delivered |

**Same order, 4 different Inboxes.** Each person sees only what's assigned to them.

---

## Channel routing (D1 + group-level ACL)

One Telegram/Slack group maps to one workspace scope. Members stay in the messaging platform. D1 maps group ID to scope.

### D1 schema

```sql
CREATE TABLE channel_groups (
  chat_id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,  -- e.g., 'w:rest-101'
  name TEXT,
  platform TEXT,
  created_by INTEGER,
  created_at TEXT
);
```

Example data in channel_groups:
| chat_id | scope | name | platform |
|---|---|---|---|
| -100123456 | w:rest-101 | Kitchen Team | telegram |
| -100234567 | w:rest-101 | Marketing Team | telegram |
| -100345678 | w:pet-202 | Grooming Team | telegram |

### How it works

```
Workspace owner creates Telegram group "Kitchen Team"
  → Adds tarai_bot to the group
  → First message triggers D1 insert:
    INSERT INTO channel_groups VALUES (-100123456, 'w:rest-101', 'Kitchen Team', 'telegram')

Ravanan sends "5 Burgers order" in the group
  → Telegram POSTs to /channels/telegram/webhook
  → chat_id -100123456 → D1 lookup → scope: w:rest-101
  → from.id → user identity
  → Agent processes with w:rest-101 scope
  → Writes motion to Ravanan's Inbox (u:ravanan)
  → Worker replies: "5 Burgers order recorded"
```

### Channel creation per platform

| Platform | Bot can create group? | Setup method |
|---|---|---|
| Telegram | No | User creates group → adds bot → bot auto-registers in D1 |
| Slack | Yes | Bot creates channel via `conversations.create` API |
| Discord | Yes (channels) | Bot creates channel via Discord API |
| WhatsApp | No | User configures WhatsApp Business API separately |

Telegram deep link shortcut: bot generates `t.me/` link that opens group creation with bot pre-added. Reduces setup to 2 taps.

### ACL: group-level

| Level | What it checks | Use case |
|---|---|---|
| **Group-level** (D1) | Is this group mapped to a scope? | Channel routing — one D1 query |
| Role-level (agent logic) | What can this user do within the scope? | Owner vs staff vs viewer |

If group is in D1 config, everyone in that Telegram group has access. Roles (manager/staff/viewer) are agent logic, not ACL queries.

### D1 limits

| Limit | Value |
|---|---|
| Max database size | 10 GB (holds ~100M group rows at 100 bytes each) |
| Max storage per account | 1 TB |
| Rows per table | Unlimited |
| Reads | 25B/month included (paid plan) |
| Writes | 50M/month included (paid plan) |

At 10M groups: 1GB storage, ~$0.33/mo reads. At 100M groups: shard by `chat_id % N` across multiple D1 databases.

### Why D1 for channel_groups

| Table | Records | Writes | Reads |
|---|---|---|---|
| channel_groups | 1 per group | Rare (group setup) | Every channel message |

Read-heavy, rarely written. D1 handles this pattern efficiently.

### Why D1 over KV or Turso

| Option | 10M groups cost | Can query by scope? | Dynamic adds? |
|---|---|---|---|
| Workers KV | $15/mo | No (key-value only) | Yes |
| Turso global DB | ~$3/mo | Yes | Yes |
| **D1** | **$0.33/mo** | **Yes** | **Yes** |

D1 is 45× cheaper than KV and 10× cheaper than Turso for this use case.

---

## Real-time updates

```text
Client A updates order phase
  → WorkspaceDO receives request
  → DO updates matter + appends motion to user's Turso DB
  → DO pushes event to user's single WebSocket
  → Client B (tarai) receives update on same socket
```

One socket per user. DOs push to user's socket via Worker. No per-DO connections.

For offline clients: Expo push notifications + pull-to-refresh.

---

## DO namespaces

| Namespace | Class | Purpose |
|---|---|---|
| `WORKSPACE_DO` | `WorkspaceDO` | Per-workspace stock, services, config (matter only), references global catalog |
| `ORDER_DO` | `OrderDO` | Per-order state machine + payment for complex orders |

---

## LLM cost control

### Tiered AI

| Layer | What | Latency | Cost |
|---|---|---|---|
| L1 | Static dictionary match | 0ms | $0 |
| L2 | Action memory (inline card replay) | 20-50ms | $0 |
| L3 | Semantic cache | 50ms | Very low |
| L4 | Cheap LLM (intent only) | 500ms | Low |
| L5 | Strong LLM (complex reasoning) | 2s | High |

### Recommended models

| Use case | Model | Cost per million IO |
|---|---|---|
| Intent detection + routing | Groq GPT-OSS-120B | ~₹40 |
| Site layout generation | MiMo v2.5 | ~₹12 input, ~₹24 output |
| Simple replies | Llama 3.1 8B on Groq | ~₹15 |
| Complex reasoning | Claude Haiku / Gemini Flash | ~₹100 |
| Pattern extraction (one-time per action) | DeepSeek-V3 | ~₹40 |

Two-model architecture: Groq handles conversations cheaply. MiMo v2.5 handles one-time site generation with premium output.

Agents use L1 → L2 → L3 → L4. L5 only for exceptional cases.

---

## Action Memory System (Inline Card Replay)

> **Concept:** Cache agent decisions as reusable inline cards. First time = LLM call. Every time after = user edits variables and taps execute. Zero LLM cost on replay.

**Relation to generative UI:** This is "cached generative UI" — the LLM generates the action template once, then it's stored as a reusable interactive card. Like if ChatGPT remembered every report you ever asked for and just showed you the form next time.

### UX flow — complete

```
FIRST TIME (LLM call):
──────────────────────

User types: "Book me a Taxi from Anna Nagar to KK Nagar"
     │
     ▼
LLM (DeepSeek-V3) detects:
  intent: book_taxi
  slots: { from: "Anna Nagar", to: "KK Nagar" }
  workflow: wf_book_taxi
     │
     ▼
Workflow executes:
  1. create(table='matter', type='ride', scope='u:user_123')
  2. link(src='user_123', tgt='{rideId}', rel='booked_by')
  3. create(table='motion', action='ride_requested')
     │
     ▼
Agent replies: "Taxi booked from Anna Nagar to KK Nagar"
     │
     ▼
EXTRACT pattern (cheap DeepSeek call, one-time):
  template: "Book a Taxi from {from} to {to}"
  workflow: "wf_book_taxi"
  slots: [{key:"from", type:"location"}, {key:"to", type:"location"}]
     │
     ▼
STORE in memory table as action_memory


EVERY TIME AFTER (zero LLM):
────────────────────────────

User types: "Bo..."
     │
     ▼
┌──────────────────────────────────────────────────────┐
│ AUTOCOMPLETE (above keyboard, as user types)         │
│                                                      │
│  🔍 Book a Taxi                                      │
│     from Anna Nagar to KK Nagar              [tap]   │
│                                                      │
│  🔍 Book a Taxi                                      │
│     from T Nagar to Airport                  [tap]   │
└──────────────────────────────────────────────────────┘
     │
     ▼ user taps first suggestion

┌──────────────────────────────────────────────────────┐
│ INLINE CARD (expands in chat, replaces text input)   │
│                                                      │
│  🚕 Book a Taxi                                      │
│                                                      │
│  Pickup   ┌────────────────────────┐                  │
│           │ Anna Nagar          ✏️ │ ← editable      │
│           └────────────────────────┘                  │
│                                                      │
│  Drop     ┌────────────────────────┐                  │
│           │ KK Nagar             ✏️ │ ← editable      │
│           └────────────────────────┘                  │
│                                                      │
│            ┌──────────────────────┐                   │
│            │     🚕 Book Now      │ ← execute         │
│            └──────────────────────┘                   │
└──────────────────────────────────────────────────────┘
     │
     ▼ user changes "Anna Nagar" → "Marina Beach"
       user changes "KK Nagar" → "Besant Nagar"
       taps "Book Now"

DIRECT EXECUTION (no LLM call):
  tarflue.workflow("wf_book_taxi", {
    from: "Marina Beach",
    to: "Besant Nagar"
  })
     │
     ▼
Workflow runs: same 3 steps as first time
Agent replies: "Taxi booked from Marina Beach to Besant Nagar"
LLM cost: ₹0
```

### More examples

| User's first request | Memory card created | Next time |
|---|---|---|
| "Create a lead for Ravanan, phone 98765" | Card: Create Lead [Name: ___] [Phone: ___] | Change name/phone, tap Create |
| "Show me sales report for April, Pepsi" | Card: Sales Report [Item: ___] [Month: ___] | Change item/month, tap Generate |
| "Restock 50 Pepsi at workspace 101" | Card: Restock [Item: ___] [Qty: ___] [Workspace: ___] | Change values, tap Restock |
| "Assign task 'Fix AC' to Thamizhini" | Card: Assign Task [Task: ___] [Assignee: ___] | Change task/person, tap Assign |
| "Order 20 chicken biryani for table 5" | Card: Place Order [Item: ___] [Qty: ___] [Table: ___] | Change values, tap Order |

### Memory schema (existing `memory` table, new `meta.type`)

```json
{
  "id": "mem_taxi_anna_kk",
  "text": "Book a Taxi from {from} to {to}",
  "embedding": [0.12, -0.34, 0.56],
  "meta": {
    "type": "action_memory",
    "intent": "book_taxi",
    "workflow": "wf_book_taxi",
    "slots": [
      { "key": "from", "label": "Pickup", "type": "location", "value": "Anna Nagar" },
      { "key": "to", "label": "Drop", "type": "location", "value": "KK Nagar" }
    ],
    "tool_sequence": [
      { "tool": "create", "table": "matter", "type": "ride" },
      { "tool": "link", "rel": "booked_by", "src": "{userId}" },
      { "tool": "create", "table": "motion", "action": "ride_requested" }
    ],
    "usage_count": 5,
    "last_used": "2026-06-30T10:00:00Z",
    "ui": "inline_card"
  },
  "scope": "u:user_123"
}
```

### Slot extraction (no LLM on replay)

User edits fields directly on the card. For autocomplete text matching:

| Slot type | Extraction method | Example |
|---|---|---|
| `location` | Match against known places, saved addresses | "Anna Nagar" |
| `product` | Match against `matter(type='product')` titles in KV cache | "Pepsi", "Burger" |
| `person` | Match against `graph(rel='member')` names | "Ravanan", "Thamizhini" |
| `month` | Regex: `/(january|february|...|dec)/i` | "April" |
| `date` | Regex: `/\d{4}-\d{2}-\d{2}/` or "today"/"yesterday" | "2026-06-30" |
| `number` | Regex: `/\d+/` | "50", "20" |
| `text` | Everything else (freetext) | "Fix AC" |

Pure regex + lookup. No LLM call.

### Agent flow change

```
Current:
  User → LLM → tools → reply → done

With action memory (first time):
  User → LLM → tools → reply → EXTRACT pattern → STORE memory → done

With action memory (every replay):
  User types → autocomplete → tap card → edit fields → submit → tools → reply
  (no LLM anywhere in this path)
```

### Intent hash for fast replay

Instead of vector search on every replay, hash the intent + slot keys for instant matching:

```typescript
function getIntentHash(intent: string, slotKeys: string[]): string {
  return sha256(`${intent}:${slotKeys.sort().join(':')}`);
}

// First time: "Book a Taxi from Anna Nagar to KK Nagar"
// → intent: "book_taxi", slotKeys: ["from", "to"]
// → hash: sha256("book_taxi:from:to")
// → stored in memory alongside the pattern

// Second time: "Book a Taxi from X to Y"
// → Same hash → instant match → zero cost
// → Falls back to vector search only if hash misses
```

| Method | Cost | Latency | Use when |
|---|---|---|---|
| Intent hash | ₹0 | <1ms | Same intent pattern (90% of replays) |
| Vector search | ~₹0.001 | ~50ms | Hash miss, new intent pattern |

### Cost impact

| Scenario | LLM calls/mo (1K tenants) | LLM cost | Savings |
|---|---|---|---|
| No memory | 30,000 | ~$4,000 | — |
| 70% cache hit | 9,000 | ~$1,200 | $2,800/mo |
| 90% cache hit | 3,000 | ~$400 | $3,600/mo |

One-time extraction cost: ~₹40/million tokens × 30K × 500 tokens = ~₹600/mo.

### Components to build

| Component | Location | What |
|---|---|---|
| Pattern extraction | `tarflue-v2/src/lib/memory.ts` | After agent success, extract intent+slots+workflow |
| Slot extraction | `tarflue-v2/src/lib/slots.ts` | Regex + entity lookup for text matching |
| Autocomplete endpoint | `tarflue-v2/src/app.ts` | `GET /memory/autocomplete?q=...` |
| Inline card | `tarai/src/components/ActionCard.tsx` | Editable fields + execute button |
| Chat autocomplete | `tarai/src/components/ChatAutocomplete.tsx` | Shows matches above keyboard |

### Integration with chat tab

```
src/app/(tabs)/chat.tsx
  ├── TextInput (message input)
  ├── ChatAutocomplete (memory matches above input)
  │     └── ActionMemoryCard (inline editable card)
  ├── MessageList (chat history)
  └── SendButton
```

When user taps autocomplete:
1. TextInput hides
2. ActionMemoryCard expands inline
3. User edits slot values
4. Taps "Execute" → `tarflue.workflow()` directly
5. Result appears as chat message
6. Card collapses, TextInput returns

### Verification checklist additions

- [ ] First taxi booking creates action memory in `memory` table.
- [ ] Typing "Bo..." shows autocomplete with taxi memory.
- [ ] Tapping autocomplete shows inline card with editable fields.
- [ ] Editing fields and tapping "Execute" runs workflow without LLM.
- [ ] Usage count increments on each replay.
- [ ] Multiple memories for same intent show as separate suggestions.

---

## Storage cost analysis

### What goes where

| Data | Store | Why |
|---|---|---|
| Inventory, stock, reservations | DO SQLite (WorkspaceDO) | Strong consistency, serialization, zero egress |
| Orders (simple) | DO SQLite (WorkspaceDO) | One workspace, one writer |
| Orders (complex/delivery) | DO SQLite (OrderDO) | State machine, WebSocket real-time |
| **User assignments, tasks** | **User Inbox (Turso)** | Personal task list — all assigned items land here |
| **Form catalog (products, actions, skills, layouts)** | **Turso global DB** | Universal, shared across all workspaces |
| **Vector search (marketplace, AI)** | **Turso global DB** | DO SQLite has no ANN index — irreplaceable |
| **Channel routing** | **D1** | Group → scope mapping |

### Turso Inbox cost (1K users)

| Metric | Calculation | Cost |
|---|---|---|
| Databases | 1,000 (unlimited on paid plan) | $0 |
| Plan | Developer ($4.99/mo) | $4.99 |
| Storage | 70GB/year = 5.8GB/mo | ~$0.60 overage |
| Reads | 300M/month | Free (< 2.5B) |
| Writes | 30M/month | Free (< 25M) |
| **Total Turso** | | **~$6/mo** |

### DO SQLite cost (operational data)

| Metric | Value |
|---|---|
| DO compute + storage | ~$40-80/mo (with hibernation + batching) |
| Workers base | $5/mo |

### Total storage cost (1K tenants)

| Component | Cost/month |
|---|---|
| DO SQLite (operational) | ~$40-80 |
| Turso Inbox (user assignments + vector) | ~$6 |
| Workers base | $5 |
| **Total storage** | **~$51-91/mo** |

---

## DO SQLite cost optimization

DO SQLite handles operational data (inventory, orders, workspace config). Turso handles form catalog, timeline + vector search. Optimize DO costs to keep total storage under ₹100/user:

Apply these techniques to keep DO costs minimal:

| Technique | How | Savings | Phase |
|---|---|---|---|
| **DO hibernation** | DOs auto-sleep after 10s idle. Only pay for active compute time. | 60-80% compute | Built-in |
| **Batch SQLite writes** | Group multiple INSERT/UPDATE into single transactions | 30-50% write ops | Phase 2 |
| **Lazy timeline flush** | Buffer `motion` events in DO memory, flush every 5s or on 50 events | 40-60% write ops | Phase 2 |
| **KV hot cache** | Cache product catalog, workspace config in KV. Read KV first, fall back to SQLite | 50-70% read ops | Phase 1 |
| **DO sharding** | Group small workspaces by region into shared DOs (e.g., `w:in-west-001` holds 50 workspaces) | 80% fewer DOs | Phase 2 |
| **Column projection** | SELECT only needed columns, not `SELECT *` | 20-30% storage I/O | Phase 2 |
| **Soft-delete cleanup** | Cron alarm to purge soft-deleted rows older than 30 days | Storage stays flat | Phase 4 |

---

## Implementation phases

### Phase 0: Clean slate

Delete from tarai:
- `src/app/*`, `src/components/*`, `src/hooks/*` (except theme)
- `src/actions/*`, `src/agents/*`, `src/skills/*`, `src/tools/*`, `src/workflows/*`
- `src/channels/*`
- `storefront/*` (replaced by workspace site system)

Keep:
- Config, assets, theme
- `src/lib/auth.ts`, `db.ts`, `schema.ts`, `embeddings.ts`, `vectorStore.ts`
- `src/lib/tarflue.ts`, `acl.ts`, `geo.ts`, `textSplitter.ts`, `ai.ts`

### Phase 1: Foundation

1. Simplify `src/lib/tarflue.ts`.
2. Add `src/lib/verticals.ts` registry.
3. Refactor tarflue-v2 tools to the 6 primitives.
4. Add KV hot cache for product catalog and workspace config.
5. Rename `StorefrontDO` to `WorkspaceDO`. Update scope prefix `s:` to `w:`.

### Phase 2: tarflue-v2 backend

6. Add Inbox support — user Turso DBs for assignments.
7. Add `OrderDO` for complex order lifecycles.
8. Add JSON action definitions (stored in Turso `form`).
9. Add workflow engine.
10. Add cheap LLM agent intent detection (Groq GPT-OSS-120B).
11. Add `GET /workspaces` endpoint.
12. Implement batch SQLite writes and lazy timeline flush.
13. Implement DO sharding for small workspaces.
14. Add `src/lib/memory.ts` — pattern extraction after agent success.
15. Add `src/lib/slots.ts` — regex + entity lookup for slot filling.
16. Add `GET /memory/autocomplete?q=...` endpoint.
17. Add motion event writing from DOs to user's Turso DB via `create(table='motion', ...)`.
18. Add 11 capability modules (CRM, Projects, Bookings, Inventory, Orders, Logistics, HR, LMS, Listings, Support, Team chat).
19. Add workspace creation flow — agent detects intent, composes capabilities, generates config.
20. Add marketplace templates in Turso global.

### Phase 3: tarai screens + workspace site

21. `src/app/(tabs)/home.tsx` — role-based timeline from user's Turso DB (across all workspaces).
22. `src/app/(tabs)/chat.tsx` — chat with action memory autocomplete + workspace creation.
23. `src/app/(tabs)/explore.tsx` — search, marketplace, workspace settings.
24. `src/components/ActionCard.tsx` — inline editable card for action memory replay.
25. `src/components/ChatAutocomplete.tsx` — memory matches above keyboard.
26. Card components: `OrderCard`, `DeliveryCard`, `TaskCard`, `StockCard`, `LeadCard`, `ChatCard`, `BookingCard`.
27. Workspace site renderer — CF Worker reads layout JSON from Turso `form` + data from WorkspaceDO → renders HTML.
28. KV cache layer for workspace sites (5min TTL, 95% hit rate).
29. Two-model architecture — Groq for intent routing, MiMo v2.5 for site layout generation (~₹0.02/site).

### Phase 3: tarai screens

17. `src/app/(tabs)/home.tsx` — role-based timeline from user's Turso DB.
18. `src/app/(tabs)/chat.tsx` — chat with action memory autocomplete.
19. `src/app/(tabs)/explore.tsx` — search, teams, marketplace.
20. `src/components/ActionCard.tsx` — inline editable card for action memory replay.
21. `src/components/ChatAutocomplete.tsx` — memory matches above keyboard.
22. Card components: `OrderCard`, `DeliveryCard`, `TaskCard`, `StockCard`, `LeadCard`, `ChatCard`.

### Phase 4: Channels & mini apps

23. Add Telegram channel.
24. Add Slack channel.
25. Add Discord channel.
26. Build Telegram mini app for direct skill execution.
27. Add soft-delete cleanup cron.
28. Add motion archival cron (daily at 3 AM UTC, moves rows > 7 days to `motion_archive`).

### Phase 5: Marketplace

29. Seed marketplace actions/workflows/skills in global `memory`.
30. Add install helper.

---

## Verification checklist

- [ ] `expo start` launches.
- [ ] Google sign-in works.
- [ ] Home screen shows role-based timeline across all workspaces.
- [ ] Status update from tarai reflects in mini app and vice versa.
- [ ] Chat detects intent and runs workflow.
- [ ] User can create a workspace by describing their business in chat.
- [ ] Agent matches capabilities from user description (bookings, CRM, orders, etc.).
- [ ] Explore tab searches marketplace actions/workflows/skills/templates.
- [ ] Installing a template copies all form rows into workspace scope.
- [ ] Installing an action/workflow copies it into workspace scope.
- [ ] Telegram/Slack/Discord messages dispatch to agent.
- [ ] Telegram group setup: user creates group → adds bot → bot registers in D1.
- [ ] Slack/Discord: bot creates channel via API.
- [ ] Stock reservation prevents oversell.
- [ ] `wrangler deploy` succeeds.
- [ ] DOs hibernate after 10s idle (verify in dashboard).
- [ ] Batch writes reduce DO operation count (check logs).
- [ ] Home screen queries user's Turso DB and shows timeline.
- [ ] Tapping card action on home screen executes workflow directly (no LLM).
- [ ] WebSocket push updates home screen in realtime when DO writes motion.
- [ ] First agent action creates action memory in `memory` table.
- [ ] Typing in chat shows autocomplete with matching action memories.
- [ ] Tapping autocomplete shows inline card with editable slot fields.
- [ ] Editing card fields and tapping "Execute" runs workflow without LLM.
- [ ] Action memory usage count increments on each replay.
- [ ] Workspace site renders from layout JSON (Turso form) + data (WorkspaceDO).
- [ ] KV cache serves 95% of site requests without hitting DO.
- [ ] Workspace site generation: MiMo v2.5 produces layout JSON (~₹0.02).
- [ ] Groq handles intent detection, MiMo v2.5 handles site generation.
- [ ] User can customize workspace via chat (add service, change price, change theme).
- [ ] One user can own multiple workspaces.
- [ ] Motion archival cron moves rows > 7 days to `motion_archive` table (runs daily).
- [ ] Each workspace has own WorkspaceDO (verify via Wrangler dashboard).
- [ ] Each user has own Turso Inbox DB (verify via Turso dashboard).
- [ ] Home screen queries user's Turso DB and merges correctly.

---

## Cost estimate (per 1,000 heavy tenants, optimized)

### Assumptions per tenant/month

| Metric | Before optimization | After optimization |
|---|---|---|
| Orders | 10,000 | 10,000 (unchanged) |
| Staff | 100 | 100 (unchanged) |
| DB operations | ~200,000 | ~80,000 (batch + cache) |
| LLM calls | 30,000 | 30,000 (unchanged) |
| Tokens per LLM call | 2k input + 1k output | 2k input + 1k output |
| Active DO time | Always-on | Hibernated (10% active) |

### Costs

| Component | Store | Before | After |
|---|---|---|---|
| Workers base | Cloudflare | $5 | $5 |
| DO compute + storage | DO SQLite | ~$100–300 | ~$40–80 |
| Turso Inbox (user assignments) | Turso (unlimited DBs) | ~$50–100 | ~$6 |
| LLM (DeepSeek/Gemini Flash) | Groq/OpenRouter | ~$3,000–5,000 | ~$3,000–5,000 |
| Push/email/telegram | Free | $0 | $0 |
| **Total** | | **~$3,200–5,500** | **~$3,050–5,090** |

### Per-user economics

| Metric | Value |
|---|---|
| Revenue per user | ₹500 (~$6) |
| 1,000 users revenue | ₹500,000 (~$6,000) |
| Platform cost (storage) | ~$90–180 (DO + Turso) |
| Platform cost (LLM) | ~$3,000–5,000 |
| **Total platform cost** | **~$3,100–5,200** |
| Profit | ~$800–2,900 |
| Profit margin | **13–48%** |

LLM dominates cost (85-95%). Storage is <10% of total cost.

### Scaling economics

| Scale | Revenue | Storage Cost | LLM Cost | Total Cost | Profit | Margin |
|---|---|---|---|---|---|---|
| 1,000 users | $6,000 | ~$130 | ~$4,000 | ~$4,130 | $1,870 | 31% |
| 10,000 users | $60,000 | ~$800 | ~$20,000 | ~$20,800 | $39,200 | 65% |
| 100,000 users | $600,000 | ~$5,000 | ~$120,000 | ~$125,000 | $475,000 | 79% |

---

## Keep it simple rules

1. **5 tables only.** No new tables for teams, marketplace, or channels.
2. **6 tools only.** All CRUD goes through `create/read/update/delete/link/search`. Agent sees only these 6 — no wrappers.
3. **DO SQLite for operational data.** Turso for form catalog, user assignments + vector search.
4. **Batch writes, cache reads.** Group SQLite writes in transactions, cache hot reads in KV.
5. **Let DOs hibernate.** Don't keep-alive. Wake on demand, sleep after 10s.
6. **Skills are JSON.** No code changes to add new business actions.
7. **Agents only detect intent.** Workflows do the work deterministically.
8. **Cheap LLMs.** Groq for intent routing. MiMo v2.5 for site generation only.
9. **Free channels first.** Telegram, Slack, Discord, push, email.
10. **Mini apps bypass LLM.** Direct tool calls keep costs low.
11. **Cache decisions, not answers.** Action memory replays skip the LLM entirely.
12. **Universal form catalog.** Products, actions, workflows, skills, layouts defined once in g:global, referenced by all workspaces via FK.
13. **No form table in WorkspaceDO.** Stock, services, config only. Everything else comes from global catalog.
14. **Graph table has no weight column.** All relationships are binary.
15. **One workspace = one WorkspaceDO.** No shared DOs across workspaces.
16. **Capability composition over monolithic skills.** 11 capability modules compose into any workspace type.
17. **No Turso sync to devices.** POS uses local cache + DO requests. No embedded replicas.

---

## Finalized decisions (2026-07-02)

| Decision | Details |
|----------|---------|
| **Naming** | Workspace (not storefront). WorkspaceDO (not StorefrontDO). Scope prefix `w:` (not `s:`). |
| **Universal form catalog** | Products, actions, workflows, skills, layouts defined in g:global (form table). WorkspaceDO references via FK. |
| **WorkspaceDO = stock + services** | matter table: qty, selling price (value), service configs. No form table. |
| **Pricing model** | Global: cost_price, MRP. Workspace: selling price (matter.value). |
| **Graph table simplified** | `src, rel, tgt, active, time` — no weight column. |
| **Orders** | Simple: WorkspaceDO. Complex: OrderDO with state machine. |
| **Payments** | Matter row in OrderDO with type='payment'. |
| **Change propagation** | MRP changes globally → all workspaces see it. Selling price is per-workspace. |
| **Capability composition** | 11 capability modules (CRM, Projects, Bookings, Inventory, Orders, Logistics, HR, LMS, Listings, Support, Team chat) compose into any workspace type. |
| **Marketplace templates** | Pre-built workspace blueprints (restaurant, clinic, retail, salon, gym, school, courier, property). Install in seconds. |
| **Two-model architecture** | Groq GPT-OSS-120B for intent detection + routing. MiMo v2.5 for site layout generation (~₹0.02/site). |
| **Local-first POS** | Device SQLite cache + DO requests. No Turso sync to devices. Offline sales queued and pushed on reconnect. |
| **Channel creation** | Telegram: manual (user creates group, adds bot). Slack/Discord: bot creates via API. |
| **Workspace site** | CF Worker renders layout JSON (from Turso form) + data (from WorkspaceDO) → HTML. KV cached (5min TTL). |
| **Workspace customization** | All changes via chat — add/remove services, change pricing, change theme, add capabilities, create custom actions. |

### Example data

**Global catalog (g:global):**
```
form: f_p001 | Pepsi | data: {variants:[{name:"500ml",cost:20,mrp:24}]}
form: f_p002 | Biryani | data: {variants:[{name:"plate",cost:120,mrp:180}]}
form: action_book_grooming | type: action | data: {steps:[...]}
form: skill_pet_mgmt | type: skill | data: {content:"..."}
form: storefront_happy_paws | type: storefront | data: {theme:{primary:"#4CAF50"},sections:[...]}
```

**WorkspaceDO (w:pet-202):**
```
matter: m_p001 | form: f_p001 | qty: 50 | value: 22  (selling price)
matter: m_p002 | form: f_p002 | qty: 20 | value: 170 (selling price)
matter: svc_grooming | type: service | title: Dog Grooming | value: 500
matter: svc_vet | type: service | title: Vet Checkup | value: 300
matter: svc_boarding | type: service | title: Overnight Boarding | value: 800
```

**OrderDO (o:order-5001):**
```
matter: items | data: [{form:f_p001,qty:2,price:22},{form:f_p002,qty:1,price:170}]
matter: pay_8001 | type: payment | value: 214 | data: {method:"upi",status:"completed"}
```

---

## How this relates to existing documents

| Document | Role | Status |
|---|---|---|
| `flue.md` | Original architecture paper: 6 tables, 12 tools, Flue primitives | **Conceptual foundation** |
| `flueprojtask.md` | Project/task management example mapped to the schema | **Valid vertical example** |
| `docs/plan.md` | Cost-optimized implementation: 5 tables, 6 tools, DO SQLite-first | **Primary baseline** |
| `docs/storefront.md` | AI-generated storefront site design | **Merged into workspace site system** |
| `fluepos.md` | POS vertical generation example | **Valid capability composition example** |
| `tarflue-v2/` | Existing Flue runtime codebase | **Refactor to match this plan (WorkspaceDO, 6 tools, 11 capabilities)** |

---

## Future Thoughts (not immediate)

Ideas discussed but not required for initial build. Consider adding after core launch.

---

## Workspace creation flow

### How a workspace gets created

| Step | Who | What happens |
|---|---|---|
| 1 | User | Says "build me a Pet management app" or "I run a restaurant" |
| 2 | Master agent (Groq) | Detects intent: `create_workspace`, matches keywords to capabilities |
| 3 | Agent | Checks marketplace for matching template |
| 4a | Template found | Asks: "Use the restaurant template? What's the name?" |
| 4b | No template | Asks about services, composes from capability modules |
| 5 | User | Provides name, services, details |
| 6 | LLM (MiMo v2.5) | One call — generates workspace config, actions, workflows, site layout |
| 7 | 6 tools | `create(table='form')` — workspace config, actions, workflows, layout saved to Turso |
| 8 | 6 tools | `create(table='matter')` — service/product entries saved to WorkspaceDO |
| 9 | 6 tools | `link(src='user:{userId}', rel='owner', tgt='w:{workspaceId}')` — ownership graph |
| 10 | Agent | Replies: "Workspace is live at {name}.tarai.space" |

Total LLM calls: 1-2. Total cost: ~₹0.03.

### Capability matching

The LLM reads 11 capability descriptions loaded into context, compares against user's words, and picks the relevant ones.

| User says | Capabilities enabled |
|---|---|
| "Pet salon with grooming and boarding" | Bookings + CRM + Orders |
| "Restaurant with delivery" | Orders + Inventory + Logistics |
| "Dentist clinic" | Bookings + CRM + Projects |
| "Clothing store" | Orders + Inventory + CRM |
| "Coaching classes" | LMS + Bookings + CRM |
| "Real estate agent" | Listings + CRM + Projects |
| "Gym with classes" | Bookings + CRM + LMS + HR |

### Workspace customization (post-creation)

All changes via chat. No admin panel needed.

| Change | User says | Agent does |
|---|---|---|
| Add service | "Add teeth whitening for ₹2000" | `create(table='matter', type='service')` |
| Remove service | "Remove boarding option" | `delete(table='matter', id='boarding')` |
| Change pricing | "Grooming is now ₹600" | `update(table='matter', id='grooming', value:600)` |
| Add team member | "Add Kamal as staff" | `link(src='user:kamal', rel='staff', tgt='w:xxx')` |
| Change site theme | "Make the site dark blue" | `update(table='form', type='storefront', data:{theme:{primary:'#0a2463'}})` |
| Add capability | "We need inventory tracking" | Copies inventory actions/workflows into workspace |
| Custom action | "I need a pet report card" | LLM generates action JSON, saves to form |

---

## Local-first POS

### How it works

| State | Device behavior | Cost |
|---|---|---|
| Online sale | POST to WorkspaceDO, get response | ~₹0 |
| Offline sale | Queue in local SQLite `motion` table | ₹0 |
| Reconnect | Push queued sales to DO one by one | ~₹0 |
| Product refresh | Fetch from Turso on app open | ~₹0 |

Device holds: product snapshot, last known stock, queued offline sales. No Turso sync to devices — just a local cache copy. Like Shopify POS.

### Why not Turso sync to devices

| Approach | 30 devices × 500 products | Every stock change | Monthly cost |
|---|---|---|---|
| Turso sync to all devices | 30 replicas syncing | 30 × every write | Uncontrollable |
| DO (no sync) | Single instance | 1 write, read by all | Predictable |

DO has zero sync cost. Devices send requests to DO. DO is the single source of truth.

---

## Workspace site generation

### Two-model architecture

| Task | Model | Why |
|---|---|---|
| Intent detection + routing | Groq GPT-OSS-120B | Fast, cheap, handles most conversations |
| Site layout generation (one-time) | MiMo v2.5 | Best design quality for ₹0.02 per site |

### How site generation works in Flue

| Step | Flue Primitive | What happens |
|---|---|---|
| User says "build my site" | Agent input | Intent detected |
| Agent loads skill | Skill | Instructions for site generation |
| Agent calls workflow | Workflow | `wf_generate_site` |
| Workflow calls LLM | LLM (MiMo v2.5) | One call — generates layout JSON |
| Workflow saves result | Tool | `create(table='form', type='storefront')` |
| CF Worker renders | Runtime | Layout JSON → server-side HTML |

### Site rendering

```
Customer hits {name}.tarai.space
  → KV cache check → HIT → serve cached HTML (~10ms)
  → KV miss → CF Worker reads:
      form (layout JSON, product details) from Turso
      matter (stock, price, services) from WorkspaceDO
    → Renders HTML from layout JSON + data
    → Writes to KV (5min TTL)
    → Serves HTML
```

### Store types as templates

The same system handles all business types. Store type determines which components load and what data fills them.

| Business | Components | Data Source |
|---|---|---|
| Retail | Product grid, cart, checkout | `form` (products) + `matter` (stock) |
| Restaurant | Menu sections, table booking | `form` (menu items) + `matter` (availability) |
| Services | Service list, booking calendar | `form` (services) + `matter` (slots) |
| Booking | Availability grid, appointment form | `form` (providers) + `matter` (schedule) |

---

## Timeline vector search

Each motion event can have a semantic summary stored in the `memory` table with an embedding. This enables natural language search across motion history.

**How it works:**
- After each `create(table='motion')`, also call `create(table='memory')` with a one-line summary + its embedding
- User types "find Pepsi orders" → vector search on memory table → returns matching motions
- Chronological search (motion table, last 7 days) covers 90% of home screen usage
- Vector search adds value for "find me something specific from history" queries

**Use cases:**
| Query | What it finds |
|---|---|
| "Pepsi orders last month" | Motion rows mentioning Pepsi |
| "deliveries to Anna Nagar" | Delivery motions with that address |
| "AC repair tasks" | Task motions matching AC repair |
| "orders like last Monday" | Motions with similar patterns |
| "who delivered to KK Nagar" | Delivery motions mentioning that drop point |
| "everything about Burger today" | Any motion mentioning Burger |

**Cost:** One embedding per motion (~50 tokens). At 29K motions/month per tenant, embedding cost ~₹60/mo for 1K tenants. Storage negligible.

**Verdict:** Nice-to-have. Chronological search covers most usage. Add when users request history search.

### Embedding generation on motion write

After each `create(table='motion')` call, also call `create(table='memory')` with a text summary and its embedding:

```typescript
// After motion is written
await storeMemory({
  text: `Order #789: 5 Burgers confirmed at Store-101`,
  embedding: await embed(`Order #789: 5 Burgers confirmed at Store-101`),
  scope: 'w:rest-101',
  meta: { type: 'motion_summary', motionId: motion.id }
});
```

### Two search paths

| Path | Table | Query pattern | Latency |
|---|---|---|---|
| Chronological | `motion` | `WHERE created_at > now - 7d ORDER BY created_at DESC` | ~20ms |
| Semantic | `memory` | Vector similarity search on embeddings | ~50ms |

Chronological is default for home screen. Semantic is for explicit search queries.

### Motion as action queue (implemented in core plan)

Motion table stores only actionable events — things needing user action. Completed/delivered/done events stay in DO SQLite. This reduced storage from 29K to ~5K rows/month per tenant, cut Turso cost by 80%, and enabled 3-7 day hot retention instead of 30 days.

### Prompt caching for agent system prompt

LLM providers (Cloudflare Workers AI, OpenAI, Anthropic) support prompt caching. First ~1K tokens of a request that match a cached prefix cost 10-30% of normal input price on warm calls.

Agent system prompt (skills, tool definitions, RBAC rules) is identical every call. Pin it as cached prefix.

| Call | Without cache | With cache |
|---|---|---|
| 1st | Full price | Full price (cache miss) |
| 2nd+ | Full price | 10-30% of input cost |

**Savings:** 70-90% on input tokens for warm sessions.

**Why future:** LLM provider undecided. Each has different caching API. Add after picking final LLM.

### Continuous archival (not cron)

Current plan uses daily cron. Continuous alternative: when a motion row is created, check if any rows in that user's hot table are >7 days old. Move them inline.

| Approach | How | Burst risk | Complexity |
|---|---|---|---|
| Daily cron | Runs once per day at 3 AM UTC | Minimal (off-peak) | Simple |
| Continuous | Inline on every write | None | Medium |

**Why future:** Daily cron is simple and sufficient at small scale. Continuous is cleaner for 10K+ tenants. Low priority.

### Platform-native template commands

Use Telegram/Slack/Discord/WhatsApp built-in features instead of free-text chat for common actions. Zero LLM cost.

| Platform | Feature | How it works |
|---|---|---|
| Telegram | Slash commands (`/add-stock`) | User types `/` → picks command → fills params → sends |
| Slack | Shortcuts + Workflow Builder | User clicks shortcut → fills form → submits |
| Discord | Slash commands (`/add-stock`) | User types `/` → picks command → fills params → sends |
| WhatsApp | Interactive Messages | Buttons + list messages → user taps to select |

**Example flow (Telegram):**
```
User types "/" in group
  → Bot shows: /add-stock, /record-sale, /check-inventory
  → User picks /add-stock
  → Bot asks: "Which product?" "How many?"
  → User replies: "icecream" "40"
  → Bot executes workflow directly
```

**Cost comparison:**
| Path | LLM cost |
|---|---|
| Free text ("add icecream stock by 40") | LLM runs once, stores pattern |
| Slash command or button | ₹0 — no LLM |
| Replay from autocomplete card | ₹0 — no LLM |

**Why future:** Requires platform-specific bot setup for each channel. Add after core channels are working. Prioritize Telegram first (free, largest user base in target market).
