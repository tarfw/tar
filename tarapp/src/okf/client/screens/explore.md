---
type: Screen
title: Explore screen
description: Search, marketplace, workspace settings, and vertical browsing.
resource: tarapp://src/app/(tabs)/explore.tsx
tags: [screen, explore, search, marketplace]
timestamp: 2026-07-04T00:00:00Z
---

# Explore screen

Search across workspaces, browse the marketplace, manage workspace settings.

## Sections

| Section | What it shows |
|---|---|
| Search | Vector search across user's workspaces |
| Verticals | Business type cards (Restaurant, Clinic, etc.) |
| Teams | Workspaces user has access to |
| Marketplace | Installable skills and templates |
| Settings | Workspace config, team management |

## Marketplace

Browse and install OKF bundles from the global catalog:

```typescript
tarflue.search(query='restaurant template')
// Returns OKF bundles with actions, workflows, skills
```

Install = copy `form` rows into workspace scope.

## Related

- [Workspace screen](/screens/workspace.md) — workspace detail
- [Auth](/screens/auth.md) — sign in
