---
type: Policy
title: Returns & refunds policy
description: The 30-day window, what's excluded, who pays for return shipping, and how the refund hits the customer's card.
resource: https://yourshop.com/policies/returns
tags: [returns, refunds, policy, customer]
timestamp: 2026-06-19T08:00:00Z
---

# Returns & refunds policy

## Window

**30 days from delivery.** Delivery date is the carrier-reported
delivery timestamp, not the ship date. Customer service confirms via
the tracking lookup before approving any return.

## What's returnable

- Unworn, unwashed items in original condition with tags attached
- Wrong item sent (our error)
- Damaged on arrival (see [/runbooks/](/runbooks/index.md) — damaged item runbook)

## What's not returnable

- Final-sale items (marked at purchase)
- Underwear, socks, and intimate apparel (hygiene)
- Items marked as customized or made-to-order

## Return shipping

- **Defective or our error**: we pay. Email a pre-paid label within
  one business day.
- **Customer change-of-mind**: customer pays. Provide them the
  return address; deduct a $7 flat fee from the refund.

## Refund timing

- We process the refund within **3 business days** of receiving the
  return at the warehouse.
- The card-network refund posts to the customer in **5–10 business
  days** depending on issuer. We don't control that part.
- For PayPal / Shop Pay / Klarna, refunds usually post within 24
  hours of our processing.

## Macros

CX reps use canonical wording for these conversations. See
[/support-macros/refund-status.md](/support-macros/refund-status.md).

## Linked

- [Shipping policy](/policies/shipping-policy.md) — outbound counterpart
- [Order states reference](/reference/order-states.md) — `RETURN_REQUESTED` → `REFUNDED` transition
