# @tarai implementation of docs/action3.md — mapping & gaps

> Generated from `docs/action3.md` (TAR — Final Unified System Architecture) against `tarai/src/`.
> **Updated after foundation cycle:** owner-only ACL + spec-complete core tools.

## Summary

`tarai` implements the **local/personal tier** of the architecture well: the 5-table schema, the 6 core tools, owner-only ACL, built-in actions, local vector search, and the React Native UI shell are present. The **cloud/multi-tenant tier** (Workspace DO, Storefront DO, Sub-Agent DOs, cloud MCP routing, flows, agents, plugins, offline sync, graph-weight roles) remains for future cycles.

| Area | Status | Key files |
|------|--------|-----------|
| 5 tables + indexes | ✅ Implemented | `tarai/src/lib/schema.ts` |
| 6 tools (create/read/update/delete/link/search) | ✅ Implemented | `tarai/src/lib/tools.ts` |
| Owner-only ACL | ✅ Implemented | `tarai/src/lib/acl.ts`, `tarai/src/lib/tools.ts` |
| DB routing (p: local, t:/s: cloud) | ❌ Not implemented | `tarai/src/lib/db.ts` |
| Actions (~60 built-in) | ✅ Implemented | `tarai/src/actions/seed.ts`, `tarai/src/actions/store.ts` |
| Action execution engine | ⚠️ Basic | `tarai/src/actions/executor.ts`, `tarai/src/actions/executor-engine.ts` |
| 5 flow primitives | ❌ Not implemented | — |
| 4 agent types + 6 sub-agent DOs | ❌ Not implemented | — |
| Multi-tenant SaaS / scopes | ❌ Not implemented | `tarai/src/lib/db.ts` |
| Graph-weight role ACL | ❌ Not implemented | `tarai/src/lib/tools.ts` |
| Vector + FTS search | ✅ Implemented | `tarai/src/lib/vectorStore.ts`, `tarai/src/lib/tools.ts` |
| Embeddings (on-device) | ✅ Implemented | `tarai/src/lib/embeddings.ts` |
| Offline-first sync queue | ❌ Not implemented | — |
| Plugin system | ❌ Not implemented | — |
| AI helpers | ✅ Implemented | `tarai/src/lib/ai.ts`, `tarai/src/lib/storefront-ai.ts` |
| React hooks / UI shell | ✅ Implemented | `tarai/src/hooks/*`, `tarai/src/app/*`, `tarai/src/components/*` |

---

## 1. Tables & Schema

**File:** `tarai/src/lib/schema.ts`

All 5 `CREATE TABLE` statements and all 5 indexes match the spec exactly.

---

## 2. Six Tools

**Files:** `tarai/src/lib/tools.ts`, `tarai/src/lib/acl.ts`

### `create` — ✅

- `table`, `scope`, `type`, `code`, `form`, `owner`, `title`, `public`, `qty`, `value`, `variant`, `mark`, `geo`, `start`, `end`, `data`, `links`, `motion`, `embed`, `client_ref` ✅
- Resolves `$id` in links ✅
- Validates `data` against `form.data.schema` when blueprint provides a schema ✅
- Enforces `client_ref` idempotency ✅
- Sets `owner` to caller if not provided ✅
- Writes motion + vector index ✅

**Remaining gaps:**
- All writes route to local DB regardless of scope (cloud routing deferred).

### `read` — ✅

- `table`, `scope`, `id`, `type`, `form`, `active`, `fields`, `filters`, `joins`, `graph_filter`, `depth`, `stream`, `seq_from`, `seq_to`, `order`, `limit`, `offset` ✅
- Returns real total `count` and `next_offset` ✅

**Remaining gaps:**
- Complex multi-hop graph filters beyond simple recursive CTE.

### `update` — ✅

- `table`, `id`, `scope`, `patch`, `phase`, `opcode`, `delta`, `reason`, `client_ref` ✅
- Deep-merge JSON ✅
- State-machine validation ✅
- Motion log + vector re-index ✅
- Owner-only ACL ✅
- `client_ref` idempotency ✅

**Remaining gaps:**
- Graph-weight role checks deferred to cloud/tenant cycle.

### `delete` — ✅

- `table`, `id`, `scope`, `hard`, `cascade`, `client_ref` ✅
- Soft delete default ✅
- Cascade graph deactivation ✅
- Hard delete restricted to `p:` scope ✅
- Owner-only ACL for form/matter ✅

**Remaining gaps:**
- Exact `(src, rel, tgt)` graph-row hard delete not exposed as separate API.

### `link` — ✅

- `src`, `rel`, `tgt`, `weight`, `bidirectional`, `active`, `scope`, `scope_check`, `client_ref` ✅
- UPSERT into `graph` ✅
- Bidirectional edge ✅
- Motion log ✅
- `scope_check` verifies both nodes exist in the requested scope ✅

**Remaining gaps:**
- Graph-weight role checks deferred.

### `search` — ✅

- `query`, `scope`, `type`, `table`, `mode`, `filters`, `limit`, `threshold` ✅
- `hybrid` (0.7 vector + 0.3 FTS) ✅
- `vector`, `fts`, `structured` modes ✅
- Cost guard falls back to FTS when no embeddings exist ✅
- Threshold applied consistently ✅

**Remaining gaps:**
- `geo` / H3 proximity not implemented.
- `join_graph` filter not implemented.

---

## 3. Database Routing

**File:** `tarai/src/lib/db.ts`

- `routeDbForEntity(type, scope)` always returns the local private DB.
- Cloud MCP / DO routing is not implemented.

---

## 4. Actions

**Files:** `tarai/src/actions/seed.ts`, `tarai/src/actions/store.ts`, `tarai/src/actions/executor.ts`, `tarai/src/actions/executor-engine.ts`

- 60+ built-in actions seeded into `form` records.
- Custom action CRUD and vector search.
- Action executor maps actions to `create({ table: 'matter' })`.

**Remaining gaps:**
- Full verb→tool mapping (`assign`→`link`, `convert`→`update`+`link`, `log`→`create(table='motion')`).

---

## 5. Flows, Agents, Sub-Agent DOs

All remain ❌ not implemented.

---

## 6. Multi-Tenant SaaS & Security

| Spec component | Status |
|----------------|--------|
| Workspace DO (`t:`) | ❌ Not implemented |
| Storefront DO (`s:`) | ❌ Not implemented |
| Tenant provisioning | ❌ Not implemented |
| Graph-weight roles (`weight` 0-3) | ❌ Not implemented |
| Scope visibility | ⚠️ `WHERE scope = ?` only |
| Owner-only ACL | ✅ Implemented |
| Auth flow | ⚠️ `tarai/src/lib/auth.ts` present |

---

## 7. Embeddings & Vector Search

**Files:** `tarai/src/lib/embeddings.ts`, `tarai/src/lib/vectorStore.ts`

- On-device `all-MiniLM-L6-v2` embeddings.
- Hybrid + vector + FTS + structured search in `search` tool.

**Remaining gaps:**
- Geo / H3 search.

---

## 8. Offline-First & Sync

| Spec component | Status |
|----------------|--------|
| Local SQLite for `p:` data | ✅ Yes |
| `sync_queue` matter type | ❌ Not implemented |
| Sync protocol | ❌ Not implemented |
| Conflict resolution | ❌ Not implemented |

---

## 9. Plugin System

All remain ❌ not implemented.

---

## 10. AI Helpers

**Files:** `tarai/src/lib/ai.ts`, `tarai/src/lib/storefront-ai.ts`

- Product cataloguing, action generation/editing, storefront layout generation.

---

## 11. UI / React Layer

**Files:** `tarai/src/app/*`, `tarai/src/components/*`, `tarai/src/hooks/*`

- Hooks and screens expose the implemented tools.

---

## Priority gap list (post-foundation)

1. **Cloud/DO routing** — branch `routeDbForEntity` to Cloudflare Worker MCP for `t:`/`s:` scopes.
2. **Graph-weight ACL** — replace owner-only checks with role levels (0=viewer, 1=member, 2=admin, 3=owner).
3. **Flow engine** — interpreter for the 5-primitive DAG.
4. **Agent runtime** — router/worker/scheduler loops and sub-agent DO spawning.
5. **Offline sync** — `sync_queue` + conflict resolution.
6. **Plugin loader** — install/uninstall bundles of form records.
7. **Action verb mapping** — map `assign`/`convert`/`log` verbs to correct tools.
8. **Geo search** — H3 hex proximity in `search`.
9. **Cross-tenant operations** — federated queries and global search.
