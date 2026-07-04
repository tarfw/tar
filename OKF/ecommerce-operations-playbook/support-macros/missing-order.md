---
type: Macro
title: Missing order
description: Customer reports a shipped order they haven't received. The triage, the wording, and the reship rules.
resource: https://internal.example/macros/missing-order
tags: [macro, support, shipping, cx]
timestamp: 2026-06-19T08:00:00Z
---

# Missing order

When a customer writes in to say their order shipped but never
arrived, follow this triage in order.

## Triage

1. **Check the tracking.** Look up the shipment number, find the
   last scan, find the expected delivery date.
2. **Within carrier-promised window?** If we're still inside USPS's
   "delivered" estimate, no action — see the wording below.
3. **Past the window, no recent scan?** Lost in transit. See reship
   policy below.
4. **Marked delivered but customer says no?** Carrier-side investigation,
   see "marked delivered" below.

## Macros

### Still within delivery window

> Hi [Name], your order is on its way! Tracking shows the most recent
> scan at [LOCATION] on [DATE]. Expected delivery is [DATE]. Carriers
> sometimes pause scans for a day or two between hubs — if you don't
> see movement by [DATE + 2], please let us know and we'll investigate
> directly with [CARRIER].

### Lost in transit (no scan for 7+ days)

> Hi [Name], I'm sorry — it looks like your order got stuck at the
> carrier. The last scan was [DATE] at [LOCATION] and there's been
> no update since. I've gone ahead and shipped a replacement at no
> charge, tracking [NEW_TRACKING]. Estimated delivery is [DATE]. If
> the original somehow shows up, just let us know.

### Marked delivered but customer says no

> Hi [Name], the carrier shows your order as delivered on [DATE].
> Could you check with neighbors and any front-desk or mailroom? If
> there's still no sign of it after 48 hours, reply back and we'll
> file a delivery investigation with [CARRIER]. In most cases the
> package turns up nearby within a couple of days.

## Reship rules

- **One reship per customer per quarter** at our cost.
- **No reships during BFCM weekend** — see
  [/runbooks/black-friday-readiness.md](/runbooks/black-friday-readiness.md)
  for the rationale. Customer gets a refund instead.

## Linked

- [Shipping policy](/policies/shipping-policy.md) — the public-facing version of these rules
- [Damaged item](/support-macros/damaged-item.md) — sibling macro
