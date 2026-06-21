# E-Commerce & Store Entity Design

Products, items, and transactions in the store entity screen.

---

## 1. Core Concepts

| Term | Table | What It Is |
|------|-------|------------|
| **Product** | form | Knowledge/definition (what it is) |
| **Item** | matter | Physical reality (stock in YOUR store) |
| **Transaction** | motion | Event log (sold, paid, shipped) |

---

## 2. Two Types of Products

| Type | Example | How Created |
|------|---------|-------------|
| **Global** | Pepsi, Coke, Nike | Already exists in global DB. Store owner searches → selects → adds items |
| **Local** | Chocolate Smoothie | Store owner creates definition → publishes to global → adds items |

---

## 3. Data Flow

### Global Product (Pepsi)

```
Store Owner Adds Pepsi
        │
        ▼
┌─────────────────────────────────────┐
│  1. Search global DB                │
│     → Find Pepsi (form exists)      │
│                                     │
│  2. Select variants                 │
│     → 250ml, 500ml, 1L              │
│                                     │
│  3. Add items to store              │
│     → matter(form=pepsi, qty=30)    │
│     → matter(form=pepsi, qty=50)    │
│     → matter(form=pepsi, qty=20)    │
│                                     │
│  4. Graph connections               │
│     → graph(src=item, tgt=store)    │
│     → graph(src=item, tgt=product)  │
└─────────────────────────────────────┘
```

### Local Product (Chocolate Smoothie)

```
Store Owner Creates Smoothie
        │
        ▼
┌─────────────────────────────────────┐
│  1. Create product definition       │
│     → form(type=product, title=...) │
│                                     │
│  2. Publish to global DB            │
│     → Turso knowledge + memory      │
│                                     │
│  3. Add items to store              │
│     → matter(form=smoothie, qty=15) │
│     → matter(form=smoothie, qty=10) │
│                                     │
│  4. Graph connections               │
│     → graph(src=item, tgt=store)    │
│     → graph(src=item, tgt=product)  │
└─────────────────────────────────────┘
```

---

## 4. Tables Summary

| Table | What | Example |
|-------|------|---------|
| **form** (product) | Knowledge definition | Pepsi, Nike Air Max, Chocolate Smoothie |
| **matter** (item) | Physical stock in YOUR store | 500ml Pepsi × 50 nos in Fridge A2 |
| **motion** (transaction) | Event log | SOLD -2, TRANS_IN +50, PAY_SUCCESS |
| **graph** | Connections | item→product, item→store, order→customer |
| **memory** | Search vectors | "pepsi", "nike shoes", "chocolate drink" |

---

## 5. Global vs Local Products

| | Global Product | Local Product |
|---|---|---|
| **form** | Already exists in global DB | Created by store owner |
| **matter** | Store adds items (stock) | Store adds items (stock) |
| **motion** | Same | Same |
| **graph** | item→global_product | item→local_product |
| **Example** | Pepsi, Coke, Nike | Chocolate Smoothie, House Special |

---

## 6. Screen Designs

### Screen 1: Store Overview

```
┌─────────────────────────────────────┐
│  ← TAR Store                 [⋯]   │
├─────────────────────────────────────┤
│  🏪 tar-store.tarai.space          │
├─────────────────────────────────────┤
│  [Items] [Transactions] [Notes]    │
├─────────────────────────────────────┤
│                                     │
│  Items (8)                   [+]   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🥤 Pepsi                        ││
│  │ 250ml: 30 · 500ml: 50 · 1L: 20 ││
│  ├─────────────────────────────────┤│
│  │ 🍫 Chocolate Smoothie (local)   ││
│  │ Medium: 15 · Large: 10          ││
│  ├─────────────────────────────────┤│
│  │ 👟 Nike Air Max                 ││
│  │ Size 9: 50 · Size 10: 30       ││
│  └─────────────────────────────────┘│
│                                     │
│  Transactions (recent)       [→]   │
│  ┌─────────────────────────────────┐│
│  │ ● Pepsi 500ml SOLD -2   ₹80    ││
│  │ ● Smoothie SOLD -1      ₹150   ││
│  │ ● Pepsi 250ml TRANS_IN +30     ││
│  └─────────────────────────────────┘│
│                                     │
│  [Search a skill…]                  │
└─────────────────────────────────────┘
```

### Screen 2: Add Item - Global Product Search

```
┌─────────────────────────────────────┐
│  ← Add Item                   [✕]  │
├─────────────────────────────────────┤
│  🔍 Search products globally...     │
├─────────────────────────────────────┤
│                                     │
│  Global Products                    │
│  ┌─────────────────────────────────┐│
│  │ 🥤 Pepsi                        ││
│  │ Variants: 250ml, 500ml, 1L     ││
│  │ Brand: PepsiCo                  ││
│  │ [Select]                        ││
│  ├─────────────────────────────────┤│
│  │ 🥤 Coca-Cola                    ││
│  │ Variants: 250ml, 500ml, 1L     ││
│  │ Brand: Coca-Cola Company        ││
│  │ [Select]                        ││
│  ├─────────────────────────────────┤│
│  │ 👟 Nike Air Max                 ││
│  │ Variants: 6, 7, 8, 9, 10, 11  ││
│  │ Brand: Nike                     ││
│  │ [Select]                        ││
│  └─────────────────────────────────┘│
│                                     │
│  ── OR ──                           │
│                                     │
│  [+ Create New Product]             │
│                                     │
└─────────────────────────────────────┘
```

### Screen 3: Add Item - Create Local Product

```
┌─────────────────────────────────────┐
│  ← Create Product            [✕]   │
├─────────────────────────────────────┤
│  Product Name                       │
│  ┌─────────────────────────────────┐│
│  │ Chocolate Smoothie              ││
│  └─────────────────────────────────┘│
│                                     │
│  Category                           │
│  ┌─────────────────────────────────┐│
│  │ Beverages                   ▾   ││
│  └─────────────────────────────────┘│
│                                     │
│  Description                        │
│  ┌─────────────────────────────────┐│
│  │ Fresh chocolate smoothie made   ││
│  │ with premium cocoa...           ││
│  └─────────────────────────────────┘│
│                                     │
│  Variants (add sizes/options)       │
│  ┌─────────────────────────────────┐│
│  │ + Medium (₹120)                 ││
│  │ + Large (₹150)                  ││
│  └─────────────────────────────────┘│
│                                     │
│  [Save & Add Items]                 │
│                                     │
└─────────────────────────────────────┘
```

### Screen 4: Add Items to Store

```
┌─────────────────────────────────────┐
│  ← Add Items: Pepsi          [✕]   │
├─────────────────────────────────────┤
│  Select variants & set stock        │
├─────────────────────────────────────┤
│                                     │
│  ☑ 250ml                           │
│  ┌─────────────────────────────────┐│
│  │ Stock: [30]  ·  Price: ₹15     ││
│  │ Location: [Fridge A1]           ││
│  └─────────────────────────────────┘│
│                                     │
│  ☑ 500ml                           │
│  ┌─────────────────────────────────┐│
│  │ Stock: [50]  ·  Price: ₹25     ││
│  │ Location: [Fridge A2]           ││
│  └─────────────────────────────────┘│
│                                     │
│  ☑ 1L Pet Bottle                   │
│  ┌─────────────────────────────────┐│
│  │ Stock: [20]  ·  Price: ₹40     ││
│  │ Location: [Shelf B1]            ││
│  └─────────────────────────────────┘│
│                                     │
│  [Add 3 Items]                      │
│                                     │
└─────────────────────────────────────┘
```

### Screen 5: Item Detail

```
┌─────────────────────────────────────┐
│  ← Pepsi 500ml               [⋯]   │
├─────────────────────────────────────┤
│  🥤 Pepsi · 500ml                   │
│  ₹25 · Fridge A2                    │
├─────────────────────────────────────┤
│  Stock: 50 nos                      │
├─────────────────────────────────────┤
│  Transactions                       │
│  ┌─────────────────────────────────┐│
│  │ ● SOLD -2      ₹50     2h ago  ││
│  │ ● SOLD -1      ₹25     3h ago  ││
│  │ ● TRANS_IN +50 Batch B06 1d ago││
│  │ ● TRANS_IN +30 Batch B05 3d ago││
│  └─────────────────────────────────┘│
│                                     │
│  [Search a skill…]                  │
└─────────────────────────────────────┘
```

---

## 7. Queries

### Get all items in store

```sql
SELECT m.*, f.title as product_name, f.data as product_data
FROM matter m
JOIN form f ON f.id = m.form
JOIN graph g ON g.src = m.id AND g.type = 'belongs_to'
WHERE g.tgt = 'store_101' AND m.type = 'stock' AND m.active = 1;
```

### Get recent transactions for store

```sql
SELECT mo.*, f.title as item_name
FROM motion mo
JOIN matter m ON m.id = mo.stream
JOIN form f ON f.id = m.form
JOIN graph g ON g.src = m.id AND g.type = 'belongs_to'
WHERE g.tgt = 'store_101'
ORDER BY mo.time DESC LIMIT 20;
```

### Search global products

```sql
SELECT * FROM form
WHERE type = 'product' AND scope = 'g' AND active = 1
AND title LIKE '%pepsi%';
```

---
