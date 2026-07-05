---
type: Macro
title: Damaged item
description: Customer received an item damaged. Photo request, replacement-vs-refund decision, return label.
resource: https://internal.example/macros/damaged
tags: [macro, support, damaged, cx]
timestamp: 2026-06-19T08:00:00Z
---

# Damaged item

When a customer reports a damaged item, we offer a fast resolution
and we don't make them prove anything beyond a photo.

## Macros

### First reply

> Hi [Name], I'm so sorry that arrived damaged — that's frustrating.
> Could you reply with a photo of the damage so we can pass it along
> to the carrier and our packaging team? Once we have that, I'll get
> a replacement out today (or a full refund if you'd rather not wait).

### After photo

> Thanks for the photo, [Name]. I've shipped a replacement at no
> charge, tracking [NEW_TRACKING]. Estimated delivery is [DATE]. No
> need to send the damaged item back — you can recycle the packaging.
> Sorry again for the trouble.

### Replacement out of stock

> Thanks for the photo, [Name]. Unfortunately we're out of stock on
> [SKU] right now. I've refunded the full amount including shipping
> to your original card — see
> [/policies/returns-and-refunds.md](/policies/returns-and-refunds.md)
> for the timing on when that posts. When [SKU] is back in stock,
> we'll send you a heads-up.

## Don't

- Don't ask the customer to ship the damaged item back. Photo is
  enough. Return shipping adds friction and cost without value to us.
- Don't tell the customer "the carrier did it." Even if it's
  obviously true. From their seat it's our package and our problem.

## Linked

- [Returns & refunds policy](/policies/returns-and-refunds.md) — refund timing
- [Missing order](/support-macros/missing-order.md) — sibling macro for never-arrived
