# TAR Gen UI Workspace System

> User picks modules → AI composes workspace from `.md` specs → Gen UI renders it. Everything is a markdown file. Modules are open — 14 core + AI-generated + marketplace.

---

## 1. Core Idea

A workspace = a folder of `.md` files. Each file follows industry standards:

| Standard | Origin | Role in TAR |
| --- | --- | --- |
| **OKF** | Google Cloud | Domain knowledge — products, policies, reports |
| **OVERRIDES.md** | TAR | Brand tokens — colors, typography |
| **SKILL.md** | TAR | Actions, workflows, tool-call steps |

**The `.md` file IS the product.** Code is just the runtime that reads it.

---

## 2. Open Module System

### A Module = A SKILL.md File. Nothing More.

No code per module. The runtime reads any SKILL.md, parses actions, executes against the same 5 tables (form, matter, motion, graph, memory). Creating a new module = writing a new `.md` file.

### Three Tiers

| Tier | Source | Examples |
| --- | --- | --- |
| **Core** (14) | TAR-maintained, tested | Orders, Inventory, Bookings, CRM, Logistics, Projects, HR, LMS, Listings, Support, Reports, Expenses, Documents, Team Chat |
| **AI-Generated** | User describes → AI writes SKILL.md | "I need a subscriptions module" → `subscriptions.md` created |
| **Marketplace** | Community-published | Restaurant A shares "loyalty rewards" module |

### Module File Structure

```
modules/core/                    ← 14 core modules (maintained by TAR)
├── orders/SKILL.md
├── inventory/SKILL.md
├── bookings/SKILL.md
├── crm/SKILL.md
├── logistics/SKILL.md
├── projects/SKILL.md
├── hr/SKILL.md
├── lms/SKILL.md
├── listings/SKILL.md
├── support/SKILL.md
├── reports/SKILL.md
├── expenses/SKILL.md
├── documents/SKILL.md
└── team-chat/SKILL.md
```

### What a SKILL.md Looks Like

```yaml
---
type: skill
name: orders
version: 1.0.0
actions:
  - name: record_sale
    params: [items, payment_method]
    icon: receipt
  - name: void_order
    params: [order_id, reason]
    icon: x-circle
ui_hints:
  primary_action: record_sale
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [record_sale, void_order]
    - type: metric-card
      title: "Today's Sales"
      data: "SELECT COUNT(*) FROM motion WHERE type='sale' AND date(time)=date('now')"
site_pages:
  - slug: /menu
    template: catalog-grid
    data_source: matter WHERE type = 'product'
---

# Orders Module

## record_sale
Check stock → deduct quantities → create motion record → generate receipt.

## void_order
Verify order exists → reverse stock → mark motion as voided.
```

YAML = machine-readable (agent parses, UI renders). Markdown = human-readable (agent reads for context).

### Presets = UX Shortcuts (Not Architecture)

```yaml
# config/presets.yaml — just module combos, 5 lines each
presets:
  restaurant: [orders, inventory, bookings, crm, reports, expenses, documents]
  salon: [bookings, crm, orders, reports, expenses, documents]
  clinic: [bookings, crm, projects, support, reports, expenses, documents]
  retail: [orders, inventory, crm, reports, expenses, documents]
  gym: [bookings, crm, lms, hr, reports, expenses, documents]
  agency: [crm, projects, hr, support, reports, expenses, documents]
```

---

## 3. Workspace Structure (Generated Output)

When a workspace is created, AI composes these files from selected modules:

```
workspaces/{scope}/
├── business/
│   └── profile.md          ← name, type, location, hours, description
├── products/
│   └── menu.md             ← menu items with prices
├── policies/
│   ├── return.md           ← return policy
│   └── delivery.md         ← delivery policy
├── faqs/
│   └── common.md           ← frequently asked questions
├── site/
│   └── OVERRIDES.md        ← brand tokens, typography
└── skills/
    ├── orders.md           ← personalized from modules/core/orders/SKILL.md
    ├── inventory.md        ← personalized from modules/core/inventory/SKILL.md
    ├── loyalty.md          ← AI-generated (custom module)
    └── ...                 ← one per installed module
```

---

## 4. Generation Layers

### Layer 1: Skills (Tools, Actions, Workflows)

**When:** Workspace creation.
**How:** AI reads each selected module's SKILL.md → composes + personalizes → writes to `workspaces/{scope}/skills/`.
**Cost:** 1 LLM call (~$0.001).

```
POST /workspaces/create {
  name: "Spice Garden",
  modules: ["orders", "inventory", "bookings", "crm", "reports"],
  location: "Mumbai"
}

→ Read modules/core/{each}/SKILL.md
→ ONE LLM call: compose + personalize all (inject name, location, tax, categories)
→ Write skills/*.md to S3
→ Return action index to app → cached locally
```

### Layer 2: Brand Tokens (OVERRIDES.md)

**When:** Workspace creation. Editable by user anytime.
**How:** AI generates from business name + extracted data.

```markdown
# Brand Overrides

## Colors
- primary: #E85D3B
- secondary: #1B2A33

## Typography
- heading: Georgia, serif
- body: Inter, sans-serif
```

### Layer 3: Site Generation

**When:** Workspace creation or on-demand.
**How:** AI Planner (Z.AI GLM-4.7-Flash) generates UIPlan JSON from universal rules + workspace data → Renderer generates HTML/CSS.
**Cost:** ~$0.001 per generation.

```
Universal Rules + Workspace Data + Turso DB → AI → UIPlan JSON → HTML/CSS
```

---

## 5. Site Generation System

### Architecture

```
Universal Design Skills (3 files for ALL verticals)
        +
Workspace Data (from AI extraction — user message)
        +
Turso DB (products, policies, FAQs)
        ↓
    AI Planner (Z.AI GLM-4.7-Flash)
        ↓
    UIPlan JSON (list of sections)
        ↓
    Rule-Critic (anti-slop check)
        ↓
    Renderer → HTML/CSS
```

### Universal Design Skills (3 files)

| File | What It Does | Stored |
|------|--------------|--------|
| `DESIGN-UNIVERSAL.md` | Base rules (typography, layout, colors) | S3 |
| `ANTI-SLOP.json` | Anti-slop rules (two-tier: error/warning) | S3 |
| `SECTIONS.json` | Available section types (the site's unit) | S3 |

### AI Planner

- **Model**: Z.AI GLM-4.7-Flash (free, thinking enabled)
- **Temperature**: 0.2 (structured JSON output)
- **Output**: List of section types from SECTIONS.json

### Renderer

- Input: UIPlan JSON (list of sections)
- Maps sections → HTML templates
- Applies CSS variables from OVERRIDES.md
- Output: Vanilla HTML/CSS (no React for sites)

---

## 6. Creation Flow

### User Journey (~10 seconds)

User sends one message describing their business → AI extracts everything → Workspace created.

### Example Conversation

```
User: I have a restaurant called Ravanan's in Chennai. 
      South Indian food. Open 10am-10pm. 
      Menu: Pepsi ₹22, Biryani ₹180. 
      No returns, free delivery 5km.

AI: Got it! I've created your workspace:
    ✓ Name: Ravanan's Restaurant
    ✓ Type: Restaurant
    ✓ Location: Chennai
    ✓ Hours: 10am-10pm
    ✓ Menu: 2 items
    ✓ Policies: Return + Delivery
    
    I'll use terracotta (#E85D3B) as your brand color 
    and Georgia for headings. Want to change these?

User: looks good

AI: Done! Your site is live at ravanan.tarai.space
```

### Backend Flow

```
1. User sends message
2. AI extracts structured data from message
3. Create Turso DB `ws-{subdomain}`, run schema DDL
4. Save extracted data to Turso DB
5. Read golden templates from `verticals/{type}/` in S3
6. AI personalizes templates (inject name, location, menu)
7. Write personalized `.md` files to `workspaces/{scope}/` in S3
8. Auto-generate OKF bundle from extracted data
9. Auto-generate OVERRIDES.md (brand tokens, typography)
10. Create S2 streams, issue tokens, register in D1
11. Return workspace config to app
12. App creates local SQLite replica, caches skill index
```

---

## 7. Runtime — How Actions Execute

Same executor for all paths. Module type doesn't matter.

| Path | Flow |
| --- | --- |
| **App** | User taps action → app knows action + params from cached index → `POST /tools/execute` → Worker reads SKILL.md → parser extracts steps → executes against Turso → result returned |
| **Channel** (Telegram/Slack) | User types message → Worker reads skills → LLM matches intent → same executor, same Turso → result to channel |
| **Voice** (future) | Speech → intent → same action name + params → same executor |

---

## 8. Tech Stack

| Layer | Tech | Cost |
| --- | --- | --- |
| Mutable state | Turso `ws-{subdomain}` per workspace | Free tier |
| Module specs | S3 `modules/core/*.md` (read-only) | $0 (Railway Tigris) |
| Workspace specs | S3 `workspaces/{scope}/*.md` | $0 |
| Registry | D1 (workspace list, tokens, checkpoints) | Included |
| Global | Turso `g:global` (user profiles, catalog) | Free tier |
| Events | S2.dev streams (sales, GPS, kitchen) | ~$2/mo |
| Site | Edge Template Engine (1 Worker → all sites) | $0–$500/mo |

---

## 9. Cost

| Scale | Per Workspace (one-time) | Per Workspace/month | Total/month |
| --- | --- | --- | --- |
| 1 | $0.003 | $0.016 | $0.016 |
| 100 | $0.30 | $1.60 | $1.60 |
| 1,000 | $3 | $16 | $16 |
| 10,000 | $30 | $160 | $160 |
| 100,000 | $300 | $1,600 | $1,600 |

---

## 10. Summary

```
Module  = a SKILL.md file (the atomic unit)
Core    = 14 maintained modules (standard library)
Custom  = AI writes new SKILL.md from user description
Preset  = UX shortcut ("Restaurant" = list of module names)
AI      = the composer (reads modules → writes workspace)
Site    = the public face (1 Worker renders all sites, pure HTML/CSS)
```

**10 things that make this different:**

1. **Open modules** — 14 core + infinite AI-generated + marketplace
2. **Spec-first** — `.md` file IS the feature, not code
3. **Generate once, render forever** — zero LLM at runtime
4. **Industry standards** — OKF, SKILL.md
5. **Zero DOs, zero WebSockets** — no compute bloat
6. **Every workspace looks different** — OVERRIDES.md = unique branding
7. **Every workspace works the same** — component registry = consistency
8. **Composable** — add module = add file, remove = delete file
9. **Portable** — workspace = folder of files, movable anywhere
10. **Maintain 14 files, serve infinite business types**
