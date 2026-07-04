---
type: API
title: tarflue client
description: The client API that tarai uses to communicate with tarflue-v2 backend.
resource: tarai://src/lib/tarflue.ts
tags: [api, client, backend, http]
timestamp: 2026-07-04T00:00:00Z
---

# tarflue client

All backend communication goes through `src/lib/tarflue.ts`.

## Methods

| Method | Endpoint | Purpose |
|---|---|---|
| `tarflue.chat(sessionId, message)` | POST /agents/master/:sessionId | Send message to agent |
| `tarflue.tool(name, input)` | POST /tools/:name | Call a tool directly |
| `tarflue.workflow(name, input)` | POST /workflows/:name | Execute a workflow |
| `tarflue.search(query)` | POST /search | Vector search |
| `tarflue.listTeams()` | GET /teams | List user's teams |
| `tarflue.installTemplate(id, scope)` | POST /marketplace/install | Install OKF bundle |

## Auth

All requests include the user's auth token. Backend verifies identity and checks workspace access via D1 channel_groups.

## Error handling

| Status | Meaning |
|---|---|
| 200 | Success |
| 401 | Not authenticated |
| 403 | No access to workspace |
| 404 | Resource not found |
| 500 | Backend error |

## Related

- [Home screen](/screens/home.md) — uses `tarflue.tool("read", ...)` for timeline
- [Chat screen](/screens/chat.md) — uses `tarflue.chat(...)` for agent
