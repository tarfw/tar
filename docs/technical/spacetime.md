# Space-Time: the philosophy behind Home

> Home is the **present moment** slicing through every open worldline.

This document records the mental model that the Home screen (`tarapp/app/home.tsx`)
is built on, and why the four Tar tables (`matter` / `mass` / `motion` / `relation`)
already encode a space-time.

---

## 1. The claim

The Home screen is not "a list of things." It is a **now-slice**: the present
moment cutting across all the worldlines a user has opened. A worldline is any
thing that *begins*, *persists*, and *ends*. The user's job on Home is to push
those worldlines forward in time until they reach a terminal state and fall out
of view.

The user's original framing was:

> "I consider the home screen like space-time where the user needs to do an
> actions list."

That instinct is correct — and it's not just a metaphor. The data model proves it.

---

## 2. The tables *are* a space-time

| Table | What it is | Role in space-time |
|-------|------------|--------------------|
| `matter` | the entity / thing | **space** — *what / who* exists (a customer, a task, a product, a warehouse) |
| `mass` | a state-bearing slot with `start`, `end`, `active` | **time** — *when* a thing lives, and whether it is still open |
| `motion` | append-only event log keyed by `(stream, seq)` | **the arrow of time** — *what happened*, in irreversible order |
| `relation` | typed edges `(src, tgt, type)` between matter | **the graph** — how points in space connect |

Key observation: **`mass` already carries `start`, `end`, and `active`.** That is
literally a worldline — a segment of existence with a beginning, a duration, and
an end. `motion` is the irreversible event stream that advances along it. Nothing
had to be bolted on; the schema was a space-time from the start.

---

## 3. The refinement

"Space-time where the user does actions" is *almost* right. Precisely:

> Home is the **present moment** slicing through all worldlines. It shows only
> the `mass` rows still `active = 1` that intersect *now or the near future*.
> The resolved past (`motion` whose worldline has ended) collapses out of view;
> the far future waits its turn.

And an action is not "ticking a checkbox." An action is **the user injecting a
`motion` event**:

- advancing a lead: `303 LEAD CREATE → 304 CONTACTED → 305 CONVERTED`
- resolving a ticket: `306 TICKET OPEN → 307 REPLY → 308 RESOLVED`
- moving a trip: `401 DISPATCHED → 402 IN TRANSIT → 109 DELIVERED`
- paying an invoice: `801 PAYMENT INIT → 802 PAYMENT SUCCESS`
- completing a task / ending a shift: `mass.active → 0`

Each tap moves a worldline forward. The row leaves the list not because it was
"checked off," but because the worldline reached its **terminal state**
(`active = 0`, or a converted/delivered/resolved/paid motion).

---

## 4. Two screens, two roles

| Screen | Role | What it does |
|--------|------|--------------|
| **`/workspace`** | the **editor of space** | define entities (`matter`) and open new worldlines — create tasks, leads, tickets, trips, invoices, shifts |
| **`/home`** | the **observer at now** | render every open worldline that demands attention, ordered on the time axis, and let the user push each one forward |

Workspace creates worldlines. Home observes the present slice of them and lets
you advance them. Same `mass`/`motion` tables, opposite ends of the telescope.

---

## 5. How Home implements the slice

`home.tsx` is a direct expression of the model above.

**The query** — every open worldline, regardless of which entity it belongs to:

```sql
SELECT m.id, m.matter, m.type, m.value, m.start, m.end, m.data, m.time,
       mt.title, mt.type,
       (SELECT action FROM motion WHERE stream = m.id ORDER BY seq DESC LIMIT 1) AS last_action,
       (SELECT data   FROM motion WHERE stream = m.id ORDER BY seq ASC  LIMIT 1) AS root_data
FROM mass m
LEFT JOIN matter mt ON mt.id = m.matter
WHERE m.active = 1 AND m.type IN ('lead','ticket','trip','invoice','slot')
```

- `active = 1` is **the now-slice condition** — only live worldlines.
- `last_action` (latest motion) is **where the worldline sits on its track** — its current stage.
- `root_data` (first motion) carries the subject / ref / source for the label.
- A `slot` resolves to a **task** (personal/business) or a **schedule/shift**
  (person/family) depending on its entity's type.
- Converted leads (`last_action = 305`) are dropped: they are terminal even
  though `mass.active` may linger.

**Two databases are merged**: entity-bound worldlines live in the synced
workspace DB (`getPrimarySyncDb`), personal items in the local private DB
(`getLocalPrivateDb`). Home reads both and de-duplicates by `mass.id`.

**Ordering** is the time axis: soonest `end` (or `start`, then created `time`)
first — overdue and imminent worldlines rise to the top.

**Advancing** mirrors `workspace.tsx` exactly (`appendMotion` /
`phaseUpdateMotion` with the same `PHASE_MAP`), so Home and Workspace write
identical motion ledgers. Each kind knows its next motion:

| Kind | `mass.type` | Current → tap emits |
|------|-------------|---------------------|
| Task | `slot` (business scope) | `mass.active → 0` + `504 COMPLETED` |
| Shift | `slot` (person/family) | `mass.active → 0` |
| Lead | `lead` | `304 CONTACTED` → `305 CONVERTED` |
| Ticket | `ticket` | `308 RESOLVED` + `mass.active → 0` |
| Trip | `trip` | `402 IN TRANSIT` → `109 DELIVERED` |
| Invoice | `invoice` | `802 PAYMENT SUCCESS` + `mass.active → 0` |

---

## 6. Consequences of the model

- **The list shrinks as work completes.** Empty Home = no open worldlines = a
  clear present. That is the goal state, not an error state.
- **History is never destroyed.** Advancing appends/updates `motion`; the past
  remains queryable, it simply leaves the slice.
- **Home and Workspace can never disagree**, because both speak the same motion
  opcodes against the same rows.
- **New worldline types are free**: add a `mass.type` to the query's `IN (...)`
  list and give it a `describe()` + `advance()` branch. The space-time absorbs it.

---

*Companion code: `tarapp/app/home.tsx` (the now-slice) and
`tarapp/app/workspace.tsx` (the editor of space). Opcode reference:
`tarapp/lib/domainsData.ts` → `OPCODE_LABELS`. Schema:
`tarapp/lib/schema.ts`.*
