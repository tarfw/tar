---
type: Tool
title: Search
description: VECTOR SEARCH operation. Searches the memory table in Turso using embeddings.
resource: taragent://tools/search
tags: [tool, search, vector, embedding]
timestamp: 2026-07-04T00:00:00Z
---

# Search

VECTOR SEARCH against the `memory` table in Turso. Used for marketplace, AI context, and action memory.

## Agent usage

```
search(query='pepsi orders', scope='w:pet-202')
search(query='book taxi', scope='u:user_123')
search(query='restaurant template', scope='g:global')
```

## What it does

1. Embeds the query text into a vector
2. Runs approximate nearest neighbor (ANN) search against `memory.embedding`
3. Returns the most relevant results with scores

## What's in the memory table

| Content | Scope | Purpose |
|---|---|---|
| Action memory cards | `u:{userId}` | Cached agent decisions for replay |
| Marketplace listings | `g:global` | Templates, skills, workflows |
| AI context | workspace scope | Business-specific knowledge |

## Action memory search

When user types "Bo..." the agent searches for matching action memory:

```
search(query='book', scope='u:user_123')
→ Returns: "Book a Taxi from {from} to {to}" card
→ User taps → inline card appears → edit fields → execute
```

## Performance

| Method | Cost | Latency |
|---|---|---|
| Intent hash (fast path) | ₹0 | <1ms |
| Vector search (fallback) | ~₹0.001 | ~50ms |

## Related

- [Read](/tools/read.md) — read exact rows (not vector search)
- [Action memory](/agents/action-memory.md) — how cached cards work
