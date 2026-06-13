# Storefront & Marketplace Plan

Cloudflare Workers serving multi-tenant shops and a global marketplace on `tarai.space`, reading live from the shared global Turso DB.

---

## 1. Key Resources & Schemas

* **Storefront Worker**: `storefront` (routes: `*.tarai.space/*`, `market.tarai.space/*`)
* **Write/Upload Worker**: `s3storage` (route: `/api/publish`, uploads, and AI vectors)
* **Global Turso DB**: `libsql://global-tarframework.aws-eu-west-1.turso.io`
* **Subdomain KV Cache**: `STORES` (subdomain -> profile JSON, 5 min TTL)

### Data Schema Mapping
* **Storefront Profile**: `matter` (type='profile', public=1, data.subdomain, data.theme)
* **Product Catalog**: `matter` (type='product', public=1, data.price)
* **Stock & Variants**: `mass` (type='variant' or 'stock', matter=productId, qty, value=price)
* **Product-to-Store Link**: `relation` (src=productId, tgt=profileId, type='published_to')
* **Orders**: `mass` (type='order', value=total, active=1, data={items, shipping}) + `motion` log

---

## 2. Storefront Development & Planning Matrix

| Feature / Task | Done? | Notes & Implementation details |
| :--- | :--- | :--- |
| **Worker Core & Deploys** | **Yes** | Deployed worker, set secrets (`TURSO_URL`, `TURSO_AUTH_TOKEN`), configured KV. |
| **Marketplace Grid** | **Yes** | `market.tarai.space` live displaying all public products sorted by date. |
| **Product Detail Page** | **Yes** | `/p/:id` detailed view, variant price resolution, and stock indicators. |
| **WhatsApp Ordering** | **Yes** | Single-tap WhatsApp button prefilled with order details; mailto fallback. |
| **App Publish Integration** | **Yes** | App has "Publish Storefront" button sending profile matter + product relations. |
| **Wildcard DNS Proxy** | **No** | Needs orange cloud wildcard `*.tarai.space` proxying config. |
| **Explicit Subdomains** | **No** | Needs uniqueness check and custom field validation for subdomains in app. |
| **Multi-Item Cart UI** | **No** | LocalStorage-backed cart drawer allowing users to add/remove multiple products. |
| **Edge Checkout Sync** | **No** | checkout API inserting `mass` type='order' and `motion` opcode `105` (ORDER_PLACED) to Turso. |
| **Payment Integration** | **No** | Stripe/Razorpay session creation + webhook updates order to Paid (opcode `802` PAY_SUCCESS). |
| **Custom Domains** | **No** | Support Cloudflare SSL SaaS. Resolve store profile by checking incoming host header. |
| **AI Design Tokens** | **No** | LLM generates visual JSON (colors, typography, effects) saved in `data.theme` & injected as CSS. |
| **AI Logo/Banner Media** | **No** | Prompt-to-image generator creating branding assets, uploading to S3, writing to profile. |
| **Structured SEO** | **No** | Auto-generating JSON-LD metadata for products to index on search engines/Google Shopping. |

---

## 3. AI-Generated Design Engine (Tokens & Ideas)

To deliver Shopify & Webflow-grade aesthetics without manual coding, the AI generates a JSON payload of Design Tokens inside `matter.data.theme`.

### Design Token JSON Schema
```json
{
  "colors": {
    "background": "#0F0F11",
    "surface": "#16161A",
    "primary": "#6366F1",
    "primaryHover": "#4F46E5",
    "accent": "#F59E0B",
    "textMain": "#F9FAFB",
    "textMuted": "#9CA3AF",
    "border": "#27272A"
  },
  "typography": {
    "headingsFont": "Outfit",
    "bodyFont": "Inter",
    "baseFontSize": "16px",
    "headingsWeight": "700",
    "headingsCase": "none",
    "letterSpacing": "-0.02em"
  },
  "spacing": {
    "siteMaxWidth": "1200px",
    "gridGap": "24px",
    "containerPadding": "32px",
    "sectionSpacing": "64px"
  },
  "effects": {
    "borderRadius": "12px",
    "buttonPadding": "12px 24px",
    "cardShadow": "0 8px 30px rgba(0,0,0,0.12)",
    "backdropFilter": "blur(8px)",
    "borderWidth": "1px"
  },
  "animation": {
    "transitionDuration": "200ms",
    "transitionTiming": "cubic-bezier(0.4, 0, 0.2, 1)",
    "hoverScale": "1.02"
  }
}
```

### Generation & Rendering Pipeline
1. **Merchant Prompt**: The user describes their store's brand vibe (e.g., *"brutalist neon shoe store"* or *"clean organic cosmetic shop"*).
2. **LLM Generation**: The app sends the prompt to an LLM (Gemini/Claude) which outputs the design tokens JSON structure and optional custom CSS.
3. **Storage**: The JSON is saved into the storefront's profile metadata (`matter.data.theme`).
4. **Edge Variable Injection**: The Cloudflare storefront worker parses the theme and injects these design parameters as CSS variables in the HTML header shell:
   ```css
   :root {
     --color-bg: ${theme.colors.background};
     --font-headings: "${theme.typography.headingsFont}, sans-serif";
     --border-radius: ${theme.effects.borderRadius};
     --transition-speed: ${theme.animation.transitionDuration} ${theme.animation.transitionTiming};
     /* ... other variables ... */
   }
   ```
5. **Asset Generation**: The AI generates brand assets (logos, header banners) via text-to-image models. The resulting files are uploaded to S3 via the existing presigned upload URL and referenced in `theme.logo` or `theme.banner`.
