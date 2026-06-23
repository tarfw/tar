# Storefront — Complete End-to-End Plan

---

## 1. Overview

| Concept | Detail |
|---------|--------|
| **What** | Each store entity gets an AI-generated storefront website |
| **Where designed** | Phone app (AI chat + config) |
| **Where previewed** | Web browser (`{store}.tarai.space`) |
| **AI Model** | MiMo v2.5 |
| **Cost per store** | ₹0.02 (generation) + ₹0.05 (lifetime with edits) |
| **Rendering** | CF Worker renders layout JSON → server-side HTML |

---

## 2. Architecture

```
Phone (tarai app)                     Web (browser)
┌────────────────────┐               ┌─────────────────────────┐
│ Store entity        │               │ {store}.tarai.space     │
│                     │               │                         │
│ ┌───────────────┐   │   ┌──────┐   │ ┌───────────────────┐   │
│ │ AI Chat Bar   │───┼──>│  DO  │<──┼─│ Published Page    │   │
│ │ "make it dark"│   │   │      │   │ │ (customers see)   │   │
│ └───────────────┘   │   └──────┘   │ └───────────────────┘   │
│                     │       │      │                         │
│ [Preview] [Publish] │       │      │ /preview (owner only)   │
└────────────────────┘       │      │ (draft, auto-refreshes) │
                              │      └─────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ KV Cache (5min)  │
                    └──────────────────┘
```

---

## 3. Data Model

| Table | Row Type | Stores |
|-------|----------|--------|
| `form` | `type=store` | Store profile (name, subdomain, theme) |
| `matter` | `type=storefront_draft` | Draft layout JSON (AI edits this) |
| `matter` | `type=storefront_published` | Published layout JSON (customers see this) |
| `matter` | `type=stock` | Product stock per store |
| `form` | `type=product` | Product catalog |
| `bond` | `type=storefront_of` | Links layout → store |
| `bond` | `type=belongs_to` | Links product → store |

**Draft vs Published:**

| Version | Who Sees | When Updates |
|---------|----------|-------------|
| Draft | Owner (preview URL) | Real-time as AI edits |
| Published | Customers (live URL) | Only on "Publish" tap |

---

## 4. Phone — Storefront Tab (entity.tsx)

When `row.type === 'store'`, add a 3rd tab:

| Tab | Content |
|-----|---------|
| Items | Stock list (existing) |
| Transactions | Txn list (existing) |
| **Storefront** | AI chat + section config + publish controls |

**Storefront tab UI:**

| Element | Purpose |
|---------|---------|
| AI chat bar | "make it dark", "add testimonials", "change hero" |
| Section list | Current sections, reorder, delete |
| Theme picker | Primary color, background, font |
| **"Preview in Browser"** button | Opens `/preview` (draft, auto-refreshes) |
| **"Publish"** button | Copies draft → published, invalidates KV cache |

**No native preview on phone.** Browser is the preview.

---

## 5. Web — Public Storefront

| URL | Shows | Who |
|-----|-------|-----|
| `{store}.tarai.space` | Published (static) | Customers |
| `{store}.tarai.space/preview` | Draft (live-updates) | Owner (auth required) |

**Request flow:**

```
Customer hits {store}.tarai.space
        │
        ▼
KV Cache check ── HIT ──► Serve cached HTML (0ms)
        │ MISS
        ▼
Wake DO → fetch layout + products
        │
        ▼
CF Worker renders HTML from layout JSON
        │
        ▼
Write to KV (5min TTL) → Serve HTML
```

| Request Type | Hits DO? | Latency |
|-------------|----------|---------|
| 95% (KV hit) | No | ~10ms |
| 5% (KV miss) | Yes | ~100ms |

---

## 6. AI Generation System

**AI never generates HTML.** It generates **layout JSON** referencing pre-built components.

**Token cost per store:**

| Part | Tokens |
|------|--------|
| System prompt (cached) | ~800 |
| User message | ~80 |
| AI response (JSON) | ~300 |
| **Total** | **~1,180** |

**Cost (MiMo v2.5, INR):**

| | Tokens | Rate | Cost |
|--|--------|------|------|
| Input | 880 | ₹12/1M | ₹0.0106 |
| Output | 300 | ₹24/1M | ₹0.0072 |
| **Total per store** | **1,180** | | **₹0.02** |

**Lifetime per store (with 4 edits):** ₹0.05

---

## 7. Component Library (Pre-Built)

| Component | Status | Source |
|-----------|--------|--------|
| `announcement_bar` | Built | Kith replica |
| `header` | Built | Kith replica |
| `hero_carousel` | Built | Kith replica |
| `hero_banner` | Built | Kith replica |
| `section_hero` | Built | Kith replica |
| `lookbook_grid` | Built | Kith replica |
| `product_grid` | Built | Kith replica |
| `product_carousel` | Build next | — |
| `testimonials` | Build next | — |
| `newsletter` | Built | Kith replica |
| `promo_tiles` | Build next | — |
| `category_row` | Build next | — |
| `rich_text` | Build next | — |
| `brand_story` | Build next | — |
| `social_proof` | Build next | — |
| `countdown` | Build next | — |
| `footer` | Built | Kith replica |

**8 components built. 8 more to build.**

---

## 8. Template System (50 Templates)

| Category | Templates | Example Styles |
|----------|-----------|---------------|
| Streetwear | 5 | dark, light, neon, minimal, bold |
| Luxury | 5 | black, gold, marble, editorial, silk |
| Minimal | 5 | white, cream, sage, stone, matte |
| Food & Bev | 5 | coffee, restaurant, bakery, juice, bar |
| Electronics | 5 | tech, gadget, audio, gaming, smart |
| Beauty | 5 | skincare, makeup, organic, spa, clean |
| Fashion | 5 | casual, formal, activewear, kids, vintage |
| Home | 5 | furniture, decor, garden, pet, kitchen |
| Sports | 5 | gym, outdoor, yoga, cycling, athletic |
| Local | 5 | grocery, pharmacy, services, market, clinic |

**Each template:**

```
templates/{name}/
├── template.json      # Section schema + defaults
├── index.html         # HTML skeleton
├── style.css          # Styles
└── thumb.jpg          # Preview image
```

---

## 9. Two Generation Paths

| Path | User Says | AI Generates | Tokens | Cost (INR) |
|------|-----------|-------------|--------|-----------|
| **Template** | "I sell sneakers, make it dark" | JSON config (template + sections) | ~500 | ₹0.01 |
| **Custom** | "Build me a Kith-level site" | Full layout JSON (component arrangement) | ~2,000 | ₹0.04 |

**90% of users use templates. 10% use custom.**

---

## 10. Product Data Source

| Source | What | Used For |
|--------|------|----------|
| **DO (`s:{store}`)** | Live products, stock, pricing | Storefront page, checkout |
| **Turso (`g`)** | Vector embeddings | Marketplace search |
| **KV cache** | Storefront layout + product list | 95% of page loads |

**DO is source of truth.** Turso is for discovery only.

---

## 11. SEO

| Element | How |
|---------|-----|
| HTML rendering | Server-side by CF Worker (not client JS) |
| `<title>` | `{Store Name} — {Tagline}` |
| `<meta description>` | 150-160 chars from store data |
| `JSON-LD` | Organization + Product schema |
| `<link rel="canonical">` | Self-referencing URL |
| `<meta og:image>` | Store logo or hero image |
| Sitemap | Auto-generated from DO products |
| Mobile responsive | 100% |

---

## 12. AI Chatbot (Customer Support)

| Component | Where |
|-----------|-------|
| Chat widget | `<script>` tag in storefront HTML |
| Chat backend | CF Worker (`/api/chat/{store}`) |
| Product context | DO (products, stock, pricing) |
| LLM | MiMo v2.5 via Workers AI |

**Capabilities:**

| Capability | Example |
|-----------|---------|
| Product lookup | "what sodas do you have?" |
| Stock check | "is pepsi available?" |
| Price check | "how much is pepsi?" |
| Order help | "how do I order?" |
| Store info | "what are your hours?" |

---

## 13. Publish Flow

| Step | Action |
|------|--------|
| 1 | Owner designs via AI chat on phone |
| 2 | Layout saved as `storefront_draft` in DO |
| 3 | Owner previews in browser (`/preview`) |
| 4 | Owner taps **"Publish"** |
| 5 | Draft copied to `storefront_published` in DO |
| 6 | KV cache invalidated |
| 7 | Next customer request renders new layout |
| 8 | Published page updates (customers see new design) |

---

## 14. Concurrency & Safety

| Concern | Solution |
|---------|----------|
| Customer sees mid-edit changes | Draft != Published. Customers only see published |
| Concurrent visitors | DO handles sequential reads (~1ms each) |
| DO cold start | KV cache handles 95% of requests |
| DO hibernation | Keep warm with cron ping for active stores |
| Conflict on publish | Version check on matter table |

---

## 15. File Structure

```
tarai/src/
├── app/
│   └── entity.tsx              # Add Storefront tab
├── components/
│   ├── StorefrontTab.tsx       # Phone tab UI
│   ├── StorefrontAIBar.tsx     # AI chat input
│   └── SectionList.tsx         # Section reorder/delete
├── hooks/
│   └── use-storefront.ts       # Load/save layout from matter
├── lib/
│   └── storefront-ai.ts        # AI prompt + JSON generation

storefront/
├── templates/                  # 50 template directories
│   ├── streetwear-dark/
│   ├── luxury-black/
│   ├── minimal-white/
│   └── ...
├── components/                 # Pre-built HTML components
│   ├── announcement_bar/
│   ├── hero_carousel/
│   ├── product_grid/
│   └── ...
└── static/                     # Shared CSS, JS, icons

workers/
├── storefront.ts               # CF Worker: renders storefront
├── storefront-preview.ts       # Serves draft preview
├── storefront-chat.ts          # AI chatbot backend
└── templates/                  # HTML templates for sections
```

---

## 16. Implementation Order

| Step | What | Effort | Depends On |
|------|------|--------|------------|
| 1 | `use-storefront` hook (CRUD layout in matter) | Small | — |
| 2 | Extract Kith replica into 8 components | Medium | — |
| 3 | Build 8 remaining components | Medium | Step 2 |
| 4 | `StorefrontTab` in entity.tsx (section list + config) | Small | Step 1 |
| 5 | `StorefrontAIBar` (AI chat input component) | Small | — |
| 6 | `storefront-ai.ts` (MiMo v2.5 prompt + JSON gen) | Medium | Step 5 |
| 7 | CF Worker: render layout JSON → HTML | Medium | Step 2 |
| 8 | KV cache layer (5min TTL) | Small | Step 7 |
| 9 | Draft vs Published logic | Small | Step 7 |
| 10 | Preview URL with WebSocket auto-refresh | Medium | Step 9 |
| 11 | Create 50 templates | Large | Step 2 |
| 12 | Public storefront page (HTML template) | Medium | Step 7 |
| 13 | SEO: JSON-LD, meta tags, sitemap | Small | Step 12 |
| 14 | AI chatbot (CF Worker + MiMo v2.5) | Medium | Step 6 |
| 15 | Cart + order flow on public page | Large | Step 12 |
| 16 | Publish toggle (KV invalidation) | Small | Step 9 |

---

## 17. Cost Summary

| Component | Cost |
|-----------|------|
| CF Workers | $5/mo base |
| KV cache | ~$0 (free tier covers 100K stores) |
| DO (per store) | ~$0 (hibernation) |
| MiMo v2.5 (100K stores) | ₹1,800/mo (~$21) |
| **Total** | **~$26/mo for 100K stores** |

**Revenue at ₹499/mo per store:**

| Stores | Revenue | Cost | Profit |
|--------|---------|------|--------|
| 1,000 | ₹4,99,000 | ₹180 | ₹4,98,820 |
| 10,000 | ₹49,90,000 | ₹1,800 | ₹49,88,200 |
| 100,000 | ₹4,99,00,000 | ₹18,000 | ₹4,98,82,000 |

---

## 18. Summary

| Concept | One Line |
|---------|----------|
| **Phone** | AI chat + section config + publish button |
| **Web** | Published storefront for customers |
| **Preview** | Draft URL with live auto-refresh |
| **AI** | MiMo v2.5 generates layout JSON (~₹0.02/store) |
| **Components** | 16 pre-built, reusable HTML components |
| **Templates** | 50 pre-arranged templates for quick start |
| **Rendering** | CF Worker: layout JSON → server-side HTML |
| **Caching** | KV cache (5min TTL), 95% hit rate |
| **Data** | DO per store (products, stock, pricing) |
| **SEO** | Server-rendered HTML, JSON-LD, meta tags |
| **Chatbot** | MiMo v2.5, reads DO for product context |
| **Cost** | ₹1,800/mo for 100K stores |

---

**6 tools write 5 tables. Skills chain tools. Workflows orchestrate skills. Agents pick workflows. Storefront renders JSON. AI generates config. Components build pages.**
