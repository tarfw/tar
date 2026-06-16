# Project Management Flow — End to End

How Linear-style project management works in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Issue   │───▶│  Sprint  │───▶│  Status  │───▶│  Done    │
│  (DO)    │    │  (DO)    │    │  (DO)    │    │  (DO)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Project Setup

### Step 1: Create Project

```sql
-- From Workspace DO (t:team_101)
INSERT INTO form (id, type, code, title, data)
VALUES ('proj_billing', 'project', 'BILL', 'Billing System', '{
  "key": "BILL",
  "color": "#6366F1",
  "description": "New billing and invoicing system"
}');
```

### Step 2: Create Sprint

```sql
INSERT INTO matter (id, type, start, end, data)
VALUES ('sprint_2026_24', 'slot', 
  '2026-06-16', '2026-06-30', '{
  "name": "Sprint 24",
  "goal": "Complete payment integration"
}');
```

---

## Part B: Issue Management

### Step 3: Create Issue

```sql
INSERT INTO form (id, type, code, title, data)
VALUES ('task_auth_99', 'task', 'BILL-101', 'Implement OAuth', '{
  "description": "Add Google OAuth login flow",
  "estimate": 3,
  "priority": "high",
  "labels": ["backend", "auth"]
}');

-- Link to project
INSERT INTO bond (src, tgt, type)
VALUES ('proj_billing', 'task_auth_99', 'project_task');

-- Link to sprint
INSERT INTO bond (src, tgt, type)
VALUES ('sprint_2026_24', 'task_auth_99', 'sprint_task');
```

### Step 4: Assign Issue

```sql
INSERT INTO bond (src, tgt, type)
VALUES ('task_auth_99', 'emp_rahul', 'assigned_to');
```

### Step 5: Start Work

```sql
-- From Workspace DO (t:team_101)
INSERT INTO motion (stream, seq, action, phase)
VALUES ('task_auth_99', 1, 304, 304);  -- IN_PROGRESS
```

### Step 6: Add Comment

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('task_auth_99', 2, 307, '{
  "from": "emp_rahul",
  "text": "Started working on OAuth flow. Using Google Identity Services."
}');
-- REPLY
```

### Step 7: Mark Done

```sql
UPDATE motion SET phase = 308 WHERE stream = 'task_auth_99';
-- DONE (RESOLVED)
```

---

## Part C: Keyboard Shortcuts

| Shortcut | Action | DB Execution |
|----------|--------|--------------|
| `C` | Create issue | Insert form + bond |
| `Cmd+K` | Command bar | Search / actions |
| `I P` | → In Progress | phaseUpdateMotion(304) |
| `I D` | → Done | phaseUpdateMotion(308) |
| `A` | Assign | bond assigned_to |
| `Del` | Archive | matter.active = 0 |

---

## Part D: Issue Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Issue Status Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ BACKLOG │───▶│   TODO  │───▶│IN PROG  │───▶│  DONE   │ │
│  │  (303)  │    │  (306)  │    │  (304)  │    │  (308)  │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │                                             │       │
│       │            ┌─────────┐                      │       │
│       └───────────▶│ BLOCKED │◀─────────────────────┘       │
│                    │  (308)  │                               │
│                    └─────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Project created | — | t:team_101 | form |
| 2 | Sprint created | — | t:team_101 | matter |
| 3 | Issue created | 303 | t:team_101 | form + bond |
| 4 | Issue assigned | — | t:team_101 | bond |
| 5 | In progress | 304 | t:team_101 | Phase |
| 6 | Comment added | 307 | t:team_101 | Append |
| 7 | Done | 308 | t:team_101 | Phase |
