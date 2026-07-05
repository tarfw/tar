---
type: Playbook
title: Out-of-stock handling
description: What to do when an order can't be fulfilled — partial ship, full backorder, or full refund.
resource: https://internal.example/runbooks/oos
tags: [oos, inventory, fulfillment, runbook]
timestamp: 2026-06-19T08:00:00Z
---

# Out-of-stock handling

This runbook fires when an order enters `READY_TO_PICK` and a SKU on
that order has no available inventory. See
[/reference/order-states.md](/reference/order-states.md) for the full
state diagram.

## Triage

1. **Multi-item order?** Check whether the in-stock items can ship
   independently without breaking the order's free-shipping threshold.
2. **Single-item order?** Decide between backorder and refund (next
   section).

## Multi-item: partial ship

If the in-stock items still exceed the $75 free-shipping threshold,
ship them now. Email the customer:

> Your order is on its way! One item (`<SKU NAME>`) is delayed and
> will ship separately within 7 days at no extra cost. We'll send a
> second tracking number when it ships.

Don't charge a second shipping fee. We absorb it.

## Single-item: backorder vs refund

- **Backorder if** the SKU has a confirmed PO arriving within 14
  days. Hold the order, email the customer the new ETA, give them
  the choice to wait or refund.
- **Refund if** there's no confirmed PO or the ETA is over 14 days.
  Don't make the customer wait open-ended.

For the refund-side conversation, use the
[/support-macros/refund-status.md](/support-macros/refund-status.md)
macro.

## After

Mark the SKU as `OUT_OF_STOCK` in the catalog. If this is the third
OOS incident this month for the same SKU, escalate to merch — the
forecast is wrong.

## Linked

- [Returns & refunds policy](/policies/returns-and-refunds.md) — refund timing applies here too
- [Fraud review](/runbooks/fraud-review.md) — don't refund a flagged order; resolve the flag first
