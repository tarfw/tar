---
type: Playbook
title: Black Friday weekend readiness
description: The pre-flight checklist plus on-call rotation for the busiest 96 hours of the year.
resource: https://internal.example/runbooks/bfcm
tags: [black-friday, bfcm, readiness, runbook]
timestamp: 2026-06-19T08:00:00Z
---

# Black Friday weekend readiness

This runbook covers the 96-hour window from Thanksgiving evening
through Cyber Monday end-of-day. Roughly 14% of the year's revenue
lands here.

## Pre-flight (week of)

- **Inventory frozen Monday at 18:00.** No new SKUs added. Forecasts
  re-run for top 50 SKUs; any forecast off by > 20% gets flagged
  for emergency PO if lead time permits.
- **Carrier rate sheets locked in.** Surcharges for the BFCM period
  added to the [shipping zones reference](/reference/shipping-zones.md);
  surcharges hidden from customer-facing pages (we absorb them).
- **Promo code matrix QA'd.** Each code tested against the
  rules engine for stacking + minimum cart + excluded SKUs.
- **Fraud thresholds raised.** Manual review queue volume is 5x
  normal; we drop the auto-review threshold from 80 to 75 to catch
  more. See [fraud review](/runbooks/fraud-review.md).

## On-call

- **Primary CX**: 12 hours each shift, two reps per shift, 6am–6pm
  and 6pm–6am Pacific.
- **Primary fulfillment**: warehouse runs 24/7 with two shifts; one
  manager on-call for escalations.
- **Engineering**: pager rotation tightened to 5-minute response.
  See severity rubric in the on-call runbook (separate bundle).

## During the window

- **Status page** updated every 30 minutes minimum if anything is
  degraded.
- **Out-of-stock decisions are faster.** No backorder over 14 days
  during BFCM (default fall-back is "no backorder, refund within
  the hour"). See [/runbooks/out-of-stock.md](/runbooks/out-of-stock.md).
- **Support macros** updated with the BFCM-specific shipping windows
  (next-day cutoff pulled in). See
  [/support-macros/missing-order.md](/support-macros/missing-order.md).

## Post-mortem

Within 5 business days of Cyber Monday, every incident gets logged.
The "what would we have wanted to know" list feeds into next year's
readiness checklist.
