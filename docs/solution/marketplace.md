# Marketplace Flow — End to End

How the multi-tenant marketplace (tarai.space) works in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Merchant │───▶│ Publish  │───▶│ Discover │───▶│ Customer │
│  (App)   │    │ (Worker) │    │ (Turso)  │    │  (App)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Merchant Publishes

### Step 1: Create Storefront

```sql
-- From Storefront DO (s:store_101)
INSERT INTO form (id, type, title, public, data)
VALUES ('store_101', 'profile', 'TAR Store', 1, '{
  "subdomain": "tar",
  "theme": {...},
  "logo": "https://...",
  "description": "Best deals on electronics"
}');
```

### Step 2: Publish to Marketplace

```javascript
// Worker /api/publish
export async function handlePublish(request, env) {
  const { form, matter } = await request.json();
  
  // 1. Upsert to Turso knowledge
  await env.TURSO.execute({
    sql: `INSERT INTO knowledge (id, title, type, verified, brand)
          VALUES (?, ?, ?, 0, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [form.id, form.title, form.type, form.data.brand]
  });
  
  // 2. Upsert to Turso context
  await env.TURSO.execute({
    sql: `INSERT INTO context (id, knowledge, store, value, stock, geo)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value=excluded.value, stock=excluded.stock`,
    args: [matter.id, form.id, matter.data.store, matter.value, matter.qty, matter.geo]
  });
  
  // 3. Embed for vector search
  const embedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
    text: `${form.title} ${form.type} ${form.data.brand || ''}`
  });
  
  await env.TURSO.execute({
    sql: `INSERT INTO memory (id, kind, vec, model, text, scope, time)
          VALUES (?, 'form', ?, 'bge-small-en-v1.5', ?, ?, ?)`,
    args: [form.id, embedding.data[0], form.title, matter.data.scope, new Date().toISOString()]
  });
}
```

---

## Part B: Customer Discovers

### Step 3: Search Products

```javascript
// Worker /api/global/search
export async function handleSearch(request, env) {
  const { query, filters } = await request.json();
  
  // 1. Embed query
  const embedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
    text: query
  });
  
  // 2. Vector search in Turso
  const results = await env.TURSO.execute({
    sql: `SELECT id, scope, text FROM memory 
          WHERE kind = 'form' 
          AND vec MATCH ? 
          LIMIT 10`,
    args: [embedding.data[0]]
  });
  
  // 3. Hydrate from Turso context
  const products = await Promise.all(results.rows.map(async (row) => {
    const context = await env.TURSO.execute({
      sql: `SELECT * FROM context WHERE knowledge = ?`,
      args: [row.id]
    });
    return { ...row, context: context.rows[0] };
  }));
  
  return products;
}
```

### Step 4: Browse Store

```
Customer visits tarai.space/tar
  → Storefront Worker serves HTML
  → Reads from Turso (not DO)
```

```javascript
// Storefront Worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const subdomain = url.hostname.split('.')[0];
    
    // Get store profile from KV cache
    let store = await env.STORES.get(subdomain, 'json');
    if (!store) {
      store = await env.TURSO.execute({
        sql: `SELECT * FROM knowledge WHERE id = ?`,
        args: [`store_${subdomain}`]
      });
      await env.STORES.put(subdomain, JSON.stringify(store), { expirationTtl: 300 });
    }
    
    // Get products
    const products = await env.TURSO.execute({
      sql: `SELECT * FROM context WHERE store = ?`,
      args: [store.id]
    });
    
    // Render HTML
    return new Response(renderStoreHTML(store, products), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

---

## Part C: Product Detail

### Step 5: View Product

```
Customer clicks product
  → Fetches from Turso (context + knowledge)
  → Shows live stock from DO
```

```javascript
// /api/product/:id
export async function handleProduct(request, env) {
  const productId = request.params.id;
  
  // Get from Turso
  const knowledge = await env.TURSO.execute({
    sql: `SELECT * FROM knowledge WHERE id = ?`,
    args: [productId]
  });
  
  const context = await env.TURSO.execute({
    sql: `SELECT * FROM context WHERE knowledge = ?`,
    args: [productId]
  });
  
  // Hydrate live stock from DO
  const storeDO = await env.SYNC_DO.get(env.SYNC_DO.idFromName(context.store));
  const liveStock = await storeDO.fetch(`/matter/${context.id}`);
  
  return { ...knowledge, ...context, stock: liveStock.qty };
}
```

---

## Part D: Multi-Tenant Store

### Storefront Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    tarai.space                               │
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
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Store created | — | s:store_101 | form |
| 2 | Product published | — | Turso | knowledge + context |
| 3 | Embedded for search | — | Turso | memory |
| 4 | Customer searches | — | Turso | memory (vector) |
| 5 | Customer browses store | — | Turso | knowledge + context |
| 6 | Customer views product | — | Turso + DO | context + matter |
| 7 | Customer orders | 104 | o:order_456 | Phase |
| 8 | Stock decremented | 101 | s:store_101 | Append |
