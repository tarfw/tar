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

### How AI Picks Modules

AI reads user message → picks relevant modules. No presets needed.

```
User: "I have a restaurant with delivery"
    → AI picks: orders, inventory, bookings, crm, logistics, reports

User: "Pet grooming salon with online booking"
    → AI picks: bookings, crm, orders, reports

User: "Freelance designer"
    → AI picks: crm, projects, expenses, documents
```

### File locations

| Path in S3 | What | When written |
|---|---|---|
| `workspaces/{scope}/skills/*.md` | AI-generated skill files for this business | Written at workspace creation |

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
| Products & Services | Pepsi ₹22, Biryani ₹180 |
| Policies | No returns, free delivery 5km |
| FAQs | "Do you deliver? Yes" |
| Brand Color | "#E85D3B" (if mentioned, or AI suggests) |
| Typography | "Georgia" (if mentioned, or AI suggests) |

### The Flow

```
1. User sends one message describing their business
2. AI extracts: name, type, location, description, hours, products, policies
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
    ✓ Products & Services: 2 items
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
| 5 | AI picks modules based on user message |
| 6 | AI generates SKILL.md files with action steps |
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
  "products": [{ "name": "item", "price": 0, "description": "" }],
  "services": [{ "name": "service", "price": 0, "description": "" }],
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

- **Editing** after creation (change hours, add products/services)
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

> Permissions are **role-based**, not vertical-specific. The workspace owner defines roles + what each role can access. System enforces via scoped Turso tokens.

| Role Level | Turso | S2 | S3 |
|---|---|---|---|
| Worker | Full group token | Create streams, issue tokens | Read/write all |
| Owner | Full scoped token | All workspace streams | Read analytics + memory |
| Staff (configurable) | `data_read` + subset of `data_update`/`data_add` | Write: allowed streams only | — |
| Viewer | `data_read` only | Read: allowed streams only | — |
| External (customer) | None (public endpoint) | Read: delivery GPS only | — |

### How Staff Permissions Work

The owner assigns each team member a **permission set** in `team/members.md`:

```markdown
| Name | Role | Permissions | User ID |
|------|------|-------------|---------|
| Ravanan | owner | full | user_abc123 |
| Priya | staff | data_read, matter:data_update, motion:data_add | user_def456 |
| Kumar | manager | data_read, matter:data_update, matter:data_delete | user_ghi789 |
| Driver 1 | driver | data_read (assigned order), s2:write (gps) | user_jkl012 |
```

> `owner` always gets `full`. Other roles get explicit permission lists. System generates scoped Turso tokens + S2 stream permissions from this.

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
    SiteLayout JSON (list of sections)
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
| `SECTIONS.json` | Section types + layout variants + CSS override schema | S3 |

> **Site** = vanilla HTML/JS/CSS. Uses `SECTIONS.json` → HTML templates.
> **tarapp** = React Native. Uses its own RN components (not from S3).

### Two Layers: Sections + CSS Overrides

The system has two layers. Sections are the **base**. CSS overrides are the **customization**. Together they achieve Webflow-level flexibility.

```
Layer 1: Section Type + Layout    →  Base structure (fast, safe, guaranteed quality)
Layer 2: CSS Overrides            →  Custom positioning, spacing, sizing (unlimited freedom)
```

**Why two layers?**
- Sections alone = template engine (limited)
- CSS overrides alone = Webflow (complex, risk of bad design)
- Together = fast base + unlimited customization = best of both

### SECTIONS.json — Composable Section System

Sections are not rigid types. Each section has **layout variants** and accepts **nested children**. The AI Planner composes layouts from these building blocks.

#### Section Types

```json
{
  "sections": [
    {
      "type": "hero_banner",
      "props": ["title", "subtitle", "image", "cta"],
      "layouts": ["centered", "left-aligned", "split", "full-bleed"]
    },
    {
      "type": "content_grid",
      "props": ["items"],
      "layouts": ["1-col", "2-col", "3-col", "4-col", "sidebar-left", "sidebar-right"],
      "children": true
    },
    {
      "type": "product_grid",
      "props": ["items", "columns"],
      "layouts": ["2-col", "3-col", "4-col", "carousel"]
    },
    {
      "type": "service_list",
      "props": ["items", "layout"],
      "layouts": ["cards", "list", "compact", "featured"]
    },
    {
      "type": "text_block",
      "props": ["heading", "body", "image"],
      "layouts": ["text-only", "text-left-image-right", "text-right-image-left", "image-top"]
    },
    {
      "type": "testimonial",
      "props": ["quotes", "style"],
      "layouts": ["single", "carousel", "grid", "masonry"]
    },
    {
      "type": "cta_button",
      "props": ["label", "url", "style"],
      "layouts": ["centered", "left", "right", "full-width"]
    },
    {
      "type": "contact_form",
      "props": ["fields", "submit_label"],
      "layouts": ["centered", "split", "inline"]
    },
    {
      "type": "map_embed",
      "props": ["address", "zoom"],
      "layouts": ["full-width", "split", "corner"]
    },
    {
      "type": "faq_accordion",
      "props": ["items"],
      "layouts": ["single-column", "two-column", "grouped"]
    },
    {
      "type": "gallery",
      "props": ["images", "layout"],
      "layouts": ["grid", "masonry", "carousel", "single-row"]
    },
    {
      "type": "pricing_table",
      "props": ["plans", "highlight"],
      "layouts": ["2-col", "3-col", "comparison", "simple-list"]
    },
    {
      "type": "team_grid",
      "props": ["members"],
      "layouts": ["grid", "list", "cards"]
    },
    {
      "type": "footer",
      "props": ["links", "social", "contact"],
      "layouts": ["simple", "multi-column", "minimal"]
    }
  ]
}
```

#### How Layout Variants Work

Each section type has multiple layout variants. The AI Planner picks the right variant based on user request + content.

```
User: "Make it two columns with image on the left"
  → content_grid + layout: "2-col"
  → Or text_block + layout: "text-right-image-left"

User: "Follow this design from site X"
  → AI screenshots/fetches site X
  → AI decomposes into section types + layouts
  → Recreates using our vocabulary

User: "Simple pricing with 3 plans"
  → pricing_table + layout: "3-col"
```

#### Reference-Based Design ("Follow this site")

When user provides a URL or screenshot:

```
1. AI fetches/screenshots the reference site
2. AI decomposes into our section vocabulary:
   - "hero with background image" → hero_banner + full-bleed
   - "3-column features" → content_grid + 3-col
   - "pricing table" → pricing_table + 3-col
   - "testimonials carousel" → testimonial + carousel
3. AI maps their content → our section props
4. Generates SiteLayout JSON using our sections + layouts
5. Applies workspace brand.md colors/fonts
```

#### Nested Children

Sections with `"children": true` can contain other sections inside them:

```json
{
  "id": "split-hero",
  "type": "content_grid",
  "props": { "layout": "2-col" },
  "children": [
    {
      "id": "left-col",
      "type": "text_block",
      "props": { "heading": "Paws & Co", "body": "Premium pet grooming" }
    },
    {
      "id": "right-col",
      "type": "gallery",
      "props": { "images": ["img1.jpg", "img2.jpg"], "layout": "single-row" }
    }
  ]
}
```

#### CSS Overrides — Webflow-Level Control

Every section and every child accepts an optional `css` object. These map directly to CSS properties. The AI Planner uses them when the user requests specific layouts beyond what section variants offer.

```json
{
  "css": {
    "display": "grid" | "flex" | "block",
    "gridTemplateColumns": "1fr 2fr" | "repeat(3, 1fr)" | "200px 1fr",
    "gridTemplateRows": "auto",
    "gridGap": "16px",
    "flexDirection": "row" | "column",
    "flexWrap": "wrap" | "nowrap",
    "justifyContent": "center" | "space-between" | "flex-end",
    "alignItems": "center" | "stretch" | "flex-start",
    "width": "100%" | "50%" | "600px",
    "maxWidth": "1200px",
    "height": "auto" | "400px" | "80vh",
    "padding": "24px" | "24px 48px",
    "margin": "0 auto" | "48px 0",
    "position": "relative" | "absolute" | "sticky",
    "top": "0",
    "right": "0",
    "zIndex": "10",
    "backgroundColor": "#ffffff",
    "color": "#333333",
    "fontSize": "16px",
    "fontWeight": "400",
    "lineHeight": "1.5",
    "textAlign": "left" | "center" | "right",
    "borderRadius": "12px",
    "border": "1px solid #eee",
    "boxShadow": "0 4px 12px rgba(0,0,0,0.1)",
    "opacity": "0.8",
    "overflow": "hidden",
    "gap": "24px"
  }
}
```

#### Responsive Breakpoints

Every section and css override supports responsive overrides via `responsive`:

```json
{
  "type": "content_grid",
  "layout": "2-col",
  "css": {
    "gridTemplateColumns": "1fr 1fr",
    "gridGap": "32px"
  },
  "responsive": {
    "mobile": {
      "css": {
        "gridTemplateColumns": "1fr",
        "gridGap": "16px"
      }
    },
    "tablet": {
      "css": {
        "gridTemplateColumns": "1fr 1fr",
        "gridGap": "24px"
      }
    }
  }
}
```

> Breakpoints: `mobile` (< 768px), `tablet` (768px - 1024px), `desktop` (> 1024px). Only override what changes — rest inherits from base `css`.

#### How AI Uses CSS Overrides

| User says | Section + Layout | CSS Override |
|-----------|-----------------|--------------|
| "Two columns, left narrower" | `content_grid` + `2-col` | `gridTemplateColumns: "1fr 2fr"` |
| "Hero full height" | `hero_banner` + `full-bleed` | `height: "100vh"` |
| "Sticky navigation" | `footer` (used as nav) | `position: "sticky"`, `top: "0"`, `zIndex: "100"` |
| "Center everything" | any section | `display: "flex"`, `justifyContent: "center"`, `alignItems: "center"` |
| "Card with shadow" | `product_grid` item | `boxShadow: "0 4px 12px rgba(0,0,0,0.1)"`, `borderRadius: "12px"` |
| "Overlap sections" | any section | `position: "relative"`, child `position: "absolute"`, `top: "-48px"`, `zIndex: "10"` |
| "Full bleed image" | `gallery` | `width: "100vw"`, `maxWidth: "none"`, `overflow: "hidden"` |
| "Sidebar 300px, content fills" | `content_grid` | `gridTemplateColumns: "300px 1fr"` |

#### Full Example: Webflow-Level Layout

```json
{
  "id": "custom-hero",
  "type": "hero_banner",
  "layout": "full-bleed",
  "css": {
    "height": "100vh",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "position": "relative",
    "overflow": "hidden"
  },
  "props": {
    "title": "Paws & Co",
    "image": "hero-bg.jpg"
  },
  "children": [
    {
      "id": "hero-overlay",
      "type": "text_block",
      "css": {
        "position": "absolute",
        "top": "0",
        "left": "0",
        "width": "100%",
        "height": "100%",
        "backgroundColor": "rgba(0,0,0,0.4)",
        "zIndex": "1"
      }
    },
    {
      "id": "hero-content",
      "type": "text_block",
      "css": {
        "position": "relative",
        "zIndex": "2",
        "textAlign": "center",
        "color": "#ffffff",
        "maxWidth": "600px"
      },
      "props": {
        "heading": "Premium Pet Grooming",
        "body": "Bangalore's trusted pet care since 2020"
      }
    }
  ],
  "responsive": {
    "mobile": {
      "css": { "height": "70vh" },
      "children": {
        "hero-content": {
          "css": { "padding": "0 16px", "fontSize": "14px" }
        }
      }
    }
  }
}
```

#### Anti-Slop on CSS Overrides

CSS overrides go through the same anti-slop check:

| Rule | Check | Action |
|------|-------|--------|
| No `position: fixed` | Prevents sticky elements that break mobile | Error → remove |
| `zIndex` max 100 | Prevents z-index wars | Error → clamp to 100 |
| No `!important` | Prevents override conflicts | Error → remove |
| `height` max 100vh | Prevents invisible sections | Error → clamp |
| `opacity` min 0.3 | Prevents unreadable text | Error → clamp |
| Grid columns max 4 | Prevents unreadable layouts | Error → reduce |

#### Renderer → HTML Mapping

| Section Type | HTML Output |
|---|---|
| `hero_banner` | `<header class="hero">` with background image + overlay |
| `content_grid` | `<div class="grid grid-{cols}">` with nested children |
| `product_grid` | `<div class="product-grid">` with `<article>` per item |
| `service_list` | `<div class="service-{layout}">` cards or list items |
| `text_block` | `<section class="text-{layout}">` with optional `<img>` |
| `testimonial` | `<div class="testimonial-{layout}">` quotes |
| `cta_button` | `<a class="cta-{layout}">` styled button |
| `contact_form` | `<form>` with input fields |
| `map_embed` | `<iframe>` Google/OSM map |
| `faq_accordion` | `<details>/<summary>` or JS accordion |
| `gallery` | `<div class="gallery-{layout}">` with `<figure>` |
| `pricing_table` | `<div class="pricing-{layout}">` plan cards |
| `team_grid` | `<div class="team-{layout}">` member cards |
| `footer` | `<footer>` with link columns |

> Each section type maps to an HTML element. CSS overrides are applied as inline `style` attributes or generated CSS classes. Responsive overrides generate `@media` queries.

### Workspace Data (from AI extraction)

| Field | Example | Source |
|-------|---------|--------|
| Business Name | "Ravanan's Restaurant" | User message |
| Business Type | "restaurant" | User message |
| Location | "Chennai" | User message |
| Description | "South Indian food" | User message |
| Opening Hours | "10am-10pm" | User message |
| Products & Services | "Pepsi ₹22, Biryani ₹180" | User message |
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
│   └── catalog.md
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

**products/catalog.md:**
```markdown
# Products & Services

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
| Priya | staff | user_def456 |
| Kumar | manager | user_ghi789 |
| Driver 1 | driver | user_jkl012 |
```

> Roles are **workspace-defined** — the owner names them during setup. Examples: `owner`, `staff`, `manager`, `driver`, `stylist`, `trainer`, `doctor`, `designer`. Maps to token permissions (see §7).

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

> Skills are AI-generated SKILL.md files. AI reads core-modules.ts for action definitions, generates steps tailored to this business.

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
        {
          "id": "hero",
          "type": "hero_banner",
          "layout": "full-bleed",
          "css": { "height": "100vh", "display": "flex", "alignItems": "center" },
          "props": {
            "title": "Ravanan's Restaurant",
            "subtitle": "South Indian food in Chennai",
            "image": "hero.jpg",
            "cta": { "label": "Order Now", "url": "/menu" }
          },
          "responsive": {
            "mobile": { "css": { "height": "70vh" } }
          }
        },
        {
          "id": "about",
          "type": "content_grid",
          "layout": "2-col",
          "css": { "gridTemplateColumns": "1fr 2fr", "gridGap": "48px", "padding": "80px 0" },
          "children": [
            {
              "id": "about-text",
              "type": "text_block",
              "layout": "text-only",
              "props": { "heading": "About Us", "body": "Authentic South Indian since 2020" }
            },
            {
              "id": "about-hours",
              "type": "text_block",
              "layout": "text-only",
              "props": { "heading": "Hours", "body": "10am - 10pm, all days" }
            }
          ],
          "responsive": {
            "mobile": { "css": { "gridTemplateColumns": "1fr", "gridGap": "24px" } }
          }
        },
        {
          "id": "menu",
          "type": "product_grid",
          "layout": "3-col",
          "css": { "gridGap": "24px", "padding": "64px 0" },
          "props": { "items": ["Biryani ₹180", "Pepsi ₹22"], "columns": 3 },
          "responsive": {
            "mobile": { "css": { "gridTemplateColumns": "1fr 1fr" } }
          }
        },
        {
          "id": "reviews",
          "type": "testimonial",
          "layout": "carousel",
          "props": { "quotes": ["Great food!"] }
        },
        {
          "id": "map",
          "type": "map_embed",
          "layout": "full-width",
          "css": { "width": "100vw", "maxWidth": "none", "height": "400px" },
          "props": { "address": "Chennai", "zoom": 14 }
        },
        {
          "id": "contact",
          "type": "contact_form",
          "layout": "centered",
          "css": { "maxWidth": "600px", "margin": "0 auto", "padding": "80px 16px" },
          "props": { "fields": ["name", "phone", "message"], "submit_label": "Send" }
        },
        {
          "id": "footer",
          "type": "footer",
          "layout": "multi-column",
          "css": { "backgroundColor": "#1B2A33", "color": "#ffffff", "padding": "48px 0" },
          "props": { "links": ["/menu", "/about", "/contact"], "social": ["instagram"] }
        }
      ]
    }
  ]
}
```

> Layout JSON = page structure with section types, layout variants, CSS overrides, responsive breakpoints, and nested children. AI Planner generates this, cached in S3/KV. Renderer maps each node → HTML element + inline styles + `@media` queries.

### Anti-Slop — Two Tiers

| Tier | Severity | Rules | Action |
|------|----------|-------|--------|
| **Hard slop** | `error` | emoji in headings, >2 CTA, placeholder text, cliché headlines, excessive gradients, deep shadows, heavy symmetry, generic border-radius | **Regenerate** |
| **Soft/aesthetic** | `warning` | minor spacing, font weight variance, color palette width | **Log only** |

> `error` → regenerate. `warning` → never blocks (log for future visual critic).

### Rule-Critic Limitation (v1)

The rule-critic checks the **JSON output**, not the rendered HTML/CSS. This means:

- **Hard slop rules** (emoji, CTA count, placeholder text, gradient count, shadow depth, symmetry) — caught from JSON ✓
- **Soft-aesthetic rules** (minor spacing, font weight) — NOT caught from JSON ✗

Soft-aesthetic issues only exist post-render. For v1, accept this limitation. Future: add a visual critic that screenshots the rendered site and checks for aesthetic issues.

### AI Planner

- **Model**: Z.AI GLM-4.7-Flash (free, thinking enabled)
- **Temperature**: 0.2 (structured JSON output)
- **Output**: SiteLayout JSON — sections with type, layout variant, props, and optional nested children
- **Reference handling**: If user provides a URL/screenshot, AI decomposes it into our section vocabulary + layouts

```
Universal Rules + Workspace Data + Turso DB + (optional reference) → AI → SiteLayout JSON → HTML/CSS
```

### Renderer

- Input: SiteLayout JSON (sections + layout variants + CSS overrides + responsive breakpoints + nested children)
- Maps section type + layout → HTML template (e.g., `hero_banner` + `split` → split hero HTML)
- Recursively renders children for sections with `"children": true`
- Applies `css` object → inline `style` attributes or generated CSS classes
- Applies `responsive` object → `@media` queries per breakpoint (mobile/tablet/desktop)
- Applies CSS variables from design.md (full token set)
- Anti-slop checks CSS overrides (no `position: fixed`, zIndex max 100, etc.)
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
- [ ] `siteskills/universal/SECTIONS.json` — Section types + layout variants (composable vocabulary)
- [ ] `taragent/src/gen-ui/design-loader.ts` — Merges universal + workspace overrides
- [ ] `taragent/src/gen-ui/rule-critic.ts` — Anti-slop check (error → regenerate, warning → log)
- [ ] `taragent/src/gen-ui/planner.ts` — Update to Z.AI GLM-4.7-Flash, temp 0.2
- [ ] `taragent/src/gen-ui/renderer.ts` — Section list → HTML templates + CSS vars
- [ ] `taragent/src/lib/extract-business.ts` — AI extracts business info from user message
- [ ] OKF folder scaffolder — Create folder structure + index.md per folder
- [ ] OKF content generator — Generate profile.md, catalog.md, members.md, etc.

### Delete

- [ ] `src/skills/` (14 SKILL.md folders) — AI generates SKILL.md at workspace creation

### Backend (`taragent`)

- [ ] `src/cloudflare.ts` — Remove `WorkspaceDO`, `OrderDO`. Strip storage from `EditorDO`
- [ ] `src/app.ts`
  - `POST /tools/execute` — Read `.md` from S3, parse, run steps against Turso
  - `POST /workspaces/create` — Turso DB + AI personalize templates + S3 write + S2 streams + D1 register
  - `GET /workspace/{scope}/skills` — Return parsed action index for app cache
  - `POST /workspace/{scope}/customize` — AI read + edit skill `.md` in S3
- [ ] `src/lib/okf.ts` — Add `readWorkspaceFile(scope, path)`: read from workspace S3
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

- [ ] None — AI generates all SKILL.md files at workspace creation
