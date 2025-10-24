# Product Options Storage Format

## UI Design: Table-Based Layout

The product options modal now uses a clean, spreadsheet-like table design:

```
┌─────────────────────────────────────────────────────┐
│ Option: Color                              [Delete] │
├─────────────────────────────────────────────────────┤
│ LABEL          │ HEX CODE    │ ●  │ ×             │
├────────────────┼─────────────┼────┼───────────────┤
│ Red            │ #FF0000     │ 🔴 │ ×             │
│ Blue           │ #0000FF     │ 🔵 │ ×             │
│ Green          │ #00FF00     │ 🟢 │ ×             │
├────────────────┴─────────────┴────┴───────────────┤
│                          [+ Add Value]             │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Clean table rows for each value
- Column headers (Label, ID/Code, Preview, Delete)
- Color preview for hex codes
- Context-aware placeholders (e.g., "Hex Code" for Color options)
- Compact and easy to scan

## Compact JSON Format (Storage)

To minimize database storage size, we use a smart compact format:

### Rules:
- **No identifier** → Store as simple string: `"Blue"`
- **Has identifier** → Store as array: `["Blue", "B"]`

### Example:

**Before (Old Format):**
```json
{
  "Material": [
    {"label": "Blue", "identifier": ""},
    {"label": "Red", "identifier": ""}
  ],
  "Color": [
    {"label": "Yellow", "identifier": ""}
  ],
  "Tar": [
    {"label": "Wood", "identifier": "W"},
    {"label": "Water", "identifier": "Wa"},
    {"label": "Tree", "identifier": "T"}
  ]
}
```
**Size:** ~242 characters

**After (Compact Format):**
```json
{
  "Material": ["Blue", "Red"],
  "Color": ["Yellow"],
  "Tar": [["Wood", "W"], ["Water", "Wa"], ["Tree", "T"]]
}
```
**Size:** ~90 characters

## Size Reduction: **~63% smaller!** 🎉

### Usage Examples:

#### 1. Color Options (with hex codes):
```json
{
  "Color": [["Red", "#FF0000"], ["Blue", "#0000FF"], ["Green", "#00FF00"]]
}
```

#### 2. Size Options (with short codes):
```json
{
  "Size": [["Small", "S"], ["Medium", "M"], ["Large", "L"], ["Extra Large", "XL"]]
}
```

#### 3. Simple Options (no identifiers):
```json
{
  "Material": ["Cotton", "Polyester", "Wool", "Silk"],
  "Style": ["Casual", "Formal", "Sport"]
}
```

#### 4. Mixed (some with identifiers, some without):
```json
{
  "Color": [["Navy Blue", "#000080"], "Black", ["Sky Blue", "#87CEEB"]],
  "Fit": ["Regular", "Slim", "Relaxed"]
}
```

## Implementation Notes:

- The app automatically handles both old and new formats (backward compatible)
- When saving, empty identifiers are automatically removed
- When loading, the compact format is expanded to the UI format
- Color identifiers (hex codes) show visual color preview in the UI
