# TAR Workspace System — End-to-End Plan

> Every workspace = Turso DB (mutable state) + `.md` skill files in S3 (the program) + S2 streams (immutable events) + S3 Parquet (archive). No DOs except a stateless Editor for WebSocket relay.

---

## 1. Architecture

| Layer | Tech | Holds |
|---|---|---|
| Mutable state | Turso `ws-{subdomain}` | Products, stock, active orders, settings |
| Skill files | S3 `workspaces/{scope}/*.md` | Action definitions the AI and app execute |
| Event streams | S2.dev | Completed sales, GPS, kitchen tickets, motion |
| Archive | S3 `{scope}/analytics/*.parquet` | Historical data queried on-device (DuckDB WASM) |
| Vectors | S3 `{scope}/memory/` | LanceDB indexes queried on-device |
| Registry | D1 | Workspace list, channels, tokens, cron checkpoints |
| Global | Turso `g:global` | User profiles, catalog metadata |
| Relay | Stateless Editor DO | WebSocket relay for live preview (no storage) |

---

## 2. Skill System

**One `.md` file per module in S3 = the program.** It contains intent matching, action definitions (tool-call steps), and business-specific config. Same file used by app, channel agents, and AI customization.

### 14 Modules

Orders · Inventory · Bookings · CRM · Logistics · Projects · HR · LMS · Listings · Support · Reports · Expenses · Documents · Team Chat

### 6 Verticals (module combos)

| Vertical | Modules |
|---|---|
| Restaurant | Orders, Inventory, Bookings, CRM, Reports, Expenses, Documents |
| Salon | Bookings, CRM, Orders, Reports, Expenses, Documents |
| Clinic | Bookings, CRM, Projects, Support, Reports, Expenses, Documents |
| Retail | Orders, Inventory, CRM, Reports, Expenses, Documents |
| Gym | Bookings, CRM, LMS, HR, Reports, Expenses, Documents |
| Agency | CRM, Projects, HR, Support, Reports, Expenses, Documents |

### File locations

| Path in S3 | What | When written |
|---|---|---|
| `verticals/{type}/*.md` | Golden templates (generic) | Authored once by us, updated as platform evolves |
| `workspaces/{scope}/*.md` | AI-personalized skills for this business | Written at workspace creation |

---

## 3. Workspace Creation — UX Flow

**2 screens, ~10 seconds. Not a chat conversation.**

### Screen 1 — Pick Business Type

- Clean grid of 6 cards with icons (Restaurant, Salon, Clinic, Retail, Gym, Agency)
- One tap selects
- Text field below: *"or describe yours"* for custom types (AI maps to closest vertical)

### Screen 2 — Name Your Business

- Business name (required)
- Location (optional)
- "Create Workspace" button

### After Tap — Animated Transition (~3-5s)

User lands directly on the **workspace home** with a welcome message in chat showing installed modules and suggested first actions. No loading screen — the transition animation covers the setup time.

### What happens behind the scenes

| # | Action | ~Time |
|---|---|---|
| 1 | `POST /workspaces/create` with `{name, type, location}` | — |
| 2 | Create Turso DB `ws-{subdomain}`, run schema DDL | ~1s |
| 3 | Read golden templates from `verticals/{type}/` in S3 | ~200ms |
| 4 | AI personalizes all templates in one LLM call (inject name, location, tax, categories) | ~2s |
| 5 | Write personalized `.md` files to `workspaces/{scope}/` in S3 | ~300ms |
| 6 | Create S2 streams, issue tokens, register in D1 | ~500ms |
| 7 | Return workspace config to app | — |
| 8 | App creates local SQLite replica, caches skill index | ~500ms |

**Cost: 1 LLM call (~$0.001) + S3 writes (free on Railway) + 1 Turso DB ($0)**

---

## 4. Runtime — How Actions Execute

### Path A: App (Direct API)

User taps action button → app already knows action name + params (cached from skill index) → `POST /tools/execute` → Worker reads `.md` from S3 → `skill-parser` extracts steps → executor runs steps against Turso → result returned to app.

### Path B: Channel Agent (Telegram / Slack / WhatsApp)

User types message → channel handler sends to Worker → Worker reads skill files → cheap LLM matches intent to action → **same executor, same steps, same Turso queries** → result returned to channel.

### Path C: User Customization (via Chat, after creation)

| User says | What happens |
|---|---|
| *"Add delivery module"* | AI reads logistics template, personalizes, writes `logistics.md` to workspace S3 folder |
| *"Add loyalty points to sales"* | AI edits `orders.md` — appends a step to `action_record_sale` |
| *"Change tax rate to 12%"* | AI edits config section in `orders.md` |
| *"Remove bookings"* | AI deletes `bookings.md`, updates `index.md` |

All customization = `.md` file edits in S3. No migrations. No redeployments.

---

## 5. Write Paths

### Mutable → Turso

| Write | How |
|---|---|
| Stock deduction (sale) | Worker atomic SQL: `UPDATE matter SET qty = qty - N WHERE qty >= N` |
| Menu item / price edit | Local replica → Turso sync push (debounced 5s) |
| Active order status change | Worker update → Turso |
| Draft edits (typing, layout) | Local-only `p:` DB → Turso only on Save/Publish |

### Immutable → S2.dev (device writes directly, Worker not involved)

| Event | S2 Stream |
|---|---|
| Bill closed / payment | `ws/{id}/sales` |
| Kitchen ticket fired | `ws/{id}/kitchen` |
| Order status transition | `ws/{id}/motion` |
| Driver GPS (every 5s) | `drivers/{driverId}` |
| Staff clock-in/out | `ws/{id}/attendance` |
| Stock adjustment delta | `ws/{id}/stock-log` |
| Customer feedback | `ws/{id}/feedback` |

---

## 6. Archival — S2 → S3 Parquet

Daily cron at midnight: tail each S2 stream from last D1 checkpoint → batch → write Parquet to S3.

| S2 Stream | S3 Path | DuckDB use case |
|---|---|---|
| `ws/{id}/sales` | `{id}/analytics/sales/YYYY-MM.parquet` | Revenue by day/item/staff |
| `ws/{id}/kitchen` | `{id}/analytics/kitchen/YYYY-MM.parquet` | Avg ticket time, peak hours |
| `ws/{id}/motion` | `{id}/analytics/orders/YYYY-MM.parquet` | Order lifecycle durations |
| `ws/{id}/stock-log` | `{id}/analytics/stock/YYYY-MM.parquet` | Consumption trends |
| `ws/{id}/attendance` | `{id}/analytics/staff/YYYY-MM.parquet` | Hours worked |
| `drivers/{id}` | `{id}/analytics/delivery/YYYY-MM.parquet` | Route replay |

- S2 retention: 7 days. Parquet in S3: permanent.
- Client queries via DuckDB WASM + HTTP range requests. Zero server cost.

---

## 7. Token Permissions

| Role | Turso | S2 | S3 |
|---|---|---|---|
| Worker | Full group token | Create streams, issue tokens | Read/write all |
| Owner device | Full scoped token | All workspace streams | Read analytics + memory |
| POS / Waiter | `data_read`, `matter:data_update`, `motion:data_add` | Write: sales, kitchen, motion | — |
| Kitchen display | `data_read` only | Read: kitchen | — |
| Driver | `data_read` (assigned order) | Write: own GPS stream | — |
| Customer | None (public endpoint) | Read: driver GPS (delivery window) | — |

---

## 8. Timeline (No inbox DB)

1. App calls `GET /timeline?userId={id}`
2. Worker queries D1 → user's workspace list
3. Fan-out parallel query to each workspace DB: `SELECT * FROM motion WHERE assignee = ? ORDER BY time DESC LIMIT 20`
4. Merge + sort → unified JSON feed
5. Real-time: motion event → WS ping → app refetches

---

## 9. Cost Optimizations

| # | What | Result |
|---|---|---|
| 1 | Draft pattern — edits in local `p:` DB until Save | Zero Turso writes during editing |
| 2 | Debounce — 5s batch before sync push | Fewer write ops billed |
| 3 | Events via S2 — sales/GPS/tickets bypass Turso | Turso write volume halved |
| 4 | Analytics on-device — DuckDB WASM on S3 Parquet | Zero server reads for reports |
| 5 | Vectors on-device — LanceDB on S3 indexes | No Turso bloat for search |
| 6 | GPS via S2 — device→S2 directly | ~$2.19/mo vs ~$72/mo with DO |
| 7 | S3 free — Railway Tigris has no read/write cost | Skills, Parquet, vectors = $0 |
| 8 | Skill caching — app caches parsed action index | S3 reads only on first sync |

---

## 10. Implementation Checklist

### Delete

- [ ] `src/skills/` (14 SKILL.md folders) — replaced by `verticals/` in S3
- [ ] `src/modules/seed.ts` — replaced by 5-line vertical→module map
- [ ] `src/marketplace/seed.ts` — marketplace = browsing `verticals/` in S3

### Backend (`taragent`)

- [ ] `src/cloudflare.ts` — Remove `WorkspaceDO`, `OrderDO`. Strip storage from `EditorDO`
- [ ] `src/app.ts`
  - `POST /tools/execute` — Read `.md` from S3, parse, run steps against Turso
  - `POST /workspaces/create` — Turso DB + AI personalize templates + S3 write + S2 streams + D1 register
  - `GET /workspace/{scope}/skills` — Return parsed action index for app cache
  - `POST /workspace/{scope}/customize` — AI read + edit skill `.md` in S3
- [ ] `src/lib/okf.ts` — Add `readWithFallback(scope, path, vertical)`: try workspace, fall back to vertical
- [ ] `src/lib/action-executor.ts` — Remove DO routing. Route all through Turso
- [ ] `src/lib/workspace-db.ts` — Turso DB provisioning, group management, scoped tokens
- [ ] `wrangler.jsonc` — Remove `WORKSPACE` + `ORDER` DO bindings. Keep `EDITOR`. Add `TURSO_GROUP_TOKEN`
- [ ] `src/index.ts` — Cron: expired checkouts (every min), S2→Parquet archival (daily)

### Client (`tarapp`)

- [ ] `src/lib/db.ts` — `getWorkspaceDb()` via `createSyncDbConnection` with scoped token
- [ ] `src/lib/skills-cache.ts` (new) — Fetch + cache action index from Worker
- [ ] `src/lib/s2-client.ts` (new) — Direct S2 stream writes (sales, kitchen, GPS)
- [ ] `src/lib/offline-queue.ts` — Point queued ops to `POST /tools/execute`
- [ ] `src/app/onboarding/` (new) — 2-screen onboarding: pick type → name business → create
- [ ] `src/app/(tabs)/home.tsx` — `GET /timeline` fetch
- [ ] `src/app/workspace.tsx` — Local replica reads + action buttons from cached skill index

### S3 Content (Railway)

- [ ] Author golden templates for all 6 verticals: `verticals/{type}/*.md`
