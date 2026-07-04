---
type: Playbook
title: Fraud review
description: Signals to check, the manual decision flow, and what to say to a legitimate customer whose order got flagged.
resource: https://internal.example/runbooks/fraud
tags: [fraud, risk, chargeback, runbook]
timestamp: 2026-06-19T08:00:00Z
---

# Fraud review

This runbook fires for orders with a payment-gateway fraud score
above 80, or for any order that trips one of our internal heuristics.

## Signals to check

In rough order of weight:

1. **Billing address ↔ shipping address.** Different country? Strong
   flag. Different state same country? Soft flag, usually fine.
2. **Cardholder name vs shipping name.** "Gift for…" is legitimate;
   completely unrelated names without that note are not.
3. **Customer history.** Previous successful orders to the same
   shipping address from the same customer? Almost always legit.
4. **Email age.** Disposable email domain? Strong flag.
5. **Order velocity.** Three orders in 5 minutes from the same IP?
   Block and review all three.
6. **Total value vs cart shape.** Unusually large order on a brand-new
   customer? Soft flag.

## Decision flow

```
score > 90 → cancel + refund, send the cancellation macro
score 80-90 → manual review:
    legit signals    → release the hold, ship
    suspect signals  → cancel + refund
    can't tell       → email the customer for last-4 verification
```

## Emailing the customer

We never tell a legitimate customer they "look like fraud." Use the
macro under [/support-macros/](/support-macros/index.md) — it asks
for the last 4 digits and the issuing bank for "additional
verification." If they reply within 24 hours with matching info, we
release the hold.

## Don't

- Don't release a hold without a documented reason in the order's
  internal notes.
- Don't refund and then ship. Pick one.
- Don't escalate to legal unless the same shipping address has been
  flagged on three separate orders.

## Linked

- [Order states reference](/reference/order-states.md) — `HOLD_FRAUD` → `CANCELED` or `READY_TO_PICK`
- [Out-of-stock handling](/runbooks/out-of-stock.md) — never refund a flagged order without resolving the flag first
