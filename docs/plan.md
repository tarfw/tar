# TAR Agents — Final End-to-End Plan (v2)

---

## 1. Architecture Overview

| Layer | What | Who Uses | Count | Example |
|-------|------|----------|-------|---------|
| **Tools** | Atomic DB operations | System (internal) | 6 | `create`, `read`, `update`, `delete`, `link`, `search` |
| **Skills** | JSON step sequences | User or Agent triggers | 8+ built-in | "Create Lead", "Record Sale" |
| **Workflows** | Orchestration logic | Skills call workflows | Per vertical | Sale with rollback, parallel actions |
| **Agents** | Autonomous AI decision loops | Runs on cron/event/message | Per vertical | Birthday agent, Driver matcher |

---

## 2. Storage — 5 Tables

| Table | Stores | Append-only? | Tools Used | Example |
|-------|--------|-------------|------------|---------|
| `form` | Blueprints, skills, workflows, profiles | No | create, read, update, delete | lead_def, skill_create_lead, wf_sale |
| `matter` | Instances, stock, bookings | No | create, read, update, delete | stock_pepsi_101, booking_789 |
| `motion` | Events (history) | Yes (phase update only) | create, read, update | sale_event, clock_in_event |
| `bond` | Relationships (edges) | No | link | product→store, lead→owner |
| `memory` | Vector embeddings | No | search | "pepsi" → item_pepsi |

### Motion Rules

| Operation | Allowed? | Example |
|-----------|----------|---------|
| INSERT new motion | Yes | New sale event |
| UPDATE phase field | Yes | `phase: 0 → 1 → 2` |
| UPDATE data/content | **No** | Cannot modify sale amount |
| DELETE | **Never** | History preserved |

### Scope System — Durable Object Routing

Every entity lives in a Durable Object (DO). Scope ID routes to the right DO.

| Prefix | Scope | DO Type | Lifetime | Purpose |
|--------|-------|---------|----------|---------|
| `s:` | Store | Storefront DO | Persistent | Inventory, products, real-time stock |
| `t:` | Team | Workspace DO | Persistent | Team tasks, attendance, HR |
| `o:` | Order | Order DO | Ephemeral | Transaction coordination |
| `p` | Personal | Local only | Device | Cart, drafts, wishlist |
| `g` | Global | Turso | Permanent | Vector search, AI context |

**Scope ID format:** `{prefix}:{identifier}` — e.g., `s:store_101`, `t:team_42`, `o:order_789`

### DO Types

| DO Type | Scope | Contains | Sync |
|---------|-------|----------|------|
| **Storefront DO** | `s:{id}` | Products, stock, pricing, bonds | Real-time push to connected clients |
| **Workspace DO** | `t:{id}` | Tasks, attendance, HR data | Real-time push to team members |
| **Order DO** | `o:{id}` | Transaction state, party roles | Ephemeral — self-destructs after completion |
| **Personal** | `p` | Cart, drafts, wishlist | Local only — no sync |
| **Global** | `g` | Vector embeddings, AI context | Turso — read-only from agents |

### Sync Protocol

| Step | Action |
|------|--------|
| 1 | Client writes to local DO (single-threaded, no locks) |
| 2 | DO broadcasts change via WebSocket to connected clients |
| 3 | Other clients receive update → apply to local state |
| 4 | Conflict: last-writer-wins on `form`, version check on `matter` |

### Offline → Online

| State | Behavior |
|-------|----------|
| Online | Real-time sync via WebSocket |
| Offline | Writes queued locally |
| Reconnect | Queue flushes → DO processes in order |
| Conflict | Version mismatch → retry or merge |

### Entity Collaboration Matrix

| Entity | Primary DO | Sync Scope | Real-time? |
|--------|-----------|------------|------------|
| Product | `s:{store}` | Store | Yes (stock changes) |
| Order | `o:{order}` | Order parties | Yes (all parties) |
| Lead | `s:{store}` | Store | Yes (agent updates) |
| Task | `t:{team}` | Team | Yes (assignment) |
| Attendance | `t:{team}` | Team | Yes (clock in/out) |
| Cart | `p` | Personal | No (local only) |
| Skill | `g` | Global | No (read-only) |
| Memory | `g` | Global | No (vector index) |

---

## 3. Tool Layer — 6 Primitives

| Tool | Operation | SQL | Tables | Notes |
|------|-----------|-----|--------|-------|
| `create` | INSERT | `INSERT INTO {table} ...` | form, matter, motion, bond | Returns new row ID |
| `read` | SELECT | `SELECT * FROM {table} WHERE ...` | form, matter, motion, bond | Returns matching rows |
| `update` | UPDATE | `UPDATE {table} SET ... WHERE ...` | form, matter, motion, bond | Last-writer-wins on form |
| `delete` | SOFT DELETE | `UPDATE {table} SET active=0 WHERE ...` | form, matter, bond | motion is never deleted |
| `link` | INSERT/TOGGLE | `INSERT OR REPLACE INTO bond ...` | bond | Create or toggle edge |
| `search` | VECTOR SEARCH | `SELECT ... ORDER BY vector_distance_cos ...` | memory | Semantic similarity |

### Search — Recall → Hydrate

Two-step search: semantic recall (vector), then live truth (DO).

| Step | Engine | Returns |
|------|--------|---------|
| 1. Recall | `memory` table (vector) | candidate IDs + cached snapshot |
| 2. Hydrate | `form`/`matter` tables | live price, stock |
| 3. Act | `motion` table | write event |

**Why staleness is fine:** 30s-old price is fine for ranking. Exactness bought at **action time** (checkout reads DO, not vector cache).

### Category → Engine Routing

| Category | Query | Find via | Live from | Geo? |
|----------|-------|----------|-----------|------|
| Shopping | "what is this" | vector memory | form/matter | No |
| Food | "what + near me" | vector + H3 | form/matter | Optional |
| Transport | "who is near me now" | **KV k-ring** | matter | **Yes** |
| Tickets | "what event" | vector memory | form | No |
| Hotels | "what + where + dates" | vector + H3 | form/matter | Optional |
| Services | "who serves near me" | vector + H3 | form/matter | Optional |

### Geospatial Presence (KV + H3)

Ephemeral location presence using H3 hex grid + KV with TTL.

| Component | How |
|-----------|-----|
| Key | `geo:{h3_hex_id}` |
| Value | `{ "driver_44": { "lat":13.08, "lng":80.27, "status":"free" } }` |
| TTL | 30 seconds (auto-expires) |
| Update | Driver pings GPS every 5s → Worker writes to KV |
| Search | Customer hex → gridDisk(1) → 7 hexes → parallel KV read |

### Tool Parameters

| Tool | Required Params | Optional Params |
|------|----------------|-----------------|
| `create` | table, type | title, scope, data, form |
| `read` | table, where | limit, offset, order |
| `update` | table, where, set | — |
| `delete` | table, where | — |
| `link` | src, tgt, type | weight, active |
| `search` | query, table | type, limit |

### Concurrency — Optimistic Locking

Add `version` column to `matter` table. Update fails if version mismatch:

```json
{"action": "update", "table": "matter", "where": {"id": "stock_101", "version": 5}, "set": {"qty": "qty - 1"}}
```

SQL: `UPDATE matter SET qty = qty - 1, version = version + 1 WHERE id = 'stock_101' AND version = 5`

If rows affected = 0 → version mismatch → retry or fail.

| Table | Has Version? | Use Case |
|-------|-------------|----------|
| `form` | No | LWW acceptable |
| `matter` | **Yes** | Prevent oversell, double-booking |
| `motion` | No | Append-only |
| `bond` | No | Toggle is idempotent |

---

## 4. Skill Layer — JSON Definition

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier (e.g., `tool_create_lead`) |
| `name` | string | Yes | Display name |
| `description` | string | Yes | What it does |
| `vertical` | string | Yes | Business area (crm, pos, taxi, etc.) |
| `icon` | string | No | UI icon |
| `fields` | array | Yes | Input form fields |
| `execution.steps` | array | Yes | Sequence of 6 tool operations |
| `custom` | boolean | No | User-created or built-in |

### Skill Security — RBAC

| Field | Type | Purpose |
|-------|------|---------|
| `allowed_roles` | array | Who can run this skill (e.g., `["owner", "cashier"]`) |
| `scope` | string | Tenant scope (`store`, `org`, `global`) |

```json
{
  "id": "tool_record_sale",
  "allowed_roles": ["owner", "cashier"],
  "scope": "store"
}
```

Agent checks user role before executing. Deny if not in `allowed_roles`.

### Skill Examples

| Vertical | Skill ID | Steps | Tools Used |
|----------|----------|-------|------------|
| CRM | `tool_create_lead` | create form → create motion → link bond | create + link |
| POS | `tool_record_sale` | update matter → create motion × 2 | update + create |
| Taxi | `tool_request_ride` | create matter → create motion → search memory | create + search |
| E-Commerce | `tool_add_product` | create form → create matter → link bond | create + link |
| HR | `tool_clock_in` | create motion (opcode 401) | create |
| Services | `tool_create_booking` | create matter → create motion | create |

---

## 5. Workflow Layer — Orchestration

| Feature | Syntax | Example |
|---------|--------|---------|
| **Conditional** | `if/then/else` | Check stock → sell or alert |
| **Parallel** | `parallel` block | Email + push + in-app simultaneously |
| **Error handling** | `try/catch` + `compensate` | If payment fails, rollback stock |
| **Retry** | `retry` config | Retry webhook 3× with backoff |
| **Loops** | `for/while` | Send reminder to all unpaid invoices |
| **Approval gates** | `wait_for_approval` | Manager approves refund |
| **State passing** | `$.variable` | Step 1 output → Step 2 input |

### Workflow Definition Structure

```json
{
  "id": "wf_record_sale",
  "name": "Record Sale with Safety",
  "steps": [
    {"skill": "check_stock", "input": {"item": "{item_id}"}},
    {
      "if": "$.stock_qty > 0",
      "then": [
        {"parallel": [
          {"skill": "deduct_stock"},
          {"skill": "create_sale_motion"}
        ]},
        {"skill": "send_receipt"}
      ],
      "else": [
        {"skill": "alert_low_stock"}
      ]
    }
  ],
  "on_error": {
    "compensate": [{"skill": "restore_stock"}]
  }
}
```

### Workflow vs Skill

| Aspect | Skill | Workflow |
|--------|-------|----------|
| Structure | Flat step array | DAG with branches/parallel |
| Error handling | None | Try/catch + rollback |
| State passing | None | `$.variable` between steps |
| Complexity | Linear A→B→C | Conditional, parallel, loops |
| Use case | Simple CRUD chains | Business logic with decisions |

---

## 6. Agent Layer

| Agent Type | Trigger | Action | Example |
|------------|---------|--------|---------|
| **Scheduled** | Cron (3 AM) | Read tables → generate report | Daily sales report |
| **Event-driven** | Motion written | React to changes | Low stock alert |
| **Real-time** | WebSocket message | Process & respond | KDS kitchen display |
| **Message** | WhatsApp/Telegram text | Interpret → pick workflow → execute | "add lead Priya" |
| **Webhook** | External API call | Process payment, update status | Stripe success |

### Agent Definition (stored in `form` table)

```json
{
  "id": "agent_pos",
  "model": "gpt-4o-mini",
  "system_prompt": "You are a POS assistant. Detect user intent and pick the right workflow.",
  "workflows": ["wf_record_sale", "wf_start_shift"],
  "temperature": 0.1,
  "max_tokens": 500
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `model` | string | LLM model to use |
| `system_prompt` | string | Agent behavior instructions |
| `workflows` | array | Allowed workflows this agent can pick |
| `temperature` | number | Response randomness (0-1) |
| `max_tokens` | number | Max response length |

### Agent Decision Flow

```
User/Agent input
       │
       ▼
┌──────────────┐
│ Intent detect │  "record_sale"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ RBAC check   │  user role in allowed_roles?
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Workflow load │  wf_record_sale
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Workflow run  │  conditional steps, parallel, error handling
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Reply/Channel │  "Sale recorded ✓" via Push/Email/WhatsApp
└──────────────┘
```

### AI Classification — Tiered Lookup

| Layer | What | Latency | Cost | Offline |
|-------|------|---------|------|---------|
| L1 | Local static dictionary | 0ms | $0 | Yes |
| L2 | Cloudflare AI Gateway cache | 50-150ms | Very low | No |
| L3 | LLM fallback | 1.5-3s | High | No |

**Flow:** User input → L1 match? → Yes: autofill. No → L2 cache hit? → Yes: autofill. No → L3 LLM → save to cache → autofill.

### Semantic Cache

| Query | Exact Match | Semantic Match |
|-------|-------------|----------------|
| "Pepperoni Pizza" | MISS | MISS (first) |
| "pepperoni pizza" | MISS | HIT (99%) |
| "Pizza with Pepperoni" | MISS | HIT (95%) |
| "Clasic Peperoni Pizza" | MISS | HIT (91%) |

**Threshold:** cosine similarity > 0.90 = cache hit. Saves ~73% LLM cost.

### Product Variants & Modifiers

| Concept | Table | How |
|---------|-------|-----|
| Categories/tags | `form.data` | `{"cat":"food", "tags":["beverage"]}` |
| Variants | `matter` rows | `variant=0` Small, `variant=1` Medium |
| Modifiers | `bond` links | `src=latte, tgt=espresso_shot, type='modifier_of'` |

---

## 7. Execution Flow

| Step | Action | Layer | Example |
|------|--------|-------|---------|
| 1 | User sends message | Channel | "Record 3 Pepsi sales" |
| 2 | Agent detects intent | Agent | Intent: `record_sale` |
| 3 | Agent loads workflow | Workflow | `wf_record_sale` |
| 4 | Workflow checks stock | Skill → Tool | `read matter WHERE item=pepsi` |
| 5 | Workflow branches | Workflow | if stock > 0, proceed; else alert |
| 6 | Workflow runs parallel | Workflow | deduct stock + create motion simultaneously |
| 7 | Workflow sends receipt | Skill → Tool | `create motion` (opcode 201) |
| 8 | Agent generates reply | Agent | "3 sales recorded ✓" |
| 9 | Reply sent via channel | Channel | Push notification + in-app |

---

## 8. Per Vertical — Skills, Workflows, Agents

| Vertical | Skills | Workflows | Agents | Channels |
|----------|--------|-----------|--------|----------|
| **CRM** | Create Lead, Log Visit, Create Ticket, Convert Lead | Lead conversion funnel, Ticket escalation | Birthday offer, Follow-up reminder | WhatsApp, Push, Email |
| **POS** | Start Shift, Record Sale, Fire to KDS, Close Till | End-of-day reconciliation, Stock alert | KDS display, Daily summary | In-app, Push |
| **E-Commerce** | Add Product, Create Order, Process Payment | Order fulfillment, Refund process | Payment webhook, Abandoned cart | Push, Email, WhatsApp |
| **Taxi** | Request Ride, Match Driver, Start Trip | Ride matching, Fare calculation | H3 geo finder, ETA calculator | Push, In-app |
| **HR** | Clock In, Request Leave, Generate Payroll | Payroll calculation, Leave approval | Payroll cron, Attendance alert | Push, Email |
| **Logistics** | Create Shipment, Assign Driver, Log Return | Route optimization, ETA tracking | ETA calculator, Delay alert | Push, Email, WhatsApp |
| **Marketing** | Send Push, Send SMS, Create Referral | Campaign scheduling, A/B testing | Campaign scheduler, Engagement tracker | Push, Email, WhatsApp |
| **Payments** | Record Payment, Record Expense | Budget tracking, Reconciliation | Budget alert, Monthly report | Push, Email |
| **Services** | Create Booking, Complete Booking | Slot management, Reminder chain | Slot reminder, No-show alert | Push, WhatsApp |

### Marketplace — Publish Flow

Discovery (read) and management (write) are separate:

| Flow | Where | How |
|------|-------|-----|
| Discovery | Global `memory` table (vector) | Vector search |
| Management | Merchant DO (`form`/`matter`/`motion`/`bond`) | Local-first |

**Publish Steps:**

| Step | Action |
|------|--------|
| 1 | Merchant creates local data (form + matter + bond) |
| 2 | Tap "Publish" → Worker receives |
| 3 | Worker checks: form in global? No → Insert. Yes → Update if newer |
| 4 | Upsert context (from matter) |
| 5 | Embed via Workers AI |
| 6 | Insert into memory (vector index) |
| 7 | Product discoverable via search |

### Storefront — Multi-Tenant

| Concept | Table | Detail |
|---------|-------|--------|
| Store profile | `form`/`matter` type=profile | `data.subdomain`, `data.theme` |
| Product catalog | `form` type=product | `data.price` |
| Stock & variants | `matter` type=variant/stock | `qty`, `value` |
| Product→store | `bond` | `type='published_to'` |
| Orders | `matter` type=order + `motion` | `value`=total |

**Subdomain routing:** `{store}.tarai.space` → KV cache (5min TTL) → Turso → DO (live stock)

---

## 9. Communication Channels

| Channel | Use For | Who Pays | Cost | Required? |
|---------|---------|----------|------|-----------|
| **In-app** | Real-time updates, internal chat | You | $0 | Yes |
| **Google Auth** | Owner/staff login | You | $0 | Yes |
| **Push (FCM/APNs)** | Alerts, order status, reminders | You | $0 | Yes |
| **Email** | Reports, invoices, marketing | You | $0 | Yes |
| **WhatsApp Support** | Customer queries, order status | Owner | Free (<1K/mo) | Optional |
| **WhatsApp Marketing** | Promotions, new arrivals | Owner | ₹0.90/conversation | Optional |
| **Telegram** | Alternative support channel | You | $0 | Optional |
| **SMS** | OTP fallback only | Owner | ₹0.15/message | Emergency only |

### Channel Decision Rule

| Question | Answer |
|----------|--------|
| Is user in app? | Use **in-app** |
| Is user on WhatsApp? | Use **WhatsApp** (if owner enables) |
| Need to reach offline? | Use **Push** |
| Need permanent record? | Use **Email** |
| Critical alert? | Use **Push + SMS** |

### WhatsApp Pricing

| Type | Trigger | Cost (India) |
|------|---------|-------------|
| **Service** | User messages first | Free (1K/mo), then ₹0.60 |
| **Marketing** | You message user (promos) | ₹0.90-1.50 |
| **Utility** | You message user (updates) | ₹0.30-0.50 |
| **Authentication** | OTP/verification | ₹0.30-0.50 |

---

## 10. Endpoints

| Endpoint | Platform | Purpose |
|----------|----------|---------|
| `/api/webhook/telegram` | Telegram | Receive/send messages |
| `/api/webhook/whatsapp` | WhatsApp | Receive/send messages |
| `/api/webhook/instagram` | Instagram DMs | Receive/send messages |
| `/api/chat` | Web/Mobile | Direct agent chat |
| `/api/skill/:id` | Any | Execute skill directly |
| `/api/workflow/:id` | Any | Execute workflow directly |
| `/api/search` | Any | Vector search |

---

## 11. Implementation Order

| Step | What | Layer | Effort | Depends On |
|------|------|-------|--------|------------|
| 1 | Refactor executor to 6-tool runner | Tools | Medium | — |
| 2 | Add JSON schema validation | Skills | Small | Step 1 |
| 3 | Migrate 8 built-in skills to JSON | Skills | Small | Step 2 |
| 4 | Add workflow engine (conditional, parallel, error) | Workflows | Large | Step 3 |
| 5 | Add skill creation UI (manual) | Skills | Medium | Step 3 |
| 6 | Add AI skill/workflow generator | Workflows | Medium | Step 4 |
| 7 | Build platform adapters (Telegram, WhatsApp) | Channels | Medium | Step 1 |
| 8 | Add `/api/chat` endpoint | Agents | Small | Step 4 |
| 9 | Add scheduled agent (cron via DO Alarm) | Agents | Small | Step 8 |
| 10 | Add event-driven agents | Agents | Medium | Step 9 |
| 11 | Add group linking for WhatsApp | Channels | Medium | Step 7 |

---

## 12. Cost Summary

| Component | Cost |
|-----------|------|
| Cloudflare Workers | $5/mo base |
| Durable Objects | ~$0 (hibernation) |
| WhatsApp Business API | Free (<1K conversations/mo) |
| Telegram Bot | Free |
| Push notifications (FCM/APNs) | Free |
| Email (100/day free tier) | Free |
| Vector search (on-device) | Free |
| **Total (no WhatsApp)** | **~$5/mo** |
| **Total (with WhatsApp support)** | **~$5/mo (free under 1K)** |
| **Total (with WhatsApp marketing)** | **~$5/mo + ₹0.90/conversation** |

### DO SQLite vs Turso (100k scopes)

| Component | Turso Scale | DO SQLite | Savings |
|-----------|------------|-----------|---------|
| Base plan | $29 | $5 | — |
| Worker requests | included | $12 | — |
| Sync egress | $2,394 | **$0** | 100% |
| SQLite storage | $88 | $40 | 55% |
| SQL rows r/w | included | $80 | — |
| KV I/O | included | $160 | — |
| **Total** | **$2,514** | **$62** | **97%** |

### Monthly P&L (100k Users)

| Category | USD | Margin |
|----------|-----|--------|
| Gross revenue | $634,730 | 100% |
| DB sync (DO) | $295 | 0.05% |
| Hosting | $50 | 0.01% |
| AI LLM queries | $11,976 | 1.89% |
| **Total expenses** | **$12,321** | **1.94%** |
| **Net profit** | **$622,409** | **98.06%** |

### AI Capacity (₹10L/mo pooled)

| Model | Cost/query | Monthly Capacity |
|-------|-----------|-----------------|
| DeepSeek-V3 | $0.000196 | ~61M queries |
| Gemini 2.0 Flash | $0.000180 | ~66.5M queries |

100k users → 610-660 queries/user/mo (~20/day).

---

## 13. Summary

| Concept | One Line |
|---------|----------|
| **6 Tools** | `create`, `read`, `update`, `delete`, `link`, `search` |
| **5 Tables** | form + matter + motion + bond + memory |
| **Skills** | JSON step sequences using the 6 tools |
| **Workflows** | Orchestration: branches, parallel, error handling |
| **Agents** | AI loops that pick and run workflows |
| **Channels** | In-app + Push + Email = free. WhatsApp = owner's choice |
| **Auth** | Google Auth (no OTP needed) |
| **Creation** | Manual, AI, template, import — all produce JSON |
| **Cost** | ~$5/mo on Cloudflare Workers |

---

**6 tools write 5 tables. Skills chain tools. Workflows orchestrate skills. Agents pick workflows. Channels reach customers. JSON is everything.**
