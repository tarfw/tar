---
type: Policy
title: Shipping policy
description: Rate matrix by zone, handling time, expedited options, and what we do when carriers fail us.
resource: https://yourshop.com/policies/shipping
tags: [shipping, fulfillment, policy]
timestamp: 2026-06-19T08:00:00Z
---

# Shipping policy

## Handling time

- Orders placed before 12:00 PT on a business day ship same day.
- Orders placed after, or on weekends, ship next business day.
- Holiday cutoffs are posted on the homepage starting November 1.

## Rates by zone

See the [shipping zones reference](/reference/shipping-zones.md) for
the per-zone breakdown. Summary:

| Zone | Standard (4–7 days) | Express (2–3 days) |
|---|---|---|
| US continental | $5 | $12 |
| US AK/HI | $15 | $35 |
| Canada | $18 | $48 |
| International | calculated at checkout | — |

**Free standard shipping** on orders over $75 within the US
continental zone. Threshold applies to the merchandise subtotal,
after promotions, before tax.

## Carriers

- USPS for standard
- UPS Ground for express
- DHL eCommerce for international

If a carrier loses a package (no scan in 7 days past the expected
delivery date), the runbook in
[/runbooks/](/runbooks/index.md) covers what we do: we reship at our
cost and file the claim with the carrier on our side.

## Force majeure

We don't promise delivery dates during named regional outages
(hurricanes, wildfire evacuations, airline strikes). We post a banner
on the homepage and pause expedited options for the affected zones
until carriers re-open service.

## Linked

- [Returns & refunds policy](/policies/returns-and-refunds.md) — inbound counterpart
- [Order states reference](/reference/order-states.md) — `READY_TO_SHIP` → `SHIPPED` → `DELIVERED`
