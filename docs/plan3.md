# Plan 3 — General Tasks & Notes + Cross-User Task Assignment

CRM anchors everything on a *customer*. The same 5-table pattern works with
**no anchor** (personal tasks/notes) or with a *person who is also a user of
the app* (assignment). This plan covers both.

---

## 1. General Tasks & Notes (no customer) — same pattern, different scope

The CRM flow already proved the shape. Only two things change:

| Aspect          | CRM version                  | General version                       |
|-----------------|------------------------------|---------------------------------------|
| Scope           | `c:{selfId}` (synced)        | `p` (private local DB, never synced)  |
| Relation anchor | `relation: customer → task`  | none — or `relation: project → task`  |

```
 PERSONAL TASK                          PERSONAL NOTE
 ┌─────────────────────┐               ┌─────────────────────┐
 │ matter              │               │ matter              │
 │  type='task'        │               │  type='note'        │
 │  scope='p'          │               │  scope='p'          │
 │  title              │               │  title + data.text  │
 └────────┬────────────┘               └─────────┬───────────┘
          │                                      │
 ┌────────▼────────────┐               ┌─────────▼───────────┐
 │ mass (slot)         │               │ memory (vector)     │
 │  active=1 pending   │               │  semantic search    │
 │  end = due date     │               └─────────────────────┘
 └────────┬────────────┘
          │
 ┌────────▼────────────┐    Optional grouping ("lists" à la MS To Do):
 │ motion 504          │    matter type='project' + relation: project → task
 │  ASSIGNED/DONE/     │    — identical to how customer → task works in CRM.
 │  REOPENED           │
 └─────────────────────┘
```

- `home.tsx` already reads `p`-scoped mass slots for its Future/Now/Past lists
  — general tasks created this way appear there automatically.
- `create_task.tsx` already writes this shape; a "My Tasks" screen is just the
  CRM screen's Tasks+Notes sections with `scope='p'` and no relation filter.

---

## 2. Assigning a task to ANOTHER USER — how it works

### The key insight: there is no central server. Each user owns a Turso DB.

```
   YOU (assigner)                          KABILAN (assignee)
   user_sync_YOU.db  ──Turso──┐    ┌──Turso── user_sync_KABILAN.db
                              │    │
   "Where does the shared task live?"
   → In the ASSIGNER's DB. The assignee gets delegated access to it.
```

A task assigned by you lives in **your** synced DB under a collab scope.
The assignee's app opens *your* DB as a second connection:

- `routeDbForEntity(type, scope, scopeOwnerId)` — db.ts:163 — already routes
  to `getCollaboratorSyncDb(ownerId)` when `scopeOwnerId !== selfId`.
- `getCollaboratorSyncDb(ownerId, delegatedToken)` — db.ts:98 — already opens
  `user_sync_{ownerId}.db` against `libsql://db-{ownerId}.turso.io` with a
  delegated auth token.

**What's missing today**: distributing the delegated token (a worker endpoint)
and an "assignments" discovery query. The schema needs nothing new.

### Data design (one home per fact, per plan2.md)

```
 IN ASSIGNER'S DB (scope = h:{assignerId} or x:{teamId})
 ───────────────────────────────────────────────────────
 ┌──────────────────────────┐
 │ matter                   │   the assignee is a matter row too —
 │  id: usr_kabilan         │   type='profile', code = their userId.
 │  type='profile'          │   (CRM customers who ARE users simply
 │  code: <kabilan_userId>  │   carry their userId in code/data.)
 └──────────┬───────────────┘
            │ relation: src=usr_kabilan, tgt=task_x9, type='assigned'
 ┌──────────▼───────────────┐
 │ matter  task_x9          │
 │  type='task' owner=YOU   │
 └──────────┬───────────────┘
 ┌──────────▼───────────────┐
 │ mass (slot)              │  active=1, end=due date
 └──────────┬───────────────┘
 ┌──────────▼───────────────┐
 │ motion 504 "ASSIGNED"    │  data: {assignee: <userId>}
 │ motion 504 "ACCEPTED"    │  ← written BY KABILAN into YOUR db
 │ motion 504 "DONE"        │  ← written BY KABILAN into YOUR db
 └──────────────────────────┘
```

- **Who is it assigned to?** → `relation` (profile → task), single home.
- **Status?** → latest motion seq (ASSIGNED → ACCEPTED → DONE), no mirrors.
- **Due?** → `mass.end`. **Open?** → `mass.active`.

### Assignment flow (sequence)

```
 1. ASSIGNER (you)                       2. WORKER (Cloudflare)
 ┌───────────────────────────┐          ┌─────────────────────────────┐
 │ create task in OWN db     │          │ POST /api/share/grant       │
 │  matter+relation+mass+504 │─────────▶│  {taskOwner: YOU,           │
 │ db.push()                 │          │   grantee: KABILAN}         │
 └───────────────────────────┘          │ → issues delegated Turso    │
                                        │   token for YOUR db,        │
                                        │   stores pending grant      │
                                        └──────────┬──────────────────┘
                                                   │
 3. ASSIGNEE (Kabilan)                             ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ GET /api/share/inbox → [{owner: YOU, token, scope}]             │
 │ getCollaboratorSyncDb(YOU, token)  ← db.ts already supports this│
 │ pull() → SELECT tasks via relation WHERE src = usr_kabilan      │
 │ taps Accept/Done → appendMotion(504) into YOUR db → push()      │
 └─────────────────────────────────────────────────────────────────┘
 4. You pull() → see ACCEPTED/DONE in your ledger. Done.
```

Seq-collision safety across two writers on one stream: the existing
`UNIQUE(stream, seq)` + `MAX(seq)+1` pattern holds because writes funnel
through the same Turso primary; on conflict the client retries (wrap the
motion INSERT in one retry).

### Notes shared the same way

`relation: usr_kabilan → note_x1, type='shared_note'` in your DB; assignee
reads it through the same delegated connection. No new mechanics.

---

## 3. Implementation steps (when we build it)

| # | Step | Where | Effort |
|---|------|-------|--------|
| 1 | "My Tasks / Notes" screen: CRM Tasks+Notes sections, scope `p`, optional project grouping | new `tasks.tsx` (reuse crm.tsx components) | S |
| 2 | Worker endpoints: `POST /share/grant` (mint delegated token via Turso API), `GET /share/inbox` | Cloudflare worker (s3storage…workers.dev) | M |
| 3 | Assign UI: picker of profile matters that have a `code` = userId → relation + 504 ASSIGNED | crm.tsx / tasks.tsx | S |
| 4 | Assignee inbox: poll `/share/inbox`, open collaborator DBs, merged "Assigned to me" list | tasks.tsx | M |
| 5 | Accept/Done writes into owner DB + push; retry-once on seq conflict | shared helper (lift `appendMotion` into `lib/motion.ts`) | S |

Order: 1 → 3 (works today, single-user) → 2 → 4 → 5 (true cross-user).

### What already exists vs missing

| Piece | Status |
|---|---|
| Schema (matter/mass/motion/relation) | ✅ nothing to add |
| Task/note write pattern | ✅ proven in crm.tsx |
| Routing to another user's DB | ✅ `getCollaboratorSyncDb` (db.ts:98) |
| Delegated token issuance/distribution | ❌ worker endpoints needed |
| Assignment discovery ("assigned to me") | ❌ inbox query needed |
| Multi-writer seq retry | ❌ one small wrapper |
