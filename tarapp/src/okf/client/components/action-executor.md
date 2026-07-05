---
type: Component
title: ActionExecutor
description: Runs workflows when user taps an action on a card. Maps card actions to workflows.
resource: tarapp://src/components/ActionExecutor.tsx
tags: [component, action, workflow, executor]
timestamp: 2026-07-04T00:00:00Z
---

# ActionExecutor

Handles action taps on motion cards. Maps the action to a workflow and executes it directly.

## How it works

```typescript
async function onCardAction(card: MotionCard, action: string) {
  const workflow = ACTION_WORKFLOW_MAP[card.type][action];
  await tarflue.workflow(workflow, {
    orderId: card.data.orderId,
    scope: card.scope
  });
}
```

## Action-to-workflow mapping

| Card Type | Action | Workflow |
|---|---|---|
| OrderCard | Confirm | `wf_confirm_order` |
| OrderCard | Ready | `wf_order_ready` |
| OrderCard | Cancel | `wf_cancel_order` |
| DeliveryCard | Accept | `wf_accept_delivery` |
| DeliveryCard | Delivered | `wf_deliver_order` |
| TaskCard | Complete | `wf_complete_task` |
| StockCard | Restock | `wf_restock` |
| ExpiryCard | Discount | `wf_discount_product` |
| ExpiryCard | Discard | `wf_discard_product` |

## No LLM

ActionExecutor never calls the LLM. It's a direct workflow execution path. This is the zero-cost replay that action memory enables.

## Related

- [Home screen](/screens/home.md) — where cards are rendered
- [ActionForm](/components/action-form.md) — dynamic form for complex actions
