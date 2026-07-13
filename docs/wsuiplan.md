# TAR Workspace Gen UI Plan

> Prebuilt React Native components. SKILL.md `app_layout` choose which to show. Role-based layouts per team member.

---

## 1. Architecture

```
SKILL.md (app_layout sections)
    ↓
layout-engine.ts (parses YAML frontmatter)
    ↓
WorkspaceModuleLayout[] (sections array)
    ↓
WorkspaceCanvas.tsx (renders each section)
    ↓
ComponentRegistry (maps type → RN component)
    ↓
Pre-built components (metric-card, pos-sale, etc.)
```

---

## 2. Prebuilt Component Registry

| Component | Used by | Description |
|-----------|---------|-------------|
| `metric-card` | All modules | Single stat with optional trend |
| `quick-actions` | All modules | Action button grid |
| `action-button` | All modules | Single action trigger |
| `action-form` | All modules | Form for action params |
| `data-table` | Reports, Inventory | Scrollable row/column list |
| `timeline-feed` | Home, Orders | Chronological activity feed |
| `catalog-grid` | Orders, Listings | Product/item card grid |
| `booking-grid` | Bookings | Appointment slot picker |
| `report-chart` | Reports | Chart visualization |
| `status-board` | Projects, Support | Kanban/status columns |
| `pos-sale` | Orders | POS interface (grid + cart + payment) |

---

## 3. Adding New Components

### Step by Step

| # | Step | What |
|---|------|------|
| 1 | Design | Create layout in Figma or describe to AI |
| 2 | Create component | `sections/PosSale.tsx` |
| 3 | Register | `builtins.ts` — `registerComponent('pos-sale', {...})` |
| 4 | Use in SKILL.md | `sections: [{ type: "pos-sale" }]` |

### Figma → Component Workflow

| Method | How |
|--------|-----|
| Figma link | AI fetches and reads the design file |
| Screenshot | Share image, AI describes what it sees |
| Description | "POS like Square: product grid left, cart right" |

### What AI Needs to Create Component

1. Visual layout (from Figma/screenshot)
2. Design tokens (from `brand.md` — colors, fonts)
3. Component pattern (from existing `CatalogGrid.tsx`)
4. Data shape (what props does it receive)

### Example Prompt to AI

> "Create a POS sale component like Square. Product grid on left (2 columns), cart on right with quantities, total at bottom, payment buttons (UPI, Cash, Card). Use design tokens from brand.md. Follow the same pattern as CatalogGrid.tsx."

---

## 4. Role-Based Gen UI

> Roles are **not hardcoded per vertical**. Each workspace defines its own roles in `team/members.md`. The system is universal — salon, gym, agency, clinic all work with the same logic.

### How It Works

| Step | What |
|------|------|
| 1 | User logs in → app reads `team/members.md` → gets role |
| 2 | App reads SKILL.md → picks sections for that role |
| 3 | WorkspaceCanvas renders role-specific sections |

### SKILL.md Format (Role-Based)

```yaml
---
app_layout:
  # Role keys are workspace-specific — whatever the owner defines
  # Examples below, NOT presets:
  
  owner:
    sections:
      - type: metric-card
        title: "Today's Sales"
      - type: data-table
        title: "All Orders"
      - type: quick-actions
        actions: [record_sale, void_order, view_reports]
  
  staff:
    sections:
      - type: pos-sale
        categories: ["Food", "Drinks"]
      - type: quick-actions
        actions: [record_sale, split_bill]
  
  manager:
    sections:
      - type: timeline-feed
        title: "Activity"
      - type: status-board
        title: "Status"
  
  # Default fallback (no role match)
  default:
    sections:
      - type: quick-actions
        actions: [view_profile]
---
```

### Role → Screen Mapping (Dynamic, Not Preset)

| Role Key in SKILL.md | Sections Shown |
|----------------------|----------------|
| (matches user's role) | That role's sections |
| `default` | Fallback if no match |
| `owner` | Always sees everything |

> **No hardcoded role names.** The owner defines roles when creating the workspace. System just reads `team/members.md` and filters sections by role key.

### Fallback Behavior

| Scenario | What Happens |
|----------|-------------|
| Role matches a section set | Show that role's sections |
| Role not in SKILL.md | Show `default` sections |
| No `default` either | Show all sections (flat) |
| Owner always sees | Everything (owner key = full access) |

---

## 5. Team Member Customization

### Methods

| Method | How |
|--------|-----|
| Edit SKILL.md directly | Change `app_layout.sections` array |
| Ask AI | "Show me a POS screen" → AI edits `app_layout` |
| Swap sections | Replace `data-table` with `pos-sale` |
| Add new role | Add a new key under `app_layout:` with its sections |

### Example — Customizing Orders Module

```yaml
# Before (default layout)
app_layout:
  sections:
    - type: metric-card
      title: "Today's Sales"
    - type: quick-actions
      actions: [record_sale, void_order]

# After (POS layout for staff)
app_layout:
  staff:
    sections:
      - type: pos-sale
        categories: ["Food", "Drinks"]
      - type: quick-actions
        actions: [record_sale, split_bill]
```

### Adding a New Role

```yaml
app_layout:
  owner:
    sections:
      - type: metric-card
      - type: data-table
  
  staff:
    sections:
      - type: pos-sale
  
  # New role: driver (for delivery business)
  driver:
    sections:
      - type: timeline-feed
        title: "My Deliveries"
      - type: quick-actions
        actions: [update_delivery_status]
```

> Any role name works. System just matches `team/members.md` role → `app_layout` key.

---

## 6. File Locations

```
tarapp/
├── src/
│   ├── components/
│   │   └── WorkspaceCanvas.tsx      ← renders sections
│   ├── lib/
│   │   └── layout-engine.ts         ← parses app_layout
│   └── gen-ui/
│       └── registry/
│           ├── builtins.ts          ← registers components
│           ├── ComponentRegistry.ts  ← type → component map
│           └── sections/
│               ├── MetricCard.tsx
│               ├── CatalogGrid.tsx
│               ├── PosSale.tsx      ← NEW
│               └── ...

workspaces/{scope}/
├── skills/
│   └── orders.md                    ← has app_layout per role
└── team/
    └── members.md                   ← staff → role mapping
```

---

## 7. Implementation Checklist

### Registry

- [ ] Create `sections/PosSale.tsx` — POS interface component
- [ ] Register `pos-sale` in `builtins.ts`
- [ ] Add `app_layout` role support to `layout-engine.ts`

### Role-Based Layout

- [ ] Update `WorkspaceCanvas.tsx` to filter sections by role
- [ ] Read user role from `team/members.md`
- [ ] Pass role to layout-engine for section filtering

### Documentation

- [ ] Add role-based `app_layout` examples to SKILL.md templates
- [ ] Document component creation workflow (Figma → AI → component)
