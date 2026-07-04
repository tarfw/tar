---
type: Screen
title: Home screen
description: Role-based timeline showing all actionable items across workspaces. Cards grouped by motion.type.
resource: tarai://src/app/(tabs)/home.tsx
tags: [screen, home, timeline, cards]
timestamp: 2026-07-04T00:00:00Z
---

# Home screen

Queries the user's Inbox (`u:{userId}`) Turso DB. All motions assigned to them appear here, grouped by type.

## Data source

```typescript
const timeline = await tarflue.tool("read", {
  table: "motion",
  limit: 50
});
```

One query to user's Turso DB. ~20ms latency.

## Card types

| motion.type | Card | Actions |
|---|---|---|
| `order` | OrderCard | Confirm, Ready, Cancel |
| `delivery` | DeliveryCard | Accept, Delivered |
| `task` | TaskCard | Complete, Reassign |
| `stock_alert` | StockCard | Restock, Dismiss |
| `lead` | LeadCard | Contact, Convert |
| `expiry` | ExpiryCard | Discount, Discard, Dismiss |

## Sections

Cards are grouped by type into sections:
- Orders (if any pending)
- Deliveries (if any pending)
- My Tasks (if any assigned)
- Stock Alerts (if any low)
- Expiry Alerts (if any expiring)

## Action handling

When user taps an action on a card:

```typescript
const workflow = ACTION_WORKFLOW_MAP[card.type][action];
await tarflue.workflow(workflow, {
  orderId: card.data.orderId,
  scope: card.scope
});
```

No LLM call. Direct workflow execution.

## Related

- [Chat screen](/screens/chat.md) — conversational interface
- [ActionExecutor](/components/action-executor.md) — runs workflows from cards
