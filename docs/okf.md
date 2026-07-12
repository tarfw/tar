# Open Knowledge Format (OKF)

> Google's open spec for knowledge as markdown files with YAML frontmatter. Agents read it directly. No SDK, no runtime, no lock-in.

**Source:** [Google Cloud OKF Spec v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)

---

## What Is OKF

OKF is an open, human- and agent-friendly format for representing knowledge — the metadata, context, and curated insight that surrounds data and systems.

| Rule | Detail |
|------|--------|
| Format | Directory of markdown files with YAML frontmatter |
| Required field | `type` only |
| Special files | `index.md` (folder map), `log.md` (change history) |
| Cross-links | Absolute paths: `/folder/file.md` |
| One concept | One file, one idea |

---

## Bundle Structure

```
my_bundle/
├── index.md                  # Directory listing (progressive disclosure)
├── log.md                    # Chronological change history
├── concept.md                # A concept at bundle root
└── subdirectory/
    ├── index.md              # Lists contents of this folder
    ├── concept.md
    └── another-concept.md
```

---

## Concept Document Format

Every concept is a UTF-8 markdown file with two parts:

### 1. YAML Frontmatter (Required)

```yaml
---
type: <Type name>                  # REQUIRED
title: <Optional display name>
description: <Optional one-line summary>
resource: <Optional canonical URI>
tags: [<tag>, <tag>, ...]
timestamp: <ISO 8601 datetime>
---
```

**Required:**
- `type` — Short string identifying the kind of concept (e.g., `Table`, `Playbook`, `Reference`)

**Recommended:**
- `title` — Human-readable display name
- `description` — Single sentence summary
- `resource` — URI identifying the underlying asset
- `tags` — Short strings for categorization
- `timestamp` — ISO 8601 datetime of last change

### 2. Markdown Body (Free-form)

```markdown
# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | STRING | Unique identifier |

# Examples

```json
{ "id": "123" }
```

# Citations

[1] [Source URL](https://example.com)
```

---

## Reserved Filenames

| Filename | Purpose |
|----------|---------|
| `index.md` | Directory listing — enumerates folder contents |
| `log.md` | Update history — date-grouped entries, newest first |

---

## Cross-linking

### Absolute links (recommended)

```markdown
See the [customers table](/tables/customers.md).
```

### Relative links

```markdown
See the [neighboring concept](./other.md).
```

---

## Index Files

`index.md` enumerates directory contents for progressive disclosure:

```markdown
# Sales

* [Orders](/tables/orders.md) - One row per completed order
* [Customers](/tables/customers.md) - Customer profiles
```

---

## Log Files

`log.md` records change history, newest first:

```markdown
## 2026-07-12
* **Update**: Added new table reference
* **Creation**: Established playbook

## 2026-07-10
* **Initialization**: Created bundle structure
```

---

## Conformance

A bundle is conformant if:

1. Every `.md` file has parseable YAML frontmatter
2. Every frontmatter has a non-empty `type` field
3. Reserved filenames follow their structure

Consumers MUST NOT reject bundles for:
- Missing optional fields
- Unknown `type` values
- Unknown frontmatter keys
- Broken cross-links
- Missing `index.md` files

---

## TAR Usage

### Workspace OKF Structure

```
workspaces/{scope}/
├── index.md                  # Root — lists all folders
├── business/
│   ├── index.md
│   └── profile.md
├── products/
│   ├── index.md
│   └── menu.md
├── policies/
│   ├── index.md
│   ├── return.md
│   └── delivery.md
├── faqs/
│   ├── index.md
│   └── common.md
├── team/
│   ├── index.md
│   └── members.md
├── skills/
│   ├── index.md
│   ├── orders.md
│   └── ...
└── site/
    ├── index.md
    ├── brand.md
    ├── design.md
    └── layouts/
        └── home.json
```

### Example: business/profile.md

```markdown
---
type: BusinessProfile
title: Ravanan's Restaurant
description: South Indian food restaurant in Chennai
tags: [restaurant, chennai]
timestamp: 2026-07-12T10:00:00Z
---

# Business Profile

| Field | Value |
|-------|-------|
| Name | Ravanan's Restaurant |
| Type | Restaurant |
| Location | Chennai |
| Hours | 10am-10pm |
| Description | South Indian food |
```

### Example: skills/orders.md

```markdown
---
type: Skill
title: Orders
description: POS operations — create orders, record payments, send receipts
tags: [orders, pos, payments]
timestamp: 2026-07-12T10:00:00Z
---

# Orders Skill

## Actions

### action_create_order
Create a new order for a customer.

Steps:
1. `create(table='matter', type='order', data:{items:{items}, total:{total}})`
2. `create(table='motion', type='order', data:{orderId:{id}, status:'pending'})`
```
