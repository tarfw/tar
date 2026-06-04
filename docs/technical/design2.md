# Teams & Agents UI Concept Designs (Front-End UI Usage)

This document defines the front-end UI usage blueprints (Concepts 1 to 9) for the **Teams & Agents (Workspace Scopes)** system. It illustrates how the application abstracts database-level schemas (Matter, Mass, Motion, Relation) into intuitive front-end interfaces for managing workspaces, roles, invite pipelines, permission maps, and synchronization.

---

## 1. Front-End UI vs. Database Schema Abstraction

In the backend schema, workspaces are resolved through prefixes (e.g. `s:102`, `t:99`, `w:ch03`) and synced using SQLite routing queries. On the front-end, this technical setup is translated into user-centric concepts:
*   **Matter:** Abracted into **Profiles** (e.g., Alice's contact cards) and **Role Blueprints** (defining permissions).
*   **Mass:** Abstracted into **Shift Slots** and **Roster Allocations** (representing who is assigned to work when and where).
*   **Motion:** Abstracted into **Rider Dispatches, Sales Logs, and Clock-Ins** (an append-only audit trail of what agents performed).
*   **Relation:** Abstracted into **Team Assignments** (e.g., linking a Profile to a Workspace).

---

## 2. Interactive UI Concepts (1 to 9)

### Concept 1 — WORKSPACE SCOPE SWITCHER (context switching)

Filters the universal dashboard feed so the user sees only events related to a specific team or agent scope.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 1 — SCOPE SWITCHER            ║
  ╠═══════════════════════════════════════╣
  ║  ←   Select Workspace Context         ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Active: Storefront (s:102)           ║
  ║  ───────────────────────────          ║
  ║  [ ] Personal Workspace            p  ║
  ║  [ ] Friends Shared               r:55║
  ║  [x] Storefront Central          s:102║
  ║  [ ] Warehouse Logistics        w:ch03║
  ║  [ ] Team Projects                t:99║
  ║                                       ║
  ║  ───────────────────────────          ║
  ║  🔒 Local-only scopes are badged      ║
  ║  ☁  Sync-enabled scopes show cloud    ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 2 — ADD NEW AGENT · invite link generator

Generates context-specific, cryptographically signed invitations linked to a specific scope role.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 2 — ADD NEW AGENT · invite    ║
  ╠═══════════════════════════════════════╣
  ║  ✕                            generate║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   Scope context: ┌ Team / Work ▾ ┐    ║
  ║   Target prefix: ┌ t:99 ▾ ┐           ║
  ║                                       ║
  ║   Role:          ┌ Manager ▾ ┐        ║
  ║                                       ║
  ║   Add member email:                   ║
  ║   ╭─────────────────────────────╮    ║
  ║   │ bob@company.com             │    ║
  ║   ╰─────────────────────────────╯    ║
  ║                                       ║
  ║   Or generate invite link:            ║
  ║   ┌─────────────────────────────┐    ║
  ║   │ tar://join/t99?role=mgr     │    ║
  ║   └─────────────────────────────┘    ║
  ║                                       ║
  ║   [x] Require admin approval         ║
  ║                                       ║
  ║   ╭─────────────────────────────╮    ║
  ║   │    GENERATE & COPY LINK     │    ║
  ║   ╰─────────────────────────────╯    ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 3 — SKILLS & PLAYBOOK (permission toggle drawer)

Admin-controlled settings drawer showing what database actions the agent is permitted to write.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 3 — SKILLS & PLAYBOOK         ║
  ╠═══════════════════════════════════════╣
  ║  ←   Bob · permissions                ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Allowed Skills (Write Actions)       ║
  ║  ───────────────────────────          ║
  ║  [x] Retail POS Sales                 ║
  ║      Writes Opcode 101 SOLD           ║
  ║  [x] Warehouse Transfers              ║
  ║      Writes Opcode 406 TRANS_IN       ║
  ║  [ ] Refund Transactions              ║
  ║      Writes Opcode 111 REFUND         ║
  ║  [x] Clock-in/out Staff               ║
  ║      Writes Opcode 501 CLOCK_IN       ║
  ║                                       ║
  ║  writes  relation assigned_to         ║
  ║                                       ║
  ║  ╭─────────────────────────────╮     ║
  ║  │         APPLY SKILLS        │     ║
  ║  ╰─────────────────────────────╯     ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 4 — ROSTER CALENDAR (shift slot planner)

Renders active schedules stored in the database `mass` table.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 4 — ROSTER CALENDAR (slot)    ║
  ╠═══════════════════════════════════════╣
  ║  ✕   Roster · t:99           ⊕ add    ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Monday, Jun 08                       ║
  ║  ───────────────────────────          ║
  ║  Alice Smith    09:00 - 17:00         ║
  ║                 active shift slot     ║
  ║                                       ║
  ║  Bob Johnson    17:00 - 01:00         ║
  ║                 pending shift slot    ║
  ║                                       ║
  ║  Charlie Brown  OFF                   ║
  ║                                       ║
  ║  ─ database allocation ─              ║
  ║  mass  type='shift'                   ║
  ║  start '2026-06-08T09:00:00'          ║
  ║  end   '2026-06-08T17:00:00'          ║
  ║                                       ║
  ║  ╭───────────────────────────────╮   ║
  ║  │         PUBLISH ROSTER        │   ║
  ║  ╰───────────────────────────────╯   ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 5 — AGENT PROFILE CARD (agent detail view)

Displays individual workspace memberships and their recent kinetic database writes.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 5 — AGENT PROFILE CARD        ║
  ╠═══════════════════════════════════════╣
  ║  ←   Alice Smith (Manager)      ⋯    ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║      (👤) Alice Smith                 ║
  ║           alice@company.com           ║
  ║                                       ║
  ║  Workspaces Scopes                    ║
  ║  ───────────────────────────          ║
  ║  ● t:99   Main Office       Manager   ║
  ║  ● s:102  Central Store     Store     ║
  ║                                       ║
  ║  Recent Audit Ledger                  ║
  ║  ───────────────────────────          ║
  ║  09:00  501 CLOCK_IN    t:99          ║
  ║  10:15  202 SHIFT_START s:102         ║
  ║  18:30  204 SHIFT_END   s:102         ║
  ║                                       ║
  ║  Writes profile matter, scope t:99    ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ⇄ transfer   🏷 edit       ⊖ deactivate║
  ╚═══════════════════════════════════════╝
```

---

### Concept 6 — SHARED WORKSPACE FEED (collaboration log)

A chronological view showing all actions written to a specific workspace log by team members.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 6 — SHARED WORKSPACE FEED     ║
  ╠═══════════════════════════════════════╣
  ║ ◉ Alice        t:99 ▾                 ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   NOW                                 ║
  ║   │                                   ║
  ║   ● Alice checked-in to Till 01       ║
  ║     t:99 · 5m ago                     ║
  ║                                       ║
  ║   ● Bob posted task deadline          ║
  ║     t:99 · 20m ago                    ║
  ║                                       ║
  ║   PAST                                ║
  ║   2h  501 CLOCK_IN  Bob               ║
  ║   3h  604 FORM_SUB  Charlie           ║
  ║   1d  204 SHIFT_END Alice             ║
  ║                                       ║
  ║  Writes motion stream t:99            ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  🧑   ⊞   +          ●REC   AI   ↑  ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 7 — ROLE PERMISSIONS MATRIX (opcode mapper)

Associates transaction opcodes with custom roles to restrict what actions the front-end will render.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 7 — PERMISSIONS MATRIX        ║
  ╠═══════════════════════════════════════╣
  ║  ✕   Role Mapper             save     ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   Role: ┌ Store Cashier ▾ ┐           ║
  ║                                       ║
  ║   Permitted Transaction Opcodes:      ║
  ║   ───────────────────────────         ║
  ║   [x] 101 SOLD      (Retail Sale)     ║
  ║   [ ] 111 REFUND    (Transactions)    ║
  ║   [x] 201 SALE      (POS Register)    ║
  ║   [ ] 405 TRANS_OUT (Wholesale)       ║
  ║   [ ] 501 CLOCK_IN  (Roster Shifts)   ║
  ║                                       ║
  ║   Allows UI buttons for checked       ║
  ║   actions only.                       ║
  ║                                       ║
  ║  ╭ writes ────────────────────────╮  ║
  ║  │ matter  role_cashier_rules     │  ║
  ║  │ scope   s:102                  │  ║
  ║  ╰────────────────────────────────╯  ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 8 — SYNC STATUS OUTBOX (offline agent logs)

Provides agents with a visual representation of pending transactions in the local queue vs synced cloud state.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 8 — SYNC OUTBOX (offline)     ║
  ╠═══════════════════════════════════════╣
  ║  ←   Sync Engine Overview             ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Unsynced local actions (outbox)      ║
  ║  ───────────────────────────          ║
  ║  ⏳  10:15  201 SALE       s:102      ║
  ║  ⏳  10:20  101 SOLD       s:102      ║
  ║                                       ║
  ║  Synced actions (ledger)              ║
  ║  ───────────────────────────          ║
  ║  ✓   09:00  501 CLOCK_IN   t:99       ║
  ║  ✓   yda    204 SHIFT_END  t:99       ║
  ║                                       ║
  ║  Local outbox queues pending Turso    ║
  ║  upload when network is restored.     ║
  ║                                       ║
  ║  [ FORCE SYNC NOW ]                   ║
  ╚═══════════════════════════════════════╝
```

---

### Concept 9 — TEAMS / AGENTS DIRECTORY

The main dashboard showing active agents and workspaces categorized by scope prefixes.

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 9 — TEAMS / AGENTS            ║
  ╠═══════════════════════════════════════╣
  ║              Teams & Agents           ║
  ╟───────────────────────────────────────╢
  ║ 🔍 search agents…                     ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Personal                       p     ║
  ║    ⬤  You                  Owner     ║
  ║                                       ║
  ║  Storefront                  s:102    ║
  ║    ⬤  Central Store         Store     ║
  ║    ⬤  Term 01               Active   ║
  ║                                       ║
  ║  Team / Work                  t:99    ║
  ║    ⬤  Alice               Manager    ║
  ║    ⬤  Bob                    Lead    ║
  ║    ⬤  Charlie                 QA     ║
  ║                                       ║
  ║  Warehouse                w:ch03      ║
  ║    ⬤  Chennai SCM        Logistics   ║
  ║                                       ║
  ║  Client / CRM              c:vip      ║
  ║    ⬤  Acme Corp             Lead     ║
  ║                                       ║
  ║  HR / Staff                h:staff    ║
  ║    ⬤  HR Office             Admin    ║
  ║                                       ║
  ║                       ⊕ new agent     ║
  ╚═══════════════════════════════════════╝
```
