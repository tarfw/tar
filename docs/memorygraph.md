# AI Memory: TAR vs Memgraph

How TAR's 5-table schema already implements what Memgraph calls "AI Memory."

---

## 1. Memgraph's Three Memory Types

Memgraph proposes AI systems need three types of memory:

| Memory Type | What It Holds | Example |
|-------------|---------------|---------|
| **Semantic** | Facts, entity knowledge | "Priya is a customer who likes Nike" |
| **Episodic** | Past interactions with context | "Priya visited Tuesday, bought sneakers" |
| **Procedural** | Workflows, skills, decision trees | "How to create a lead" |

---

## 2. TAR's 5-Table Equivalent

| Memgraph Memory | TAR Table | How It Works |
|-----------------|-----------|--------------|
| Semantic: entity | `form` | `form(id='cust_priya', type='profile', data='{"likes":"Nike"}')` |
| Semantic: relationship | `graph` | `graph(src='cust_priya', tgt='store_101', type='belongs_to')` |
| Episodic: event | `motion` | `motion(stream='cust_priya', action=301, data='{"visit":"Tuesday"}')` |
| Procedural: skill | `skills` (definitions) | `skill(id='tool_create_lead', fields=[...])` |
| Vector: similarity | `memory` | `memory(form='cust_priya', vector=[0.23, -0.11, ...])` |

---

## 3. Direct Comparison

| Feature | TAR | Memgraph |
|---------|-----|----------|
| **Semantic memory** | ✅ `form` + `graph` | ✅ Graph nodes |
| **Episodic memory** | ✅ `motion` | ✅ Graph events |
| **Procedural memory** | ✅ `skills` definitions | ✅ Graph workflows |
| **Vector search** | ✅ `memory` table | ✅ Native vectors |
| **Graph storage** | ✅ SQLite `graph` table | ✅ In-memory graph DB |
| **Cost** | $0 (local SQLite) | $$$$ (cloud service) |
| **Offline** | ✅ Yes | ❌ No |
| **Complexity** | Low | High |
| **Deep traversals** | ❌ Not needed | ✅ Cypher queries |

---

## 4. Why TAR Doesn't Need Memgraph

### Memgraph Is For

- Large-scale enterprise knowledge graphs
- Deep graph traversals (10+ hops)
- Real-time fraud detection
- Complex relationship reasoning

### TAR Is For

- Local-first business app
- Simple entity connections (1-2 hops)
- Offline-first with sync
- Zero infrastructure cost

### TAR's Graph Queries Are Simple

```sql
-- "Show all products in this store" (1 hop)
SELECT f.* FROM graph g JOIN form f ON f.id = g.src
WHERE g.tgt = 'store_101' AND g.type = 'belongs_to';

-- "Show orders for this customer" (1 hop)
SELECT f.* FROM graph g JOIN form f ON f.id = g.src
WHERE g.tgt = 'cust_priya' AND g.type = 'ordered_by';
```

No deep traversals needed. Simple JOINs work.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| Do we need a separate graph database? | No — `graph` table works |
| Do we need in-memory traversals? | No — simple JOINs are fast |
| Do we need semantic + episodic + procedural? | Yes — we already have it |
| Do we need Memgraph? | **No** — TAR's 5 tables cover it |

**TAR's 5-table schema = Semantic (`form`+`graph`) + Episodic (`motion`) + Procedural (`skills`) + Vector (`memory`).**

---
