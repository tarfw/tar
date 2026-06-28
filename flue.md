# Final Architecture Paper

## Universal Super-App Platform

**Version 1.0 — Single Schema, Infinite Verticals**

---

## Abstract

A universal schema-driven architecture using 6 tables to support unlimited business verticals (CRM, Logistics, Support, HR, Real Estate, E-Commerce, POS, LMS, Booking, Inventory, Projects, plus user-defined domains). Built on Flue framework primitives (Tools, Actions, Skills, Agents, Subagents, Workflows) where 80% of system configuration is data, not code.

---

## Core Principle

```
6 tables absorb all domain knowledge.
Flue primitives compose all behavior.
LLM creates all business configuration.
Code stays minimal. Data grows infinitely.
```

---

## 1. The Six Tables

### 1.1 matter — Any Entity

```
Stores: any business entity (lead, deal, trip, ticket, employee, property, order, course, reservation, product, customer, store, team, person)

Columns:
  id     TEXT PRIMARY KEY  -- unique identifier
  form   TEXT              -- which form template
  type   TEXT              -- entity type (lead, deal, trip, etc.)
  scope  TEXT              -- access scope (user/team/tenant/system)
  title  TEXT              -- human label
  value  REAL              -- money or numeric value
  start  TEXT              -- start date
  end    TEXT              -- end date
  mark   INTEGER           -- stage/phase/status code
  data   TEXT              -- JSON for flexible fields
  time   TEXT              -- created timestamp
  updated TEXT             -- last updated
  active INTEGER           -- soft delete (0=deleted, 1=active)
  owner  TEXT              -- created by user
```

### 1.2 motion — Any Event

```
Stores: append-only event log (state changes, actions, comments, notifications, AI decisions, payments, inventory moves)

Columns:
  stream     TEXT       -- matter ID or workflow ID
  seq        INTEGER    -- sequence within stream
  action     INTEGER    -- action code (99993=action, 99992=skill, etc.)
  phase      INTEGER    -- stage at time of event
  delta      REAL       -- value change (for money/inventory)
  txn        TEXT       -- transaction ID
  clientref  TEXT       -- client reference
  data       TEXT       -- JSON event details
  time       TEXT       -- timestamp

PRIMARY KEY: (stream, seq)
```

### 1.3 graph — Any Relationship

```
Stores: relationships (user→team, team→resource, order→product, lead→contact, project→task)

Columns:
  id     INTEGER PRIMARY KEY
  src    TEXT       -- source entity
  rel    TEXT       -- relationship type
  tgt    TEXT       -- target entity
  data   TEXT       -- JSON metadata
  time   TEXT       -- timestamp
  active INTEGER    -- soft delete
```

### 1.4 form — Any Configuration

```
Stores: all system configuration (pipelines, tools, actions, skills, agents, subagents, workflows, schedules, channels, sandboxes, MCP servers, tax rules, payment methods, discounts)

Columns:
  id     TEXT PRIMARY KEY
  type   TEXT       -- pipeline/tool/action/skill/agent/etc.
  scope  TEXT       -- access scope
  title  TEXT       -- human label
  data   TEXT       -- JSON configuration
  time   TEXT       -- timestamp
  active INTEGER    -- enabled/disabled
```

### 1.5 attr — Any Hot Field

```
Stores: high-frequency fields needing index lookup (scores, status, labels, stock levels, prices, assignments)

Columns:
  id     INTEGER PRIMARY KEY
  matter TEXT       -- FK to matter.id
  key    TEXT       -- field name
  val    TEXT       -- text value
  num    REAL       -- numeric value
  ref    TEXT       -- reference to other matter
  time   TEXT       -- timestamp

UNIQUE: (matter, key)
```

### 1.6 memory — Any Embedding

```
Stores: vector embeddings for semantic search (product descriptions, ticket content, property features, course material)

Columns:
  id        TEXT        -- unique chunk ID
  chunk     INTEGER     -- chunk number
  matter    TEXT        -- FK to matter.id
  text      TEXT        -- source text
  embedding BLOB        -- vector
  meta      TEXT        -- JSON metadata
  time      TEXT        -- timestamp

PRIMARY KEY: (id, chunk)
```

---

## 2. Flue Primitives (8 Types)

### 2.1 Tools — Atomic DB Operations (Pre-Coded)

**Definition:** Single deterministic database operation. Cannot fail mid-way. No LLM judgment needed.

**When to use:** Agent needs atomic read/write to DB.

**Location:** `src/tools/core/*.ts`

**Storage:** `form.type='tool'` for metadata.

**The 12 Universal Tools:**

| Tool | Purpose |
|---|---|
| `tool_get_matter` | Read one entity |
| `tool_list_matters` | Read filtered list |
| `tool_create_matter` | Create one entity |
| `tool_update_matter` | Update one entity |
| `tool_append_motion` | Log one event |
| `tool_read_motions` | Read event history |
| `tool_link_graph` | Create relationship |
| `tool_traverse_graph` | Find relationships |
| `tool_set_attr` | Set hot field |
| `tool_search_memory` | Semantic search |
| `tool_store_memory` | Store embedding |
| `tool_read_form` | Read config |

### 2.2 Actions — Orchestrated Sequences

**Definition:** Multi-step business logic with validation. Reliability-critical workflows.

**When to use:** Multi-step process that needs guaranteed execution order.

**Location:** `src/actions/core/*.ts` + `src/actions/composite/*.ts`

**Storage:** `form.type='action'` for metadata.

**The 6 Core Actions (Universal):**

| Action | Purpose |
|---|---|
| `action_log_event` | Log + update matter state |
| `action_advance_stage` | Validate + log + update stage |
| `action_score` | LLM scoring + attr + memory |
| `action_notify` | Send via channel |
| `action_embed` | Chunk + embed + store |
| `action_run_pipeline` | Execute full pipeline |

**Composite Actions:** One per business workflow. Grows with user needs. Each calls core actions + creates domain-specific matters.

### 2.3 Skills — Instructions Only

**Definition:** Markdown text that guides LLM behavior. No executable code.

**When to use:** Repeatable method requiring human judgment (sales technique, troubleshooting procedure, onboarding checklist).

**Location:** `src/skills/{scope}/{skill-name}/SKILL.md`

**Storage:** `form.type='skill'` after import.

**Categories:** CRM, Logistics, Support, HR, Real Estate, E-Commerce, Projects, Booking, Inventory, LMS, plus user-defined.

### 2.4 Agents — Multi-Turn Conversations

**Definition:** LLM configuration + tools + actions + skills. Persistent across user messages.

**When to use:** User conversation requiring context retention.

**Location:** `src/agents/*.ts`

**Storage:** `form.type='agent'`.

**Master Agent:** Universal, knows all scopes, loaded with all skills.

### 2.5 Subagents — Scoped Versions

**Definition:** Agent filtered by scope/type. Inherits from master, limits focus.

**When to use:** Route queries to vertical-specific assistant.

**Storage:** `form.type='subagent'` with `data.parent`, `data.scope`, `data.types`.

**The 10 Standard Subagents:**

| Subagent | Scope | Types |
|---|---|---|
| `agent-crm` | crm | lead, deal, contact, org |
| `agent-logistics` | logistics | trip, shipment, route |
| `agent-support` | support | ticket, kb-article |
| `agent-hr` | hr | employee, candidate, review |
| `agent-realestate` | realestate | property, showing, offer |
| `agent-ecommerce` | ecommerce | product, order, cart |
| `agent-projects` | projects | project, task, sprint |
| `agent-booking` | booking | reservation, resource |
| `agent-inventory` | inventory | product, stock, warehouse |
| `agent-lms` | lms | course, lesson, enrollment |

### 2.6 Workflows — Finite Operations

**Definition:** Background jobs with runId + event history. Run to completion, then stop.

**When to use:** Cron jobs, event triggers, batch processing, document transformation.

**Location:** `src/workflows/*.ts` (inline) + `form.type='workflow'` (config-driven)

**Three Patterns:**
- **Inline:** `defineWorkflow` with `run()` body
- **Bound:** `defineWorkflow` + existing action
- **Config-driven:** `form.type='workflow'` rows

**Triggers:**
- `form.type='schedule'` (cron-based)
- `form.type='channel'` (event-based)
- Manual (HTTP POST /workflows/<name>)

### 2.7 Sandboxes — Isolated Environments

**Definition:** Test/staging environments with data isolation.

**When to use:** Development, QA, multi-tenant isolation.

**Storage:** `form.type='sandbox'` with isolation rules.

### 2.8 Channels — External Integrations

**Definition:** External service connections (email, SMS, Slack, GitHub, Stripe webhooks).

**When to use:** External events trigger workflows.

**Storage:** `form.type='channel'` with provider config.

**Examples:** `channel-email`, `channel-sms`, `channel-slack`, `channel-github`, `channel-stripe`, `channel-webhook`.

---

## 3. Form Type Taxonomy

| `form.type` | Purpose | Created By |
|---|---|---|
| `pipeline` | Stage definitions per matter type | User/LLM |
| `tool` | Tool metadata | Developer (pre-coded) |
| `action` | Action metadata | Developer + User |
| `skill` | Imported SKILL.md content | User/LLM |
| `agent` | Agent config | Developer (master only) |
| `subagent` | Scoped agent config | User/LLM |
| `workflow` | Workflow definition | User/LLM |
| `schedule` | Cron trigger | User/LLM |
| `channel` | External integration | User/LLM |
| `sandbox` | Test isolation | User/LLM |
| `mcp-server` | MCP integration | User/LLM |
| `tax-rule` | Tax calculation | User/LLM |
| `payment-method` | Payment processor | User/LLM |
| `discount` | Discount rules | User/LLM |
| `team-config` | Team settings | User/LLM |

---

## 4. The Execution Flow

```
1. User sends message → API route
   ↓
2. Route loads user context + scope
   ↓
3. Loads appropriate agent (master or subagent)
   ↓
4. Loads skills (personal → team → system priority)
   ↓
5. Builds system prompt + context
   ↓
6. Agent calls LLM with context
   ↓
7. LLM decides: tool/action/skill
   ↓
8. Execution logs to motion table
   ↓
9. Result returned to user
```

---

## 5. The Decision Tree

```
Need to do something?
│
├─ Single atomic operation? → TOOL
├─ Multi-step with validation? → ACTION
├─ Just instructions for LLM? → SKILL
├─ Multi-turn conversation? → AGENT
├─ Scoped version of agent? → SUBAGENT
├─ Finite background job? → WORKFLOW
├─ Isolated test environment? → SANDBOX
└─ External integration trigger? → CHANNEL
```

---

## 6. Universal Action Pattern

```
Core actions = universal verbs (6, fixed forever)
Composite actions = business workflows (grows per need)

Every composite action:
  1. Calls action_score (AI scoring)
  2. Calls action_advance_stage (move through pipeline)
  3. Calls action_notify (send notification)
  4. Creates domain matter (specific entity)
  5. Links via graph (relationships)
  6. Logs to motion (audit trail)

Adding new vertical:
  - Add 1 composite action (template)
  - Add 5-10 form rows (pipeline + skills)
  - 0 changes to core
  - 0 new tables
```

---

## 7. Teams & Collaboration

### 7.1 Team as Matter

```
Team = matter (type='team')
Membership = graph (user → team)
Permissions = graph (team → resource)
Hierarchy = graph (team → team)
Activity feed = motion (all events)
Chat = motion (stream=matter.id)
Assignments = graph + attr
Mentions = motion data
Notifications = graph subscriptions + motion triggers
Team agent = subagent (scope=team-{id})
```

### 7.2 Scope Levels

```
system    → everyone in org
tenant    → everyone in tenant (SaaS)
team-{id} → specific team members
user-{id} → private (just the user)
sandbox   → test isolation
```

### 7.3 Collaboration Features

```
- Shared matters (scope=team-{id})
- Activity streams (motion per matter)
- @mentions (motion data with user IDs)
- Assignments (graph + attr)
- Approvals (multi-step with attr tracking)
- Team chat (motion stream per matter)
- Cross-team collaboration (graph collab links)
- Notifications (graph subscriptions)
- Team agents (subagents scoped to team)
```

---

## 8. POS & Storefront

### 8.1 Everything is a Matter

```
Store        = matter (type='store')
Register     = matter (type='register')
Product      = matter (type='product') with variants as children
Customer     = matter (type='person')
Order        = matter (type='order')
Payment      = matter (type='payment')
Shift        = matter (type='shift')
Cart         = motion stream (cart-{sessionId})
Receipt      = motion events
Inventory    = attr (stock per location)
Tax/discount = form.type='tax-rule' / 'discount'
Payment methods = form.type='payment-method'
```

### 8.2 Checkout Flow

```
1. CREATE ORDER (tool_create_matter)
2. ADD LINE ITEMS (tool_link_graph)
3. CALCULATE TOTAL (action_run_pipeline)
4. PROCESS PAYMENT (tool_create_matter + Stripe)
5. UPDATE INVENTORY (tool_set_attr)
6. PRINT/SEND RECEIPT (action_notify)
7. LOG EVERYTHING (motion table)
```

### 8.3 Online vs In-Store

```
Same system. Same code. Same actions.

Online: customer → cart (motion stream) → checkout (action) → Stripe webhook
In-store: cashier → order (matter) → scan items (graph) → payment (matter) → receipt (motion)

Difference = entry point, not architecture.
```

---

## 9. The Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                                │
│              Web / Mobile / API / CLI                            │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ROUTES (Hono/Flue)                              │
│            /matter, /motion, /graph, /agent                      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AGENTS (Master + Subagents)                         │
│         Multi-turn conversations, persistent context             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌─────────────────┐  ┌────────────────┐  ┌────────────────┐
│ TOOLS (12)      │  │ ACTIONS (6+)   │  │ SKILLS (30+)   │
│ Atomic calls    │  │ Orchestrated   │  │ Instructions   │
│ defineTool      │  │ defineAction   │  │ SKILL.md       │
└────────┬────────┘  └───────┬────────┘  └────────┬───────┘
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     6 TABLES (SQL)                                │
│      matter · motion · graph · form · attr · memory              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     TRIGGERS                                      │
│         Schedule (cron) · Channel (events) · Manual              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     SANDBOXES                                     │
│              prod · staging · test · multi-tenant                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Storage Mapping

| Concept | Code Location | Data Location | Config Location |
|---|---|---|---|
| Tool | `src/tools/core/*.ts` | — | `form.type='tool'` |
| Action (core) | `src/actions/core/*.ts` | — | `form.type='action'` |
| Action (composite) | `src/actions/composite/*.ts` | — | `form.type='action'` |
| Skill | `src/skills/*/*/SKILL.md` | — | `form.type='skill'` |
| Agent (master) | `src/agents/master-agent.ts` | — | `form.type='agent'` |
| Subagent | — | — | `form.type='subagent'` |
| Workflow (inline) | `src/workflows/*.ts` | — | — |
| Workflow (config) | — | — | `form.type='workflow'` |
| Schedule | — | — | `form.type='schedule'` |
| Channel | — | — | `form.type='channel'` |
| Sandbox | — | — | `form.type='sandbox'` |
| MCP Server | — | — | `form.type='mcp-server'` |
| Matter | — | `matter` table | `form.type='pipeline'` |
| Motion | — | `motion` table | — |
| Graph | — | `graph` table | — |
| Attr | — | `attr` table | — |
| Memory | — | `memory` table | — |

---

## 11. File Structure

```
our-app/
├─ src/
│  ├─ runtime/
│  │  ├─ db.ts
│  │  ├─ schema.sql
│  │  └─ seed.sql
│  ├─ tools/
│  │  ├─ core/ (12 universal tools)
│  │  └─ integrations/ (email, sms, slack, github)
│  ├─ actions/
│  │  ├─ core/ (6 universal actions)
│  │  └─ composite/ (user-defined workflows)
│  ├─ skills/
│  │  ├─ crm/
│  │  ├─ logistics/
│  │  ├─ support/
│  │  └─ ... (per scope)
│  ├─ agents/
│  │  └─ master-agent.ts
│  ├─ workflows/
│  │  └─ (inline .ts files)
│  └─ routes/
│     ├─ api.ts
│     └─ auth.ts
└─ config/
   ├─ schema.sql
   ├─ seed-pipelines.sql
   ├─ seed-skills.sql
   ├─ seed-agents.sql
   ├─ seed-schedules.sql
   └─ seed-channels.sql
```

---

## 12. User-Created vs Pre-Coded

### Pre-Coded (Ship in Code)

```
✅ 12 tools (DB operations)
✅ 6 core actions (universal verbs)
✅ 1 master agent (top-level config)
✅ Example skills (templates)
```

### User-Created (Via LLM)

```
✅ Composite actions (business workflows)
✅ Skills (their methods)
✅ Subagents (their verticals)
✅ Workflows (their automation)
✅ Schedules (their timing)
✅ Channels (their integrations)
✅ Pipelines (their processes)
✅ Sandboxes (their test envs)
✅ MCP servers (their external tools)
✅ Tax rules (their regions)
✅ Payment methods (their processors)
✅ Discount rules (their promotions)
✅ Teams (their org structure)
```

---

## 13. LLM as Configurator

```
Master Agent can create ANYTHING via conversation:

User: "Score leads every 5 minutes"
→ Generates schedule + workflow
→ Validates + saves
→ Live immediately

User: "Add Slack for deal notifications"
→ Generates channel + auth
→ Stores encrypted credentials
→ Registers webhook

User: "Create sales team with Alice as lead"
→ Generates team matter
→ Creates memberships
→ Sets permissions

User: "Add tax rule for Texas: 8.25%"
→ Generates form row
→ Validates against schema
→ Live in seconds
```

---

## 14. Multi-Tenant SaaS

```
Tenant A:
  - Their composite actions
  - Their skills
  - Their pipelines
  - Their channels
  - Their teams

Tenant B:
  - Different composite actions
  - Different skills
  - Different pipelines
  - Different channels
  - Different teams

Same code. Different config.
All in form table.
Scoped by tenant.
```

---

## 15. Deployment Strategy

```
App deploy:
  - Code: tools, actions/core, agents/master
  - Changes once per version
  - Never after v1 (config-driven thereafter)

User configures (via UI or SQL or LLM):
  - Adds composites, skills, workflows, schedules, channels
  - Sets up teams, pipelines, tax rules
  - Connects integrations

Deploy cycle: rare (feature releases)
Config cycle: continuous (users add daily)
```

---

## 16. The Numbers

```
Code (fixed):
  - 12 tools
  - 6 core actions
  - 1 master agent
  - Total: ~50 files, ~5000 LOC

Data (grows):
  - 6 tables
  - 11+ form types
  - Unlimited rows
  - User-defined

Scale:
  - 1 vertical = 6 core + 1 composite + ~10 form rows
  - 10 verticals = 6 core + 10 composites + ~100 form rows
  - 100 verticals = 6 core + 100 composites + ~1000 form rows
  - Core stays at 6 forever
```

---

## 17. Design Principles

```
1. Tables before code
   - Domain knowledge lives in tables, not in schema migrations
   
2. Configuration over programming
   - 80% of system behavior is data, 20% is code
   
3. Universal primitives
   - Same tools/actions work across all verticals
   
4. LLM-first creation
   - Users build via conversation, not forms
   
5. Append-only audit
   - Motion table never deletes, only appends
   
6. Graph for relationships
   - Teams, permissions, assignments all via edges
   
7. Attr for hot data
   - Indexes for scores, status, stock, prices
   
8. Memory for semantics
   - Embeddings for search, not SQL LIKE
   
9. Forms for everything
   - 11+ types absorb all system configuration
   
10. Composability
    - Core actions compose into composite actions
    - Composite actions compose into workflows
```

---

## 18. Summary

```
Universal Super-App Platform:
  - 6 tables (matter, motion, graph, form, attr, memory)
  - 8 Flue primitives (tool, action, skill, agent, subagent, workflow, sandbox, channel)
  - 11+ form types (pipeline, action, skill, agent, subagent, workflow, schedule, channel, sandbox, mcp-server, plus domain configs)
  - 12 tools (pre-coded, universal)
  - 6 core actions (pre-coded, universal)
  - N composite actions (user-created, per workflow)
  - 30+ skills (per scope, user-extensible)
  - 1 master agent + N subagents (per vertical)
  - N workflows (cron, event, manual)
  - M teams (org structure)

Result:
  - Single schema, infinite verticals
  - 80% config (data), 20% code
  - LLM creates everything
  - Zero migrations after v1
  - Scales to 100+ verticals
  - Works for CRM, Logistics, Support, HR, Real Estate, E-Commerce, POS, LMS, Booking, Inventory, Projects, plus anything user defines

The 6 tables are the foundation.
The Flue primitives are the verbs.
The LLM is the configurator.
The user is the builder.
```

---

## Appendix A: Complete Schema

```sql
CREATE TABLE matter (
  id TEXT PRIMARY KEY,
  form TEXT,
  type TEXT,
  scope TEXT,
  title TEXT,
  value REAL,
  start TEXT,
  end TEXT,
  mark INTEGER,
  data TEXT,
  time TEXT,
  updated TEXT,
  active INTEGER,
  owner TEXT
);

CREATE TABLE motion (
  stream TEXT,
  seq INTEGER,
  action INTEGER,
  phase INTEGER,
  delta REAL,
  txn TEXT,
  clientref TEXT,
  data TEXT,
  time TEXT,
  PRIMARY KEY (stream, seq)
);

CREATE TABLE graph (
  id INTEGER PRIMARY KEY,
  src TEXT,
  rel TEXT,
  tgt TEXT,
  data TEXT,
  time TEXT,
  active INTEGER
);

CREATE TABLE form (
  id TEXT PRIMARY KEY,
  type TEXT,
  scope TEXT,
  title TEXT,
  data TEXT,
  time TEXT,
  active INTEGER
);

CREATE TABLE attr (
  id INTEGER PRIMARY KEY,
  matter TEXT,
  key TEXT,
  val TEXT,
  num REAL,
  ref TEXT,
  time TEXT,
  UNIQUE(matter, key)
);

CREATE TABLE memory (
  id TEXT,
  chunk INTEGER,
  matter TEXT,
  text TEXT,
  embedding BLOB,
  meta TEXT,
  time TEXT,
  PRIMARY KEY (id, chunk)
);

-- Indexes
CREATE INDEX idx_matter_type ON matter(type);
CREATE INDEX idx_matter_scope ON matter(scope);
CREATE INDEX idx_motion_stream ON motion(stream);
CREATE INDEX idx_motion_time ON motion(time);
CREATE INDEX idx_graph_src ON graph(src);
CREATE INDEX idx_graph_tgt ON graph(tgt);
CREATE INDEX idx_attr_matter ON attr(matter);
CREATE INDEX idx_attr_key ON attr(key);
CREATE INDEX idx_memory_matter ON memory(matter);
```

---

## Appendix B: Invocation Logging Codes

| What | Action Code |
|---|---|
| Tool call | 99994 |
| Action call | 99993 |
| Skill invocation | 99992 |
| Workflow run | 99991 |
| Schedule trigger | 99990 |
| Channel event | 99989 |
| Sandbox activity | 99988 |

---

**End of Architecture Paper**
