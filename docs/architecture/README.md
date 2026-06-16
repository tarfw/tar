# TAR Architecture

Local-first, database-per-scope system for multi-vertical commerce.

> **Core idea:** Physics lives in the Durable Object (truth). Only AI-consumable projections radiate to Turso (search).

---

## Document Index

| # | File | Covers |
|:--|:-----|:-------|
| 01 | [01-schema.md](01-schema.md) | 5 tables, schemas, opcodes, scope routing, conflict resolution |
| 02 | [02-collaboration.md](02-collaboration.md) | Why sync exists (collaboration), how it works, auth/revocation |
| 03 | [03-do.md](03-do.md) | Complete DO guide: lifecycle, single-threaded, hibernation, cost |
| 04 | [04-search.md](04-search.md) | Vector search, geo presence (KV), order coordinator |
| 05 | [05-storefront.md](05-storefront.md) | Publish flow, multi-tenant stores, AI themes |
| 06 | [06-ai.md](06-ai.md) | Product classification, semantic cache |
| 07 | [07-domains.md](07-domains.md) | 9 verticals mapped to schema, AI agent commands |
| 08 | [08-pricing.md](08-pricing.md) | Cost model, P&L, Shopify-scale stress test |

---

## Quick Reference

**The 5 tables:** *matter takes `form`, driven by `motion`, joined by `bond`, leaving `memory`.*

| Table | Role | DO | Turso |
|:------|:-----|:---|:------|
| `form` | Blueprint | `form` | `knowledge` |
| `matter` | Instance | `matter` | `context` |
| `motion` | Ledger | `motion` | — |
| `bond` | Graph | `bond` | — |
| `memory` | Vector | `memory` | `memory` |

**Scope routing (4 prefixes):**

| Prefix | Class | Lifetime |
|:-------|:------|:---------|
| `p` | Personal (local-only) | Persistent |
| `g` | Global (Turso search) | Persistent |
| `s:{id}` | Storefront (merchant) | Persistent |
| `t:{id}` | Workspace (team/HR) | Persistent |
| `o:{id}` | Order (transaction) | Ephemeral |

**Query engines:**

| Need | Engine |
|:-----|:-------|
| "what is this" | Turso `memory` (vector) |
| "where is it now" | Workers KV (H3 k-ring) |
| "the exact truth" | Scope DO (SQLite) |

---

## Naming (Legacy → New)

| Legacy (in code) | New (docs) |
|:-----------------|:-----------|
| `matter` | `form` |
| `mass` | `matter` |
| `relation` | `bond` |
| global `matter` | `knowledge` |
| global `mass` | `context` |
