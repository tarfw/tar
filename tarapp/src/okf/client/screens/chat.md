---
type: Screen
title: Chat screen
description: Conversational interface with the AI agent. Supports autocomplete from action memory and inline action cards.
resource: tarapp://src/app/(tabs)/chat.tsx
tags: [screen, chat, agent, autocomplete]
timestamp: 2026-07-04T00:00:00Z
---

# Chat screen

The primary interface for talking to the agent. Supports text input, autocomplete from action memory, and inline action cards.

## Flow

```
User types message
  → POST /agents/master/:sessionId
  → Agent detects intent
  → Agent picks workflow or replies directly
  → Response appears in chat
```

## Autocomplete

As user types, search action memory for matching patterns:

```
User types: "Bo..."
  → Search memory: query='bo', scope='u:{userId}'
  → Returns: "Book a Taxi from {from} to {to}"
  → Shows autocomplete suggestion above keyboard
```

## Inline action cards

When user taps an autocomplete suggestion:

1. TextInput hides
2. ActionMemoryCard expands inline
3. User edits slot values
4. Taps "Execute" → `tarflue.workflow()` directly
5. Result appears as chat message
6. Card collapses, TextInput returns

## Components

| Component | Purpose |
|---|---|
| `TextInput` | Message input |
| `ChatAutocomplete` | Memory matches above input |
| `ActionMemoryCard` | Inline editable card |
| `MessageList` | Chat history |
| `SendButton` | Send message |

## Related

- [Home screen](/screens/home.md) — timeline view
- [ActionExecutor](/components/action-executor.md) — runs workflows
