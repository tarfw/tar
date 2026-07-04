---
type: System
title: Action memory
description: Cache agent decisions as reusable inline cards. First time = LLM. Every replay = zero cost.
resource: tarflue-v2://src/lib/memory.ts
tags: [action-memory, replay, cost, cache]
timestamp: 2026-07-04T00:00:00Z
---

# Action memory

The core cost-saving mechanism. Caches agent decisions as reusable inline cards.

## How it works

```
FIRST TIME (LLM call):
  User: "Book a Taxi from Anna Nagar to KK Nagar"
  → LLM detects intent, picks workflow
  → Workflow executes
  → EXTRACT pattern → STORE in memory table

EVERY TIME AFTER (zero LLM):
  User types: "Bo..."
  → Autocomplete shows cached card
  → User taps → inline card appears
  → Edit fields → tap Execute
  → Workflow runs directly
  → LLM cost: ₹0
```

## Memory schema

```json
{
  "id": "mem_taxi_anna_kk",
  "text": "Book a Taxi from {from} to {to}",
  "embedding": [0.12, -0.34, 0.56],
  "meta": {
    "type": "action_memory",
    "intent": "book_taxi",
    "workflow": "wf_book_taxi",
    "slots": [
      {"key": "from", "label": "Pickup", "type": "location"},
      {"key": "to", "label": "Drop", "type": "location"}
    ],
    "usage_count": 5
  },
  "scope": "u:user_123"
}
```

## Intent hash (fast path)

Instead of vector search on every replay, hash the intent + slot keys:

```typescript
const hash = sha256("book_taxi:from:to");
```

| Method | Cost | Latency |
|---|---|---|
| Intent hash | ₹0 | <1ms |
| Vector search | ~₹0.001 | ~50ms |

## Cost impact (1K tenants)

| Scenario | LLM calls/mo | Cost |
|---|---|---|
| No memory | 30,000 | ~$4,000 |
| 70% cache hit | 9,000 | ~$1,200 |
| 90% cache hit | 3,000 | ~$400 |

## Components

| Component | Location | Purpose |
|---|---|---|
| Pattern extraction | `src/lib/memory.ts` | Extract intent+slots after success |
| Slot extraction | `src/lib/slots.ts` | Regex + entity lookup |
| Autocomplete endpoint | `src/app.ts` | `GET /memory/autocomplete?q=...` |
| Inline card | `tarai/src/components/ActionCard.tsx` | Editable fields + execute |
| Chat autocomplete | `tarai/src/components/ChatAutocomplete.tsx` | Shows matches above keyboard |

## Related

- [Master Agent](/agents/master.md) — the agent that uses action memory
- [Tools: Search](/tools/search.md) — vector search for memory
