---
type: Schema
title: Motion types
description: 32 motion types across 11 verticals. Motion = action queue — only events needing user action are stored.
resource: docs://schemas/motion
tags: [schema, motion, verticals, cards]
timestamp: 2026-07-04T00:00:00Z
---

# Motion types

Motion is the **action queue**. Only events needing user action go here. Completed/done events stay in DO SQLite for analytics.

## Verticals and motion types

| Vertical | motion.types | Avg motions/tenant/month |
|---|---|---|
| CRM | lead, deal, follow_up | 500 |
| POS / E-commerce | order, payment, refund | 5,000 |
| Food delivery | order, order_item, delivery, delivery_status | 8,000 |
| Taxi / Logistics | ride, ride_status, shipment | 3,000 |
| HR / Payroll | attendance, leave_request, payroll | 1,000 |
| Project management | task, sprint, milestone | 2,000 |
| Booking / Services | booking, reminder | 1,500 |
| Real estate | listing, inquiry | 500 |
| LMS | course_enrollment, assignment, completion | 500 |
| Inventory | stock_alert, restock, expiry | 2,000 |
| General | chat_message, notification, system | 5,000 |

**Total: 32 unique types, ~5,000/tenant/month**

## Card rendering by motion.type

| motion.type | Card | Fields | Actions |
|---|---|---|---|
| `order` | OrderCard | item, qty, customer, status | Confirm, Ready, Cancel |
| `delivery` | DeliveryCard | order, address, driver | Accept, Delivered |
| `task` | TaskCard | title, assignee, due date | Complete, Reassign |
| `stock_alert` | StockCard | product, current qty, threshold | Restock, Dismiss |
| `lead` | LeadCard | name, phone, source | Contact, Convert |
| `expiry` | ExpiryCard | product, expiry date, qty | Discount, Discard, Dismiss |

## Motion lifecycle (hot/warm/cold)

| Stage | Storage | Retention |
|---|---|---|
| Hot (active) | Turso motion table | 3-7 days |
| Warm (recent) | Turso motion_archive | 90 days |
| Cold (historical) | Turso motion_cold or R2 | Indefinite |

## Related

- [Matter](/schemas/matter.md) — where completed data lives
- [Home Screen](/operations/home-screen.md) — how motion renders on home
- [Modules](/modules/index.md) — which modules create which motions
