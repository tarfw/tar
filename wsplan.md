# TAR Workspace System — End-to-End Plan

> Every workspace = Turso DB (mutable state) + `.md` skill files in S3 (the program) + S2 streams (immutable events) + S3 Parquet (archive). No DOs except a stateless Editor for WebSocket relay.

---

## 1. Architecture

| Layer | Tech | Holds |
|---|---|---|
| Mutable state | Turso `ws-{subdomain}` | Products, stock, active orders, settings |
| Skill files | S3 `workspaces/{scope}/*.md` | Action definitions the AI and app execute |
| **Site design** | **S3 `siteskills/`** | **Universal design rules + workspace overrides** |
| **Site content** | **S3 `workspaces/{scope}/site/`** | **brand.md, design.md, layouts/*.json** |
| Event streams | S2.dev | Completed sales, GPS, kitchen tickets, motion |
| Archive | S3 `{scope}/analytics/*.parquet` | Historical data queried on-device (DuckDB WASM) |
| Vectors | S3 `{scope}/memory/` | LanceDB indexes queried on-device |
| Registry | D1 | Workspace list, channels, tokens, cron checkpoints |
| Global | Turso `g:global` | User profiles, catalog metadata |
| Relay | Stateless Editor DO | WebSocket relay for live preview (no storage) |

---

## 2. Skill System

**One `.md` file per module in S3 = the program.** It contains intent matching, action definitions (tool-call steps), and business-specific config. Same file used by app, channel agents, and AI customization.

### 14 Modules

Orders · Inventory · Bookings · CRM · Logistics · Projects · HR · LMS · Listings · Support · Reports · Expenses · Documents · Team Chat

### 6 Verticals (module combos)

| Vertical | Modules |
|---|---|
| Restaurant | Orders, Inventory, Bookings, CRM, Reports, Expenses, Documents |
| Salon | Bookings, CRM, Orders, Reports, Expenses, Documents |
| Clinic | Bookings, CRM, Projects, Support, Reports, Expenses, Documents |
| Retail | Orders, Inventory, CRM, Reports, Expenses, Documents |
| Gym | Bookings, CRM, LMS, HR, Reports, Expenses, Documents |
| Agency | CRM, Projects, HR, Support, Reports, Expenses, Documents |

### File locations

| Path in S3 | What | When written |
|---|---|---|
| `verticals/{type}/modules/*/SKILL.md` | Golden templates (generic) | Authored once by us, updated as platform evolves |
| `workspaces/{scope}/skills/*.md` | AI-personalized skills for this business | Written at workspace creation |

---

## 3. Workspace Creation — AI Way

**One message. AI extracts everything. No forms.**

### How It Works

```
User: "I have a restaurant called Ravanan's in Chennai. 
       We serve South Indian food. Open 10am-10pm. 
       Menu has Pepsi ₹22, Biryani ₹180. 
       No returns, free delivery within 5km."

AI extracts → System creates workspace → Site goes live
```

### What AI Extracts from One Message

| Field | Extracted |
|-------|-----------|
| Business Name | "Ravanan's Restaurant" |
| Business Type | "restaurant" |
| Location | "Chennai" |
| Description | "South Indian food" |
| Opening Hours | "10am-10pm" |
| Menu Items | Pepsi ₹22, Biryani ₹180 |
| Policies | No returns, free delivery 5km |
| FAQs | "Do you deliver? Yes" |
| Brand Color | "#E85D3B" (if mentioned, or AI suggests) |
| Typography | "Georgia" (if mentioned, or AI suggests) |

### The Flow

```
1. User sends one message describing their business
2. AI extracts: name, type, location, description, hours, menu, policies
3. AI asks 1-2 follow-up questions if needed (color, logo)
4. System creates everything automatically
```

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

### What Happens Behind the Scenes

| # | Action |
|---|--------|
| 1 | User sends message |
| 2 | AI extracts structured data from message |
| 3 | Create Turso DB `ws-{subdomain}`, run schema DDL |
| 4 | Save extracted data to Turso DB |
| 5 | Read golden templates from `verticals/{type}/` in S3 |
| 6 | AI personalizes templates (inject name, location, menu) |
| 7 | Write personalized `.md` files to `workspaces/{scope}/` in S3 |
| 8 | Auto-generate OKF bundle from extracted data |
| 9 | Auto-generate brand.md (colors, fonts) |
| 10 | Create S2 streams, issue tokens, register in D1 |
| 11 | Return workspace config to app |
| 12 | App creates local SQLite replica, caches skill index |

**Cost: 1 LLM call (~$0.001) + S3 writes (free) + 1 Turso DB ($0)**

### AI Extraction Code

```typescript
async function extractBusinessInfo(message: string, env: any) {
  const prompt = `Extract business information from this message:

"${message}"

Return JSON:
{
  "name": "business name",
  "type": "restaurant|salon|clinic|retail|gym|agency",
  "location": "city/area",
  "description": "what the business does",
  "hours": "opening hours",
  "menu": [{ "name": "item", "price": 0, "description": "" }],
  "policies": { "return": "", "delivery": "" },
  "faqs": [{ "q": "", "a": "" }],
  "brand_color": "#hex or null",
  "typography": { "heading": "font name or null", "body": "font name or null" }
}`;

  const response = await callLLM(prompt, env);
  return JSON.parse(response);
}
```

### Why This Is Better Than Forms

| Forms | AI Way |
|-------|--------|
| Multiple screens | One message |
| User fills fields | User describes naturally |
| User must know what to fill | AI extracts what's there |
| Boring, tedious | Fast, conversational |
| Error-prone (missing fields) | AI asks follow-ups |

### When Forms Are Still Useful

- **Editing** after creation (change hours, add menu items)
- **Settings** (brand color, logo upload)
- **Advanced** (custom domains, API keys)

But **initial creation** = one message = AI extracts everything.

---

## 4. Runtime — How Actions Execute

### Path A: App (Direct API)

User taps action button → app already knows action name + params (cached from skill index) → `POST /tools/execute` → Worker reads `.md` from S3 → `skill-parser` extracts steps → executor runs steps against Turso → result returned to app.

### Path B: Channel Agent (Telegram / Slack / WhatsApp)

User types message → channel handler sends to Worker → Worker reads skill files → cheap LLM matches intent to action → **same executor, same steps, same Turso queries** → result returned to channel.

### Path C: User Customization (via Chat, after creation)

| User says | What happens |
|---|---|
| *"Add delivery module"* | AI reads logistics template, personalizes, writes `logistics.md` to workspace S3 folder |
| *"Add loyalty points to sales"* | AI edits `orders.md` — appends a step to `action_record_sale` |
| *"Change tax rate to 12%"* | AI edits config section in `orders.md` |
| *"Remove bookings"* | AI deletes `bookings.md`, updates `index.md` |

All customization = `.md` file edits in S3. No migrations. No redeployments.

---

## 5. Write Paths

### Mutable → Turso

| Write | How |
|---|---|
| Stock deduction (sale) | Worker atomic SQL: `UPDATE matter SET qty = qty - N WHERE qty >= N` |
| Menu item / price edit | Local replica → Turso sync push (debounced 5s) |
| Active order status change | Worker update → Turso |
| Draft edits (typing, layout) | Local-only `p:` DB → Turso only on Save/Publish |

### Immutable → S2.dev (device writes directly, Worker not involved)

| Event | S2 Stream |
|---|---|
| Bill closed / payment | `ws/{id}/sales` |
| Kitchen ticket fired | `ws/{id}/kitchen` |
| Order status transition | `ws/{id}/motion` |
| Driver GPS (every 5s) | `drivers/{driverId}` |
| Staff clock-in/out | `ws/{id}/attendance` |
| Stock adjustment delta | `ws/{id}/stock-log` |
| Customer feedback | `ws/{id}/feedback` |

---

## 6. Archival — S2 → S3 Parquet

Daily cron at midnight: tail each S2 stream from last D1 checkpoint → batch → write Parquet to S3.

| S2 Stream | S3 Path | DuckDB use case |
|---|---|---|
| `ws/{id}/sales` | `{id}/analytics/sales/YYYY-MM.parquet` | Revenue by day/item/staff |
| `ws/{id}/kitchen` | `{id}/analytics/kitchen/YYYY-MM.parquet` | Avg ticket time, peak hours |
| `ws/{id}/motion` | `{id}/analytics/orders/YYYY-MM.parquet` | Order lifecycle durations |
| `ws/{id}/stock-log` | `{id}/analytics/stock/YYYY-MM.parquet` | Consumption trends |
| `ws/{id}/attendance` | `{id}/analytics/staff/YYYY-MM.parquet` | Hours worked |
| `drivers/{id}` | `{id}/analytics/delivery/YYYY-MM.parquet` | Route replay |

- S2 retention: 7 days. Parquet in S3: permanent.
- Client queries via DuckDB WASM + HTTP range requests. Zero server cost.

---

## 7. Token Permissions

| Role | Turso | S2 | S3 |
|---|---|---|---|
| Worker | Full group token | Create streams, issue tokens | Read/write all |
| Owner device | Full scoped token | All workspace streams | Read analytics + memory |
| POS / Waiter | `data_read`, `matter:data_update`, `motion:data_add` | Write: sales, kitchen, motion | — |
| Kitchen display | `data_read` only | Read: kitchen | — |
| Driver | `data_read` (assigned order) | Write: own GPS stream | — |
| Customer | None (public endpoint) | Read: driver GPS (delivery window) | — |

---

## 8. Timeline (No inbox DB)

1. App calls `GET /timeline?userId={id}`
2. Worker queries D1 → user's workspace list
3. Fan-out parallel query to each workspace DB: `SELECT * FROM motion WHERE assignee = ? ORDER BY time DESC LIMIT 20`
4. Merge + sort → unified JSON feed
5. Real-time: motion event → WS ping → app refetches

---

## 9. Cost Optimizations

| # | What | Result |
|---|---|---|
| 1 | Draft pattern — edits in local `p:` DB until Save | Zero Turso writes during editing |
| 2 | Debounce — 5s batch before sync push | Fewer write ops billed |
| 3 | Events via S2 — sales/GPS/tickets bypass Turso | Turso write volume halved |
| 4 | Analytics on-device — DuckDB WASM on S3 Parquet | Zero server reads for reports |
| 5 | Vectors on-device — LanceDB on S3 indexes | No Turso bloat for search |
| 6 | GPS via S2 — device→S2 directly | ~$2.19/mo vs ~$72/mo with DO |
| 7 | S3 free — Railway Tigris has no read/write cost | Skills, Parquet, vectors = $0 |
| 8 | Skill caching — app caches parsed action index | S3 reads only on first sync |

---

## 10. Site Generation System

> AI generates website + chatbot from workspace data. Universal design skills + workspace overrides.

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

> **Site** = vanilla HTML/JS/CSS. Uses `SECTIONS.json` → HTML templates.
> **tarapp** = React Native. Uses its own RN components (not from S3).

### Workspace Data (from AI extraction)

| Field | Example | Source |
|-------|---------|--------|
| Business Name | "Ravanan's Restaurant" | User message |
| Business Type | "restaurant" | User message |
| Location | "Chennai" | User message |
| Description | "South Indian food" | User message |
| Opening Hours | "10am-10pm" | User message |
| Menu Items | "Pepsi ₹22, Biryani ₹180" | User message |
| Policies | "No returns, free delivery" | User message |
| FAQs | "Do you deliver? Yes" | User message |
| Brand Color | "#E85D3B" | AI suggestion or user |
| Typography | "Georgia" | AI suggestion or user |

### Workspace Creation — Extended Flow

| # | Action |
|---|--------|
| 1-8 | (Existing workspace creation) |
| 9 | Auto-generate OKF bundle from workspace data |
| 10 | Auto-generate brand.md (colors, fonts) |
| 11 | Store in S3: `workspaces/{scope}/site/` |

### OKF Bundle — What Gets Generated

From extracted workspace data, system auto-generates these markdown files in S3:

```
workspaces/{scope}/
├── index.md
├── business/
│   ├── index.md
│   └── profile.md
├── products/
│   ├── index.md
│   └── menu.md
├── policies/
│   ├── index.md
│   ├── return.md
│   └── delivery.md
├── faqs/
│   ├── index.md
│   └── common.md
├── team/
│   ├── index.md
│   └── members.md
├── skills/
│   ├── index.md
│   ├── orders.md
│   ├── inventory.md
│   └── ...
└── site/
    ├── index.md
    ├── brand.md              ← quick brand tokens (colors, fonts)
    ├── design.md             ← full design system (typography, spacing, components)
    └── layouts/
        └── home.json
```

### OKF File Formats

**Root index.md (OKF standard):**
```markdown
# Ravanan's Restaurant

**Vertical:** restaurant
**Modules:** orders, inventory, bookings, crm, reports, expenses, documents

## Folders
- [business](./business/index.md)
- [products](./products/index.md)
- [policies](./policies/index.md)
- [faqs](./faqs/index.md)
- [team](./team/index.md)
- [skills](./skills/index.md)
- [site](./site/index.md)
```

**business/index.md:**
```markdown
# Business

- [profile](./profile.md)
```

**business/profile.md:**
```markdown
# Business Profile

| Field | Value |
|-------|-------|
| Name | Ravanan's Restaurant |
| Type | Restaurant |
| Location | Chennai |
| Hours | 10am-10pm |
| Description | South Indian food |
```

**products/menu.md:**
```markdown
# Menu Items

| Item | Price | Description |
|------|-------|-------------|
| Pepsi | ₹22 | Cold drink |
| Biryani | ₹180 | Chicken biryani |
```

**policies/return.md:**
```markdown
# Return Policy

No returns on food items.
```

**policies/delivery.md:**
```markdown
# Delivery Policy

Free delivery within 5km.
```

**faqs/common.md:**
```markdown
# FAQs

## Do you deliver?
Yes, free delivery within 5km.
```

**site/brand.md:**
```markdown
---
colors:
  primary: "#E85D3B"
  secondary: "#1B2A33"
fonts:
  heading: Georgia
  body: Inter
---
```

**site/design.md:**
```markdown
---
name: Ravanan's Restaurant
version: 1.0.0
colors:
  primary: "#E85D3B"
  secondary: "#1B2A33"
  tertiary: "#D4A373"
  neutral: "#FEFAE0"
  on-primary: "#FFFFFF"
typography:
  h1: { fontFamily: "Georgia", fontSize: "1.75rem", fontWeight: 700 }
  body: { fontFamily: "Inter", fontSize: "0.938rem", fontWeight: 400 }
rounded: { sm: "6px", md: "12px", lg: "16px" }
spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
components:
  action-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---
```

> `brand.md` = quick tokens for app. `design.md` = full system for site renderer.

**team/members.md:**
```markdown
# Team Members

| Name | Role | User ID |
|------|------|---------|
| Ravanan | owner | user_abc123 |
| Priya | waiter | user_def456 |
| Kumar | kitchen | user_ghi789 |
| Driver 1 | driver | user_jkl012 |
```

> Roles: `owner`, `waiter`, `kitchen`, `driver`, `cashier`. Maps to token permissions (see §7).

**skills/orders.md:**
```markdown
---
name: orders
version: 1.0.0
module: orders
tools: [create, read, update, delete, link]
---

# Orders Skill — Ravanan's Restaurant

## Actions

### action_create_order
Create a new order for a customer.

Steps:
1. `create(table='matter', type='order', title='Order #{auto_id}', data:{items:{items}, total:{total}})`
2. `create(table='motion', type='order', data:{orderId:{id}, status:'pending'})`
3. For each item: `update(table='matter', id={itemId}, qty=currentQty - soldQty)`

### action_record_payment
Record payment for an order.

Steps:
1. `update(table='matter', id={orderId}, data:{payment_method:{method}, payment_status:'paid'})`
2. `create(table='motion', type='sale', data:{orderId:{id}, amount:{total}})`
```

> Skills are AI-personalized versions of golden templates. Injected: business name, tax rate, categories, policies.

**site/layouts/home.json:**
```json
{
  "workspaceId": "ravanans",
  "target": "web",
  "revision": "v1",
  "routes": [
    {
      "path": "/",
      "nodes": [
        { "id": "hero", "type": "hero_banner", "props": { "title": "Ravanan's Restaurant" } },
        { "id": "menu", "type": "product_grid", "props": { "items": ["Biryani ₹180"] } },
        { "id": "cta", "type": "cta_button", "props": { "label": "Order Now" } }
      ]
    }
  ]
}
```

> Layout JSON = page structure (routes + nodes). Generated once by AI Planner, cached in S3/KV. Renderer maps nodes → HTML using SECTIONS.json.

### Anti-Slop — Two Tiers

| Tier | Severity | Rules | Action |
|------|----------|-------|--------|
| **Hard slop** | `error` | emoji in headings, >2 CTA, placeholder text, cliché headlines | **Regenerate** |
| **Soft/aesthetic** | `warning` | gradients, border-radius, shadow depth, symmetry | **Log only** |

> `error` → regenerate. `warning` → never blocks (a branded gradient is not slop).

### Rule-Critic Limitation (v1)

The rule-critic checks the **JSON output**, not the rendered HTML/CSS. This means:

- **Hard slop rules** (emoji, CTA count, placeholder text) — caught from JSON ✓
- **Soft-aesthetic rules** (gradients, shadows, border-radius) — NOT caught from JSON ✗

Soft-aesthetic issues only exist post-render. For v1, accept this limitation. Future: add a visual critic that screenshots the rendered site and checks for aesthetic issues.

### AI Planner

- **Model**: Z.AI GLM-4.7-Flash (free, thinking enabled)
- **Temperature**: 0.2 (structured JSON output)
- **Output**: List of section types from SECTIONS.json

```
Universal Rules + Workspace Data + Turso DB → AI → UIPlan JSON → HTML/CSS
```

### Renderer

- Input: UIPlan JSON (list of sections)
- Maps sections → HTML templates
- Applies CSS variables from design.md (full token set)
- Output: Vanilla HTML/CSS (no React for sites)

### Content Flow

```
User Sends Message → AI Extracts Data → Turso DB → OKF Bundle → Site + Chatbot
```

### Files to Create

| # | File |
|---|------|
| 1 | `siteskills/universal/DESIGN-UNIVERSAL.md` |
| 2 | `siteskills/universal/ANTI-SLOP.json` |
| 3 | `siteskills/universal/SECTIONS.json` |
| 4 | `taragent/src/gen-ui/design-loader.ts` |
| 5 | `taragent/src/gen-ui/rule-critic.ts` |
| 6 | Update `planner.ts` (Z.AI, temp 0.2) |
| 7 | `taragent/src/gen-ui/renderer.ts` |
| 8 | `taragent/src/lib/extract-business.ts` |
| 9 | OKF folder scaffolder |
| 10 | OKF content generator |

---

## 11. Implementation Checklist

### Site Generation (NEW)

- [ ] `siteskills/universal/DESIGN-UNIVERSAL.md` — Base rules, typography, layout
- [ ] `siteskills/universal/ANTI-SLOP.json` — Anti-slop rules (two-tier)
- [ ] `siteskills/universal/SECTIONS.json` — Available section types (site uses this)
- [ ] `taragent/src/gen-ui/design-loader.ts` — Merges universal + workspace overrides
- [ ] `taragent/src/gen-ui/rule-critic.ts` — Anti-slop check (error → regenerate, warning → log)
- [ ] `taragent/src/gen-ui/planner.ts` — Update to Z.AI GLM-4.7-Flash, temp 0.2
- [ ] `taragent/src/gen-ui/renderer.ts` — Section list → HTML templates + CSS vars
- [ ] `taragent/src/lib/extract-business.ts` — AI extracts business info from user message
- [ ] OKF folder scaffolder — Create folder structure + index.md per folder
- [ ] OKF content generator — Generate profile.md, menu.md, members.md, etc.

### Delete

- [ ] `src/skills/` (14 SKILL.md folders) — replaced by `verticals/` in S3
- [ ] `src/modules/seed.ts` — replaced by 5-line vertical→module map
- [ ] `src/marketplace/seed.ts` — marketplace = browsing `verticals/` in S3

### Backend (`taragent`)

- [ ] `src/cloudflare.ts` — Remove `WorkspaceDO`, `OrderDO`. Strip storage from `EditorDO`
- [ ] `src/app.ts`
  - `POST /tools/execute` — Read `.md` from S3, parse, run steps against Turso
  - `POST /workspaces/create` — Turso DB + AI personalize templates + S3 write + S2 streams + D1 register
  - `GET /workspace/{scope}/skills` — Return parsed action index for app cache
  - `POST /workspace/{scope}/customize` — AI read + edit skill `.md` in S3
- [ ] `src/lib/okf.ts` — Add `readWithFallback(scope, path, vertical)`: try workspace, fall back to vertical
- [ ] `src/lib/action-executor.ts` — Remove DO routing. Route all through Turso
- [ ] `src/lib/workspace-db.ts` — Turso DB provisioning, group management, scoped tokens
- [ ] `wrangler.jsonc` — Remove `WORKSPACE` + `ORDER` DO bindings. Keep `EDITOR`. Add `TURSO_GROUP_TOKEN`
- [ ] `src/index.ts` — Cron: expired checkouts (every min), S2→Parquet archival (daily)

### Client (`tarapp`)

- [ ] `src/lib/db.ts` — `getWorkspaceDb()` via `createSyncDbConnection` with scoped token
- [ ] `src/lib/skills-cache.ts` (new) — Fetch + cache action index from Worker
- [ ] `src/lib/s2-client.ts` (new) — Direct S2 stream writes (sales, kitchen, GPS)
- [ ] `src/lib/offline-queue.ts` — Point queued ops to `POST /tools/execute`
- [ ] `src/app/onboarding/` (new) — 2-screen onboarding: pick type → name business → create
- [ ] `src/app/(tabs)/home.tsx` — `GET /timeline` fetch
- [ ] `src/app/workspace.tsx` — Local replica reads + action buttons from cached skill index

### S3 Content (Railway)

- [ ] Author golden templates for all 6 verticals: `verticals/{type}/*.md`
