# Data Sizes & Storage Strategy

Expected row sizes, vertical estimates, and cost optimization via Railway Object Storage.

---

## 1. Row Sizes by Table

| Table | Avg Row Size | Columns | Why Small |
|-------|--------------|---------|-----------|
| **form** | 200-500 bytes | id, type, title, scope, data(JSON) | Essential fields only |
| **matter** | 150-400 bytes | id, form(FK), type, qty, value, data | State snapshot |
| **motion** | 100-300 bytes | stream, seq, action, delta, data | Append-only log |
| **graph** | 80-150 bytes | src, tgt, type | Just connections |
| **memory** | 3-6 KB | form, chunk, vector(BLOB) | 384-768 dims × 4 bytes |

---

## 2. Per-Vertical Estimates

Assuming 100 active customers, daily usage:

| Vertical | form | matter | motion | Total Size |
|----------|------|--------|--------|------------|
| CRM (100 leads) | 100 rows | 100 rows | 300 rows | ~200 KB |
| POS (daily sales) | 20 rows | 20 rows | 200 rows | ~80 KB |
| Store (50 products) | 50 rows | 100 rows | 500 rows | ~250 KB |
| HR (10 employees) | 10 rows | 30 rows | 300 rows | ~120 KB |
| Payments (monthly) | 50 rows | 50 rows | 200 rows | ~100 KB |
| Logistics (shipments) | 30 rows | 30 rows | 150 rows | ~80 KB |
| **Total per user** | ~260 rows | ~330 rows | ~1650 rows | **~830 KB** |

**Per user, per year: ~1-2 MB.** Very small for SQLite.

---

## 3. Memory (Vector) Size

| Vector Dimension | Size per Row | 1000 Forms | 10,000 Forms |
|------------------|--------------|------------|--------------|
| 384 (MiniLM) | 1.5 KB | 1.5 MB | 15 MB |
| 768 (mpnet) | 3 KB | 3 MB | 30 MB |
| 1536 (OpenAI) | 6 KB | 6 MB | 60 MB |

**Recommendation:** Use 384-dim (MiniLM) for local storage. 10K forms = 15 MB.

---

## 4. Storage Provider: Railway Object Storage

### Why Railway

Railway Object Storage is built on Tigris S3. It provides:

- **$0.015/GB/month** storage (same as Cloudflare R2)
- **Free unlimited API operations** (no per-request charges)
- **Free egress** (no bandwidth charges)
- **S3-compatible** (use any S3 SDK)
- **Global distribution** (Tigris backend)

### Pricing Comparison

| Provider | Storage | Egress | API Operations |
|----------|---------|--------|----------------|
| **Railway** | $0.015/GB/month | Free | Free (unlimited) |
| Cloudflare R2 | $0.015/GB/month | Free | $4.50/1M Class A |
| AWS S3 | $0.023/GB/month | $0.09/GB | $0.005/1K writes |

### Railway Advantages

| Advantage | Detail |
|-----------|--------|
| Same price as R2 | $0.015/GB/month |
| Free API ops | No per-request charges |
| Free egress | No bandwidth charges |
| Tigris backend | High durability, global distribution |
| Integrated with Railway | One platform for app + storage |
| Presigned URLs | Serve private files securely |

---

## 5. Hybrid Storage Strategy

### Problem

Product descriptions can be 10-50 KB (Amazon-style pages). Storing in `form.data` bloats SQLite.

### Solution: Essentials Local, Details on Railway

| Data | Location | Size |
|------|----------|------|
| Essential fields (price, stock, category) | `form.data` | 200-500 bytes |
| Full description | Railway | 10-50 KB |
| Images | Railway | 100 KB-2 MB |
| Reviews | Railway | Variable |
| Vector embedding | `memory` table | 1.5 KB |
| Stock/price | `matter` row | 150-400 bytes |

### What Goes Where

| Data Type | SQLite (local) | Railway (cloud) |
|-----------|----------------|-----------------|
| Product name | ✅ | — |
| Price | ✅ | — |
| Stock qty | ✅ | — |
| Category | ✅ | — |
| Short description (100 chars) | ✅ | — |
| Full description (2000+ words) | — | ✅ |
| Product images | — | ✅ |
| Detailed specs | — | ✅ |
| Customer reviews | — | ✅ |
| FAQ content | — | ✅ |
| Notes/posts | — | ✅ |
| Invoices/PDFs | — | ✅ |

### General Pattern

| Content | SQLite | Railway |
|---------|--------|---------|
| Metadata (title, type, date) | ✅ | — |
| Full content (long text) | — | ✅ |
| Images/files | — | ✅ |
| Vector for search | ✅ | — |

---

## 6. Example: Product Storage

### SQLite Row (metadata only)

```sql
INSERT INTO form (id, type, title, data)
VALUES ('prod_nike', 'product', 'Nike Air Max', '{
  "price": 5999,
  "category": "footwear",
  "brand": "Nike",
  "shortDesc": "Revolutionary air cushioning",
  "detailsUrl": "presigned-url-from-railway",
  "imagesUrl": "presigned-url-from-railway"
}');
-- Row size: 300 bytes ✅
```

### Railway Object (full details)

```json
// tarai/products/prod_nike/details.json
{
  "description": "The Nike Air Max features revolutionary air cushioning technology...",
  "specs": {
    "weight": "300g",
    "material": "Leather",
    "cushioning": "Air Max unit",
    "outsole": "Rubber"
  },
  "features": [
    "Visible Air cushioning",
    "Breathable mesh upper",
    "Durable rubber outsole"
  ],
  "reviews": [
    {"user": "Priya", "rating": 5, "text": "Best shoes ever!"},
    {"user": "Rahul", "rating": 4, "text": "Very comfortable"}
  ],
  "faq": [
    {"q": "Are these waterproof?", "a": "No, they are not waterproof."},
    {"q": "What sizes available?", "a": "6-12 US"}
  ]
}
```

---

## 7. Example: Notes & Posts on Railway

### Note

```sql
-- SQLite: metadata only
INSERT INTO form (id, type, title, data)
VALUES ('note_001', 'note', 'Meeting Notes', '{
  "createdAt": "2026-06-21",
  "tags": ["meeting", "client"],
  "contentUrl": "presigned-url-from-railway"
}');
-- Row size: 150 bytes ✅
```

```markdown
<!-- Railway: tarai/notes/note_001.md -->
# Meeting Notes - June 21

## Attendees
- Priya (client)
- Rahul (sales)

## Discussion
The client wants to order 50 sneakers...
```

### Post

```sql
-- SQLite: metadata only
INSERT INTO form (id, type, title, data)
VALUES ('post_001', 'post', 'Summer Sale Announcement', '{
  "author": "TAR Store",
  "publishDate": "2026-06-21",
  "contentUrl": "presigned-url-from-railway",
  "imageUrl": "presigned-url-from-railway"
}');
```

---

## 8. SEO with Railway Storage

### How Storefront Worker Serves Pages

```
Crawler visits: tar-store.tarai.space/product/prod_nike
        │
        ▼
┌─────────────────────────────────────┐
│  Storefront Worker                  │
│  1. Read form.data from Turso       │
│  2. Fetch details from Railway      │
│  3. Render full HTML server-side    │
│  4. Return to crawler               │
└─────────────────────────────────────┘
```

### Google Sees Rendered HTML

```html
<head>
  <meta name="description" content="Nike Air Max - revolutionary air cushioning...">
  <meta property="og:title" content="Nike Air Max">
  <script type="application/ld+json">
    {"@type": "Product", "name": "Nike Air Max", "price": "5999"}
  </script>
</head>
<body>
  <h1>Nike Air Max</h1>
  <p>The Nike Air Max features revolutionary air cushioning...</p>
</body>
```

**SEO is fine.** Worker renders HTML server-side. Crawlers never see Railway.

---

## 9. Sitemaps

### Dynamic Generation

```javascript
// Storefront Worker generates sitemap.xml
async function handleSitemap(request, env) {
  const subdomain = new URL(request.url).hostname.split('.')[0];

  // Check KV cache
  let sitemap = await env.STORES.get(`sitemap:${subdomain}`);
  if (sitemap) return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' }
  });

  // Query Turso for all products
  const products = await env.TURSO.execute({
    sql: "SELECT id, title FROM knowledge WHERE store = ?",
    args: [`store_${subdomain}`]
  });

  // Generate XML
  const urls = products.rows.map(p => `
    <url>
      <loc>https://${subdomain}.tarai.space/product/${p.id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('');

  sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${subdomain}.tarai.space/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${urls}
</urlset>`;

  await env.STORES.put(`sitemap:${subdomain}`, sitemap, { expirationTtl: 300 });
  return new Response(sitemap, { headers: { 'Content-Type': 'application/xml' } });
}
```

### Per-Store Sitemaps

| Store | Sitemap URL |
|-------|-------------|
| TAR Store | `tar-store.tarai.space/sitemap.xml` |
| Coffee Shop | `coffee.tarai.space/sitemap.xml` |
| Nike | `nike.tarai.space/sitemap.xml` |

---

## 10. Cost Analysis

### Storage Costs

| Component | Storage | Cost |
|-----------|---------|------|
| SQLite (per user) | ~2 MB/year | $0 (local) |
| Railway (product details) | ~100 KB × 1000 products | ~$0.015/month |
| Railway (images) | ~500 KB × 1000 products | ~$0.075/month |
| Railway (notes/posts) | ~5 KB × 1000 notes | ~$0.008/month |
| Turso (published data) | ~1 MB per store | Free tier sufficient |
| **Total per store** | **~2 MB** | **~$0.10/month** |

### Bandwidth Costs

| Component | Requests | Cost |
|-----------|----------|------|
| Storefront Worker | 10K requests/month | Free (Workers free tier) |
| Railway reads | 10K requests/month | Free (unlimited API ops) |
| Turso reads | 10K queries/month | Free (Turso free tier) |
| **Total** | **10K requests** | **$0** |

### Full Platform Cost

| Service | Cost |
|---------|------|
| Railway (storage) | ~$0.10/month per store |
| Cloudflare Workers | Free tier |
| Turso | Free tier |
| **Total per store** | **~$0.10/month** |

---

## 11. Summary

| Aspect | Strategy |
|--------|----------|
| Small data (names, prices, stock) | SQLite local |
| Large data (descriptions, images, notes) | Railway Object Storage |
| Search vectors | SQLite `memory` table |
| Published data | Turso (global) |
| Sitemaps | Worker-generated, KV-cached |
| SEO | Server-side rendered HTML |
| Cost per store | ~$0.10/month |

**Essentials local. Details on Railway. SEO via Worker. Near-zero cost.**

---
