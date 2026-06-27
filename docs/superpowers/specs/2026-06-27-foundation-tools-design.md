# Foundation Tools Design

> Scope: complete the 6 core tools (`create`, `read`, `update`, `delete`, `link`, `search`) to match `docs/action3.md` within the existing local-only architecture.

## Goal

Make every core tool spec-complete and secure under an owner-only ACL model, without introducing cloud MCP, flow engine, agent runtime, offline sync, or plugins.

## Constraints

- Stay local-only: `routeDbForEntity` continues to return the local SQLite DB for all scopes.
- Owner-only ACL for mutations; graph-weight roles deferred to a future cloud/tenant cycle.
- TypeScript, Expo / React Native, `@tursodatabase/sync-react-native`, `react-native-executorch` for embeddings.
- Keep changes clean and focused; avoid refactoring unrelated code.

## Success Criteria

1. Every mutating tool rejects unauthorized callers.
2. `create` accepts `mark`, validates against blueprint schema, and enforces `client_ref` idempotency.
3. `read` supports `fields`, `joins`, `graph_filter`/`depth`, motion ranges, and true `count`.
4. `update` enforces ACL, idempotency, and clean form/matter patching.
5. `delete` supports hard graph-row deletion and correct cascade behavior.
6. `link` supports `scope_check`.
7. `search` supports `hybrid`, `vector`, `fts`, `structured` modes and cost guard.
8. Each tool has unit tests covering happy path, validation errors, and ACL rejection.

## Architecture

```
User / UI / Action executor
    │
    ▼
┌─────────────────────────────┐
│ 6 core tools (tarai/src/lib/tools.ts)
│ - create
│ - read
│ - update
│ - delete (del)
│ - link
│ - search
├─────────────────────────────┤
│ ACL helper (tarai/src/lib/acl.ts)   ← NEW
│ - isAuthorized(scope, owner, caller)
│ - requireOwner(scope, owner, caller)
├─────────────────────────────┤
│ DB layer (tarai/src/lib/db.ts)
│ - local SQLite only
└─────────────────────────────┘
```

## Security / ACL

### Model

- Owner-only checks for mutations.
- Caller is derived from `cachedSelfId` in `tarai/src/lib/db.ts`.
- `create` for `matter` sets `owner` to caller if not provided.
- `create` for `form` sets `owner` to caller if not provided.
- `update`, `delete`, `link(scope_check)` verify caller === owner.
- `read` and `search` remain read-only and scope-filtered; no owner check.

### Helper API

```ts
// tarai/src/lib/acl.ts
export function getCallerId(): string;
export function isAuthorized(scope: string, owner: string | null, caller?: string): boolean;
export function requireOwner(scope: string, owner: string | null, caller?: string): void;
```

- `isAuthorized` returns true if owner is null/undefined or matches caller.
- `requireOwner` throws `UnauthorizedError` if not authorized.
- For `t:` and `s:` scopes, owner check still applies; graph roles are deferred.

## Tool Changes

### 1. `create`

**Files:** `tarai/src/lib/tools.ts`, `tarai/src/lib/acl.ts`

**Changes:**

- Accept `mark` option in signature.
- Set `owner` to caller when not provided for `matter` and `form`.
- Validate `data` against `form.data.schema` if `form` provided and schema exists.
  - Schema language: `{ [field]: "string|required" | "number" | "array|required" | ... }`.
  - For this cycle, support required checks and basic type checks.
- Enforce `client_ref` idempotency: check if a motion record with same `client_ref` already exists for the stream; if yes, return existing record.

**Return:** unchanged `{ id, time, status: "created" }`.

### 2. `read`

**Files:** `tarai/src/lib/tools.ts`

**Changes:**

- `fields`: array of JSON paths; project via `json_extract(data, '$.path')` with alias `path`.
- `joins`: array of `{ table: 'graph', on: 'matter.id = graph.src', as: 'edges' }`.
  - For simplicity support only graph joins on `src` or `tgt`.
- `graph_filter`: `{ src?, rel?, tgt? }` filter graph edges.
- `depth`: recursive graph traversal from `src` or `tgt`; limited to small depth (max 3) to avoid performance issues.
- Motion filters: `stream`, `seq_from`, `seq_to`.
- `count`: execute separate `SELECT COUNT(*) ...` query for total matching rows.

**Return:** `{ rows, count, next_offset? }`.

### 3. `update`

**Files:** `tarai/src/lib/tools.ts`, `tarai/src/lib/acl.ts`

**Changes:**

- Load existing record and enforce owner check via `requireOwner`.
- Enforce `client_ref` idempotency: if a motion with same `client_ref` exists for this stream, return existing update result without mutating.
- Support all form patch fields cleanly.

**Return:** unchanged `{ success, id, time, seq }`.

### 4. `delete`

**Files:** `tarai/src/lib/tools.ts`, `tarai/src/lib/acl.ts`

**Changes:**

- Owner check for form/matter; graph rows have no owner, so no owner check.
- When `table === 'graph'` and `hard === true`, delete the exact `(src, rel, tgt)` row.
- `cascade` behavior for form/matter remains soft-deactivate graph edges.

### 5. `link`

**Files:** `tarai/src/lib/tools.ts`

**Changes:**

- Add `scope_check?: string` option.
- If provided, verify `src` and `tgt` each exist in a record with scope matching `scope_check`.
- Owner check on `src` is optional for this cycle; defer to graph roles.

### 6. `search`

**Files:** `tarai/src/lib/tools.ts`, `tarai/src/lib/vectorStore.ts`

**Changes:**

- `mode = 'hybrid'` (default): combine vector and FTS results.
  - Vector score normalized to [0,1].
  - FTS score based on keyword overlap normalized.
  - Final score = 0.7 * vector + 0.3 * FTS.
- `mode = 'vector'`: vector only.
- `mode = 'fts'`: FTS only.
- `mode = 'structured'`: query `matter` table directly with JSON filters, no embedding.
- `filters`: JSON field filters applied after search.
- `geo`: placeholder; return empty results or throw "not implemented" for this cycle.
- Cost guard: if `memory` table has no embeddings for the requested scope/type, fall back to FTS or structured mode.
- `threshold`: apply cutoff consistently across all modes.

## Testing

**New file:** `tarai/src/lib/tools.test.ts`

- Use an in-memory SQLite setup or a test DB file created for each test run.
- Test each tool:
  - Happy path.
  - Validation / missing required fields.
  - ACL rejection when caller ≠ owner.
  - Idempotency via `client_ref`.
  - Graph traversal and joins for `read`.
  - Search modes for `search`.

## Files to Create / Modify

| File | Action | Responsibility |
|------|--------|----------------|
| `tarai/src/lib/acl.ts` | Create | Caller identity, owner-only authorization helpers |
| `tarai/src/lib/tools.ts` | Modify | Core tool implementations |
| `tarai/src/lib/vectorStore.ts` | Modify | Search scoring helpers if needed |
| `tarai/src/lib/db.ts` | Modify (minor) | Expose caller helper consistently |
| `tarai/src/actions/executor.ts` | Modify (minor) | Adjust for any signature changes |
| `tarai/src/lib/tools.test.ts` | Create | Unit tests |

## Out of Scope

- Cloud MCP / DO routing
- Flow engine and 5 primitives
- Agent runtime (router/worker/scheduler/sub-agent DOs)
- Offline sync queue / conflict resolution
- Plugin install/uninstall system
- Graph-weight role levels (0-3)
- Multi-tenant provisioning
- Geo/H3 search implementation

## Deferral Notes

- Graph-weight roles will be added when cloud routing is implemented.
- Geo search is a stub in this cycle because H3 indexing is not yet present.
- Plugin and agent runtimes are not part of this foundation cycle.
