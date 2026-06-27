# TAR — Final Unified System Architecture

> **One identity. One schema. One motion.**
> If you can describe it as a form, it can exist. If it exists, it is matter. If it changes, it leaves motion. If it relates, it enters graph. If it means something, it lives in memory.

---

## 0. Philosophy

| TAR Concept | Table | Philosophical Role | Question Answered |
|-------------|-------|-------------------|-------------------|
| **Form** | `form` | Blueprint — what a thing *is* | What is it? |
| **Matter** | `matter` | Instance — what a thing *is now* | Where is it? |
| **Motion** | `motion` | Event — what *happened* to it | What happened? |
| **Graph** | `graph` | Relation — what it is *connected to* | What is it linked to? |
| **Memory** | `memory` | Meaning — what it *resembles* | What is it like? |

**3 Entities.** 5 Tables. 6 Tools. 5 Flow Primitives. 4 Agent Types. 2 MCP Servers. No exceptions.

---

## 1. Architecture Overview

### 3 Entities

| Entity | Scope | DO Type | Identity | Holds |
|--------|-------|---------|----------|-------|
| **People** | `p:{sub}` | Local SQLite (device) | Google `sub` / UUID | All humans: users, contacts, leads, drivers, vendors |
| **Workspace** | `t:{id}` | Workspace DO (cloud) | Workspace UUID | Internal work: HR, Project, Logistics, Pages, Invoices, Expenses, Marketing |
| **Store** | `s:{id}` | Storefront DO (cloud) | Store UUID | External business: CRM, Food, POS, E-Commerce, Services, Taxi, Quotes, Marketplace, Payments |

### 16 Contexts

Each context is **scope + types + opcodes + flow pattern**. Not code.

| Store (`s:`) | Workspace (`t:`) | Shared |
|-------------|------------------|--------|
| CRM, E-Commerce, Food, POS, Services, Taxi, Quotes, Marketplace | HR, Project, Logistics, Pages, Invoices, Expenses, Marketing | Payments |

### Routing Rule (Single)

```
scope.startsWith('p:') → Local MCP  (in-process SQLite)
scope.startsWith('t:') → Cloud MCP  → Workspace DO
scope.startsWith('s:') → Cloud MCP  → Storefront DO
```

### System Topology

```
User Input (Chat / UI / Voice / Webhook / Cron)
    │
    ▼
┌─────────────────────────────────────────────────┐
│ MCP CLIENT                                       │
│ 1. Inject Context {user_id, scope, entity}      │
│ 2. Select Prompt (agent form record)             │
│ 3. Route: action | flow | agent                  │
│ 4. Scope Router: p: → Local | t:/s: → Cloud     │
└──────────┬──────────────────────────────────────┘
           │
    ┌──────┴──────┐ ▼             ▼
┌─────────┐  ┌──────────────────────────┐
│ LOCAL   │  │ CLOUD MCP                 │
│ MCP     │  │  ┌──────────────┐         │
│         │  │  │ Workspace DO │ (t:)    │
│ SQLite  │  │  │ SQLite       │         │
│ (p:)    │  │  └──────────────┘         │
│         │  │  ┌──────────────┐         │
│         │  │  │ Storefront DO│ (s:)    │
│         │  │  │ SQLite       │         │
│         │  │  └──────────────┘         │
│         │  │  ┌──────────────┐         │
│         │  │  │ Sub-Agent DOs│ spawn   │
│         │  │  │ (hibernate)  │         │
│         │  │  └──────────────┘         │
└─────────┘  └──────────────────────────┘
```

---

## 2. The 5 Tables

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1. FORM: Blueprints, schemas, templates, flows, agents, plugins
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE form (
    id      TEXT PRIMARY KEY,
    code    TEXT UNIQUE,           -- human-readable slug
    type    TEXT NOT NULL,         -- 'person','product','order_tpl','flow','agent','plugin'
    scope   TEXT NOT NULL,         -- 'p:','t:{id}','s:{id}'
    owner   TEXT,                  -- creator p:{sub}
    title   TEXT,
    public  INTEGER DEFAULT 0,     -- read-only shared access
    active  INTEGER DEFAULT 1,
    data    TEXT,                  -- JSON: schema, state machine, flow steps, agent config
    time    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- 2. MATTER: Instances, records, state, inventory, contacts
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE matter (
    id      TEXT PRIMARY KEY,
    form    TEXT NOT NULL,         -- references form.id (blueprint)
    type    TEXT NOT NULL,         -- 'order','issue','lead','shift','payment','contact'...
    scope   TEXT NOT NULL,         -- 'p:{sub}','t:{id}','s:{id}'
    qty     REAL,
    value   REAL,
    active  INTEGER DEFAULT 1,
    variant INTEGER,               -- SKU variant, leave type, priority level
    mark    INTEGER DEFAULT 0,     -- 0=none, 1=important, 2=urgent, 3=archived
    geo     TEXT,                  -- "lat,lng" or H3 hex index
    start   TEXT,                  -- scheduled start
    end     TEXT,                  -- scheduled end / deadline
    data    TEXT,                  -- JSON: all business fields + current state
    owner   TEXT,                  -- immutable creator p:{sub}
    time    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- 3. MOTION: Append-only event log (history, audit, state transitions)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE motion (
    stream     TEXT NOT NULL,      -- matter.id or form.id (the subject)
    seq        INTEGER NOT NULL,   -- monotonic per stream
    action     INTEGER NOT NULL,   -- universal opcode (block-defined)
    phase      INTEGER,            -- target state index (for transitions)
    delta      REAL,               -- change in qty or value
    client_ref TEXT,               -- who performed the action (p:{sub})
    data       TEXT,               -- event payload JSON
    time       TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stream, seq)
);

-- ═══════════════════════════════════════════════════════════════
-- 4. GRAPH: Hyper-relational edges (directional, typed, weighted)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE graph (
    src    TEXT NOT NULL,          -- source node (matter/form/person id)
    rel    TEXT NOT NULL,          -- relation: 'assigned_to','member_of','owns_contact'...
    tgt    TEXT NOT NULL,          -- target node
    weight REAL DEFAULT 1.0,
    active INTEGER DEFAULT 1,
    time   TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, rel, tgt)
);
CREATE INDEX graph_tgt ON graph(tgt, rel, src);   -- reverse lookup

-- ═══════════════════════════════════════════════════════════════
-- 5. MEMORY: Semantic index (vector + FTS + metadata)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE memory (
    id        TEXT NOT NULL,      -- form.id or matter.id
    chunk     INTEGER NOT NULL DEFAULT 0,
    text      TEXT,               -- raw text for Full-Text Search
    embedding BLOB,               -- serialized vector
    meta      TEXT,               -- JSON: {table, scope, type, title, owner}
    PRIMARY KEY (id, chunk)
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES (covering indexes for common query patterns)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX matter_scope_type ON matter(scope, type, active, time);
CREATE INDEX matter_owner ON matter(scope, owner, active);
CREATE INDEX form_scope_type ON form(scope, type, active);
CREATE INDEX motion_stream ON motion(stream, seq);
```

### Schema Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `graph.rel` not `graph.type` | Avoids naming collision with `form.type` and `matter.type` | 3 tables with a column named `type` = confusion |
| `matter.owner` | Immutable creator provenance | Answers "who created this?" without querying motion |
| `memory.id` not `memory.form` | Indexes both forms AND matters | Most search targets are matters (orders, contacts), not just forms |
| `memory.text` | Raw text for FTS | Without this, hybrid search is impossible — FTS has nothing to match |
| `memory.meta` | JSON metadata for filtering | Search results filterable by scope/type without joining back |
| `graph_tgt` index | Reverse lookup O(log n) | "Who is assigned to this project?" without full table scan |
| Covering indexes | `(scope, type, active, time)` | Most queries filter by scope + type + active, order by time |

---

## 3. The 6 Tools (Perfected)

> **Tools are the only code. Everything else is data.**

### Tool 1: `create`

```
create(opts) → { id, time, status: "created" }

opts:
  table       'form' | 'matter'        -- which table to insert into
  scope       string                    -- 'p:{sub}', 't:{id}', 's:{id}'
  type        string                    -- entity type
  code?       string                    -- for form: unique slug
  form?       string                    -- for matter: blueprint form.id
  owner?      string                    -- creator p:{sub}
  title?      string                    -- for form
  public?     boolean                   -- for form, default false
  qty?        number                    -- for matter
  value?      number                    -- for matter
  variant?    number                    -- for matter
  geo?        string                    -- for matter
  start?      string                    -- for matter
  end?        string                    -- for matter
  data?       object                    -- JSON payload (business fields)
  links?      [{src, rel, tgt, weight}] -- atomic graph edges ($id = new record id)
  motion?     {action, phase?, delta?}  -- explicit motion (default: action=1000 INIT)
  embed?      boolean                   -- generate vector embedding, default true
  client_ref  string                    -- idempotency key
```

**Behavior:**
1. Validate `scope` — caller must have write access (graph ACL check for `t:`/`s:`)
2. If `form` provided → load blueprint → validate `data` against `form.data.schema`
3. INSERT into `form` or `matter`
4. If `links` provided → for each link: resolve `$id` → INSERT/UPSERT into `graph`
5. INSERT into `motion` (stream=new_id, seq=1, action=motion.action ?? 1000, client_ref)
6. If `embed=true` and table is `form` or `matter` → generate embedding from `title`+`data` → INSERT into `memory` (text=concatenated fields, meta={table, scope, type, title, owner})
7. Return `{ id, time, status: "created" }`

**Atomic.** Full transaction. All-or-nothing. Single MCP round-trip.

**Why atomic links matter:** Creating a lead + assigning an owner = 1 call, not 2. Fewer round-trips, fewer failure points, lower cost.

---

### Tool 2: `read`

```
read(opts) → { rows: [], count, next_offset? }

opts:
  table         'form' | 'matter' | 'motion' | 'graph'
  scope string                    -- mandatory scope filter
  id?           string                    -- specific record
  type?         string                    -- filter by type
  form?         string                    -- filter by form (matter only)
  active?       boolean                   -- default true
  fields?       string[]                  -- project from JSON data
  filters?      [{key, val}]              -- JSON field filters in data
  joins?        [{table, on, as}]         -- join tables (e.g., graph edges)
  graph_filter? {src?, rel?, tgt?}       -- graph traversal
  depth?        number                    -- graph traversal depth (default 0)
  stream?       string                    -- motion: stream id
  seq_from?     number                    -- motion: from sequence
  seq_to?       number                    -- motion: to sequence
  order?        string                    -- 'time DESC', 'seq ASC', 'value DESC'...
  limit?        number                    -- default 50
  offset?       number                    -- default 0
```

**Behavior:**
1. Build SELECT from opts with mandatory `scope` enforcement
2. If `joins` → LEFT JOIN specified tables (e.g., graph edges onto matter)
3. If `graph_filter` → filter by graph relationship4. If `depth > 0` → recursive graph traversal from `src` or `tgt`
5. If `fields` → extract from JSON `data` column
6. Enforce scope visibility (see §12 Security)
7. Return `{ rows, count, next_offset? }`

**Read-only.** No side effects. No motion. No cost beyond the query.

**Why joins matter:** A single `read` returns an order + its customer (graph edge) + its items (child matters). Without joins, that's 3 round-trips.

---

### Tool 3: `update`

```
update(opts) → { id, changed_fields, time, seq } | { success: false, reason }

opts:
  table       'form' | 'matter'
  id          string                    -- record to update
  scope       string                    -- mandatory scope check
  patch: {
    qty?      number
    value?    number
    active?   boolean
    mark?     number
    variant?  number
    geo?      string
    start?    string
    end?      string
    data?     object                    -- DEEP-MERGE into existing JSON (not replace)
    title?    string                    -- form only
    public?   boolean                   -- form only
  }
  phase?      number                    -- target state index (triggers state machine validation)
  opcode?     number                    -- motion.action (auto-derived from transition if phase given)
  delta?      number                    -- motion.delta (qty/value change)
  reason?     string                    -- human-readable reason for audit
  client_ref  string                    -- idempotency key
```

**Behavior:**
1. Load record by `id` + verify `scope` match
2. Verify caller is `owner` or graph-authorized admin
3. If `phase` provided → **state machine validation**:
   a. Load `form` blueprint by `matter.form`
   b. Read `form.data.states` and `form.data.transitions`
   c. `current_state` = `matter.data.state` ?? `states[0]`
   d. `target_state` = `states[phase]`
   e. Find transition: `{from: current_state, to: target_state}`
   f. If no valid transition → return `{ success: false, reason: "invalid_transition" }`
   g. `opcode` = transition.opcode (overrides any provided opcode)
   h. Set `patch.data.state` = `target_state`
4. If `patch.data` provided → **deep-merge** into existing JSON (not replace)
5. UPDATE row
6. INSERT into `motion` (stream=id, seq=next, action=opcode ?? 1001, phase, delta, data={reason, changed_fields}, client_ref)
7. If table is `matter` → regenerate embedding → UPSERT `memory`
8. Return `{ id, changed_fields, time, seq }`

**Atomic.** State-machine validated. Deep-merge preserves existing data. Motion logged.

**Why deep-merge matters:** `update(id, patch={data:{status:"paid"}})` merges into existing `{items:[...], total:99, customer:"x"}` → results in `{items:[...], total:99, customer:"x", status:"paid"}`. No data loss on partial updates.

**Why state machine validation matters:** Prevents invalid transitions (e.g., `delivered` → `preparing`). The state machine is data in the form record, not code. New state machine = new form record.

---

### Tool 4: `delete`

```
delete(opts) → { id, mode: "soft" | "hard", seq }

opts:
  table       'form' | 'matter' | 'graph'
  id          string
  scope       string                    -- mandatory scope check
  hard?       boolean                   -- default false (soft)
  cascade?    boolean                   -- default true (deactivate graph edges)
  client_ref  string
```

**Behavior:**
1. Verify scope + ownership/admin
2. If `hard=false` → UPDATE `active=0` (soft delete)
3. If `hard=true` → DELETE row (**only allowed for `p:` local data owned by self**)
4. If `cascade=true` → UPDATE `graph` SET `active=0` WHERE `src=id` OR `tgt=id`
5. INSERT into `motion` (stream=id, seq=next, action=1002, client_ref)
6. Return `{ id, mode, seq }`

**Soft by default.** History preserved. Reversible. Hard delete restricted to personal local data (privacy/GDPR).

---

### Tool 5: `link`

```
link(opts) → { src, rel, tgt, status: "created" | "updated" }

opts:
  src           string                  -- source node id
  rel           string                  -- relation type
  tgt           string                  -- target node id
  weight?       number                  -- default 1.0
  bidirectional? boolean                -- default false (creates reverse edge)
  active?       boolean                -- default true (false = deactivate edge)
  scope_check?  string                  -- verify both nodes in accessible scope
  client_ref    string
```

**Behavior:**
1. If `scope_check` → verify `src` and `tgt` exist within accessible scope
2. UPSERT into `graph` (src, rel, tgt, weight, active, time)
3. If `bidirectional` → UPSERT reverse (tgt, rel, src, weight, active, time)
4. INSERT into `motion` (stream=src, seq=next, action=1001, data={rel, tgt, weight}, client_ref)
5. Return `{ src, rel, tgt, status }`

**Idempotent.** Same (src, rel, tgt) = updates weight/timestamp. No duplicates.

---

### Tool 6: `search`

```
search(opts) → [{ id, table, score, snippet, meta: {type, scope, title, owner} }]

opts:
  query string                   -- text query
  scope?       string                   -- filter by scope
  type?        string                   -- filter by entity type
  table?       'form' | 'matter'        -- default: both
  mode?        'hybrid' | 'vector' | 'fts' | 'structured' | 'geo' -- default: hybrid
  vector?      number[]                 -- pre-computed embedding (skip query embedding)
  filters?     [{key, val}]            -- structured JSON field filters
  geo?         {center, radius}         -- geo proximity filter
  join_graph?  {rel?, tgt?}            -- filter by graph relationship
  limit?       number                   -- default 10
  threshold?   number                   -- similarity cutoff, default 0.0
```

**Behavior:**
1. **Cost guard:** Check if `memory` has embeddings for this scope. If not → fall back to FTS-only mode.
2. **Vector mode:** Generate query embedding → cosine similarity against `memory.embedding` → ranked results
3. **FTS mode:** Full-text search on `memory.text` → ranked results
4. **Structured mode:** JSON field filters on `matter.data` → filtered results
5. **Geo mode:** H3 hex proximity query on `matter.geo` → spatial results
6. **Hybrid mode (default):** Vector (0.7 weight) + FTS (0.3 weight) → merge + re-rank
7. Apply `scope`, `type`, `filters`, `geo`, `join_graph` post-filtering
8. Apply `threshold` cutoff
9. Return ranked results with `meta` for each

**On-demand.** No writes. No motion. Cost guard prevents unnecessary vector computation.

**Why 5 modes matter:** Different use cases need different search. "Find orders near this location" = geo. "Find all expenses > $500 in January" = structured. "Find documents about payment processing" = hybrid. One tool, all modes.

---

### Tool Composition Matrix

| Tool | form | matter | motion | graph | memory | Writes Motion? | Writes Memory? | Atomic Multi-Write? |
|------|------|--------|--------|-------|--------|---------------|----------------|---------------------|
| `create` | ✅ INSERT | ✅ INSERT | ✅ INSERT | ✅ (via `links[]`) | ✅ INSERT | ✅ | ✅ | ✅ |
| `read` | ✅ SELECT | ✅ SELECT | ✅ SELECT | ✅ SELECT (via joins) | — | ❌ | ❌ | — |
| `update` | ✅ UPDATE | ✅ UPDATE | ✅ INSERT | — | ✅ UPSERT | ✅ | ✅ | — |
| `delete` | ✅ (soft) | ✅ (soft) | ✅ INSERT | ✅ (soft cascade) | — | ✅ | ❌ | ✅ (cascade) |
| `link` | — | — | ✅ INSERT | ✅ UPSERT | — | ✅ | ❌ | — |
| `search` | — | — | — | ✅ (via `join_graph`) | ✅ SELECT | ❌ | ❌ | — |

**Rule:** Every mutating tool writes exactly one `motion` record. No exceptions. Every `create`/`update` of `form`/`matter` updates `memory`. No exceptions.

---

## 4. State Machines (Data, Not Code)

State machines live in `form.data`. The `update` tool validates transitions. No state machine code exists.

```json
// form record: order blueprint
{
  "id": "form_order",
  "type": "order_template",
  "data": {
    "schema": {
      "items": "array|required",
      "total": "number|required",
      "customer_id": "string|required"
    },
    "states": ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"],
    "transitions": [
      { "from": "pending",   "to": "confirmed",  "opcode": 105 },
      { "from": "confirmed", "to": "preparing",  "opcode": 106 },
      { "from": "preparing", "to": "ready",      "opcode": 107 },
      { "from": "ready",     "to": "delivered",  "opcode": 404 },
      { "from": "*",         "to": "cancelled",  "opcode": 108 }
    ]
  }
}
```

**How `update` uses it:**
1. Load `matter` by id → get `matter.form` → load form blueprint
2. `current_state` = `matter.data.state` ?? `states[0]`
3. `target_state` = `states[phase]`
4. Find matching transition in `transitions[]`
5. If valid → update `matter.data.state = target_state` + motion (with transition.opcode)
6. If invalid → reject

**New state machine = new form record. Zero deployment.**

---

## 5. Actions (Zero Repetition)

An **Action** is not code. It is a declared intent stored as a `form` record.

### Action = { entity, context, verb, noun, schema }

| Element | Values | Example |
|---------|--------|---------|
| **Entity** | `people \| workspace \| store` | `store` |
| **Context** | 16 verticals | `crm` |
| **Verb** | `create \| read \| update \| delete \| assign \| search \| log \| convert` | `create` |
| **Noun** | `matter.type` or `form.type` | `lead` |
| **Schema** | tool + params + links + motion opcode | `{tool:"create", opcode:301, links:[{rel:"owned_by",tgt:"$caller"}]}` |

### Verb → Tool Mapping (The Collapse)

| Verb | Tool(s) | What Happens | Example |
|------|---------|-------------|---------|
| `create` | `create` | INSERT matter + links + motion + memory | `create lead` → create(type='lead', opcode=301, links=[owned_by]) |
| `read` | `read` | SELECT with scope filter | `read issues` → read(type='issue', scope='t:{id}') |
| `update` | `update` | UPDATE matter + motion (state transition) | `start issue` → update(id, phase=2, opcode=309) |
| `delete` | `delete` | Soft delete + motion | `archive page` → delete(id, opcode=1002) |
| `assign` | `link` | UPSERT graph edge + motion | `assign driver` → link(src=driver, rel='assigned_to', tgt=shipment) |
| `search` | `search` | Vector + FTS query | `search pages` → search(query, type='page', scope='t:{id}') |
| `log` | `create` | INSERT motion only (event log) | `log visit` → create(table='motion', action=302) |
| `convert` | `update` + `link` | UPDATE matter type + link to new entity | `convert lead` → update(id, type='customer') + link(p, s, 'customer_of') |

### Same Tools, Different Config — No New Code

| Step | `create lead` (CRM) | `create issue` (Project) |
|------|---------------------|---------------------------|
| 1. Validate | `read` form `lead_template` | `read` form `issue_template` |
| 2. Create | `create` matter `type='lead', scope='s:{id}'` | `create` matter `type='issue', scope='t:{id}'` |
| 3. Relate | `links:[{rel:'owned_by', tgt:'p:sales'}]` | `links:[{rel:'for_project', tgt:'proj_99'}]` |
| 4. Event | `motion:{action:301}` | `motion:{action:307}` |

**~130 actions = ~130 form records.** Zero functions. Zero deployments.

---

## 6. Flows (5 Primitives → ~60 Instances)

A **Flow** is a DAG of tool calls. All vertical workflows compose from 5 control-flow primitives.

### The 5 Primitives

| Primitive | Symbol | Description | Use Case |
|-----------|--------|-------------|----------|
| **Sequence** | `→` | Execute tools in order, pass output forward | Linear lifecycle steps |
| **Parallel** | `⇉` | Execute independent tool calls simultaneously | Create + link in one step |
| **Branch** | `?` | Conditional routing based on `read` result | Payment success/failure paths |
| **Loop** | `↻` | Iterate over `read` result set, tool per item | Batch process all pending orders |
| **Wait** | `⏻` | Pause for external event (webhook, timer, human) | Wait for kitchen prep, wait for payment confirmation |

### Flow Record Structure (Stored as `form`)

```json
{
  "id": "wf_food_order",
  "type": "flow",
  "scope": "s:",
  "data": {
    "pattern": "transaction",
    "steps": [
      {
        "id": "s1",
        "primitive": "sequence",
        "tool": "create",
        "params": { "table": "matter", "type": "cart", "opcode": 102 }
      },
      {
        "id": "s2",
        "primitive": "sequence",
        "tool": "create",
        "params": { "table": "matter", "type": "order", "opcode": 104 },
        "requires": ["s1"]
      },
      {
        "id": "s3",
        "primitive": "parallel",
        "calls": [
          { "tool": "link", "params": { "src": "$s2.id", "rel": "ordered_by", "tgt": "$caller" } },
          { "tool": "update", "params": { "id": "$s2.id", "phase": 1, "opcode": 105 } }
        ],
        "requires": ["s2"]
      },
      {
        "id": "s4",
        "primitive": "wait",
        "wait_for": { "event": "motion", "opcode": 107, "stream": "$s2.id" },
        "timeout": "45m",
        "on_timeout": "s_cancel",
        "requires": ["s3"]
      },
      {
        "id": "s5",
        "primitive": "branch",
        "conditions": [
          { "if": "$s4.result.delta > 0", "then": "s6" },
          { "if": "$s4.result.delta <= 0", "then": "s_cancel" }
        ],
        "requires": ["s4"]
      },
      {
        "id": "s6",
        "primitive": "sequence",
        "tool": "create",
        "params": { "table": "matter", "type": "delivery", "opcode": 401 },
        "requires": ["s5"]
      },
      {
        "id": "s7",
        "primitive": "loop",
        "iterate_over": "$s6.result.items",
        "body": { "tool": "update", "params": { "id": "$item.id", "patch": { "mark": 1 } } },
        "requires": ["s6"]
      },
      {
        "id": "s_cancel",
        "primitive": "sequence",
        "tool": "update",
        "params": { "opcode": 108, "phase": 5 },
        "requires": []
      }
    ],
    "on_failure": "rollback_phase",
    "idempotent": true
  }
}
```

### Flow Composition Examples

| Flow | Primitive Chain | Context |
|------|----------------|---------|
| `wf_food_order` | `create(cart) → create(order) ⇉ [link(customer), update(confirm)] ⏻ wait(kitchen) ? {ready} → create(delivery) ↻ update(items) → update(delivered)` | Food |
| `wf_crm_funnel` | `create(lead) → link(owner) ? {hot} → create(motion) ⏻ wait(7d) ? {no_reply} → create(motion) → link(new_owner)` | CRM |
| `wf_project_lifecycle` | `create(issue) ⇉ [link(project), link(sprint), link(assignee)] ? {blocked} → link(blocker) ⏻ wait(done) → update(active=0)` | Project |
| `wf_hr_cycle` | `create(shift) → link(employee) ⏻ wait(8h) → read(clock_out?) ? {no} → create(motion:missed) → update(mark=1)` | HR |
| `wf_invoice_billing` | `create(invoice) ⇉ [link(order), link(customer)] ⏻ wait(14d) ? {unpaid} → create(motion:overdue) → search(contact) → create(reminder)` | Invoices |
| `wf_expense_approval` | `create(expense) → link(submitter) ⏻ wait(approval) ? {approved} → update(phase=1) ? {rejected} → update(phase=2)` | Expenses |
| `wf_taxi_dispatch` | `create(ride) → search(drivers, geo) ? {found} → link(driver, assigned_to) ⏻ wait(arrival) → update(started) ⏻ wait(end) → create(motion:completed)` | Taxi |
| `wf_cart_abandon` | `create(cart) ⏻ wait(30m) ? {still_active} → create(motion:abandoned) → search(contact) → create(reminder_email)` | E-Commerce |
| `wf_personal_sync` | `read(sync_queue) ↻ create(cloud_matter) → update(synced) ⇉ [link(cloud), delete(local)]` | People |
| `wf_daily_reconcile` | `read(payments, today) ↻ read(settlements) ? {mismatch} → create(motion:discrepancy) → link(admin)` | Payments |

### Flow Execution Rules

1. **Sequential by default** — steps run in `requires` order
2. **`requires`** — step waits for referenced steps to complete
3. **`$id` placeholder** — resolved from prior step results
4. **`on_failure`** — `rollback_phase` (revert to last stable state) or `abort`
5. **Idempotent** — `client_ref` prevents duplicate execution
6. **Composable** — a step can reference another flow: `"tool": "flow:wf_billing"`
7. **No code** — MCP client reads the form record and executes tool calls

### Why 5 Primitives Beat 8 Business Patterns

| Approach | New Business Flow | Turing-Complete? | Self-Documenting? |
|----------|------------------|------------------|-------------------|
| 8 business patterns (Lifecycle, Transaction, Approval...) | Must fit existing pattern or add new one | ❌ No | ✅ Yes (pattern name = intent) |
| 5 control-flow primitives (Sequence, Parallel, Branch, Loop, Wait) | Always composable from existing primitives | ✅ Yes | ⚠️ Read DAG to understand intent |

**5 primitives are Turing-complete for flow composition.** Any business flow that can be described can be composed. No new primitives ever needed.

---

## 7. Agents (4 Types → ~50 Instances)

An **Agent** is an LLM-orchestrated MCP Client session. Not a new runtime. Not new code.

### The 4 Types

| Type | Trigger | LLM? | Role | Tools | Examples |
|------|---------|------|------|-------|----------|
| **Router** | User message | ✅ | Classify intent → select entity + context + flow | `read`, `search` | `agent_invite_router`, `agent_personal_assistant` (entry) |
| **Worker** | Flow invocation, motion event, webhook, user message (post-route) | ✅ | Execute flow steps, handle retries, make decisions | All 6 | `agent_food_order`, `agent_crm_lead`, `agent_booking_assistant`, `agent_quote_creator`, `agent_pos_cashier`, `agent_project_triage`, `agent_invoice_reminder`, `agent_ec_webhook` |
| **Scheduler** | Cron / timer | ❌ | Pure deterministic tool invocation on schedule | `read`, `create`, `update` | `agent_hr_payroll`, `agent_marketing_scheduler`, `agent_crm_birthday`, `agent_crm_followup`, `agent_expense_approval`, `agent_payment_reconcile` |
| **Sub-Agent DO** | Spawn request | ✅ or ❌ | Stateless, isolated, hibernates after task | Subset | `search_do`, `worker_do`, `driver_search_do`, `kitchen_do`, `payment_webhook_do`, `campaign_send_do` |

### Why 4 Types, Not 6

| Previous Type | Folded Into | Trigger Config |
|---------------|-------------|----------------|
| Assistant | Worker | `trigger: {type: "user_message"}` |
| Monitor | Worker | `trigger: {type: "motion_event", opcode: 105}` |
| Webhook | Worker | `trigger: {type: "http_request", path: "/webhook/stripe"}` |
| Search | Sub-Agent DO | `trigger: {type: "spawn", purpose: "search"}` |

**The trigger is a config field, not a type.** A Worker handles any trigger. This is simpler and more extensible — new trigger types don't require new agent types.

### Agent Record Structure (Stored as `form`)

```json
{
  "id": "agent_food_order",
  "type": "agent",
  "scope": "s:",
  "data": {
    "agent_type": "worker",
    "trigger": { "type": "motion_event", "opcode": 105 },
    "prompt": "You are a food order monitor. When an order is confirmed (opcode 105), check kitchen capacity via read. If kitchen is busy, queue the order. If available, trigger kitchen prep flow.",
    "tools": ["read", "update", "search", "link"],
    "max_iterations": 5,
    "exit_condition": "order_assigned_or_queued",
    "flow": "wf_food_order"
  }
}
```

### Agent Execution Loop

```
┌──────────────────────────────────────────────────┐
│ 1. TRIGGER fires                                  │
│    (user_message | motion_event | cron | webhook) │
├──────────────────────────────────────────────────┤
│ 2. LOAD agent form record                         │
│    (prompt, tools, max_iterations, exit_condition)│
├──────────────────────────────────────────────────┤
│ 3. INJECT context                                 │
│    {user_id, scope, active_entity, trigger_data}  │
├──────────────────────────────────────────────────┤
│ 4. LLM LOOP (max N iterations)                    │
│    a. LLM decides: call tool or respond            │
│    b. Execute tool (atomic)                        │
│    c. Feed result back to LLM                     │
│    d. Check exit_condition                         │
│    e. If not met → repeat                         │
├──────────────────────────────────────────────────┤
│ 5. EXIT                                           │
│    (response | flow triggered | hibernate)        │
└──────────────────────────────────────────────────┘
```

### Scheduler Agent (No LLM — Pure Deterministic)

```json
{
  "id": "agent_hr_payroll",
  "type": "agent",
  "scope": "t:",
  "data": {
    "agent_type": "scheduler",
    "trigger": { "type": "cron", "schedule": "0 0 1 * *" },
    "steps": [
      { "tool": "read", "params": { "type": "attendance", "scope": "t:{id}" } },
      { "tool": "create", "params": { "type": "payroll", "opcode": 506 } }
    ],
    "tools": ["read", "create", "update"],
    "max_iterations": 1,
    "exit_condition": "payroll_created"
  }
}
```

**No LLM = zero token cost.** Pure tool execution on a schedule.

### How 50 Agents Collapse to 4 Types

```
4 types × {trigger, prompt, tools, scope, flow} = 50 agent instances
```

Each instance is a `form` record. New agent = new form record. Zero deployment.

---

## 8. Sub-Agent DOs (6 Stateless Workers)

Spawn on demand. Hibernate when done. Zero idle cost. All use the same 6 tools.

| # | Sub-Agent DO | Trigger | Lifecycle | Tools | LLM? |
|---|-------------|---------|-----------|-------|------|
| 1 | **Search DO** | Vector query request | spawn → search `memory` → rank → return → hibernate | `search` | ❌ |
| 2 | **Worker DO** | Background job queue | spawn → process queue → `update` matters → save → hibernate | `read`, `update`, `delete` | ❌ |
| 3 | **DriverSearch DO** | Taxi request (opcode 200-range) | spawn → geo-query `matter` → match → `link` driver → hibernate | `read`, `search`, `link` | ❌ |
| 4 | **Kitchen DO** | Order fire (opcode 208) | spawn → prep timer → `update` order phase → notify → hibernate | `read`, `update` | ❌ |
| 5 | **PaymentWebhook DO** | Stripe/Razorpay webhook | spawn → verify signature → `create` motion → `update` payment → hibernate | `create`, `update` | ❌ |
| 6 | **CampaignSend DO** | Bulk send trigger | spawn → batch `read` contacts → send via API → `create` motion per send → track → hibernate | `read`, `create` | ❌ |

**All 6 are configurations of the same DO type.** They differ only in trigger and which tools they call. No special code per DO.

---

## 9. Opcodes (10 Blocks, ~90 Codes)

| Block | Range | Domain | Key Opcodes |
|-------|-------|--------|-------------|
| **System** | 1000–1002 | All | `1000` INIT · `1001` UPDATE · `1002` DELETE |
| **Stock & Sales** | 100–199 | Store (Food, POS, E-Com, Marketplace) | `101` decrement · `102` add cart · `103` wishlist · `104` checkout · `105` confirm · `106` prep · `107` serve/ready · `108` refund · `109` fulfill · `110` commission |
| **Service & Transport** | 200–299 | Store (POS, Services, Taxi) | `201` sale · `202` start service · `203` break · `204` shift start · `205` shift end · `206` token call · `207` token serve · `208` fire kitchen · `209` abandon · `210` cash close |
| **CRM & Project** | 300–399 | Store (CRM) + Workspace (Project) | `301` lead create · `302` review · `303` convert · `304` ticket create · `305` reply · `306` resolve · `307` project create · `308` sprint create · `309` issue assign |
| **Logistics & Pages** | 400–499 | Workspace (Logistics, Pages) | `401` shipment create · `402` assign driver · `403` eta · `404` deliver · `405` transfer out · `406` transfer in · `407` return init · `408` return receive · `409` page create · `410` page edit |
| **HR & Invoices** | 500–599 | Workspace (HR, Invoices) | `501` clock in · `502` clock out · `503` leave request · `504` leave approve · `505` leave reject · `506` payroll gen · `507` invoice create · `508` invoice send · `509` invoice pay · `510` invoice overdue |
| **Expenses** | 600–699 | Workspace | `601` log · `602` approve · `603` reject · `604` reimburse · `605` attach receipt |
| **Bookings & Quotes** | 700–799 | Store (Services, Quotes) | `701` book slot · `702` start booking · `703` cancel · `704` quote send · `705` view · `706` accept · `707` reject · `708` negotiate · `709` expire |
| **Payments** | 800–899 | Store + Workspace | `801` init · `802` confirm · `803` refund init · `804` refund complete · `805` settlement · `806` dispute open · `807` dispute resolve · `808` payout |
| **Marketing & Comms** | 900–999 | Workspace + Store | `901` push · `902` email · `903` sms · `904` whatsapp · `905` engagement · `906` campaign create · `907` coupon create · `908` referral create |

**Reserved blocks:** 1100–1999 for future extensions. Plugin opcodes use 1100+.

**System opcodes (1000–1002) are critical:** They ensure every tool operation gets a motion entry — even non-business operations like data corrections. This makes the audit log truly complete.

---

## 10. MCP Architecture

### 2 Servers

| Server | Location | Data | Protocol | Scope |
|--------|----------|------|----------|-------|
| **Local MCP** | Mobile / Desktop | Personal SQLite | In-process | `p:{sub}` |
| **Cloud MCP** | Cloudflare Workers | Workspace DO + Storefront DO + Sub-Agent DOs | WebSocket / HTTP | `t:{id}`, `s:{id}` |

### MCP Primitive Mapping

| MCP Primitive | TAR Mapping | Count |
|---------------|-------------|-------|
| 🛠️ **Tools** | 6 tool primitives | 6 |
| 📄 **Resources** | 5 tables + KV | 5 + KV |
| 📝 **Prompts** | Agent system prompts (form records) | 4 types → ~50 instances |
| 🧠 **Context** | Session: `user_id`, `scope`, `active_entity` | Per request |

### Execution Pipeline (3-Tier)

```
┌─────────────────────────────────────────────────┐
│ TIER 1: PRESENTATION │
│ Static UI · Dynamic UI (from form schema) ·      │
│ Chat · Voice · Webhook                            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│ TIER 2: INTERACTION                              │
│ Form fill · Chat message · Voice command · │
│ API call · Webhook payload · Cron trigger         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│ TIER 3: EXECUTION (MCP)                          │
│                                                   │
│ A. SINGLE ACTION                                  │
│    action form → tool call → done                 │
│                                                   │
│ B. FLOW (chained actions)                         │
│    flow form → 5-primitive DAG → done │
│                                                   │
│ C. AGENT (LLM loop)                              │
│    agent form → LLM decides → tool calls →        │
│    LLM evaluates → repeat until exit              │
│                                                   │
│ All three use the same 6 tools.                  │
│ All three write motion.                           │
│ All three are form records.                       │
└─────────────────────────────────────────────────┘
```

---

## 11. Multi-Tenant SaaS Architecture

### Tenant = Durable Object

| Concept | Implementation |
|---------|---------------|
| **Tenant** | A Workspace DO (`t:{id}`) or Storefront DO (`s:{id}`) |
| **Tenant ID** | UUID, becomes DO ID |
| **Data isolation** | Each DO has its own SQLite — fully isolated |
| **Provisioning** | `create(table='form', type='workspace_config', scope='t:{new_id}')` → DO auto-provisions on first request |
| **Deprovisioning** | `delete(table='form', id=workspace_config, cascade=true)` → soft delete, data retained |

### People Are Multi-Tenant

One person can belong to multiple workspaces and stores. Graph edges link them:

```
Person p:{sub}
  ├── graph: (p:{sub}, member_of, t:{workspace_1})
  ├── graph: (p:{sub}, member_of, t:{workspace_2})
  ├── graph: (p:{sub}, customer_of, s:{store_1})
  └── graph: (p:{sub}, works_for, s:{store_1})
```

**Personal data (p:) never leaves the device.** Tenant DOs only store graph edges referencing the person — not their personal data.

### SaaS Administration

| Function | How |
|----------|-----|
| **Tenant provisioning** | `create` workspace/store form → DO auto-spawns on first request |
| **Member invitation** | `link(src=p:{sub}, rel=member_of, tgt=t:{id})` |
| **Role management** | Graph edge `weight` field = role level (0=viewer, 1=member, 2=admin, 3=owner) |
| **Usage tracking** | Every tool call writes `motion` with `client_ref` → count per tenant |
| **Billing** | Scheduler agent reads motion counts per scope → creates invoice matter |
| **Rate limiting** | Per-DO request counter in KV → throttle at configurable threshold |

### Scale Targets

| Metric | Target | How |
|--------|--------|-----|
| **Tenants** | Millions | Each tenant = 1 DO. Cloudflare supports millions of DOs per account. |
| **Records** | Billions | Records distributed across millions of DOs. Each DO: ~1K–100K records (SQLite sweet spot). |
| **Users** | Millions | Each user has local SQLite (p:). Cloud stores only graph edges. |
| **Concurrent requests** | Millions | Cloudflare edge handles routing. Each DO handles its own tenant. |

### Cross-Tenant Operations

| Operation | Approach | Cost |
|-----------|----------|------|
| **Within tenant** | Direct DO query | Sub-millisecond (co-located compute + storage) |
| **Cross-tenant search** | Federated: Router agent queries multiple DOs in parallel | Proportional to # of DOs queried |
| **Cross-tenant analytics** | Optional ETL pipeline: Scheduler agent exports motion to analytics warehouse | Batch, off-peak |
| **Global search** | Optional global Search DO that aggregates across DOs | Higher latency, optional feature |

**Trade-off:** Cross-tenant operations are not real-time by default. This is intentional — it keeps per-tenant costs near zero. Cross-tenant analytics is an optional add-on, not a core feature.

---

## 12. Security & Scoping

### Scope Visibility

| Scope | Visibility | Enforcement |
|-------|-----------|-------------|
| `p:{sub}` | Personal only | `WHERE scope = 'p:{sub}'` — Local MCP only, never sent to cloud |
| `t:{id}` | Workspace members | `WHERE scope = 't:{id}'` AND `graph` check: `(p:{sub}, member_of, t:{id}) AND active=1` |
| `s:{id}` | Store staff + customers | `WHERE scope = 's:{id}'` AND role check: `(p:{sub}, works_for, s:{id})` OR `(p:{sub}, customer_of, s:{id})` |
| `public` | Anyone, read-only | `WHERE form.public = 1` — no graph check needed |

### Auth Flow

```
Google OAuth → sub claim
    │
    ▼
create(type='person', scope='p:{sub}', data={email, name, photo})
    │
    ▼
link(src='p:{sub}', rel='member_of', tgt='t:{id}') ← workspace
link(src='p:{sub}', rel='customer_of', tgt='s:{id}')    ← store customer
link(src='p:{sub}', rel='works_for', tgt='s:{id}')      ← store staff
    │
    ▼
Every subsequent request:
  1. Verify Google sub
  2. Load graph edges for p:{sub}
  3. Determine accessible scopes
  4. Enforce in every read/update/delete/search
```

### Role Levels (Graph Weight)

| Weight | Role | Permissions |
|--------|------|-------------|
| 0 | Viewer | Read public + scope data |
| 1 | Member | Read + create + update own |
| 2 | Admin | Read + create + update all + delete + link |
| 3 | Owner | All + manage members + deprovision |

### Contact Model (No Auth)

Contacts are `matter` records owned by an authenticated person. No Google OAuth. No login.

```
create(type='contact', scope='s:{store}', data={name, email, phone, company, tags})
link(src='p:{owner}', rel='owns_contact', tgt='p:{contact}')
```

---

## 13. Offline-First & Sync

### Personal Data (Local SQLite Only)

| `matter.type` | Meaning | Syncs? |
|---------------|---------|--------|
| `cart` | Shopping cart items | On checkout |
| `wishlist` | Saved items | On change |
| `draft` | Unfinished orders/notes | On complete |
| `personal_task` | Private to-do | Never (local only) |
| `personal_note` | Private notes | Never (local only) |
| `bookmark` | Saved links | On change |
| `history` | Local event log | Never (local only) |
| `sync_queue` | Offline sync buffer | On connectivity |

### Sync Protocol

```
1. Device offline → user performs actions → writes to local SQLite (p:)
2. Each action also writes to sync_queue matter (type='sync_queue', data={tool, params, client_ref})
3. Connectivity restored → Scheduler agent reads sync_queue
4. For each queued item:
   a. Call tool via Cloud MCP
   b. On success → delete sync_queue item (soft)
   c. On conflict → resolve (see below)
5. Sync complete → notify user
```

### Conflict Resolution

| Conflict Type | Resolution |
|---------------|-----------|
| **Same record, different fields** | Field-level merge (deep-merge JSON) |
| **Same record, same field** | Last-write-wins (by `time` timestamp) |
| **State transition conflict** | Cloud state wins (motion log is authoritative) |
| **Delete vs update** | Delete wins (soft delete propagates) |
| **Graph edge conflict** | Idempotent (UPSERT resolves) |

**`client_ref` prevents duplicate application** of the same sync item. If the same `client_ref` appears twice, the second is a no-op.

---

## 14. AI-First Design

| Principle | Implementation |
|-----------|---------------|
| **Natural language is primary interface** | Every action invocable via chat. Router agent classifies intent. |
| **Router agent is entry point** | All user input → Router → entity + context + verb + noun |
| **Auto-form generation** | Form schemas are JSON. UI renders dynamically from schema. No hand-coded forms. |
| **Semantic search is default** | `search` defaults to hybrid (vector + FTS). Keyword-only is opt-out. |
| **Agents are first-class** | 4 agent types built into execution pipeline. Not bolted on. |
| **LLM loop for complex operations** | When a flow can't be predetermined, Worker agent decides tool calls. |
| **Embeddings on write** | Every `create`/`update` of form/matter generates vector (lazy, opt-out via `embed=false`). |
| **Context injection** | Every tool call includes `{user_id, scope, active_entity}`. LLM always knows who, where, what. |
| **Scheduler agents are LLM-free** | Deterministic cron jobs use zero tokens. Cost-efficient automation. |

### Router Agent Decision Flow

```
User: "I need a taxi to the airport"
    │
    ▼
Router Agent (LLM):
  - Intent: request_ride
  - Entity: store
  - Context: taxi
  - Verb: create
  - Noun: ride
  - Flow: wf_taxi_dispatch │
    ▼
Worker Agent executes wf_taxi_dispatch:
  1. create(type='ride', scope='s:{id}', geo= pickup_location)
  2. search(type='driver', geo= proximity, mode='geo')
  3. link(src=driver, rel='assigned_to', tgt=ride)
  4. update(ride, phase=1, opcode=202)  // dispatched
  5. wait(motion, opcode=204, stream=ride)  // driver arrived
  6. update(ride, phase=2, opcode=205)  // trip started
  ...
```

---

## 15. Plugin System

A **Plugin** is a collection of form records. No code. No deployment. No hooks.

### Plugin Record

```json
{
  "id": "plugin_stripe_payments",
  "type": "plugin",
  "scope": "s:",
  "data": {
    "name": "Stripe Payments",
    "version": "1.0.0",
    "actions": [
      {
        "code": "act_stripe_charge",
        "tool": "create",
        "params": { "type": "payment", "opcode": 801 },
        "links": [{ "rel": "paid_by", "tgt": "$caller" }]
      }
    ],
    "flows": [
      {
        "code": "wf_stripe_payment",
        "steps": [
          { "tool": "create", "params": { "type": "payment", "opcode": 801 } },
          { "tool": "wait", "params": { "event": "webhook", "path": "/stripe/confirm" } },
          { "tool": "update", "params": { "opcode": 802, "phase": 1 } }
        ]
      }
    ],
    "agents": [
      {
        "code": "agent_stripe_webhook",
        "type": "worker",
        "trigger": { "type": "http_request", "path": "/webhook/stripe" },
        "tools": ["create", "update"],
        "prompt": "Verify Stripe webhook signature. If valid, create motion and update payment status."
      }
    ],
    "forms": [
      {
        "code": "stripe_config",
        "type": "config",
        "data": { "schema": { "api_key": "string", "webhook_secret": "string" } }
      }
    ]
  }
}
```

### Plugin Installation

```
1. read(plugin form record from marketplace or upload)
2. For each action/flow/agent/form in plugin.data:
   create(table='form', type='action'|'flow'|'agent'|'config', data=record)
3. Plugin is now active. Users can invoke its actions, trigger its flows, interact with its agents.
```

### Plugin Uninstallation

```
1. read all form records where data.plugin = plugin_id
2. For each: delete(id, cascade=true)
3. Plugin deactivated. All its actions/flows/agents removed.
```

### Why No Hooks

| Approach | Complexity | Safety | AI-Compatible? |
|----------|-----------|--------|-----------------|
| Code hooks (pre/post functions) | High — requires code execution sandbox | Low — arbitrary code | ❌ No |
| Declarative hooks (JSON conditions + actions) | Medium — limited expressiveness | High — no arbitrary code | ⚠️ Partial |
| **Monitor agents (motion-triggered Workers)** | Low — uses existing agent infrastructure | High — LLM-controlled | ✅ Yes |

**If you need pre/post behavior, use a Worker agent triggered by motion events.** Example: "After any payment is created (opcode 801), trigger reconciliation agent." This is a Worker agent with `trigger: {type: "motion_event", opcode: 801}`. No hooks needed. No new mechanism.

---

## 16. Cost & Efficiency

### Data Efficiency

| Measure | How |
|---------|-----|
| **5 tables only** | No context-specific tables. No join tables. No log tables. |
| **JSON data field** | No schema migrations. New fields = new JSON keys. |
| **Soft deletes** | `active=0`. No data loss. Reversible. No cascade deletes. |
| **Single audit log** | `motion` is the only log. No separate logging infrastructure. |
| **Graph for all relations** | No join tables. No foreign key constraints. Pure edges. |
| **Vectors in SQLite** | No external vector DB. BLOB storage. Cosine similarity in-process. |
| **Flows/agents as data** | No code files. No deployments. Form records. |
| **Deep-merge updates** | `update` merges JSON, doesn't replace. No full-rewrite overhead. |
| **Motion compaction** | Old motions archiveable. `seq` continues. State derivable from latest matter. |

### Cost Efficiency

| Measure | Savings |
|---------|---------|
| **Local SQLite for personal data** | Zero cloud cost for `p:` scope. No egress. No storage fees. |
| **Cloudflare DO hibernation** | Pay per active second. Idle DOs cost ~$0. |
| **Sub-Agent DOs spawn on demand** | 6 DOs exist only during execution. Hibernate immediately. |
| **No external database** | SQLite in DO. No RDS/DynamoDB/Supabase bill. |
| **No external vector DB** | Pinecone/Weaviate replaced by `memory` table. |
| **No code deployment for flows/agents** | New flow/agent = INSERT into form. No CI/CD. |
| **Scheduler agents are LLM-free** | Zero token cost for cron jobs. Pure tool execution. |
| **Idempotency prevents duplicates** | `client_ref` blocks replay. No double-charges, double-orders. |
| **Lazy embeddings** | Vectors generated on write (if `embed=true`). Not on every read. |
| **Read is free** | `read` and `search` write no motion. Zero write cost for queries. |
| **Search cost guard** | Falls back to FTS when no vectors exist. No unnecessary embedding computation. |
| **Atomic multi-write in `create`** | 1 MCP round-trip for matter + links + motion. Fewer transactions. |

### External Dependencies (Minimal)

| Service | Purpose | Required? |
|---------|---------|-----------|
| Google OAuth | Identity (`sub`) | ✅ Yes |
| Stripe / Razorpay | Payments | ⚠️ If accepting payments |
| Push / Email / SMS / WhatsApp | Marketing comms | ⚠️ If sending campaigns |
| Cloudflare Workers + DO | Cloud compute + storage | ✅ Yes |
| **Everything else** | **Self-contained** | ❌ No external DB, no external vector store, no external queue, no external cache |

---

## 17. Scalability

### Millions of Tenants

| Mechanism | How |
|-----------|-----|
| **DO-per-tenant** | Each tenant = 1 DO instance. Cloudflare supports millions of DOs per account. |
| **DO auto-provisioning** | DO spawns on first request. No pre-allocation. No idle cost. |
| **DO hibernation** | Idle DOs hibernate. Zero compute cost when inactive. |
| **Global edge** | DOs run at nearest Cloudflare edge. Sub-millisecond latency. |
| **No shared bottleneck** | Each DO has its own SQLite. No connection pool contention. |

### Billions of Records

| Mechanism | How |
|-----------|-----|
| **Natural sharding** | Records distributed across millions of DOs. Each DO: ~1K–100K records. |
| **SQLite performance** | SQLite handles 100K+ records per database efficiently with proper indexes. |
| **Motion compaction** | Old motion events can be archived. `seq` continues. State derivable from latest matter. |
| **Memory partitioning** | Vector search is per-DO. Each DO's vector space is small. No global ANN index needed. |
| **Large tenant support** | For tenants >100K records: partition by time (monthly motion archives) or type (separate DOs per context). |

### Read Scalability

| Scenario | Approach |
|----------|----------|
| **Within tenant** | Direct DO query. Sub-millisecond (co-located compute + storage). |
| **Cross-tenant (federated)** | Router agent queries multiple DOs in parallel. Merges results. |
| **Global search (optional)** | Optional global Search DO aggregates across DOs. Higher latency. |
| **Personal data** | Local SQLite. Zero network. Instant. |

### Write Scalability

| Scenario | Approach |
|----------|----------|
| **Within tenant** | Single DO handles writes. No cross-tenant contention. |
| **Motion (append-only)** | No UPDATE/DELETE contention. High write throughput. |
| **SQLite WAL mode** | Concurrent reads during writes. No read locks. |
| **Batch operations** | Loop primitive in flows handles batch creates/updates. |

### Future Scaling Path

| If... | Then... |
|-------|--------|
| **Tenant exceeds 100K records** | Partition DO by context (separate DOs for HR, Project, etc.) |
| **Cross-tenant search too slow** | Add global Search DO with aggregated index |
| **Motion table too large** | Archive motions older than N days to KV or R2 |
| **Vector search too slow** | Add ANN index (sqlite-vss or similar) per DO |
| **Global analytics needed** | ETL pipeline: Scheduler agent exports to analytics warehouse |

---

## 18. Trade-offs

| # | Decision | Choice | Trade-off | Mitigation |
|---|----------|--------|-----------|------------|
| 1 | **SQLite vs PostgreSQL** | SQLite (in DO) | No cross-tenant joins at storage layer | Cross-tenant via federated agent queries |
| 2 | **DO-per-tenant vs shared DB** | DO-per-tenant | Cross-tenant analytics need separate pipeline | Optional ETL (not core) |
| 3 | **Local SQLite for personal data** | Local-first | Sync complexity, potential data loss if device lost | Sync queue + cloud graph edges as backup |
| 4 | **JSON data field vs typed columns** | JSON | No native indexing on JSON fields | `memory` table for search + covering indexes on metadata columns |
| 5 | **6 tools vs rich REST API** | 6 tools | Complex queries need multiple tool calls | `read` with joins + `search` with 5 modes |
| 6 | **Soft deletes vs hard deletes** | Soft by default | Storage grows over time | Motion compaction + hard delete for `p:` local data (GDPR) |
| 7 | **Event sourcing (motion)** | Append-only | Write amplification (every mutation = 2 writes) | SQLite is fast enough; motion is append-only (no contention) |
| 8 | **5 flow primitives vs 8 business patterns** | 5 control-flow primitives | Less self-documenting (must read DAG) | Flow `data.pattern` field labels the business pattern |
| 9 | **4 agent types vs 6** | 4 types | Worker type is overloaded (multiple triggers) | Trigger is config field, not type — cleaner taxonomy |
| 10 | **Vector search in SQLite vs external** | SQLite BLOB | No ANN index (brute-force cosine) | Per-DO vector space is small (<100K); cost guard falls back to FTS |
| 11 | **MCP protocol vs custom API** | MCP (open standard) | MCP still evolving, fewer client libraries | MCP is the AI-native standard; adoption growing fast |
| 12 | **Declarative plugins vs code plugins** | Data-only plugins | Can't express arbitrary logic | Complex logic delegates to Worker agent (LLM) |

---

## 19. Bootstrap (Self-Describing System)

**Everything in TAR is a `form` or `matter` record — including the system's own configuration.**

### What Is Stored Where

| What | Stored As | Table | `type` |
|------|-----------|-------|--------|
| Entity templates (person, product, order) | Form | `form` | `'product'`, `'order_template'`, ... |
| State machines | Form data | `form` | (same as entity template) |
| Flow definitions | Form | `form` | `'flow'` |
| Agent definitions | Form | `form` | `'agent'` |
| Action definitions | Form | `form` | `'action'` |
| Plugin definitions | Form | `form` | `'plugin'` |
| Actual records | Matter | `matter` | `'order'`, `'contact'`, ... |
| Events | Motion | `motion` | (opcode in `action` field) |
| Relationships | Graph | `graph` | (edge `rel` field) |
| Search index | Memory | `memory` | (vector BLOB) |

### Bootstrap Sequence

```
Step 1: Create entity templates
  create(type='form', code='form_person', data={schema:{name,email,photo}})
  create(type='form', code='form_order', data={schema:{items,total,customer_id}, states:[...], transitions:[...]})
  create(type='form', code='form_lead', data={schema:{name,email,phone}, states:[...], transitions:[...]})
  ...

Step 2: Create flow definitions
  create(type='form', code='wf_food_order', data={pattern:'transaction', steps:[...]})
  create(type='form', code='wf_crm_funnel', data={pattern:'funnel', steps:[...]})
  create(type='form', code='wf_invoice_billing', data={pattern:'billing', steps:[...]})
  ...

Step 3: Create agent definitions
  create(type='form', code='agent_router', data={agent_type:'router', prompt:'...', tools:['read','search']})
  create(type='form', code='agent_food_order', data={agent_type:'worker', trigger:{...}, prompt:'...', tools:[...]})
  create(type='form', code='agent_hr_payroll', data={agent_type:'scheduler', trigger:{cron:'0 0 1 * *'}, steps:[...]})
  ...

Step 4: Create action definitions
  create(type='form', code='act_create_lead', data={tool:'create', opcode:301, params:{type:'lead'}, links:[{rel:'owned_by',tgt:'$caller'}]})
  create(type='form', code='act_checkout_food', data={tool:'create', opcode:104, flow:'wf_food_order'})
  ...

Step 5: System is self-sustaining
  All future changes = form/matter records.
  New context = new forms + flows + agents.
  New plugin = new form records.
  Zero deployment. Zero code.
```

### The System Creates Itself

The 6 tools are the only code. Everything else — schemas, state machines, flows, agents, actions, plugins — is data created by the tools. The system bootstraps itself by creating its own configuration as form records.

---

## 20. Final Counts

| Component | Count | Identity |
|-----------|-------|----------|
| **Root Entities** | 3 | People (`p:`), Workspace (`t:`), Store (`s:`) |
| **Scopes** | 3 prefixes | `p:`, `t:`, `s:` |
| **Tables** | 5 | `form`, `matter`, `motion`, `graph`, `memory` |
| **Tool Primitives** | 6 | `create`, `read`, `update`, `delete`, `link`, `search` |
| **Flow Primitives** | 5 | Sequence `→`, Parallel `⇉`, Branch `?`, Loop `↻`, Wait `⏻` |
| **Agent Types** | 4 | Router, Worker, Scheduler, Sub-Agent DO |
| **Sub-Agent DOs** | 6 | Search, Worker, DriverSearch, Kitchen, PaymentWebhook, CampaignSend |
| **Contexts** | 16 | CRM, E-Com, Food, POS, Services, Taxi, Quotes, Marketplace, Payments, HR, Project, Logistics, Pages, Invoices, Expenses, Marketing |
| **Matter Types** | 30+ | `lead`, `order`, `issue`, `shift`, `payment`, `contact`, `campaign`, `cart`, `draft`, ... |
| **Graph Relations** | 14+ | `assigned_to`, `for_project`, `member_of`, `customer_of`, `contains`, `owns_contact`, `converted_from`, `blocked_by`, `watched_by`, `linked_to`, `works_for`, `owns`, `in_folder`, `shared_with` |
| **Action Schemas** | ~130 | Form records (verb + noun + tool config) |
| **Flow Instances** | ~60 | Form records (5-primitive DAGs) |
| **Agent Instances** | ~50 | Form records (4 type configurations) |
| **MCP Servers** | 2 | Local (device) + Cloud (DO) |
| **Opcodes** | ~90 | 10 blocks (1000–1002 system + 100–999 business) |
| **DO Types** | 3 | Personal DB (local), Workspace DO (cloud), Storefront DO (cloud) |
| **External Dependencies** | 4 | Google OAuth, Stripe/Razorpay, Push/Email/SMS/WA, Cloudflare |
| **Code to Maintain** | **6 tool implementations** | Everything else is data |
| **Deployments for New Logic** | **Zero** | INSERT into form |

### Moving Parts Count

```
3 entities + 5 tables + 6 tools + 5 flow primitives + 4 agent types + 
6 sub-agent DOs + 2 MCP servers + 3 DO types = 34 moving parts

34 moving parts → 16 contexts, ~130 actions, ~60 flows, ~50 agents, 
millions of tenants, billions of records.
```

---

## The Unified Rule

> **One identity. One schema. One motion.**

```
6 TOOLS (the only code)
  └── 5 FLOW PRIMITIVES (control-flow, Turing-complete)
        └── ~60 FLOW INSTANCES (form records, zero deployment)
              └── 4 AGENT TYPES (Router, Worker, Scheduler, Sub-Agent DO)
                    └── ~50 AGENT INSTANCES (form records, zero deployment)
                          └── ~130 ACTIONS (parameterized tool calls, form records)

ALL stored in 5 TABLES.
ALL scoped by 3 ENTITIES.
ALL served by 2 MCP SERVERS.
ALL events logged in 1 MOTION TABLE.
ALL relations in 1 GRAPH TABLE.
ALL meaning in 1 MEMORY TABLE.

No code for business logic.
No deployments for new flows.
No external databases.
No external vector store.
No external queue.
No hooks. No handlers. No scripts.

Just6 tools. Just data. Just context.

One system. Three entities. Six tools. Five primitives. Four agents.
No exceptions.
```
