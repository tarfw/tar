---
type: Architecture
title: System overview
description: tarai is a thin 3-tab Expo client; tarflue-v2 is the Cloudflare Workers backend handling all business logic.
resource: https://github.com/tarfr/tarflue-v2
tags: [architecture, system, overview]
timestamp: 2026-07-04T00:00:00Z
---

# System overview

## tarai (thin client)

Expo React Native app with 3 tabs:

| Tab | Purpose |
|---|---|
| **Home** | Role-based timeline / inbox across all workspaces |
| **Chat** | AI agent — creates workspaces, runs workflows |
| **Explore** | Search, marketplace, workspace settings |

One workspace = one business. Channels (Telegram, Slack, Discord) are how people reach that workspace. Users can own multiple workspaces.

## tarflue-v2 (backend)

Cloudflare Workers + Durable Objects. All business logic lives here.

```
tarflue-v2
├── 6 tools (create, read, update, delete, link, search)
├── JSON actions (stored in Turso form)
├── Workflows (orchestrate actions with branches/parallel)
├── Agents (cheap LLM intent detection + workflow picker)
├── Flue skills (markdown instructions for agents)
├── Channels (Telegram, Slack, Discord, WhatsApp)
├── WorkspaceDO (per-workspace stock, services, config)
├── OrderDO (per-order state machine + payment)
├── Turso global (form catalog, user profiles, vectors)
├── D1 (channel routing + team membership)
├── KV (site cache)
└── CF Worker (renders workspace site from layout JSON)
```

## Data flow

```
User input
  → Agent (cheap LLM) → detects intent → picks workflow
  → Workflow → orchestrates skills/actions
  → Skills/Actions → call 6 tools
  → 6 tools → SQL on DO SQLite / Turso
  → Reply to user
```

## Key design decisions

1. DO SQLite-first for operational hot paths
2. 5 tables, 6 tools — no new primitives
3. Action memory caches decisions as reusable cards
4. Motion = action queue (only events needing action)
5. Cheap LLMs only (Groq for routing, MiMo v2.5 for site gen)
6. One WebSocket per user

## Related

- [Data Model](/architecture/data-model.md)
- [Scopes](/architecture/scopes.md)
- [Storage](/architecture/storage.md)
