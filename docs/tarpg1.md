# TAR — One Page Cheat Sheet

---

## Philosophy

```
Form  = what a thing IS (blueprint)
Matter = what a thing IS NOW   (instance)
Motion = what HAPPENED to it   (event)
Graph  = what it CONNECTS to   (relation)
Memory = what it RESEMBLES     (meaning)
```

---

## 3 Entities

| Entity | Scope | Where | Holds |
|--------|-------|-------|-------|
| **People** | `p:{sub}` | Local SQLite (device) | All humans |
| **Workspace** | `t:{id}` | Cloud DO | Internal work (HR, Project, Invoices...) |
| **Store** | `s:{id}` | Cloud DO | External business (CRM, Food, POS, Taxi...) |

**Routing:** `p:` → Local MCP · `t:`/`s:` → Cloud MCP → DO

---

## 5 Tables

| Table | One Line | Key Fields |
|-------|----------|------------|
| `form` | Blueprint (schema, template, flow, agent, plugin) | `code`, `type`, `scope`, `data` (JSON) |
| `matter` | Instance (order, contact, issue, payment) | `form`, `type`, `scope`, `qty`, `value`, `geo`, `data`, `owner` |
| `motion` | Event log (append-only, audit, state transitions) | `stream`, `seq`, `action` (opcode), `phase`, `delta`, `client_ref` |
| `graph` | Relationships (edges, ownership, assignment) | `src`, `rel`, `tgt`, `weight`, `active` |
| `memory` | Search index (vector + FTS text + metadata) | `id`, `text`, `embedding`, `meta` |

---

## 6 Tools (The Only Code)

```
create  → INSERT form/matter + links[] + motion + memory    (atomic, 1 call)
read    → SELECT with joins, graph traversal, pagination     (read-only)
update  → UPDATE + deep-merge JSON + state machine check + motion
delete  → Soft delete (active=0) + cascade graph + motion
link    → UPSERT graph edge (src, rel, tgt) + motion         (idempotent)
search  → hybrid | vector | fts | structured | geo           (cost guard: FTS fallback)
```

**Rule:** Every mutating tool writes exactly 1 `motion` record. No exceptions.

---

## 5 Flow Primitives

| Symbol | Name | What |
|--------|------|------|
| `→` | Sequence | Run in order |
| `⇉` | Parallel | Run simultaneously |
| `?` | Branch | Conditional routing |
| `↻` | Loop | Iterate over result set |
| `⏻` | Wait | Pause for event/timer/webhook |

**Any business flow = composition of these 5. Turing-complete.**

---

## 4 Agent Types

| Type | Trigger | LLM? | Role |
|------|---------|------|------|
| **Router** | User message | ✅ | Classify intent → route to flow/agent |
| **Worker** | Flow / motion / webhook / message | ✅ | Execute flow steps, make decisions |
| **Scheduler** | Cron timer | ❌ | Deterministic tool calls on schedule |
| **Sub-Agent DO** | Spawn request | ❌ | Stateless worker, hibernates after task |

**Trigger is config, not type.** New trigger = new form record.

---

## The Collapse

```
6 tools ×  {scope, type, opcode, data, phase, links}
 ↓
~130 actions   (form records — verb + noun + tool config)
~60  flows     (form records — 5-primitive DAGs)
~50  agents    (form records — 4 type configs)
16 contexts  (scope + types + opcodes + flow pattern)

ALL are form records. ALL are data. Zero deployment for new logic.
```

---

## State Machines (Data, Not Code)

```json
// Inside form.data:
{
  "states": ["pending", "confirmed", "preparing", "ready", "delivered"],
  "transitions": [
    { "from": "pending", "to": "confirmed", "opcode": 105 },
    { "from": "*", "to": "cancelled", "opcode": 108 }
  ]
}
```

`update` tool validates transitions. Invalid = rejected. No state machine code.

---

## Opcodes (10 Blocks)

| Block | Range | Domain |
|-------|-------|--------|
| System | 1000–1002 | INIT, UPDATE, DELETE |
| Stock/Sales | 100–199 | Food, POS, E-Com, Marketplace |
| Service/Transport | 200–299 | POS, Services, Taxi |
| CRM/Project | 300–399 | CRM, Project |
| Logistics/Pages | 400–499 | Logistics, Pages |
| HR/Invoices | 500–599 | HR, Invoices |
| Expenses | 600–699 | Expenses |
| Bookings/Quotes | 700–799 | Services, Quotes |
| Payments | 800–899 | Store + Workspace |
| Marketing | 900–999 | Marketing |

---

## Scale & Cost

| Goal | How |
|------|-----|
| **Millions of tenants** | 1 DO per tenant. Auto-provision. Hibernate when idle. |
| **Billions of records** | Natural sharding across DOs.1K–100K records per DO. |
| **$0 when idle** | DO hibernation. Local SQLite for personal. No external DB. |
| **Zero deploy for new logic** | Flows/agents/actions = form records. INSERT = deploy. |
| **Offline-first** | Personal data local. Sync queue on reconnect. `client_ref` = idempotent. |

---

## The One Rule

> **If you can describe it as a form, it can exist. If it exists, it is matter. If it changes, it leaves motion. If it relates, it enters graph. If it means something, it lives in memory.**

```
6 tools. 5 tables. 5 flow primitives. 4 agent types. 3 entities. 2 MCP servers.
No exceptions.
```

---

Want me to create the **visual map (Mermaid diagram)** next? That will show how everything connects in one picture.
