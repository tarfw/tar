# TAR Architecture

The single source of truth for TAR's local-first, database-per-scope system. Everything here was consolidated from the earlier scattered docs.

> **Core idea:** Physics lives in the Durable Object (truth). Only AI-consumable projections radiate to Turso (search).

---

## Document Index

| # | File | Covers |
| :--- | :--- | :--- |
| — | [README.md](README.md) | This index + quick reference |
| 01 | [01-data-model.md](01-data-model.md) | Naming, 5 tables, merge/sync rules, scope routing, opcodes, identity, dynamic forms |
| 02 | [02-sync-protocol.md](02-sync-protocol.md) | DO WebSocket sync handshake, message formats, Google auth + JWT, revocation, compaction |
| 03 | [03-search-and-realtime.md](03-search-and-realtime.md) | Recall→hydrate search, geo presence cells, order coordinator DO, per-category sample data |
| 04 | [04-marketplace-storefront.md](04-marketplace-storefront.md) | Federated product space, publish flow, `tarai.space` storefronts, AI theme engine |
| 05 | [05-domain-opcode-map.md](05-domain-opcode-map.md) | Every business domain mapped to the 4 tables + opcodes |
| 06 | [06-ai-classification-cache.md](06-ai-classification-cache.md) | Product options/modifiers, semantic caching strategy & cost |
| 07 | [07-project-management.md](07-project-management.md) | Linear-style PM UI on the same schema |
| 08 | [08-build-ops.md](08-build-ops.md) | Expo dev server & EAS build guide |
| 09 | [09-pricing-pl.md](09-pricing-pl.md) | Sync cost, P&L, AI capacity |
| 10 | [10-edge-patterns.md](10-edge-patterns.md) | Workers/DO/WebSocket roles, noise-vs-milestone, cost, Turso client |
| 11 | [11-agentic-capabilities.md](11-agentic-capabilities.md) | AI agent command matrix (merchant + customer) |
| 12 | [12-code-reference.md](12-code-reference.md) | `home.tsx` now-slice + `workspace.tsx` action→table matrix (legacy names) |

---

## Quick Reference

**The 5 tables (one sentence):** *matter takes `form`, driven by `motion`, joined by `bond`, leaving `memory`.*

| Table | Is | DO term (truth) | Turso term (AI) |
| :--- | :--- | :--- | :--- |
| `form` | blueprint / template | `form` | `knowledge` |
| `matter` | realized instance | `matter` | `context` |
| `motion` | event ledger | `motion` | — (private) |
| `bond` | graph link | `bond` | — (private) |
| `memory` | vector recall | `memory` | `memory` |

**The 3 kinds of Durable Object:**

| DO kind | Name pattern | Lifespan | Purpose |
| :--- | :--- | :--- | :--- |
| Scope DO | `s:`, `c:`, `w:`, `t:`… | permanent | a user/merchant's operational data |
| Geo cell DO | `geo:{h3}` | permanent | live registry of moving bodies in one hex |
| Order DO | `o:{order_id}` | ephemeral (archived + deleted) | shared lifecycle of one transaction |

**The engines a query can hit:**

| Need | Engine |
| :--- | :--- |
| "what is this" (meaning) | Turso `memory` (vector) |
| "where is it now" (live place) | `geo:{h3}` DO (k-ring) |
| "the exact truth" (price/stock) | the owning scope DO |

---

## Naming note (legacy → new)

The current **codebase** still uses legacy table names. This doc set uses the new names.

| Legacy (in code) | New (these docs) |
| :--- | :--- |
| `matter` (template) | `form` |
| `mass` (instance) | `matter` |
| `motion` | `motion` |
| `relation` | `bond` |
| global `matter` | `knowledge` (Turso) |
| global `mass` / offer | `context` (Turso) |

The rename is mechanical and optional — the architecture works identically under either naming. Do it as a single migration across `schema.ts` + all queries, not piecemeal.
