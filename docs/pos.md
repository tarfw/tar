# POS Item Customization & Ingredient Stock Architecture

This document provides a visual walkthrough of how product configurations (variations, modifiers) and recipe-based ingredient consumption are modeled, synchronized, and resolved inside the local-first TAR sync architecture.

---

## 1. Visual POS Item Cards (UI State Lifecycle)

Below is a visual representation of how items, customizations, cart details, and raw inventory are rendered as UI cards in the POS terminal.

````carousel
### 🛒 Card 1: Catalog Grid Tile
---
```
+------------------------------------------+
|  Iced Mocha                              |
|                                          |
|  [ #6E473B Brown Tile ]                  |
|  Price: ₹100.00 - ₹120.00                |
|  Category: Beverages                     |
+------------------------------------------+
```
* **Database Source:** `matter` table (`type = 'product'`)
* **Styling details:** Handled in `matter.data` (`{"tile_style": {"color": "#6E473B"}}`)

<!-- slide -->
### ⚙️ Card 2: Customization & Modifier Card
---
```
+------------------------------------------+
|  Configure: Iced Mocha                   |
|                                          |
|  SIZE (Select 1):                        |
|  [ ] Small  (Variable)                   |
|  [x] Medium (₹100.00)                    |
|  [ ] Large  (₹120.00)                    |
|                                          |
|  MODIFIERS:                              |
|  [x] fresh cream (+₹30.00)               |
|  [ ] chocolate syrup (+₹30.00)           |
+------------------------------------------+
```
* **Database Source:** `relation` table (`type = 'parent-child'`)
* **Variant price mapping:** `mass` table (`type = 'stock'`, value = `100.00`)

<!-- slide -->
### 🧾 Card 3: Active Cart Item Card
---
```
+------------------------------------------+
|  1x Iced Mocha (Medium)                  |
|  - Add-on: fresh cream (+₹30.00)         |
|  - Note: "Extra cold"                    |
|                                          |
|  Price: ₹130.00                          |
+------------------------------------------+
```
* **Database Source:** `mass` table (`type = 'cart'`)
* **Selection details:** Stored in `mass.data` JSON payload

<!-- slide -->
### 📦 Card 4: Inventory Stock Card
---
```
+------------------------------------------+
|  Ingredient: Milk                        |
|                                          |
|  Stock level: 4550.0 ml                  |
|  Status: [ 🟢 Adequate ]                  |
|  Cost: ₹0.10 / ml                        |
+------------------------------------------+
```
* **Database Source:** `mass` table (`type = 'stock'`, qty = `4550.0`)
* **Alert Trigger:** Calculated dynamically on stock thresholds
````

---

## 2. User-Friendly UI Layout Wireframe (Design Concept)

![POS Item Customization UI Concept](C:\Users\tarfr\.gemini\antigravity\brain\7a4eca19-d72e-47e2-a0e2-f9d4d440767e\pos_ui_layout_concept_1780734534099.png)

This diagram outlines the screen layout layout for customizing items, matching the Square Android POS structure.

```mermaid
graph TD
    %% Wireframe Layout mapping the Square POS screen
    subgraph POS_Screen ["POS Customization UI (Item Details Screen)"]
        direction TB
        
        subgraph Header_Bar ["1. Header Area"]
            Close_Btn["X Close Window"]
            Title_Lbl["Item: Iced Mocha"]
        end

        subgraph Navigation_Tabs ["2. Quick-Jump Category Pills"]
            Tab_Size["Size (1 Selected)"]
            Tab_Bev["bev 1"]
            Tab_Note["Note"]
            Tab_Options["Options"]
        end

        subgraph Content_Area ["3. Scrollable Option Lists"]
            subgraph Size_Grid ["Size Variations (Grid Tiles)"]
                Var_S["Small<br>(Variable)"]
                Var_M["Medium<br>(₹100.0) [100 Stock]"]
                Var_L["Large<br>(₹120.0)"]
            end
            
            subgraph Modifier_Select ["bev 1 Add-ons (Wide Toggles)"]
                Mod_Cream["fresh cream<br>(+₹30.00)"]
                Mod_Syrup["chocolate syrup<br>(+₹30.00)"]
            end
            
            subgraph Item_Note ["Notes Input"]
                Note_Box["[ Add an item note... ]"]
            end
        end

        subgraph Action_Bar ["4. Action Footer (Fixed)"]
            Qty_Selector["[ - ]  1  [ + ]"]
            Done_Btn["Done / Add to Cart (₹130.00)"]
        end
        
        Header_Bar --> Navigation_Tabs
        Navigation_Tabs --> Content_Area
        Content_Area --> Action_Bar
    end
```

### Why this Layout is User-Friendly:
1. **Quick-Jump Pills:** Allow the operator to instantly skip long lists (e.g. jumping directly to "Note" or "bev 1") using a sticky horizontal navigation bar.
2. **Touch-Friendly Targets:** Size selections and add-ons are styled as large block tiles rather than tiny checkboxes, preventing selection errors on small POS touchscreens.
3. **Contextual Badges:** Shows stock level numbers (e.g., `[100 Stock]`) directly on the size tile before selection so operators can alert customers if a choice is low on stock.

---

## 3. Structural Schema Mapping (Visual Database Blueprint)

The catalog structure uses the core **`matter`** table for identities and the **`relation`** table to build the directed graph (Categories, Modifiers, and Ingredient Recipes).

```mermaid
graph TD
    %% Styling
    classDef mainProduct fill:#6E473B,stroke:#3a2018,stroke-width:2px,color:#fff;
    classDef category fill:#d1ecf1,stroke:#17a2b8,stroke-width:2px,color:#0c5460;
    classDef modifier fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#856404;
    classDef ingredient fill:#f8d7da,stroke:#dc3545,stroke-width:2px,color:#721c24;

    %% Nodes
    C1["Category: Beverages<br>(matter: cat_beverages)"]:::category
    P1["Product: Iced Mocha<br>(matter: prod_iced_mocha)"]:::mainProduct
    
    M1["Modifier Option: fresh cream<br>(matter: mod_fresh_cream)"]:::modifier
    M2["Modifier Option: chocolate syrup<br>(matter: mod_chocolate_syrup)"]:::modifier
    
    I1["Ingredient: Milk<br>(matter: prod_milk)"]:::ingredient
    I2["Ingredient: Espresso Shot<br>(matter: prod_espresso_shot)"]:::ingredient

    %% Relationships
    C1 -->|relation: parent-child<br>weight: 1.0| P1
    
    P1 -->|relation: parent-child| M1
    P1 -->|relation: parent-child| M2
    
    P1 -->|relation: recipe-item<br>weight: 150.0 ml| I1
    P1 -->|relation: recipe-item<br>weight: 1.0 shot| I2

    %% Sub-Legends
    subgraph Catalog Hierarchy
        C1
        P1
    end
    subgraph Modifiers & Customization
        M1
        M2
    end
    subgraph Recipe & Bill of Materials
        I1
        I2
    end
```

---

## 4. Table Instances (Step-by-Step Data Flow)

Here is how rows are populated in the database to represent the above diagram.

### A. Identities (`matter` Table)
Defines the blueprint templates for products, categories, modifiers, and ingredients.

| id | code | type | scope | title | data (JSON Payload) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cat_beverages` | `CAT_BEV` | `product` | `g` | `"Beverages"` | `{"is_category": true}` |
| `prod_iced_mocha` | `MOCHA` | `product` | `g` | `"Iced Mocha"` | `{"description": "Rich espresso with cocoa..."}` |
| `mod_fresh_cream` | `MOD_CREAM` | `product` | `g` | `"fresh cream"` | `{"is_modifier": true}` |
| `prod_milk` | `ING_MILK` | `product` | `g` | `"Milk"` | `{"is_ingredient": true, "unit": "ml"}` |
| `prod_espresso_shot` | `ING_SHOT` | `product` | `g` | `"Espresso Shot"`| `{"is_ingredient": true, "unit": "shot"}` |

### B. Structural Network (`relation` Table)
Maps how items link together (Category placement, modifier options, and recipe weights).

| src | tgt | type | weight | Note / Role |
| :--- | :--- | :--- | :--- | :--- |
| `cat_beverages` | `prod_iced_mocha` | `parent-child` | `1.0` | Assigns Mocha to Beverages category (order position `1`) |
| `prod_iced_mocha` | `mod_fresh_cream` | `parent-child` | `1.0` | Links "fresh cream" as a modifier choice |
| `prod_iced_mocha` | `prod_milk` | `recipe-item` | `150.0` | Recipe: Mocha requires **150 ml** of Milk |
| `prod_iced_mocha` | `prod_espresso_shot` | `recipe-item` | `1.0` | Recipe: Mocha requires **1 shot** of Espresso |

### C. Physical Realization & Inventory (`mass` Table)
Tracks the physical stock quantities on hand for raw ingredients.

| id | matter | type | scope | qty | value (cost/price) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mas_stock_milk` | `prod_milk` | `stock` | `w:kitchen` | **`5000.0`** | `0.10` / ml |
| `mas_stock_espresso` | `prod_espresso_shot` | `stock` | `w:kitchen` | **`200.0`** | `15.00` / shot |
| `mas_price_cream` | `mod_fresh_cream` | `stock` | `w:kitchen` | `9999.0` | **`30.00`** (price) |

---

## 5. Conflict-Free Sync & Resolution Model

> [!IMPORTANT]
> To prevent offline synchronization conflicts using **Turso Sync**, devices **never overwrite the same cell** concurrently. Instead, they write append-only transaction logs.

### The Problem: Concurrent Offline Direct Updates (Overwrites)

```mermaid
sequenceDiagram
    participant TerminalA as Terminal A (Offline)
    participant Cloud as Turso Cloud (Central DB)
    participant TerminalB as Terminal B (Offline)

    Note over TerminalA, TerminalB: Starting Stock: 5000ml Milk
    TerminalA->>TerminalA: Sale 1 (Deducts 150ml)<br>Local UPDATE qty = 4850ml
    TerminalB->>TerminalB: Sale 2 (Deducts 300ml)<br>Local UPDATE qty = 4700ml
    
    Note over TerminalA, Cloud: Terminal A goes online & syncs
    TerminalA->>Cloud: Push: set qty = 4850ml
    Note over Cloud: Cloud Stock: 4850ml
    
    Note over TerminalB, Cloud: Terminal B goes online & syncs
    TerminalB->>Cloud: Push: set qty = 4700ml (Overwrites A!)
    Note over Cloud: Cloud Stock: 4700ml (Incorrect! Should be 4550ml)
```

### The Solution: Append-Only Event Logs (`motion` Table)

Instead of updating the `qty` cell directly, both terminals insert a unique transaction row in the `motion` table representing the change (`delta`).

```mermaid
sequenceDiagram
    participant TerminalA as Terminal A (Offline)
    participant Cloud as Turso Cloud (Central DB)
    participant TerminalB as Terminal B (Offline)

    Note over TerminalA, TerminalB: Starting Stock: 5000ml Milk
    TerminalA->>TerminalA: Sale 1 (Deducts 150ml)<br>INSERT motion (ID: mot_A, delta: -150)
    TerminalB->>TerminalB: Sale 2 (Deducts 300ml)<br>INSERT motion (ID: mot_B, delta: -300)
    
    Note over TerminalA, Cloud: Terminal A syncs
    TerminalA->>Cloud: Push: [mot_A]
    Note over Cloud: Holds: [mot_A]
    
    Note over TerminalB, Cloud: Terminal B syncs
    TerminalB->>Cloud: Push: [mot_B]
    Note over Cloud: Holds: [mot_A, mot_B] (Both logs preserved)

    Note over TerminalA, TerminalB: Both devices pull and run reconciliation
    Note over TerminalA, TerminalB: Stock = 5000 + (mot_A.delta) + (mot_B.delta) = 4550ml (Correct!)
```

---

## 6. Query & Ledger Reconciliation Patterns

### Computing Stock Levels Dynamically (Ledger Run)
To calculate the current inventory level of an ingredient by combining its base inventory with sales logs:

```sql
SELECT 
    m.id AS ingredient_id,
    m.title AS ingredient_name,
    -- (Base Stock) + (Sum of all offline & online transaction changes)
    (base_stock.qty + COALESCE(SUM(log.delta), 0)) AS current_stock
FROM matter m
JOIN mass base_stock ON base_stock.matter = m.id AND base_stock.type = 'stock'
LEFT JOIN motion log ON log.stream = m.id AND log.action = 405 -- SCM Deductions
GROUP BY m.id;
```

> [!TIP]
> **Performance Optimization:** In production, do not scan the entire `motion` log history every time. Maintain a **`mass`** record as a materialized cache. When a sync event completes, apply the incoming `motion.delta` fields to update `mass.qty` in a single fast write query.
