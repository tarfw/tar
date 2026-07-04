---
type: Macro
title: Refund status
description: Customer is asking where their refund is. Why it's not back yet, when it will be, and what we can prove on our end.
resource: https://internal.example/macros/refund-status
tags: [macro, support, refunds, cx]
timestamp: 2026-06-19T08:00:00Z
---

# Refund status

The most common refund question is "you said you refunded me and I
don't see it." Almost always, the refund has cleared our side and
is on the card network's side.

## Reference points

- **We process refunds within 3 business days of receiving the return.**
- **The card-network refund posts to the customer in 5–10 business
  days** depending on issuer.
- Full policy: [/policies/returns-and-refunds.md](/policies/returns-and-refunds.md)

## Macros

### Refund processed, customer hasn't seen it yet

> Hi [Name], I checked and your refund of $[AMOUNT] was processed on
> [DATE]. From our end the transaction shows as completed, but card
> networks usually take 5–10 business days to post the refund back
> to your statement. If it doesn't show up by [DATE + 10 BUSINESS],
> please reply and we'll send you the confirmation reference so you
> can pursue it with your issuing bank.

### Refund processed, share the reference

> Hi [Name], here's the refund confirmation for your records:
>
> - Refund reference: [REFERENCE_ID]
> - Amount: $[AMOUNT]
> - Processed: [DATE]
>
> Your bank should be able to locate the refund using that reference.
> If they still can't see it, ask them to check pending refund
> transactions, not just posted ones.

### Refund delayed on our side

This shouldn't happen, but when it does:

> Hi [Name], you're right — your refund hasn't been processed yet.
> I'm sorry about the delay. I've just submitted it now;
> you should see it back on your card within 5–10 business days
> from today. We'll watch for the post-back on our side.

## Don't

- Don't say "the bank is being slow" without proof. Sometimes the
  delay is on us.
- Don't offer a re-refund. Two refunds against the same charge
  create reconciliation headaches.

## Linked

- [Returns & refunds policy](/policies/returns-and-refunds.md) — canonical timing
- [Order states reference](/reference/order-states.md) — `REFUNDED` state
