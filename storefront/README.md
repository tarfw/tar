# storefront — Cloudflare Worker

Multi-tenant edge renderer for user storefronts + the global marketplace, on `tarai.space`.
**Reads directly from the shared global Turso DB** — the same DB the app's
`s3storage` worker writes to via `/api/publish`. No mirror, no sync step, always live.

## How it works

- **Data source**: global Turso DB `libsql://global-tarframework.aws-eu-west-1.turso.io`
  (org `tarframework`). Set in the Worker as secrets `TURSO_URL` + `TURSO_AUTH_TOKEN`.
- **Routing** (by hostname):
  - `acme.tarai.space` → that store's page
  - `market.tarai.space` → global marketplace (all `public=1` products)
  - `/api/store/:sub` → storefront JSON
  - `/api/market?type=&limit=` → marketplace JSON
- **KV** `STORES` caches `subdomain → store` for 5 min.

## Data model (global Turso)

| App concept | Stored as |
|---|---|
| Product | `matter` type=`product`, `public=1` |
| Price / stock | `mass` rows (`value`=price, `qty`=stock, `matter`=productId) |
| Store | `matter` type=`store`, `public=1`, `data.subdomain`=`acme` |
| Product listed in store | `relation` src=storeId, tgt=productId, type=`lists` |

**Storefront product selection:** if a store has `relation 'lists'` rows, those
products show (ordered by relation weight). If it has none yet, the Worker falls
back to **all products owned by the store owner**. So a storefront works the moment
a `store` matter exists, even before listings are wired.

A product with multiple `mass` rows (variants) is collapsed to one card showing the
**lowest price** (`MIN(value)`) and **total stock** (`SUM(qty)`).

## To make storefronts appear

The marketplace already works (real products are live). For per-subdomain shops,
the app must publish a `store` matter, e.g. via the existing `s3storage /api/publish`:

```jsonc
{
  "matter": {
    "id": "store_acme",
    "type": "store",
    "scope": "g",
    "public": 1,
    "owner": "<userId>",
    "title": "Acme Shop",
    "data": { "subdomain": "acme", "theme": { "color": "#e23", "logo": "https://..." } }
  }
}
```

Then `acme.tarai.space` renders that owner's products. To curate exactly which
products show, insert `relation(src=store_acme, tgt=<productId>, type='lists')` rows.

## Bindings & secrets

| Binding | Resource |
|--------|----------|
| `STORES` | KV `8ae7e36b7af14be69607a987d2d2a060` |
| `TURSO_URL` | secret |
| `TURSO_AUTH_TOKEN` | secret |

## Commands

```bash
npm install
wrangler secret put TURSO_URL          # libsql://global-tarframework...
wrangler secret put TURSO_AUTH_TOKEN   # token from s3storage wrangler.toml
npm run deploy
```

### Routes (already attached by deploy)
- `*.tarai.space/*` and `market.tarai.space/*` (zone `tarai.space`).
- Needs proxied DNS: wildcard `* → tarai.space` and `market → tarai.space` (orange cloud ON).

## Local dev
```bash
npm run dev   # http://localhost:8787  (override Host header to test a tenant)
```
