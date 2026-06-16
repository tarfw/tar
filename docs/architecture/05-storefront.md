# 05 — Marketplace & Storefront

Publish flow, multi-tenant stores, and AI themes.

---

## 1. Publish Flow

Discovery (read) and management (write) are separate:

| Flow | Where | How |
|:-----|:------|:----|
| Discovery | Turso `knowledge` + `context` + `memory` | vector search |
| Management | Merchant DO (`form`/`matter`/`motion`/`bond`) | local-first |

### Publish to Marketplace

```
┌─────────────────────────────────────────────────────────────┐
│                    Publish Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Merchant creates local data                             │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Merchant DO (s:store_101)                           │   │
│  │  - Create form (product definition)                  │   │
│  │  - Create matter (stock, price)                      │   │
│  │  - Create bond (product → store)                     │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         │ Tap "Publish"                     │
│                         ▼                                   │
│  2. Worker /api/publish receives                            │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Worker checks: form in knowledge?                   │   │
│  │  ├─ No → Insert into knowledge (verified=0)          │   │
│  │  └─ Yes → Update if newer                            │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  3. Upsert context (from matter)                            │
│     │                                                       │
│     ▼                                                       │
│  4. Embed via Workers AI                                    │
│     │                                                       │
│     ▼                                                       │
│  5. Insert into memory (vector index)                       │
│     │                                                       │
│     ▼                                                       │
│  Product discoverable via search                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Turso Tables

**knowledge** (from `form`):

| Field | Note |
|:------|:-----|
| `id` | standard key/barcode |
| `title` | display name |
| `type` | `product`, `service`, `restaurant` |
| `verified` | 0=crowdsourced, 1=official |
| `brand` | denormalized |

**context** (from `matter`):

| Field | Note |
|:------|:-----|
| `id` | mirrors `matter.id` |
| `knowledge` | FK → knowledge.id |
| `store` | storefront profile id |
| `value` | selling price |
| `stock` | 1=in stock, 0=out |
| `geo` | H3 hex |

---

## 2. Storefront Engine (tarai.space)

Cloudflare Workers serve multi-tenant shops.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    tarai.space Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  tar.tarai  │  │ nike.tarai  │  │ apple.tarai │        │
│  │   .space    │  │   .space    │  │   .space    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Storefront Worker                       │   │
│  │  - Routes by subdomain                               │   │
│  │  - Serves HTML + CSS + JS                            │   │
│  │  - Reads from Turso (products)                       │   │
│  │  - Reads from DO (live stock)                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              KV Cache (STORES)                       │   │
│  │  - subdomain → profile JSON                          │   │
│  │  - 5-min TTL                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Global Turso DB                         │   │
│  │  - knowledge (products)                              │   │
│  │  - context (stock, price, geo)                       │   │
│  │  - memory (vector search)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Resources

| Resource | Detail |
|:---------|:-------|
| Storefront Worker | routes `*.tarai.space/*` |
| Write Worker | `/api/publish`, uploads, AI vectors |
| Global Turso DB | `libsql://global-tar...` |
| Subdomain KV | `STORES` (5-min TTL) |

### Data Mapping

| Concept | Table | Detail |
|:--------|:------|:-------|
| Store profile | `form`/`matter` type=profile | `data.subdomain`, `data.theme` |
| Product catalog | `form` type=product | `data.price` |
| Stock & variants | `matter` type=variant/stock | `qty`, `value` |
| Product→store | `bond` | `type='published_to'` |
| Orders | `matter` type=order + `motion` | `value`=total |

### Subdomain Routing

```javascript
export default {
  async fetch(request, env) {
    const subdomain = new URL(request.url).hostname.split('.')[0];
    
    // KV cache
    let store = await env.STORES.get(subdomain, 'json');
    if (!store) {
      store = await env.TURSO.execute({
        sql: "SELECT * FROM knowledge WHERE id = ?",
        args: [`store_${subdomain}`]
      });
      await env.STORES.put(subdomain, JSON.stringify(store), { expirationTtl: 300 });
    }
    
    // Get products
    const products = await env.TURSO.execute({
      sql: "SELECT * FROM context WHERE store = ?",
      args: [store.id]
    });
    
    return new Response(renderHTML(store, products), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

---

## 3. AI Design Engine

LLM generates design tokens for Shopify-grade aesthetics.

### Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Design Pipeline                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Merchant describes vibe                                 │
│     │  "brutalist neon shoe store"                          │
│     ▼                                                       │
│  2. LLM generates design tokens                             │
│     │  (JSON with colors, typography, spacing, effects)     │
│     ▼                                                       │
│  3. Tokens saved to form.data.theme                         │
│     │                                                       │
│     ▼                                                       │
│  4. Storefront Worker injects CSS variables                 │
│     │  :root {                                              │
│     │    --color-bg: ${theme.colors.background};            │
│     │    --font-headings: "${theme.typography.headingsFont}";│
│     │  }                                                    │
│     ▼                                                       │
│  5. Logo/banner: text-to-image → S3 presigned upload        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Schema

```json
{
  "colors": { "background":"#0F0F11", "primary":"#6366F1" },
  "typography": { "headingsFont":"Outfit", "bodyFont":"Inter" },
  "spacing": { "siteMaxWidth":"1200px", "gridGap":"24px" },
  "effects": { "borderRadius":"12px", "cardShadow":"0 8px 30px rgba(0,0,0,0.12)" },
  "animation": { "transitionDuration":"200ms" }
}
```
