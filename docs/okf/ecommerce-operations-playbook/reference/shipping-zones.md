---
type: Reference
title: Shipping zones
description: The rate matrix by zone, with BFCM surcharges and carrier-specific notes.
resource: https://internal.example/reference/shipping-zones
tags: [shipping, zones, rates, reference]
timestamp: 2026-06-19T08:00:00Z
---

# Shipping zones

The rate matrix every CX rep and the [shipping policy](/policies/shipping-policy.md)
both reference.

## Domestic — US continental

| Service | Days | Rate | BFCM surcharge | Carrier |
|---|---|---|---|---|
| Standard | 4–7 | $5.00 | $0 (absorbed) | USPS Ground Advantage |
| Express | 2–3 | $12.00 | $4 (absorbed) | UPS Ground / 2-Day |
| Overnight | 1 | $32.00 | $8 (absorbed) | UPS Next Day Air |

**Free standard shipping** at $75+ merchandise subtotal.

## Domestic — US AK / HI / territories

| Service | Days | Rate |
|---|---|---|
| Standard | 7–10 | $15.00 |
| Express | 3–5 | $35.00 |

No free shipping threshold; the per-package cost is too high.

## Canada

| Service | Days | Rate |
|---|---|---|
| Standard | 7–14 | $18.00 |
| Express | 3–6 | $48.00 |

Customer pays duties on delivery (DDP not offered).

## International

Rates calculated at checkout via DHL eCommerce's API. Duties + taxes
collected by the carrier on delivery (DDU). We don't offer DDP
shipping at this time — the cross-border refund flow is too messy
for our return-rate tolerance.

## Carrier notes

- **USPS** — most common scan delays happen in the 24 hours after
  pickup. If a customer asks about a "no scan" status within that
  window, see the [missing-order macro](/support-macros/missing-order.md).
- **UPS Ground** — Saturday delivery is included for free in the US
  continental zone.
- **DHL eCommerce** — drops to a local carrier at the destination
  country, so the final tracking number changes. Always provide both
  numbers to international customers.

## BFCM-specific

During Black Friday weekend (see
[/runbooks/black-friday-readiness.md](/runbooks/black-friday-readiness.md)),
the carrier-imposed surcharges are absorbed by us, not passed to the
customer. The matrix above already reflects that.
