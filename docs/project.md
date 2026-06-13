# Project Management Design (Linear-like List Engine)

This document details the concepts and UX design for integrating a fast, keyboard-first, and list-driven project management interface (similar to **Linear**) into the TAR application, using our local-first database architecture.

---

## 1. Core UX Philosophy: The Linear Way

Instead of complex drag-and-drop Kanban boards, this interface focuses on **speed, keyboard shortcuts, dense information, and filterable list views**.

### Design Principles
1. **Sub-100ms Interactions:** Local-first operations mean page switches, issue creation, and updates happen instantly.
2. **Dense List Over Board:** Clear vertical lists grouped by status (Backlog, Todo, In Progress, Done), easily navigable via keys or quick taps.
3. **Command Menu First:** A global Command Menu (Cmd/Ctrl + K or double-tap search) to trigger actions, assign, or search issues.
4. **No-Friction Creation:** An inline "+ Add Issue" input at the bottom of lists or a simple overlay, rather than multi-tab creation forms.

---

## 2. Layout & UI Architecture

The interface is divided into three key panels in the screen space:

```text
 ╔═════════════════════════════════════════════════════════════════════════════════╗
 ║                                  TOP BAR: Filters & Search                      ║
 ╠═════════════════════════════════════════════════════════════════════════════════╣
 ║  SIDEBAR           ║  ISSUE LIST AREA                                           ║
 ║  • Inbox           ║                                                            ║
 ║  • My Issues       ║  ▼ Todo (3)                                                ║
 ║  • Projects        ║    [ENG-101] [Priority: High] Implement Google OAuth       ║
 ║    - Mobile App    ║    [ENG-102] [Priority: Med]  Fix vector memory leak       ║
 ║    - Web Store     ║                                                            ║
 ║  • Cycles          ║  ▼ In Progress (1)                                         ║
 ║    - Cycle 24      ║    [ENG-99]  [Priority: High] Collab sync performance      ║
 ║                    ║                                                            ║
 ║                    ║  ▼ Done (14)                                               ║
 ║                    ║    [ENG-95]  [Priority: Low]  Add workspace safearea       ║
 ╚═════════════════════════════════════════════════════════════════════════════════╝
```

### Main Screens
1. **Inbox / Notifications:** Displays activity updates (replies, mentions, assignees) on issues you own or watch.
2. **My Issues:** Pre-filtered view showing only active issues assigned to the current user profile.
3. **Project / Cycle List:** Detailed lists grouped by workflow stage (`Todo`, `In Progress`, etc.), with simple toggles to group by priority or assignee instead.
4. **Issue Detail Panel:** A clean right-side slide-over containing descriptions, comment history (`motion` ledger), and relations (blockers/sprints).

---

## 3. Database Schema Mapping

This setup runs entirely on the existing SQLite schema without requiring database modifications:

```mermaid
classDiagram
    class Matter_Project {
        id: proj_redesign
        type: "project"
        title: "Mobile App Redesign"
        data: "{"key": "ENG", "color": "#2564cf"}"
    }

    class Matter_Task {
        id: task_auth_99
        code: "ENG-101"
        type: "task"
        title: "Implement Google OAuth"
        data: "{"desc": "Integrate Native Auth flow", "estimate": 3}"
    }

    class Relation_Parent {
        src: proj_redesign
        tgt: task_auth_99
        type: "project_task"
    }

    class Relation_Assignee {
        src: task_auth_99
        tgt: usr_self
        type: "assigned_to"
    }

    class Motion_Ledger {
        stream: task_auth_99
        action: 304 (CONTACTED / IN_PROGRESS)
        phase: 304
        data: "{"updated_by": "usr_self"}"
    }

    Matter_Project --> Relation_Parent : links
    Relation_Parent --> Matter_Task : to task
    Matter_Task --> Relation_Assignee : links
    Matter_Task --> Motion_Ledger : tracks updates
```

### Table Details

#### 1. Projects (`matter` table)
* `id`: unique project ID (e.g., `proj_billing`)
* `type`: `'project'`
* `code`: Project abbreviation prefix (e.g., `BIL`, `ENG`)
* `title`: "Billing Integration"
* `data`: JSON holding project styling, status, and metadata

#### 2. Issues / Tasks (`matter` table)
* `id`: unique issue ID (e.g., `task_google_auth`)
* `type`: `'task'`
* `code`: Formatted issue key (e.g., `ENG-101`)
* `title`: "Implement native Google Auth flow"
* `data`: JSON string storing:
  ```json
  {
    "desc": "Add native sign-in handler for iOS/Android using EAS credentials.",
    "estimate": 3,
    "priority": "high"
  }
  ```

#### 3. Assignees & Sprints (`relation` table)
Relations connect tasks to projects, assignees, and sprints/cycles:
* **Project Membership:** `src = proj_redesign`, `tgt = task_auth_99`, `type = 'project_task'`
* **User Assignee:** `src = task_auth_99`, `tgt = usr_john`, `type = 'assigned_to'`
* **Reporter:** `src = task_auth_99`, `tgt = usr_jane`, `type = 'reported_by'`
* **Issue Dependencies:** `src = task_blocker_id`, `tgt = task_blocked_id`, `type = 'blocked_by'`

#### 4. Sprints / Cycles (`mass` table)
* `id`: unique cycle ID (e.g., `sprint_2026_24`)
* `matter`: Points to the project ID or system-wide cycle matter
* `type`: `'slot'`
* `start` / `end`: Sprint boundaries (e.g. `2026-06-01` to `2026-06-14`)

#### 5. Issue Lifecycle & Comments (`motion` table)
* **Lifecycle State:** When an issue is moved to a new state (e.g., Backlog $\rightarrow$ Todo $\rightarrow$ In Progress $\rightarrow$ Done), we perform a **phaseUpdateMotion** or **appendMotion**.
  * Status phase mappings:
    * `303` $\rightarrow$ Backlog
    * `306` $\rightarrow$ Todo (Open)
    * `304` $\rightarrow$ In Progress
    * `308` $\rightarrow$ Done (Resolved)
* **Comments & System Log:** Append-only records with stream set to the task ID (`task_auth_99`) and action set to `307` (`REPLY`).

---

## 4. Keyboard & Interaction Shortcuts (Keyboard-first UX)

To enable the speed of Linear, the UI will support keyboard shortcuts when running in desktop/web environments:

| Shortcut | Action | Database Execution |
| :--- | :--- | :--- |
| **`C`** | Open Quick Create Issue Modal | (Pre-populates project prefix) |
| **`Cmd/Ctrl + K`** | Open Command Bar / Menu | (Interactive search / actions list) |
| **`I`** then **`P`** | Move selected issue to "In Progress" | `phaseUpdateMotion(db, taskId, 304, 'IN_TRANSIT', ...)` |
| **`I`** then **`D`** | Move selected issue to "Done" | `phaseUpdateMotion(db, taskId, 308, 'RESOLVED', ...)` |
| **`A`** | Assign selected issue | Creates relation: `src = task_id, tgt = user_id, type = 'assigned_to'` |
| **`Delete`** | Archive / Delete issue | `UPDATE mass SET active = 0 WHERE matter = task_id` |

---

## 5. Next Steps for Implementation

1. **Register New Workspace View:**
   * Create `tarapp/app/project.tsx` (or a dedicated tab) containing the clean, multi-grouped list interface.
2. **Implement Command Menu Component:**
   * Add a bottom sheet / modal overlay that allows typing commands like `/assign`, `/status`, `/priority` with immediate search filtering.
3. **Bind Keyboard Event Listeners:**
   * Listen for key events when the web or desktop client has active focus on the issue lists.
