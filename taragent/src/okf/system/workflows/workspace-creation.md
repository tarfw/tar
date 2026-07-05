---
type: Workflow
title: Workspace creation
description: How a new workspace is born — describe business, install modules, generate site, go live.
resource: taragent://src/workflows/
tags: [workflow, workspace, creation, setup]
timestamp: 2026-07-04T00:00:00Z
---

# Workspace creation

User describes their business in chat. Agent creates a workspace with the right modules.

## Steps

```
1. User: "I run a restaurant called Ravanan's in Anna Nagar"

2. Agent detects: business_type=restaurant, name="Ravanan's", location="Anna Nagar"

3. Agent matches business to module set:
   restaurant → Orders + Inventory + Bookings + CRM + Reports + Expenses + Documents

4. For each module:
   → Copy form rows from system bundle to workspace scope
   → Copy OKF concepts from system/modules/{module}.md to workspace bundle

5. Agent generates site layout (one LLM call — MiMo v2.5)

6. Workspace created: w:rest-101

7. Reply: "Workspace created! You have: Orders, Inventory, Bookings, CRM, Reports. Your site is live."
```

## Module mapping

| Business Type | Modules Installed |
|---|---|
| Restaurant / Cafe | Orders, Inventory, Bookings, CRM, Reports, Expenses, Documents |
| Pet Salon | Bookings, CRM, Orders, Reports, Expenses, Documents |
| Dental / Clinic | Bookings, CRM, Projects, Support, Reports, Expenses, Documents |
| Retail Store | Orders, Inventory, CRM, Reports, Expenses, Documents |
| Gym / Yoga | Bookings, CRM, LMS, HR, Reports, Expenses, Documents |
| Food Delivery | Orders, Inventory, Logistics, CRM, Reports, Expenses, Documents |

## What gets copied

For each module:
1. `form` rows (type='action', type='skill') → workspace scope
2. OKF concepts from `system/modules/{module}.md` → workspace bundle
3. SKILL.md from `src/skills/{module}/` → agent context

## LLM cost

One call for site layout generation (MiMo v2.5). Module matching is deterministic.

## Related

- [Modules](/modules/index.md) — the 14 capability modules
- [Marketplace](/modules/marketplace.md) — pre-built workspace templates
