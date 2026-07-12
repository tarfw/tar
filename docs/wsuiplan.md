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
  owner:
    sections:
      - type: metric-card
        title: "Today's Sales"
      - type: data-table
        title: "All Orders"
      - type: quick-actions
        actions: [record_sale, void_order, view_reports]
  
  waiter:
    sections:
      - type: pos-sale
        categories: ["Food", "Drinks"]
      - type: quick-actions
        actions: [record_sale, split_bill]
  
  kitchen:
    sections:
      - type: timeline-feed
        title: "Incoming Orders"
      - type: status-board
        title: "Order Status"
  
  cashier:
    sections:
      - type: pos-sale
      - type: data-table
        title: "Payment History"
---
```

### Role → Screen Mapping

| Role | Sections |
|------|----------|
| Owner | metric-card, data-table, quick-actions, reports |
| Waiter | pos-sale, quick-actions |
| Kitchen | timeline-feed, status-board |
| Cashier | pos-sale, payment-history |

---

## 5. Team Member Customization

### Methods

| Method | How |
|--------|-----|
| Edit SKILL.md directly | Change `app_layout.sections` array |
| Ask AI | "Show me a POS screen" → AI edits `app_layout` |
| Swap sections | Replace `data-table` with `pos-sale` |

### Example — Customizing Orders Module

```yaml
# Before (default layout)
app_layout:
  sections:
    - type: metric-card
      title: "Today's Sales"
    - type: quick-actions
      actions: [record_sale, void_order]

# After (POS layout for waiter)
app_layout:
  waiter:
    sections:
      - type: pos-sale
        categories: ["Food", "Drinks"]
      - type: quick-actions
        actions: [record_sale, split_bill]
```

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
