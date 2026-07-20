## SKILL.md — Final Complete Architecture

```yaml
---
# ──────────────────────────────────────────────
# FRONTMATTER
# ──────────────────────────────────────────────
type: skill                    # Required. Always "skill"
name: daily-kitchen-check      # Required. Unique kebab-case ID
version: 1.0.0                 # Required. Semver
custom: true                   # Optional. true = admin-created
scope: ws:myrestaurant         # Required. Workspace binding

# ──────────────────────────────────────────────
# ACTIONS (Tools)
# ──────────────────────────────────────────────
actions:
  - name: action_log_prep              # Action identifier
    params: [item, quantity, checked_by] # Input fields
    icon: checkmark-done               # Optional UI icon
    steps:                             # DB write pattern
      - table: motion
        type: activity
        data: {item: {item}, qty: {quantity}, by: {checked_by}}
        by: agent:taragent

  - name: action_log_waste
    params: [item, quantity, reason]
    icon: trash
    steps:
      - table: motion
        type: activity
        data: {item: {item}, qty: {quantity}, reason: {reason}}
        by: agent:taragent

# ──────────────────────────────────────────────
# WORKFLOWS (Multi-step sequences)
# ──────────────────────────────────────────────
workflows:
  - name: workflow_restock流程
    trigger: "low stock detected"
    steps:
      - action: action_check_supplier
      - action: action_create_po
      - action: action_notify_manager

# ──────────────────────────────────────────────
# SUBAGENTS (Autonomous with memory/loop)
# ──────────────────────────────────────────────
subagents:
  - name: subagent_inventory_monitor
    trigger: "daily at 6am"
    goal: "Check all products, alert if any below min_stock"
    allowed_actions: [action_check_stock, action_log_alert]
    memory: true
    loop: true

# ──────────────────────────────────────────────
# APP LAYOUT (per role)
# ──────────────────────────────────────────────
app_layout:
  kitchen:
    default_blocks:                     # Pinned on canvas load
      - type: inbox-list
        title: "Active Orders"
        filter: "type='order'"
    allowed_blocks: [inbox-list, action-form, timeline-feed]
    quick_chips: ["Active Orders", "Mark Done", "Low Stock Alert"]
    sections:                           # Block definitions
      - type: action-form
        action: action_log_prep
      - type: data-table
        title: "Today's Prep Log"
        query: "SELECT * FROM motion WHERE type='activity' AND data LIKE '%prep%'"

  manager:
    default_blocks: []
    allowed_blocks: [data-table, metric-card, report-chart, action-form]
    sections:
      - type: report-chart
        title: "Waste Report"
        query: "SELECT date(at,'unixepoch') d, COUNT(*) n FROM motion WHERE type='activity' GROUP BY d"
---

# Daily Kitchen Check

Custom skill for kitchen operations.

### action_log_prep
Log food prep items completed.
steps:
  1. create(table='motion', type='activity', data={item: {item}, qty: {quantity}, by: {checked_by}}, by='agent:taragent')

### action_log_waste
Log food waste.
steps:
  1. create(table='motion', type='activity', data={item: {item}, qty: {quantity}, reason: {reason}}, by='agent:taragent')
```

---

## Complete Field Reference Table

| Section         | Field                              | Type    | Required | Description                       |
| --------------- | ---------------------------------- | ------- | -------- | --------------------------------- |
| **Frontmatter** | `type`                             | string  | Yes      | Always `skill`                    |
|                 | `name`                             | string  | Yes      | Unique kebab-case ID              |
|                 | `version`                          | string  | Yes      | Semver format                     |
|                 | `custom`                           | boolean | No       | `true` if admin-created           |
|                 | `scope`                            | string  | Yes      | Workspace binding                 |
| **Actions**     | `actions[].name`                   | string  | Yes      | Action identifier                 |
|                 | `actions[].params`                 | array   | Yes      | Input fields                      |
|                 | `actions[].icon`                   | string  | No       | UI icon                           |
|                 | `actions[].steps`                  | array   | Yes      | DB write operations               |
|                 | `actions[].steps[].table`          | string  | Yes      | `matter`/`motion`/`inbox`/`graph` |
|                 | `actions[].steps[].type`           | string  | Yes      | Entity type                       |
|                 | `actions[].steps[].data`           | object  | Yes      | Fields to write                   |
|                 | `actions[].steps[].by`             | string  | No       | Actor                             |
| **Workflows**   | `workflows[].name`                 | string  | Yes      | Workflow identifier               |
|                 | `workflows[].trigger`              | string  | Yes      | What starts it                    |
|                 | `workflows[].steps`                | array   | Yes      | Ordered actions                   |
| **Subagents**   | `subagents[].name`                 | string  | Yes      | Subagent identifier               |
|                 | `subagents[].trigger`              | string  | Yes      | What starts it                    |
|                 | `subagents[].goal`                 | string  | Yes      | Objective                         |
|                 | `subagents[].allowed_actions`      | array   | Yes      | Permitted actions                 |
|                 | `subagents[].memory`               | boolean | No       | Persistent memory                 |
|                 | `subagents[].loop`                 | boolean | No       | Continuous execution              |
| **App Layout**  | `app_layout.{role}.default_blocks` | array   | No       | Pinned blocks                     |
|                 | `app_layout.{role}.allowed_blocks` | array   | Yes      | Permitted block types             |
|                 | `app_layout.{role}.quick_chips`    | array   | No       | Action chip labels                |
| **Sections**    | `sections[].type`                  | string  | Yes      | Block type                        |
|                 | `sections[].action`                | string  | No       | Action to trigger                 |
|                 | `sections[].title`                 | string  | No       | Block header                      |
|                 | `sections[].query`                 | string  | No       | SQL-like fetch                    |
|                 | `sections[].filter`                | string  | No       | Filter expression                 |
| **Body**        | `# Title`                          | heading | Yes      | Skill display name                |
|                 | `### action_name`                  | heading | Yes      | Action docs                       |
|                 | `steps:`                           | list    | Yes      | Human-readable steps              |

---

## How Each Part Connects to System

| SKILL.md Part  | System Component     | What It Does                    |
| -------------- | -------------------- | ------------------------------- |
| Frontmatter    | CustomSkillLoader.ts | Loads skill from S3             |
| Actions        | Intent Resolver      | Maps input → action             |
| Workflows      | SubagentRunner.tsx   | Runs multi-step sequences       |
| Subagents      | SubagentRunner.tsx   | Runs autonomous agents          |
| App Layout     | Layout Engine        | Filters blocks by role          |
| Allowed Blocks | WorkspaceCanvas.tsx  | Renders or blocks UI            |
| Quick Chips    | Input Bar            | Shows role-specific buttons     |
| Sections       | ComponentRegistry    | Resolves block type → component |
| Queries        | GET /api/query       | Fetches data for blocks         |
| Steps          | POST /api/action     | Executes DB writes              |

---

## Storage

```
S3 (per scope):
├── {scope}/skills/*.md                 ← All skills (actions + workflows + subagents)
├── {scope}/team/members.md             ← Role assignments
└── {scope}/{id}/full.json              ← Entity full payloads
```

**One file = One skill = Actions + Workflows + Subagents + Layout + Blocks**
