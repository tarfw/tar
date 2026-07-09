# TAR Gen UI Workspace System

> User picks modules → AI composes workspace from `.md` specs → Gen UI renders it. Everything is a markdown file. Modules are open — 14 core + AI-generated + marketplace.

---

## 1. Core Idea

A workspace = a folder of `.md` files. Each file follows industry standards:

| Standard      | Origin               | Role in TAR                                          |
| ------------- | -------------------- | ---------------------------------------------------- |
| **OKF**       | Google Cloud         | Domain knowledge — products, policies, reports       |
| **DESIGN.md** | Google Labs / Stitch | Visual identity — colors, fonts, spacing, components |
| **SKILL.md**  | TAR                  | Actions, workflows, tool-call steps                  |
| **AGENTS.md** | GitHub / industry    | Agent behavior, routing, constraints                 |

**The `.md` file IS the product.** Code is just the runtime that reads it.

---

## 2. Open Module System

### A Module = A SKILL.md File. Nothing More.

No code per module. The runtime reads any SKILL.md, parses actions, executes against the same 5 tables (form, matter, motion, graph, memory). Creating a new module = writing a new `.md` file.

### Three Tiers

| Tier             | Source                              | Examples                                                                                                                   |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Core** (14)    | TAR-maintained, tested              | Orders, Inventory, Bookings, CRM, Logistics, Projects, HR, LMS, Listings, Support, Reports, Expenses, Documents, Team Chat |
| **AI-Generated** | User describes → AI writes SKILL.md | "I need a subscriptions module" → `subscriptions.md` created                                                               |
| **Marketplace**  | Community-published                 | Restaurant A shares "loyalty rewards" module                                                                               |

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
├── index.md              ← installed modules list, workspace identity
├── DESIGN.md             ← colors, fonts, spacing, component tokens
├── AGENTS.md             ← agent behavior, routing rules
├── business/
│   ├── profile.md        ← name, hours, location, UPI, contacts
│   ├── team.md           ← staff roles, permissions
│   └── channels.md       ← Telegram/WhatsApp group mappings
├── skills/
│   ├── orders.md         ← personalized from modules/core/orders/SKILL.md
│   ├── inventory.md      ← personalized from modules/core/inventory/SKILL.md
│   ├── loyalty.md        ← AI-generated (custom module)
│   └── ...               ← one per installed module
├── site/
│   └── pages.md          ← composed from each module's site_pages
├── reports/
│   └── daily-sales.md    ← SQL + output format
├── policies/
│   ├── returns.md        ← refund decision matrix
│   └── delivery.md       ← zones, fees, timing
└── macros/
    └── order-confirm.md  ← template messages
```

---

## 4. The 4 Generation Layers

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
→ Write skills/*.md + DESIGN.md + AGENTS.md to S3
→ Return action index to app → cached locally
```

### Layer 2: Design System (DESIGN.md)

**When:** Workspace creation. Editable by user anytime.
**How:** AI generates from business name + module set. Each module contributes component tokens.

```yaml
---
name: Spice Garden
version: alpha
colors:
  primary: "#1B4332"
  secondary: "#2D6A4F"
  tertiary: "#D4A373"
  neutral: "#FEFAE0"
  on-primary: "#FFFFFF"
typography:
  h1: { fontFamily: "Inter", fontSize: "1.75rem", fontWeight: 700 }
  body-md: { fontFamily: "Inter", fontSize: "0.938rem", fontWeight: 400 }
rounded: { sm: "6px", md: "12px", lg: "16px" }
spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
components:
  action-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---
```

App reads YAML → applies as style tokens → all components themed instantly. Zero LLM at runtime.

### Layer 3: Workspace Screen (Gen UI)

**When:** User opens workspace.
**How:** App reads cached action index + DESIGN.md → component registry renders UI.
**Cost:** Zero. Pure local rendering.

```
Workspace opens
  → Read skills/*.md YAML frontmatter (cached)
  → Read DESIGN.md (cached)
  → Component Registry maps actions to pre-built components
  → Layout engine arranges by ui_hints
  → Personalized, branded workspace — instant
```

**Component Registry** — pre-built, validated. AI never generates raw HTML:

| Component       | Props                     | Used By            |
| --------------- | ------------------------- | ------------------ |
| `metric-card`   | title, value, trend, icon | All modules        |
| `quick-actions` | actions[]                 | All modules        |
| `action-button` | label, skillAction, icon  | All modules        |
| `action-form`   | skillAction, params       | All modules        |
| `data-table`    | columns, dataSource       | Reports, Inventory |
| `timeline-feed` | events, filter            | Home, Orders       |
| `pos-pad`       | categories, items         | Orders             |
| `booking-grid`  | slots, date               | Bookings           |
| `catalog-grid`  | items, layout             | Orders, Listings   |
| `report-chart`  | reportId, type            | Reports            |
| `status-board`  | columns, cards            | Projects, Support  |

### Layer 4: Public Site (Edge Template Engine)

**When:** Instant on request (On-Demand Server-Side Compilation). There is **no build step** at workspace creation or during updates. The site exists dynamically the moment the workspace folders are written to S3.
**How:** One Cloudflare Worker intercepts requests for all tenant subdomains, parses `DESIGN.md` for styling tokens and `site/pages.md` for page structure (cached in KV for 5 minutes), reads inventory/catalog data live from the tenant's Turso DB, and merges them into shared high-performance HTML/CSS templates.
**Cost:** $0 at small scale. ~$25/mo at 100K sites.

**Why not Astro/Shopify-style SSG?** Generating static files at creation time requires rebuilding and redeploying whenever catalog items, prices, or bookings change. SSG breaks at scale with millions of workspaces. Edge SSR via a single worker provides dynamic, real-time inventory updates with sub-200ms latency.

#### How DESIGN.md Achieves Shopify-Grade Aesthetic Quality:
1. **Semantic HTML Shells:** The shared templates (e.g. `base.html`, `catalog-grid.html`) are designed with modern, clean markup utilizing CSS Grid/Flexbox layouts, layout boundaries, and responsive image sizes.
2. **Deep Styling Token Mapping:** `DESIGN.md` defines granular tokens for modern visuals, including:
   - Gradient presets (`--gradient-primary`)
   - Shadow depth layers (`--shadow-sm`, `--shadow-md`) for card layering
   - Glassmorphism values (`--backdrop-filter`, `--glass-bg`)
   - Border radius classes (`--rounded-lg`) and animation transition easings
3. **Dynamic CSS Variable Injection:** The edge Worker parses these tokens out of `DESIGN.md` and injects them as CSS custom properties into the template header. All template layouts adapt instantly to match the custom brand guidelines.
4. **Performance is Quality:** Bypassing React hydration and heavy JS bundles yields a 100/100 Lighthouse performance rating, matching or beating Shopify's best storefront metrics on slow mobile networks.
5. **Bespoke CSS & Custom Slots:** Allows injection of raw custom CSS overrides from `DESIGN.md` and renders custom HTML widget snippets directly into template layout slots for infinite visual flexibility.

```
spicegarden.tar.app/menu
  → Worker catches *.tar.app (wildcard route)
  → Extracts scope from subdomain
  → Reads DESIGN.md from KV cache → CSS variables
  → Reads site/pages.md from KV cache → which pages exist
  → Reads product data from Turso (workspace DB)
  → Renders HTML from shared template + data + CSS vars
  → CDN caches response for 5 min
  → ~200ms, zero JS framework, works on 2G
```

**Each module contributes site pages + JS widgets:**

| Module   | Pages                         | Widget (vanilla JS)                       |
| -------- | ----------------------------- | ----------------------------------------- |
| Orders   | `/menu`, `/cart`, `/checkout` | `cart.js` (~60 lines) — localStorage cart |
| Bookings | `/book`                       | `booking.js` (~50 lines) — slot picker    |
| Listings | `/catalog`, `/item/:id`       | None — pure HTML                          |
| CRM      | `/contact`                    | `contact.js` (~20 lines) — form submit    |
| Support  | `/help`                       | `ticket.js` (~30 lines) — form submit     |

**Total JS for full storefront + booking site: ~160 lines vanilla JS. No React. No framework.**

**Shared HTML templates (in Worker code, NOT per workspace):**

```
site-templates/
├── layouts/base.html           ← shell: head, nav, footer
├── pages/
│   ├── hero.html               ← landing with hero section
│   ├── catalog-grid.html       ← product/service grid
│   ├── item-detail.html        ← single product/service
│   ├── cart.html               ← shopping cart
│   ├── checkout.html           ← payment form
│   ├── booking-widget.html     ← slot picker + form
│   └── contact.html            ← contact form
└── widgets/
    ├── cart.js                 ← add/remove, localStorage
    ├── booking.js              ← fetch slots, submit
    └── checkout.js             ← payment redirect
```

**DESIGN.md → CSS (injected by Worker):**

```html
<style>
  :root {
    --color-primary: #1b4332; /* from DESIGN.md */
    --color-tertiary: #d4a373;
    --color-neutral: #fefae0;
    --font-family: "Inter", sans-serif;
    --rounded-md: 12px;
  }
</style>
<!-- Same HTML templates, every site looks different via CSS vars -->
```

**Ordering flow (pure HTML forms):**

```
Customer visits /menu → product grid (HTML, no JS needed)
  → Taps "Add to Cart" → cart.js saves to localStorage
  → Taps cart → /cart page
  → Taps "Checkout" → /checkout form
  → Submits → POST /api/order → Worker creates order in Turso
  → Redirect to UPI/payment gateway
  → Callback → order status updated → confirmation page
```

**Site cost at scale:**

| Scale                  | Requests/day | Cost               |
| ---------------------- | ------------ | ------------------ |
| 1K sites × 10 visits   | 10K          | **$0** (free tier) |
| 100K sites × 50 visits | 5M           | **~$25/mo**        |
| 1M sites × 100 visits  | 100M         | **~$500/mo**       |

---

## 5. Creation Flow

### User Journey (~10 seconds)

| Step | Screen              | Action                                                     |
| ---- | ------------------- | ---------------------------------------------------------- |
| 1    | Onboarding          | Tap preset ("Restaurant") OR "Custom" OR describe business |
| 2    | Module picker       | Checklist of modules (pre-selected if preset, editable)    |
| 3    | Name + location     | Business name (required), location (optional)              |
| 4    | Animated transition | ~5s (covers backend work)                                  |
| 5    | Workspace home      | Gen UI canvas, ready to use                                |

### Backend (~5 seconds)

```
1. Create Turso DB `ws-{subdomain}`                          (~1s)
2. Read modules/{each}/SKILL.md for selected modules         (~200ms)
3. ONE LLM call — compose + personalize everything:          (~2s)
   Input:  module SKILL.md files + { name, location, modules[] }
   Output: skills/*.md + DESIGN.md + AGENTS.md + site/pages.md
4. Write all .md files to S3 workspaces/{scope}/             (~300ms)
5. Register in D1, issue tokens                              (~500ms)
6. Return workspace config + action index to app             (~100ms)

App-side:
7. Cache action index + DESIGN.md locally                    (~100ms)
8. Create local SQLite replica                               (~200ms)
9. Render workspace canvas from cached specs                 (~instant)
```

**Cost per workspace: ~$0.003**

### Adding Modules Later

```
User: "Add a loyalty program"
  → AI checks core modules — no match
  → AI writes modules/custom/loyalty/SKILL.md (actions: earn_points, redeem, check_balance)
  → Writes to workspaces/{scope}/skills/loyalty.md
  → App refreshes action index → new actions appear in workspace
  → Zero downtime, zero migration
```

---

## 6. Runtime — How Actions Execute

Same executor for all paths. Module type doesn't matter.

| Path                         | Flow                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App**                      | User taps action → app knows action + params from cached index → `POST /tools/execute` → Worker reads SKILL.md → parser extracts steps → executes against Turso → result returned |
| **Channel** (Telegram/Slack) | User types message → Worker reads skills → LLM matches intent → same executor, same Turso → result to channel                                                                     |
| **Voice** (future)           | Speech → intent → same action name + params → same executor                                                                                                                       |

---

## 7. Tech Stack

| Layer           | Tech                                        | Cost                |
| --------------- | ------------------------------------------- | ------------------- |
| Mutable state   | Turso `ws-{subdomain}` per workspace        | Free tier           |
| Module specs    | S3 `modules/core/*.md` (read-only)          | $0 (Railway Tigris) |
| Workspace specs | S3 `workspaces/{scope}/*.md`                | $0                  |
| Registry        | D1 (workspace list, tokens, checkpoints)    | Included            |
| Global          | Turso `g:global` (user profiles, catalog)   | Free tier           |
| Events          | S2.dev streams (sales, GPS, kitchen)        | ~$2/mo              |
| Archive         | S3 Parquet + DuckDB WASM on-device          | Postponed (Future)  |
| Vectors         | S3 LanceDB indexes on-device                | Postponed (Future)  |
| Site            | Edge Template Engine (1 Worker → all sites) | $0–$500/mo          |

---

## 8. What to Build

### New Files to Author

| What                                                         | Count    | Priority |
| ------------------------------------------------------------ | -------- | -------- |
| Add `ui_hints` + `site_pages` YAML to 14 core SKILL.md files | 14 edits | P1       |
| `config/presets.yaml` — 6 preset combos                      | 1 file   | P1       |

### New Code

| File                                        | ~Lines    | What                                                              |
| ------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `taragent/src/lib/module-composer.ts`       | 100       | Read N module SKILL.md → compose prompt for LLM                   |
| `taragent/src/lib/design-md-parser.ts`      | 80        | Parse + validate DESIGN.md YAML                                   |
| `taragent/src/lib/schema-validator.ts`      | 60        | Zod validation for composed workspace specs (DESIGN.md, SKILL.md) |
| `taragent/src/lib/auth-scopes.ts`           | 50        | Scope query execution and validate user role permissions           |
| `taragent/src/site-renderer.ts`             | 150       | Edge template engine — render HTML from DESIGN.md + data          |
| `tarapp/src/lib/design-tokens.ts`           | 60        | Apply DESIGN.md tokens as React Native styles                     |
| `tarapp/src/lib/layout-engine.ts`           | 80        | Read ui_hints → arrange component tree                            |
| `tarapp/src/components/WorkspaceCanvas.tsx` | 200       | Component registry + layout renderer                              |
| `tarapp/src/components/registry/*.tsx`      | 300       | Pre-built components (11 types)                                   |
| `taragent/src/site-templates/*.html`        | 200       | ~8 shared HTML templates + 3 vanilla JS widgets                   |
| **Total**                                   | **~1280** |                                                                   |

### Code to Modify

| File                             | Change                                             |
| -------------------------------- | -------------------------------------------------- |
| `taragent/src/app.ts`            | Accept `modules[]`, compose from specs             |
| `tarapp/src/app/workspace.tsx`   | Replace static layout with WorkspaceCanvas         |
| `tarapp/src/lib/skills-cache.ts` | Parse ui_hints alongside actions                   |
| `tarapp/src/app/onboarding/`     | Preset cards + module picker + "describe business" |

---

## 9. Phases

### Phase 1: Module Specs (~2 hours)

- [x] Add `ui_hints` + `site_pages` YAML to all 14 core SKILL.md files
- [x] Create `config/presets.yaml`

### Phase 2: Design Token Runtime (~1 day)

- [x] `tarapp/src/lib/design-tokens.ts`
- [x] `tarapp/src/hooks/useDesignTokens.ts`
- [x] Wire into workspace provider

### Phase 3: Gen UI Canvas (~2 days)

- [x] `tarapp/src/components/registry/*.tsx` — 11 component types
- [x] `tarapp/src/components/WorkspaceCanvas.tsx`
- [x] `tarapp/src/lib/layout-engine.ts`

### Phase 4: Backend Composer (~1.5 days)

- [x] `taragent/src/lib/module-composer.ts`
- [x] `taragent/src/lib/design-md-parser.ts`
- [x] `taragent/src/lib/schema-validator.ts` (Zod schemas for specs validation)
- [x] Update `POST /workspaces/create` (accept modules[], compose, generate, validate with Zod)
- [x] Update `GET /workspace/{scope}/skills` (return DESIGN.md + ui_hints)

### Phase 5: Edge Site Engine (~3 days)

- [x] `taragent/src/site-renderer.ts` — wildcard route, DESIGN.md → CSS vars, data from Turso
- [x] HTML templates: `hero`, `catalog-grid`, `item-detail`, `cart`, `checkout`, `booking-widget`, `contact`
- [x] Vanilla JS widgets: `cart.js`, `booking.js`, `checkout.js` (~160 lines total)
- [x] `POST /api/order` + `POST /api/booking` endpoints for form submissions
- [x] KV cache for DESIGN.md + site/pages.md (5 min TTL)

### Phase 6: Completion (~1 day)

- [x] Complete remaining core module SKILL.md files
- [x] Test all 6 presets + custom combos
- [x] Test AI-generated custom module flow

**Total: ~9 days**

---

## 10. Cost

| Scale   | Per Workspace (one-time) | Per Workspace/month | Total/month |
| ------- | ------------------------ | ------------------- | ----------- |
| 1       | $0.003                   | $0.016              | $0.016      |
| 100     | $0.30                    | $1.60               | $1.60       |
| 1,000   | $3                       | $16                 | $16         |
| 10,000  | $30                      | $160                | $160        |
| 100,000 | $300                     | $1,600              | $1,600      |

---

## 11. Design Principles Check

| Principle                | ✓ How                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| Zero learning curve      | Tap preset → name → done                                             |
| Direct & straightforward | 1 tap = 1 action, rendered from YAML                                 |
| One-screen-one-task      | Canvas shows only installed module actions                           |
| Minimal taps             | Quick-actions grid: 1 tap to primary action                          |
| Frictionless onboarding  | 3 screens, ~10 seconds                                               |
| Cost-efficient           | $0.003 creation, $0 runtime LLM                                      |
| Data-efficient           | Action index + DESIGN.md cached locally                              |
| Lightweight              | No DOs, no WebSockets, Turso-native client-side replication          |
| Battery-friendly         | No background processes                                              |
| AI-futuristic            | Every layer is .md — any future AI reads it natively                 |
| Adaptive                 | New AI model = same specs, swap LLM endpoint                         |
| Scalable                 | 1 workspace = 1 Turso DB + S3 files. Same at 10M.                    |
| Modular & decoupled      | 1 module = 1 file. Add/remove = add/remove file.                     |
| Plugin-based             | New module = new SKILL.md. No code changes.                          |
| API-first                | Everything is an endpoint                                            |
| Self-healing             | Missing skill? Fall back to core module. Corrupted? Regenerate.      |
| Voice & gesture ready    | Actions have names + params in YAML. Voice → intent → same executor. |

---

## 12. Future-Proofing

| Future Shift             | Adaptation                                                 |
| ------------------------ | ---------------------------------------------------------- |
| Better LLM               | Same .md format, better content                            |
| Local/on-device LLM      | Same parser, different endpoint                            |
| Multimodal (voice/image) | Actions already YAML — voice maps to same intent           |
| AI agents everywhere     | OKF + DESIGN.md = industry standards, any agent reads them |
| AI-generated animations  | Extend DESIGN.md with `animations:` section                |
| Marketplace              | SKILL.md files are portable — publish/install = copy file  |

---

## Summary

```
Module  = a SKILL.md file (the atomic unit)
Core    = 14 maintained modules (standard library)
Custom  = AI writes new SKILL.md from user description
Preset  = UX shortcut ("Restaurant" = list of module names)
AI      = the composer (reads modules → writes workspace)
App     = the renderer (reads specs → Gen UI canvas)
Site    = the public face (1 Worker renders all sites, pure HTML/CSS)
```

**10 things that make this different:**

1. **Open modules** — 14 core + infinite AI-generated + marketplace
2. **Spec-first** — `.md` file IS the feature, not code
3. **Generate once, render forever** — zero LLM at runtime
4. **Industry standards** — OKF, DESIGN.md, SKILL.md
5. **Zero DOs, zero WebSockets** — no compute bloat
6. **Every workspace looks different** — DESIGN.md = unique branding
7. **Every workspace works the same** — component registry = consistency
8. **Composable** — add module = add file, remove = delete file
9. **Portable** — workspace = folder of files, movable anywhere
10. **Maintain 14 files, serve infinite business types**
