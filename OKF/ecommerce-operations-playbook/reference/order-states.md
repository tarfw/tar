---
type: Reference
title: Order states
description: The full state machine an order moves through, the events that trigger each transition, and the operational owner.
resource: https://internal.example/reference/order-states
tags: [order-state, state-machine, reference]
timestamp: 2026-06-19T08:00:00Z
---

# Order states

Every order moves through this state machine. The state determines
who can act on the order, what the customer sees, and what the next
allowed transition is.

## The states

| State | Description | Who owns it |
|---|---|---|
| `CART` | Items added; checkout not started | Storefront |
| `CHECKOUT` | Customer entered checkout flow | Storefront |
| `PENDING_PAYMENT` | Submitted; waiting on payment processor | Payments |
| `PAID` | Payment captured | Payments |
| `HOLD_FRAUD` | Flagged for review | CX / fraud team |
| `READY_TO_PICK` | Cleared to ship | Warehouse |
| `READY_TO_SHIP` | Picked, packed, labeled | Warehouse |
| `SHIPPED` | Carrier has the package | Carrier |
| `DELIVERED` | Carrier marks delivered | Carrier |
| `RETURN_REQUESTED` | Customer initiated a return | CX |
| `RETURN_IN_TRANSIT` | Customer shipped the return | Carrier |
| `RETURN_RECEIVED` | Warehouse logged the return | Warehouse |
| `REFUNDED` | Refund issued | Finance |
| `CANCELED` | Order voided pre-ship | CX or system |

## Allowed transitions

- `CART` → `CHECKOUT` → `PENDING_PAYMENT` → `PAID`
- `PAID` → `HOLD_FRAUD` (auto) → `READY_TO_PICK` or `CANCELED`
- `READY_TO_PICK` → `READY_TO_SHIP` → `SHIPPED` → `DELIVERED`
- `DELIVERED` → `RETURN_REQUESTED` → `RETURN_IN_TRANSIT` → `RETURN_RECEIVED` → `REFUNDED`
- Most states → `CANCELED` (with appropriate reason code)

## Who uses this

- The [fraud review runbook](/runbooks/fraud-review.md) sits at the
  `HOLD_FRAUD` → `READY_TO_PICK` / `CANCELED` transition.
- The [out-of-stock runbook](/runbooks/out-of-stock.md) fires at
  `READY_TO_PICK` if inventory disappears.
- The [refund status macro](/support-macros/refund-status.md)
  references the `REFUNDED` state when answering customer questions.
- The [returns policy](/policies/returns-and-refunds.md) describes
  the `RETURN_*` states to customers in human-readable form.
