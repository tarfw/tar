# Storefront & Marketplace — Status

Last updated: 2026-06-12

Cloudflare Worker (`storefront/`) serving multi-tenant shops + a marketplace on
`tarai.space`, reading **live** from the shared global Turso DB (same DB the app's
`s3storage /api/publish` writes to). No mirror, no sync.

## The two workers

Two Cloudflare Workers with opposite jobs, linked only by the shared global Turso DB.

| Worker | Side | Who calls it | Job |
|---|---|---|---|
| `s3storage` | WRITE (backend) | the Expo app | API: publish data, media uploads, per-user DBs, search |
| `storefront` | READ (public web) | browsers | Renders shops + marketplace on `tarai.space` |

```
Expo app ──POST /api/publish──►  s3storage  ──writes──►  ┌──────────────┐
                                                         │ global Turso │
Browser ──acme.tarai.space──►   storefront  ──reads──►   └──────────────┘
```

### `s3storage` endpoints (write side)

| Endpoint | Does |
|---|---|
| `POST /api/publish` | Writes matter + mass + relations to global Turso; builds AI search vector. Makes products/shops live. |
| `POST /api/storage/presign-upload` | Signed S3 URL to upload media / `user.db` backups |
| `POST /api/storage/presign-download` | Signed S3 download URL (private-file ownership check) |
| `POST /api/user/get-or-create-db` | Creates a per-user Turso DB, returns sync URL + token |
| `POST /api/collab/create-group` · `/join-group` | Create/join a shared collab Turso DB by code |
| `POST /api/global/search` | AI vector search over global matter (LIKE fallback) |

Backed by: S3 bucket, global Turso (writes), Turso Platform API, Workers AI.

### `storefront` endpoints (read side)

| Route | Does |
|---|---|
| `<sub>.tarai.space` | Render a user's storefront |
| `market.tarai.space` | Render the global marketplace grid |
| `/p/:id` | Product detail page + WhatsApp order button |
| `/api/store/:sub` · `/api/market` · `/api/product/:id` | JSON |

Backed by: global Turso (reads only), KV `STORES` (5-min subdomain cache).

## Data model (existing app schema)

| Concept | Stored as |
|---|---|
| Storefront | `matter` type=`profile`, `public=1`, `data.subdomain`, `data.theme` |
| Product | `matter` type=`product`, `public=1` |
| Price / stock | `mass` rows (`value`=price, `qty`=stock, `matter`=productId) |
| Product → store | `relation` src=product, tgt=profile, type=`published_to` |

Display price = `matter.data.price` (falls back to `mass.value`). Variants collapse
to one card via `GROUP BY m.id` (`MIN(price)`, `SUM(qty)`).

## Routes

| Host / path | Behavior |
|---|---|
| `<sub>.tarai.space` | That profile's storefront (its `published_to` products; else all owner products) |
| `market.tarai.space` | Marketplace grid (all `public=1` products) |
| `/p/:id` | Product detail page |
| `/api/store/:sub`, `/api/market`, `/api/product/:id` | JSON |

## ✅ Done

- Worker built, deployed, routes attached, Turso secrets set.
- `market.tarai.space` **live** — 8 real products.
- Variant dedup + correct price (`matter.data.price`).
- Aligned to app model (`profile` + `published_to`); verified end-to-end with a throwaway shop.
- `/p/:id` product detail page + `/api/product/:id`.
- WhatsApp order button (`wa.me`, prefilled) with mailto fallback.
- App: `publishStorefront()` + "Publish Storefront" button; typechecks clean.

## ⏭️ Open

- [ ] **DNS** — confirm wildcard `*.tarai.space` + `market` are proxied (orange cloud). *Main gate.*
- [ ] **Manual app test** — create profile `acme`, attach products, publish, visit `acme.tarai.space`.
- [ ] Cart / multi-item order (today: one-tap WhatsApp per product).
- [ ] Explicit subdomain field + uniqueness check (today derived from `code`).

## Key resources

| Thing | Value |
|---|---|
| Worker | `storefront` (account `tar`) · routes `*.tarai.space/*`, `market.tarai.space/*` |
| Global Turso | `libsql://global-tarframework.aws-eu-west-1.turso.io` |
| Secrets | `TURSO_URL`, `TURSO_AUTH_TOKEN` |
| KV | `STORES` = `8ae7e36b7af14be69607a987d2d2a060` (subdomain→profile, 5 min TTL) |
| Publish | `https://s3storage.tar-54d.workers.dev/api/publish` |
