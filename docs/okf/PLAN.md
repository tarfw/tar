# OKF Plan — tarai + tarflue-v2

> How Open Knowledge Format applies to our system. Three bundles, concrete use cases, zero fluff.

---

## What Is OKF

Open Knowledge Format (v0.1) — Google's open spec for knowledge as markdown files with YAML frontmatter. Agents read it directly. No SDK, no runtime, no lock-in.

| Rule | Detail |
|---|---|
| Required field | `type` only |
| Special files | `index.md` (folder map), `log.md` (change history) |
| Cross-links | Absolute paths: `/folder/file.md` |
| One concept | One file, one idea |

---

## Our Three OKF Bundles

| Bundle | Location | Purpose | Readers |
|---|---|---|---|
| **System** | `OKF/system/` | Platform knowledge — tools, modules, schemas, agents | Master agent, subagents, developers |
| **Client** | `OKF/client/` | tarai app structure — screens, components, navigation | Frontend agents, developers |
| **Workspace** | `OKF/workspace-template/` | Per-business knowledge — products, policies, reports | Workspace agent, staff |

---

## Bundle 1: System (tarflue-v2)

Documents the backend. Agent reads this to understand how the platform works.

```
OKF/system/
├── index.md
├── log.md
├── architecture/
│   ├── overview.md          # Workers + DO + Turso + D1
│   ├── data-model.md        # 5 tables: form, matter, motion, graph, memory
│   └── scopes.md            # w:, o:, p:, g: data routing
├── tools/
│   ├── create.md            # INSERT any table
│   ├── read.md              # SELECT any table
│   ├── update.md            # UPDATE any table
│   ├── delete.md            # SOFT DELETE
│   ├── link.md              # Graph edge toggle
│   └── search.md            # Vector search
├── agents/
│   ├── master.md            # Intent detection → workflow routing
│   └── action-memory.md     # Inline card replay, zero LLM on replay
├── modules/
│   ├── crm.md               # Leads, follow-ups, deal pipeline
│   ├── orders.md            # POS, state machine, payment
│   ├── inventory.md         # Stock, batch/expiry, suppliers
│   ├── bookings.md          # Appointments, slots, reminders
│   ├── logistics.md         # Delivery, drivers, routing
│   ├── projects.md          # Tasks, sprints, milestones
│   ├── hr.md                # Attendance, leave, payroll
│   ├── lms.md               # Courses, assignments
│   ├── listings.md          # Property/products, inquiries
│   ├── support.md           # Tickets, escalation
│   ├── reports.md           # SQL queries over matter+motion
│   ├── expenses.md          # Tracking, recurring, bills
│   └── documents.md         # Railway S3, linking
├── schemas/
│   ├── matter.md            # Columns, types, time fields, data JSON
│   ├── motion.md            # 32 motion types across 11 verticals
│   └── graph.md             # Edges, relationships, ACL
├── workflows/
│   ├── record-sale.md       # Check stock → deduct → receipt
│   ├── checkout.md          # Cart → payment → order
│   └── workspace-creation.md # Describe business → install modules → go live
└── channels/
    ├── telegram.md          # Group → scope mapping via D1
    ├── slack.md
    ├── discord.md
    └── whatsapp.md
```

### Concrete Use Cases

| Agent Task | OKF File It Reads |
|---|---|
| "Create a restaurant workspace" | `workflows/workspace-creation.md` |
| "Record sale of 3 Pepsi" | `workflows/record-sale.md` |
| "What columns does matter have?" | `schemas/matter.md` |
| "How does the create tool work?" | `tools/create.md` |
| "Generate daily sales report" | `modules/reports.md` |
| "Install CRM module" | `modules/crm.md` |

---

## Bundle 2: Client (tarai)

Documents the frontend. Agent reads this to understand the app structure.

```
OKF/client/
├── index.md
├── log.md
├── screens/
│   ├── home.md              # Role-based timeline, motion cards
│   ├── chat.md              # Agent chat, autocomplete, action cards
│   ├── explore.md           # Search, marketplace, settings
│   ├── workspace.md         # Workspace detail view
│   └── auth.md              # Google sign-in
├── components/
│   ├── action-executor.md   # Runs workflows from cards
│   ├── action-form.md       # Dynamic form from action schema
│   └── storefront-tab.md    # Product listing view
├── navigation/
│   ├── tabs.md              # Bottom tab: Home | Chat | Explore
│   └── screens.md           # Full screen map
└── api/
    └── tarflue-client.md    # How tarai talks to tarflue-v2
```

### Concrete Use Cases

| Task | OKF File It Reads |
|---|---|
| "Add a new screen" | `navigation/screens.md` |
| "How does the home screen render cards?" | `screens/home.md` |
| "How does ActionExecutor work?" | `components/action-executor.md` |
| "What API endpoints does the client call?" | `api/tarflue-client.md` |

---

## Bundle 3: Workspace Template

Copied per business. Filled with their specific knowledge.

```
OKF/workspace-template/
├── index.md
├── log.md
├── business/
│   ├── profile.md           # Name, type, hours, UPI ID
│   ├── team.md              # Staff roles
│   └── channels.md          # Telegram groups → scope
├── products/
│   ├── catalog.md           # Items with prices, stock
│   └── categories.md        # Groupings
├── policies/
│   ├── returns.md           # Refund rules
│   ├── delivery.md          # Zones, timing, fees
│   └── payments.md          # UPI, cash handling
├── workflows/
│   ├── order-flow.md        # State machine for this workspace
│   └── delivery-flow.md     # Driver assignment
├── reports/
│   ├── daily-sales.md       # SQL + output format
│   └── stock-valuation.md   # Current inventory value
└── macros/
    ├── order-confirm.md     # "Your order is confirmed"
    └── out-of-stock.md      # "Sorry, we're out"
```

### Concrete Use Cases

| Task | OKF File It Reads |
|---|---|
| "What's today's sales?" | `reports/daily-sales.md` → SQL query |
| "How do I handle a return?" | `policies/returns.md` → decision matrix |
| "Who's on shift?" | `business/team.md` → staff list |
| "What products do we have?" | `products/catalog.md` → item list |

---

## How OKF Integrates with Our Code

### tarflue-v2 Integration

| Component | How It Uses OKF |
|---|---|
| **Master agent** (`src/agents/master.ts`) | Reads `system/modules/*.md` to understand what each module does before routing |
| **Workflows** (`src/workflows/*.ts`) | Read `system/workflows/*.md` for step-by-step procedures |
| **Skills** (`src/skills/*/SKILL.md`) | Reference `system/tools/*.md` for tool usage patterns |
| **Module install** | Copies `system/modules/*.md` into workspace bundle |

### tarai Integration

| Component | How It Uses OKF |
|---|---|
| **Home screen** (`src/app/(tabs)/home.tsx`) | Reads workspace `reports/*.md` to know what reports are available |
| **Chat screen** (`src/app/(tabs)/chat.tsx`) | Reads workspace `macros/*.md` for template replies |
| **Explore** (`src/app/(tabs)/explore.tsx`) | Reads `system/modules/*.md` to show available modules |
| **ActionExecutor** (`src/components/ActionExecutor.tsx`) | Reads workspace `workflows/*.md` to execute actions |

### Agent Flow with OKF

```
User: "Show me today's sales"
  → Agent reads workspace/reports/daily-sales.md
  → Agent gets: SQL query + output format
  → Agent executes: read(table='matter', type='order', start >= today)
  → Agent formats: per the template in daily-sales.md
  → Reply: "47 orders, ₹12,400. UPI: ₹8,200"
```

Without OKF, the agent would need LLM to figure out the SQL. With OKF, it reads the curated query. Zero LLM cost.

---

## OKF + Action Memory

| Layer | What | Cost |
|---|---|---|
| **OKF bundle** | Curated knowledge — "how to run daily sales" | Write once |
| **Action memory** | Cached decision — user ran it 3 times | Read from cache |
| **Agent** | First time: reads OKF + LLM. Replay: memory card only | ₹0 on replay |

The OKF bundle is the **training data**. Action memory is the **cached output**.

---

## Implementation Phases

### Phase 1: System Bundle (tarflue-v2)

| Step | What | Files |
|---|---|---|
| 1 | Architecture concepts | `overview.md`, `data-model.md`, `scopes.md` |
| 2 | Tool concepts | `create.md`, `read.md`, `update.md`, `delete.md`, `link.md`, `search.md` |
| 3 | Module concepts | 13 files — one per module |
| 4 | Schema concepts | `matter.md`, `motion.md`, `graph.md` |
| 5 | Workflow concepts | `record-sale.md`, `checkout.md`, `workspace-creation.md` |
| 6 | Channel concepts | `telegram.md`, `slack.md`, `discord.md`, `whatsapp.md` |

**~30 concept files**

### Phase 2: Client Bundle (tarai)

| Step | What | Files |
|---|---|---|
| 1 | Screen concepts | `home.md`, `chat.md`, `explore.md`, `workspace.md`, `auth.md` |
| 2 | Component concepts | `action-executor.md`, `action-form.md`, `storefront-tab.md` |
| 3 | Navigation concepts | `tabs.md`, `screens.md` |
| 4 | API concept | `tarflue-client.md` |

**~10 concept files**

### Phase 3: Workspace Template

| Step | What | Files |
|---|---|---|
| 1 | Business concepts | `profile.md`, `team.md`, `channels.md` |
| 2 | Product concepts | `catalog.md`, `categories.md` |
| 3 | Policy concepts | `returns.md`, `delivery.md`, `payments.md` |
| 4 | Report concepts | `daily-sales.md`, `stock-valuation.md` |
| 5 | Macro concepts | `order-confirm.md`, `out-of-stock.md` |

**~12 concept files**

### Phase 4: Agent Integration

| Step | What |
|---|---|
| 1 | Master agent loads system bundle on startup |
| 2 | Agent loads workspace bundle when scope is set |
| 3 | Module install copies OKF concepts to workspace |
| 4 | Action memory reads OKF, caches result |

---

## Final Ideas — How OKF Helps Our System

### 1. Agent Onboarding (Zero LLM)

New agent joins. Instead of training it on our codebase, it reads the system OKF bundle. Every tool, module, schema, workflow — documented in markdown it can parse. No fine-tuning. No prompt engineering. Just files.

### 2. Workspace Creation as OKF Copy

User describes business → agent matches to module set → agent copies relevant OKF concepts from system bundle to workspace bundle. The workspace now has its own knowledge base. The agent reads it to understand the business.

### 3. Module Marketplace as OKF Bundles

Each marketplace skill is an OKF bundle. Install = copy bundle to workspace. The agent reads the bundle to know how to use the skill. No code deployment. No schema migration.

### 4. Reports as OKF Concepts

Each report is an OKF concept file with SQL query + output format. Agent reads the file, runs the query, formats per template. First time uses LLM. Every subsequent time, action memory caches the card.

### 5. Channel Routing as OKF

Telegram group → workspace scope mapping documented as OKF concepts. Agent reads `channels/telegram.md` to know how to route incoming messages. D1 lookup is the implementation, OKF is the documentation.

### 6. Action Memory Replay

User types "Bo..." → agent searches action memory → finds "Book a Taxi" card → inline card appears → user edits fields → taps Execute → workflow runs. Zero LLM. The OKF bundle told the agent how to create the card the first time.

### 7. Cross-Workspace Learning

Restaurant A figures out a good stock alert workflow. They publish it to the marketplace as an OKF bundle. Restaurant B installs it. Both agents read the same knowledge. No code sharing — just knowledge sharing.

### 8. DKG Verification (Future)

Import OKF bundles to OriginTrail DKG. Every concept becomes a verifiable knowledge asset. Workspace owners prove they wrote the policy. Buyers verify the marketplace skill hasn't been tampered with.

---

## What to Remove from OKF/

| Item | Reason |
|---|---|
| `on-page-seo-essentials/` | External reference example — not our system |
| `ecommerce-operations-playbook/` | External reference example — not our system |

These were useful for understanding OKF patterns. Move to `OKF/references/` if needed, but they're not part of our bundles.

---

## Summary

| Bundle | Files | Purpose |
|---|---|---|
| System | ~30 | Platform knowledge for agents |
| Client | ~10 | App structure for developers/agents |
| Workspace | ~12 | Per-business knowledge |
| **Total** | **~52** | Full knowledge base |

| Benefit | Impact |
|---|---|
| Agent reads OKF instead of LLM guessing | Lower cost |
| Workspace creation = copy OKF concepts | Instant setup |
| Module marketplace = OKF bundles | No code deploy |
| Action memory caches OKF-guided decisions | Zero LLM on replay |
| DKG integration (future) | Verifiable knowledge |
