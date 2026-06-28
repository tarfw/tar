# tarai/app Launch Six — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Execute tasks in order; each task must pass its verify step before moving on.

**Goal:** Complete the six launch-necessary gaps identified in `docs/action3.md` ↔ `tarai/app` checklist: atomic transactions, flow engine, formal agent runtime, scope routing, graph-based ACL, and geo search.

**Architecture:** Keep the existing 6-tool core intact. Add a transaction wrapper, a lightweight flow DAG executor, an agent loop, scope-aware DB routing hooks, graph-relation ACL, and H3 geo search — all built on the existing `form/matter/motion/graph/memory` tables.

**Tech Stack:** React Native / Expo, `@tursodatabase/sync-react-native`, TypeScript, `h3-js` (new dependency for geo), existing local SQLite.

---

## Task 1: Atomic transactions for multi-step tool calls

**Files:**
- Modify: `tarai/src/lib/tools.ts` (wrap `create`, `update`, `delete`, `link`)
- Modify: `tarai/src/lib/db.ts` (ensure `Database` exposes `exec('BEGIN')` / `COMMIT` / `ROLLBACK`)
- Test: `tarai/src/lib/tools.transaction.test.ts` (or runtime script)

- [ ] **Step 1: Add transaction helpers on Database type**

Add to `tarai/src/lib/db.ts`:

```ts
export async function withTransaction<T>(db: Database, fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    throw e;
  }
}
```

- [ ] **Step 2: Wrap `create` in a transaction**

Inside `create()`, wrap the INSERT + links + motion + vector upsert in `withTransaction(db, async () => { ... })`.

- [ ] **Step 3: Wrap `update` in a transaction**

Wrap load → validation → UPDATE → motion → vector re-index.

- [ ] **Step 4: Wrap `delete` and `link` in transactions**

Same pattern for the multi-step writes.

- [ ] **Step 5: Verify with a forced failure**

Create a temporary test that passes an invalid `link` inside `create`. Confirm the matter row is not inserted when the link fails.

Run: `npx tsx tarai/src/lib/tools.transaction.test.ts`
Expected: PASS — no partial writes.

---

## Task 2: Flow engine — 5 primitives

**Files:**
- Create: `tarai/src/lib/flow.ts` (DAG executor)
- Create: `tarai/src/lib/flow-types.ts` (flow record types)
- Modify: `tarai/src/lib/tools.ts` (import flow executor for `flow:` tool targets)
- Modify: `tarai/src/actions/executor.ts` (support `type: 'flow'` actions)
- Test: `tarai/src/lib/flow.test.ts`

- [ ] **Step 1: Define flow record types**

```ts
export type FlowPrimitive = 'sequence' | 'parallel' | 'branch' | 'loop' | 'wait';

export interface FlowStep {
  id: string;
  primitive: FlowPrimitive;
  requires?: string[];
  tool?: string;
  params?: Record<string, any>;
  calls?: { tool: string; params: Record<string, any> }[];
  conditions?: { if: string; then: string }[];
  iterate_over?: string;
  body?: { tool: string; params: Record<string, any> };
  wait_for?: { event: 'motion'; opcode?: number; stream?: string } | { event: 'timer'; duration: string };
  timeout?: string;
  on_timeout?: string;
}

export interface FlowDef {
  id: string;
  type: 'flow';
  scope: string;
  data: {
    pattern?: string;
    steps: FlowStep[];
    on_failure?: 'rollback_phase' | 'abort';
    idempotent?: boolean;
  };
}
```

- [ ] **Step 2: Build variable resolver**

Helper `resolveVars(obj, context)` replaces `$stepId.result.field`, `$caller`, `$id`, etc., with actual values from prior step results.

- [ ] **Step 3: Implement sequence primitive**

Call the specified tool with resolved params. Store result under `context.results[step.id]`.

- [ ] **Step 4: Implement parallel primitive**

Execute `calls` array concurrently with `Promise.all`. Store merged results.

- [ ] **Step 5: Implement branch primitive**

Evaluate `conditions` in order using a tiny expression evaluator (`$step.result.field > 0`). Return the matched `then` step id; scheduler continues from there.

- [ ] **Step 6: Implement loop primitive**

Resolve `iterate_over` to an array. Run `body` tool for each item, collecting results.

- [ ] **Step 7: Implement wait primitive**

For `timer`: `setTimeout`. For `motion`: poll `read(table='motion', stream=..., seq_from=...)` until matching opcode appears, or `timeout` fires and routes to `on_timeout`.

- [ ] **Step 8: Wire flows into action executor**

In `executor.ts`, if `action.type === 'flow'`, load the flow `form` record and call `executeFlow(flow, context)`.

- [ ] **Step 9: Verify a sample food order flow**

Create a flow `wf_test_order`: sequence create cart → sequence create order → parallel link customer + update confirm.

Run: `npx tsx tarai/src/lib/flow.test.ts`
Expected: PASS — flow completes, cart and order matters exist, graph links active.

---

## Task 3: Formal agent runtime

**Files:**
- Create: `tarai/src/lib/agent.ts` (agent loop)
- Create: `tarai/src/lib/agent-types.ts`
- Modify: `tarai/src/lib/ai.ts` (expose LLM tool-calling interface)
- Modify: `tarai/src/app/chat.tsx` (use agent runtime)
- Test: `tarai/src/lib/agent.test.ts`

- [ ] **Step 1: Define agent record types**

```ts
export type AgentType = 'router' | 'worker' | 'scheduler' | 'subagent';

export interface AgentDef {
  id: string;
  type: 'agent';
  scope: string;
  data: {
    agent_type: AgentType;
    trigger: { type: 'user_message' | 'motion_event' | 'cron' | 'http_request' | 'spawn'; [k: string]: any };
    prompt: string;
    tools: string[];
    max_iterations: number;
    exit_condition?: string;
    flow?: string;
    steps?: { tool: string; params: Record<string, any> }[];
  };
}
```

- [ ] **Step 2: Build agent context injection**

Function `buildAgentContext(agent, userId, scope, triggerData)` returns `{ user_id, scope, active_entity, trigger_data }`.

- [ ] **Step 3: Implement scheduler agent (no LLM)**

If `agent_type === 'scheduler'`, execute `steps` deterministically with the 6 tools.

- [ ] **Step 4: Implement router agent (LLM)**

Call LLM with prompt + available actions list. Parse JSON `{ intent, entity, context, verb, noun, action_id }` and return the matching action.

- [ ] **Step 5: Implement worker agent (LLM loop)**

Repeatedly call LLM with `{ prompt, context, previous_results }`. LLM responds with `{ tool, params }` or `done`. Execute up to `max_iterations`, respecting `tools` allow-list. If `flow` is set, hand off to flow engine.

- [ ] **Step 6: Wire chat to router agent**

In `chat.tsx`, route user messages through `agent_router` (or fallback) instead of direct action matching.

- [ ] **Step 7: Verify**

Run: `npx tsx tarai/src/lib/agent.test.ts`
Expected: PASS — scheduler agent executes steps; router agent picks correct action; worker agent calls tools iteratively.

---

## Task 4: Scope routing for `t:` and `s:`

**Files:**
- Modify: `tarai/src/lib/db.ts` (`routeDbForEntity`)
- Create: `tarai/src/lib/remote.ts` (cloud MCP client stub/interface)
- Modify: `tarai/src/lib/tools.ts` (use routed DB/client)
- Test: `tarai/src/lib/db.test.ts`

- [ ] **Step 1: Add scope metadata helpers**

```ts
export function scopePrefix(scope: string): 'p' | 't' | 's' | 'g' {
  if (scope.startsWith('p:') || scope === 'p') return 'p';
  if (scope.startsWith('t:') || scope === 't') return 't';
  if (scope.startsWith('s:') || scope === 's') return 's';
  return 'g';
}
```

- [ ] **Step 2: Formalize routing decision**

Update `routeDbForEntity` to return `{ kind: 'local' | 'cloud', db: Database, target: string }`. For now, `t:` and `s:` return `kind: 'cloud'` with a placeholder remote client. `p:` returns local DB.

- [ ] **Step 3: Create cloud MCP client interface**

```ts
export interface CloudMcpClient {
  call(tool: string, params: any): Promise<any>;
}

let cloudClient: CloudMcpClient | null = null;
export function setCloudClient(client: CloudMcpClient) {}
export function getCloudClient(): CloudMcpClient | null {}
```

- [ ] **Step 4: Wrap tools to use remote client for cloud scopes**

In each tool, if routed client is cloud and no cloud client is set, throw `CloudNotConfiguredError`. If set, forward the call.

- [ ] **Step 5: Verify**

Run: `npx tsx tarai/src/lib/db.test.ts`
Expected: PASS — `p:` routes local, `t:/s:` route cloud, missing cloud client throws clear error.

---

## Task 5: Graph-based ACL

**Files:**
- Modify: `tarai/src/lib/acl.ts`
- Modify: `tarai/src/lib/tools.ts` (call ACL checks on read/update/delete)
- Test: `tarai/src/lib/acl.test.ts`

- [ ] **Step 1: Add role helpers**

```ts
export type RoleWeight = 0 | 1 | 2 | 3;

export async function getRole(db: Database, personId: string, scope: string): Promise<RoleWeight> {
  const owner = await db.get('SELECT owner FROM form WHERE scope = ? UNION ALL SELECT owner FROM matter WHERE scope = ? LIMIT 1', [scope, scope]);
  if (owner?.owner === personId) return 3;
  const edge = await db.get(
    "SELECT weight FROM graph WHERE src = ? AND (tgt = ? OR tgt LIKE ? || '%') AND rel IN ('member_of','works_for','customer_of','owns') AND active = 1 ORDER BY weight DESC LIMIT 1",
    [personId, scope, scope]
  );
  return (edge?.weight ?? -1) as RoleWeight;
}
```

- [ ] **Step 2: Add permission checks**

```ts
export function canRead(role: RoleWeight, isPublic: boolean): boolean { return isPublic || role >= 0; }
export function canCreate(role: RoleWeight): boolean { return role >= 1; }
export function canUpdate(role: RoleWeight, owner: string | null, caller: string): boolean { return role >= 2 || owner === caller; }
export function canDelete(role: RoleWeight, owner: string | null, caller: string): boolean { return role >= 2 || (role >= 0 && owner === caller && scopeIsPersonal(scope)); }
```

- [ ] **Step 3: Enforce in tools**

In `read`, add `public` form visibility and role filter. In `create`, check `canCreate`. In `update`/`delete`, check `canUpdate`/`canDelete` using `getRole`.

- [ ] **Step 4: Verify**

Run: `npx tsx tarai/src/lib/acl.test.ts`
Expected: PASS — owner can update, member can read/create, admin can update/delete, public forms readable.

---

## Task 6: Geo search

**Files:**
- Add dependency: `h3-js`
- Modify: `tarai/src/lib/tools.ts` (`search` geo mode)
- Modify: `tarai/src/lib/schema.ts` (add geo index)
- Create: `tarai/src/lib/geo.ts`
- Test: `tarai/src/lib/geo.test.ts`

- [ ] **Step 1: Install `h3-js`**

Run: `cd tarai && npm install h3-js`

- [ ] **Step 2: Add geo helpers**

```ts
import { latLngToCell, cellToLatLng, gridDisk, greatCircleDistance } from 'h3-js';

export function encodeGeo(lat: number, lng: number, res = 9): string {
  return latLngToCell(lat, lng, res);
}

export function nearbyCells(h3Index: string, ringSize = 1): string[] {
  return gridDisk(h3Index, ringSize);
}
```

- [ ] **Step 3: Add geo index**

Add to `SCHEMA_STATEMENTS`:

```sql
CREATE INDEX IF NOT EXISTS matter_geo ON matter(geo);
```

- [ ] **Step 4: Implement geo search in `search`**

When `mode === 'geo'`:
- Encode `opts.geo.center` to H3.
- Compute neighbor cells.
- Query `matter` where `geo IN (?)` and optional scope/type filters.
- Rank by great-circle distance.

- [ ] **Step 5: Verify**

Run: `npx tsx tarai/src/lib/geo.test.ts`
Expected: PASS — nearby drivers returned, far drivers excluded.

---

## Final verification

- [ ] Run full test suite: `cd tarai && npm test`
- [ ] Smoke-test the app launch: `cd tarai && npx expo start --android` (or iOS)
- [ ] Re-generate checklist: update `docs/action3-checklist.md` to mark items complete.
