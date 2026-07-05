---
type: Catalog
title: Menu items
description: Product catalog for this workspace — items, prices, stock levels.
resource: docs://workspace/products/menu-items
tags: [products, catalog, inventory]
timestamp: 2026-07-04T00:00:00Z
---

# Menu items

Each product is a `matter` row with `type='product'`. Products reference the global form catalog via FK.

## Fields per product

| Field | Source | Example |
|---|---|---|
| `title` | Workspace | "Pepsi 500ml" |
| `form` | Global FK | `f_p001` |
| `qty` | Workspace | 50 |
| `unit` | Workspace | piece |
| `value` | Workspace | 22 |
| `data.cost_price` | Workspace | 18 |
| `data.mrp` | Global | 24 |
| `data.min_stock` | Workspace | 20 |
| `data.category` | Workspace | beverages |

## Example catalog

| Product | Qty | Unit | Price | Cost | Min Stock |
|---|---|---|---|---|---|
| Pepsi 500ml | 50 | piece | ₹22 | ₹18 | 20 |
| Chicken Biryani | 30 | plate | ₹180 | ₹120 | 10 |
| Sunflower Oil | 20 | litre | ₹180 | ₹150 | 5 |

## Related

- [Categories](/products/categories.md) — product groupings
- [Suppliers](/products/suppliers.md) — who supplies what
- [Inventory module](/modules/inventory.md) — stock management procedures
