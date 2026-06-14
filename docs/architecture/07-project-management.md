# 07 — Project Management (Linear-style)

A fast, keyboard-first, list-driven PM interface on the existing TAR schema — no database changes.

---

## 1. UX philosophy

1. **Sub-100ms interactions** — local-first, instant creation/updates.
2. **Dense lists over boards** — vertical lists grouped by status (Backlog, Todo, In Progress, Done).
3. **Command menu first** — global Cmd/Ctrl+K (or double-tap search) for actions.
4. **No-friction creation** — inline "+ Add Issue", not multi-tab forms.

```text
 ╔════════════════════════════════════════════════════════════╗
 ║                  TOP BAR: Filters & Search                ║
 ╠════════════════════════════════════════════════════════════╣
 ║  SIDEBAR        ║  ISSUE LIST AREA                         ║
 ║  • Inbox        ║  ▼ Todo (3)                              ║
 ║  • My Issues    ║    [ENG-101] High  Implement OAuth       ║
 ║  • Projects     ║    [ENG-102] Med   Fix vector leak       ║
 ║    - Mobile App ║  ▼ In Progress (1)                       ║
 ║    - Web Store  ║    [ENG-99]  High  Collab sync perf      ║
 ║  • Cycles       ║  ▼ Done (14)                             ║
 ║    - Cycle 24   ║    [ENG-95]  Low   Add safearea          ║
 ╚════════════════════════════════════════════════════════════╝
```

**Screens:** Inbox/Notifications · My Issues (assigned, active) · Project/Cycle list (grouped by stage) · Issue detail slide-over (description, comment history from `motion`, blockers/sprints).

---

## 2. Schema mapping (runs on existing tables)

> New names: `form` (was `matter`), `matter` (was `mass`), `bond` (was `relation`).

| Concept | Table | Shape |
| :--- | :--- | :--- |
| Project | `form` | `id=proj_billing`, `type='project'`, `code='ENG'`, `data={key,color}` |
| Issue / Task | `form` | `id=task_auth_99`, `type='task'`, `code='ENG-101'`, `data={desc,estimate,priority}` |
| Assignees / Sprints | `bond` | see below |
| Sprint / Cycle | `matter` | `id=sprint_2026_24`, `type='slot'`, `start`/`end` |
| Lifecycle & comments | `motion` | phase opcodes + replies |

**Bonds:**
- Project membership: `src=proj_redesign, tgt=task_auth_99, type='project_task'`
- Assignee: `src=task_auth_99, tgt=usr_john, type='assigned_to'`
- Reporter: `src=task_auth_99, tgt=usr_jane, type='reported_by'`
- Dependency: `src=task_blocker, tgt=task_blocked, type='blocked_by'`

**Issue lifecycle (phase opcodes):**
| Opcode | State |
| :--- | :--- |
| 303 | Backlog |
| 306 | Todo (Open) |
| 304 | In Progress |
| 308 | Done (Resolved) |

Comments: append-only `motion` with `stream=task_id`, `action=307` (REPLY).

---

## 3. Keyboard shortcuts

| Shortcut | Action | DB execution |
| :--- | :--- | :--- |
| `C` | Quick-create issue | pre-populates project prefix |
| `Cmd/Ctrl+K` | Command bar | search / actions |
| `I` then `P` | → In Progress | `phaseUpdateMotion(db, taskId, 304, ...)` |
| `I` then `D` | → Done | `phaseUpdateMotion(db, taskId, 308, ...)` |
| `A` | Assign | bond `src=task, tgt=user, type='assigned_to'` |
| `Delete` | Archive | `UPDATE matter SET active=0 WHERE form=task_id` |

---

## 4. Implementation steps

1. Register `tarapp/app/project.tsx` with the grouped list view.
2. Add a command-menu bottom sheet (`/assign`, `/status`, `/priority` with live filtering).
3. Bind keyboard listeners when web/desktop client has focus on issue lists.
