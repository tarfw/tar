---
type: Navigation
title: Screen map
description: All screens in the tarai app with their routes and purposes.
resource: tarai://src/app/
tags: [navigation, screens, routes]
timestamp: 2026-07-04T00:00:00Z
---

# Screen map

## Root

| Route | File | Purpose |
|---|---|---|
| `/` | `index.tsx` | Redirect → /auth or /(tabs) |
| `/auth` | `auth.tsx` | Google sign-in |

## Tabs

| Route | File | Purpose |
|---|---|---|
| `/(tabs)/home` | `home.tsx` | Role-based timeline |
| `/(tabs)/chat` | `chat.tsx` | Agent chat |
| `/(tabs)/explore` | `explore.tsx` | Search + marketplace |

## Screens

| Route | File | Purpose |
|---|---|---|
| `/workspace` | `workspace.tsx` | Workspace detail |
| `/entity` | `entity.tsx` | Entity detail (product, order, etc.) |
| `/product` | `product.tsx` | Product detail |
| `/add-item` | `add-item.tsx` | Add item to workspace |
| `/add` | `add.tsx` | Generic add screen |
| `/browse` | `browse.tsx` | Browse items |
| `/personal` | `personal.tsx` | Personal settings |
| `/settings` | `settings.tsx` | Workspace settings |
| `/actions` | `actions.tsx` | Actions catalog |
| `/actions-catalog` | `actions-catalog.tsx` | Browse all actions |

## Related

- [Tabs](/navigation/tabs.md) — bottom tab bar
