# TAR — Final Unified System

---

## One System

**3 Entities → 5 Tables → 6 Tools → 16 Contexts → ~133 Actions → ~60 Flows → ~50 Agents → 2 MCP Servers**

---

## 1. The3 Entities

| Entity | Scope | DO Type | Identity | What It Holds |
|--------|-------|---------|----------|---------------|
| **People** | `p:{id}` | Personal DB (Local SQLite) | Google `sub` / UUID | All humans: users, customers, employees, drivers, vendors, contacts, leads, suppliers |
| **Workspace** | `t:{id}` | Workspace DO (Cloud) | Workspace ID | Internal work: HR, Project, Logistics, Pages, Invoices, Expenses, Marketing |
| **Store** | `s:{id}` | Storefront DO (Cloud) | Store ID | Business & customer: CRM, Food, POS, E-Commerce, Services, Taxi, Quotes, Marketplace, Payments |

---

### 16 Contexts Mapped to Entities

| # | Context | Entity | Scope | Examples |
|---|---------|--------|-------|----------|
| 1 | **CRM** | Store | `s:` | Leads, tickets, contacts |
| 2 | **E-Commerce** | Store | `s:` | Products, carts, checkout, fulfillment |
| 3 | **Food** | Store | `s:` | Orders, kitchen, delivery |
| 4 | **POS** | Store | `s:` | Sales, tokens, shifts, cash close |
| 5 | **Services** | Store | `s:` | Bookings, slots, appointments |
| 6 | **Taxi** | Store | `s:` | Rides, drivers, dispatch |
| 7 | **Quotes** | Store | `s:` | Sales quotes, proposals |
| 8 | **Marketplace** | Store | `s:` | Vendors, commissions, discovery |
| 9 | **Payments** | Store + Workspace | `s:` / `t:` | Customer pay, settlements, reconciliation |
| 10 | **HR** | Workspace | `t:` | Attendance, leave, payroll, tasks |
| 11 | **Project** | Workspace | `t:` | Projects, sprints, issues |
| 12 | **Logistics** | Workspace | `t:` | Shipments, transfers, returns |
| 13 | **Pages** | Workspace | `t:` | Docs, wiki, notes, folders |
| 14 | **Invoices** | Workspace | `t:` | Billing, reminders, recurring |
| 15 | **Expenses** | Workspace | `t:` | Reimbursements, receipts, approval |
| 16 | **Marketing** | Workspace | `t:` | Campaigns, coupons, referrals, A/B |

---

## 2. The 5 Tables (Universal Schema)

All 3 entities use the same 5 tables. Personal data uses them locally; Workspace and Store use them in the cloud DO.

```sql
-- Blueprints, schemas, templates, profiles
CREATE TABLE IF NOT EXISTS form (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    type TEXT NOT NULL,       -- 'person', 'product', 'project', 'page', 'campaign'...
    scope TEXT NOT NULL,      -- 'p:', 't:', 's:'
 owner TEXT,
    title TEXT,
    public INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Instances, state, inventory, records
CREATE TABLE IF NOT EXISTS matter (
    id TEXT PRIMARY KEY,
    form TEXT NOT NULL,
    type TEXT NOT NULL,       -- 'person', 'contact', 'order', 'issue', 'expense'...
    scope TEXT NOT NULL,      -- 'p:{sub}', 't:{id}', 's:{id}'
    qty REAL,
    value REAL,
    active INTEGER DEFAULT 1,
    variant INTEGER,
    mark INTEGER DEFAULT 0,
    geo TEXT,
    start TEXT,
    end TEXT,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Events, history, transitions (append-only log)
CREATE TABLE IF NOT EXISTS motion (
    stream TEXT NOT NULL,     -- matter.id or form.id
    seq INTEGER NOT NULL,
    action INTEGER NOT NULL,  -- opcode
    phase INTEGER, -- for phase transitions
    delta REAL,               -- for qty/value changes
    client_ref TEXT,
    data TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stream, seq)
);

-- Relationships, edges, ownership, assignments
CREATE TABLE IF NOT EXISTS graph (
    src TEXT NOT NULL,
    tgt TEXT NOT NULL,
    type TEXT NOT NULL,       -- 'member_of', 'customer_of', 'assigned_to', 'owns_contact'
    weight REAL DEFAULT 1.0,
    active INTEGER DEFAULT 1,
    time TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (src, tgt, type)
);

-- Semantic search, embeddings
CREATE TABLE IF NOT EXISTS memory (
    form TEXT NOT NULL,
    chunk INTEGER NOT NULL DEFAULT 0,
    vector BLOB,
    embedding BLOB,
    PRIMARY KEY (form, chunk)
);
```

---

## 3. The 6 Tools (Primitives)

| # | Tool | Operation | Tables | Atomic |
|---|------|-----------|--------|--------|
| 1 | **`create`** | INSERT | `form`, `matter`, `motion`, `memory` | ✅ |
| 2 | **`read`** | SELECT | `form`, `matter`, `motion`, `graph`, `memory` | ✅ |
| 3 | **`update`** | UPDATE | `form`, `matter`, `graph` (soft toggle) | ✅ |
| 4 | **`delete`** | Soft (`active = 0`) | `form`, `matter`, `graph` | ✅ |
| 5 | **`link`** | UPSERT `graph` | `graph` (relations) | ✅ |
| 6 | **`search`** | Vector + FTS | `memory`, `matter`, `form` | ✅ |

---

## 4. MCP Architecture

### Server Topology

| Server | Location | Data Access | Protocol |
|--------|----------|-------------|----------|
| **Local MCP** | Mobile / Desktop | Personal SQLite (`p:`) | In-process |
| **Cloud MCP** | Cloudflare Workers | Workspace DO (`t:`), Storefront DO (`s:`) | WebSocket / HTTP |

### Primitive Mapping

| MCP Primitive | TAR Mapping | Count |
|---------------|-------------|-------|
| 🛠️ **Tools** | **Actions** (Action Handlers) | ~133 |
| 📄 **Resources** | SQLite queries, KV reads, memory reads | 5 tables + KV |
| 📝 **Prompts** | Agent system prompts | ~50 |
| 🧠 **Context** | Session state: `user_id`, `scope`, `active_entity` | Per request |

### Execution Tier

```
User Input (Chat / UI)
 │
       ▼
┌─────────────────────────────────────┐
│ MCP Client (LLM / Auto-Form)        │
│ - Injects Context │
│ - Selects Prompt                    │
│ - Calls Tools (Actions)             │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
Local MCP Cloud MCP
(p: SQLite)   (t:/s: DO)
    │             │
    ▼             ▼ SQLite Durable Object
```

---

## 5. People — Universal Human Entity

### Two Sub-Types

| Sub-type | Identity | Storage | Auth |
|----------|----------|---------|------|
| **Person** (Authenticated) | Google `sub` | Local SQLite + Cloud graph | ✅ Google OAuth |
| **Contact** (Business Card) | UUID | Cloud `matter` + `graph` | ❌ None (created by Person) |

### Auth Flow

```
Google OAuth │
     ▼
┌─────────────────┐
│ matter:         │
│   type='person'   │
│   id = Google sub │
│   scope = p:{sub}│
│   data={email,name,photo}│
└────────┬────────┘ │
         ▼
┌─────────────────────────────┐
│ graph:                      │
│   src=p:{sub} → tgt=t:{id}  │ type='member_of'
│   src=p:{sub} → tgt=s:{id}  │ type='customer_of'
│   src=p:{sub} → tgt=s:{id}  │ type='works_for'
└─────────────────────────────┘
```

### Personal Data (Local SQLite only)

Stored as `matter` with `scope = p:{sub}`:

| `matter.type` | Meaning |
|---------------|---------|
| `cart` | Shopping cart items |
| `wishlist` | Saved items |
| `draft` | Unfinished orders/notes |
| `personal_task` | Private to-do |
| `personal_note` | Private notes |
| `bookmark` | Saved links |
| `history` | Local event log |
| `sync_queue` | Offline sync buffer |

### Contact Card Model (Cloud)

| Field | Source |
|-------|--------|
| `id` | UUID |
| `type` | `contact` |
| `scope` | `s:{store}` or `t:{workspace}` |
| `data` | `{name, email, phone, company, tags, source, owner_id}` |
| `graph` | `src=p:{owner} tgt=p:{contact} type='owns_contact'` |

---

## 6. Actions InventoryGrouped by Entity. Total: **133 Actions**

### People Actions (20)

| Category | Actions |
|----------|---------|
| **Auth** | `act_sign_in`, `act_sign_out`, `act_update_profile` |
| **Personal** | `act_add_to_cart`, `act_remove_from_cart`, `act_add_wishlist`, `act_remove_wishlist`, `act_create_draft`, `act_delete_draft`, `act_personal_task`, `act_personal_note`, `act_personal_bookmark`, `act_personal_history` |
| **Contacts** | `act_create_contact`, `act_update_contact`, `act_archive_contact`, `act_tag_contact`, `act_log_interaction`, `act_assign_contact`, `act_convert_lead`, `act_merge_contacts` |
| **Membership** | `act_invite_member`, `act_accept_invite`, `act_leave_workspace` |

### Workspace Actions (55)

| Context | Actions |
|---------|---------|
| **HR** (9) | `act_clock_in`, `act_clock_out`, `act_request_leave`, `act_approve_leave`, `act_reject_leave`, `act_perf_note`, `act_generate_payroll`, `act_assign_task`, `act_complete_task` |
| **Project** (8) | `act_create_project`, `act_create_sprint`, `act_create_issue`, `act_assign_issue`, `act_start_issue`, `act_comment_issue`, `act_done_issue`, `act_archive_issue` |
| **Logistics** (9) | `act_transfer_in`, `act_transfer_out`, `act_create_shipment`, `act_assign_driver_log`, `act_eta_update`, `act_delivery_attempt`, `act_deliver_shipment`, `act_init_return`, `act_receive_return` |
| **Pages** (7) | `act_create_page`, `act_edit_page`, `act_archive_page`, `act_share_page`, `act_comment_page`, `act_search_pages`, `act_create_folder` |
| **Invoices** (7) | `act_create_invoice`, `act_send_invoice`, `act_pay_invoice`, `act_overdue_invoice`, `act_cancel_invoice`, `act_recurring_invoice`, `act_link_invoice_order` |
| **Expenses** (7) | `act_log_expense`, `act_categorize_expense`, `act_approve_expense`, `act_reject_expense`, `act_reimburse`, `act_recurring_expense`, `act_attach_receipt` |
| **Marketing** (10) | `act_create_campaign`, `act_send_push`, `act_send_email`, `act_send_sms`, `act_send_whatsapp`, `act_create_coupon`, `act_apply_coupon`, `act_create_referral`, `act_track_engagement`, `act_ab_test` |
| **Payments (Internal)** (8) | `act_create_payment`, `act_process_payment`, `act_init_refund`, `act_complete_refund`, `act_record_settlement`, `act_reconcile`, `act_track_dispute`, `act_payout` |

### Store Actions (58)

| Context | Actions |
|---------|---------|
| **CRM** (8) | `act_create_lead`, `act_log_visit`, `act_review_lead`, `act_convert_lead`, `act_create_ticket`, `act_reply_ticket`, `act_resolve_ticket`, `act_bday_offer` |
| **Food** (8) | `act_add_to_cart_food`, `act_checkout_food`, `act_confirm_food`, `act_kitchen_prep`, `act_decrement_stock`, `act_assign_driver_food`, `act_deliver_food`, `act_refund_food` |
| **POS** (10) | `act_start_shift`, `act_break`, `act_end_shift`, `act_cash_close`, `act_record_sale`, `act_fire_kitchen`, `act_kitchen_prep_pos`, `act_token_called`, `act_token_served`, `act_create_token` |
| **Services** (7) | `act_create_service`, `act_create_slot`, `act_book_slot`, `act_start_service`, `act_complete_service`, `act_cancel_booking`, `act_view_slots` |
| **Taxi** (8) | `act_request_ride`, `act_match_driver`, `act_dispatch_ride`, `act_arrived_pickup`, `act_start_trip`, `act_end_trip`, `act_rate_ride`, `act_find_drivers` |
| **Quotes** (9) | `act_create_quote`, `act_send_quote`, `act_view_quote`, `act_accept_quote`, `act_reject_quote`, `act_negotiate_quote`, `act_revise_quote`, `act_expire_quote`, `act_convert_quote_order` |
| **E-Commerce** (10) | `act_add_product`, `act_update_product`, `act_ec_checkout`, `act_ec_fulfill`, `act_ec_track`, `act_ec_refund`, `act_ec_review`, `act_ec_wishlist`, `act_ec_payment`, `act_ec_abandon_cart` |
| **Marketplace** (8) | `act_onboard_vendor`, `act_publish_product`, `act_discover_products`, `act_route_order`, `act_track_commission`, `act_vendor_payout`, `act_marketplace_review`, `act_vendor_analytics` |

---

## 7. Flows Inventory (~60)

| Entity | Flow Pattern | Examples |
|--------|------------|----------|
| **People** (6) | `wf_sign_in`, `wf_personal_sync`, `wf_lead_to_customer`, `wf_contact_merge`, `wf_invite_member`, `wf_interaction_log` |
| **Workspace** (28) | `wf_hr_cycle`, `wf_project_lifecycle`, `wf_logistics_route`, `wf_page_workflow`, `wf_invoice_billing`, `wf_expense_approval`, `wf_campaign_send`, `wf_payment_lifecycle`, `wf_daily_reconcile` |
| **Store** (26) | `wf_crm_funnel`, `wf_food_order`, `wf_taxi_lifecycle`, `wf_booking_lifecycle`, `wf_pos_sale`, `wf_quote_funnel`, `wf_ec_order`, `wf_marketplace_order`, `wf_cart_abandon` |

---

## 8. Agents Inventory (~50)

| Type | Count | Examples |
|------|-------|----------|
| **Personal** | 4 | `agent_personal_assistant`, `agent_personal_habit`, `agent_personal_sync`, `agent_invite_router` |
| **CRM/Contact** | 4 | `agent_crm_lead`, `agent_crm_followup`, `agent_crm_birthday`, `agent_contact_merge` |
| **Workspace Ops** | 20 | `agent_hr_payroll`, `agent_project_triage`, `agent_logistics_eta`, `agent_page_search`, `agent_invoice_reminder`, `agent_expense_approval`, `agent_marketing_scheduler`, `agent_payment_reconcile` |
| **Store Ops** | 22 | `agent_food_order`, `agent_taxi_matcher`, `agent_booking_assistant`, `agent_pos_cashier`, `agent_quote_creator`, `agent_ec_webhook`, `agent_marketplace_discover` |

---

## 9. Sub-Agent DOs (6)

| # | Sub-Agent | Trigger | Lifecycle |
|---|-----------|---------|-----------|
| 1 | **Search DO** | Vector query | Spawn → search memory → return → hibernate |
| 2 | **Worker DO** | Background job | Spawn → process queue → save → hibernate |
| 3 | **DriverSearch DO** | Taxi request | Spawn → geo-query → match → hibernate |
| 4 | **Kitchen DO** | Order fire | Spawn → prep timer → notify → hibernate |
| 5 | **PaymentWebhook DO** | Stripe/Razorpay | Spawn → verify → write motion → hibernate |
| 6 | **CampaignSend DO** | Bulk push/email | Spawn → batch → send → track → hibernate |

---

## 10. Opcode Map (Unified)

| Block | Range | Contexts | Opcodes |
|-------|-------|----------|---------|
| **Stock & Sales** | 100–199 | Store (Food, POS, E-Commerce, Marketplace) | `101` decrement, `102` add cart, `103` wishlist, `104` checkout, `105` confirm, `106` prep, `107` serve, `108` refund, `109` fulfill, `110` commission |
| **Service & Transport** | 200–299 | Store (POS, Services, Taxi) | `201` sale, `202` start service, `203` break, `204` shift start, `205` shift end, `206` token call, `207` token serve, `208` fire kitchen, `209` abandon, `210` cash close |
| **CRM & Project** | 300–399 | Store (CRM) + Workspace (Project) | `301` lead create, `302` review, `303` convert, `304` ticket create, `305` reply, `306` resolve, `307` project create, `308` sprint create, `309` issue assign |
| **Logistics & Pages** | 400–499 | Workspace (Logistics, Pages) | `401` create shipment, `402` assign driver, `403` eta, `404` deliver, `405` transfer out, `406` transfer in, `407` return init, `408` return receive, `409` page create, `410` page edit |
| **HR & Invoices** | 500–599 | Workspace (HR, Invoices) | `501` clock in, `502` clock out, `503` leave request, `504` leave approve, `505` leave reject, `506` payroll gen, `507` invoice create, `508` invoice send, `509` invoice pay, `510` invoice overdue |
| **Expenses** | 600–699 | Workspace | `601` log expense, `602` approve, `603` reject, `604` reimburse, `605` attach receipt |
| **Bookings & Quotes** | 700–799 | Store (Services, Quotes) | `701` book slot, `702` start booking, `703` cancel booking, `704` quote send, `705` quote view, `706` quote accept, `707` quote reject, `708` quote negotiate, `709` quote expire |
| **Payments** | 800–899 | Store + Workspace | `801` init payment, `802` confirm payment, `803` refund init, `804` refund complete, `805` settlement, `806` dispute open, `807` dispute resolve, `808` payout |
| **Marketing & Comms** | 900–999 | Workspace + Store | `901` push, `902` email, `903` sms, `904` whatsapp, `905` engagement, `906` campaign create, `907` coupon create, `908` referral create |

---

## 11. Unified Action Execution Pattern

Every Action follows the same 3-tier pipeline:

```
┌─────────────────────────────┐
│ Tier 1: UI Presentation     │
│ (Static / Dynamic / JSON UI)│
└─────────────┬───────────────┘
              │
┌─────────────┴───────────────┐
│ Tier 2: Input Interaction   │
│ (Form / Chat / Voice)       │
└─────────────┬───────────────┘
              │
┌─────────────┴───────────────┐
│ Tier 3: Execution (MCP)     │
│                             │
│  Action → Tool(s) → SQL/API │
│                             │
│  A. Single Tool (create)  │
│  B. Flow          (chained) │
│  C. Agent (LLM loop)│
└─────────────────────────────┘
```

---

## 12. Security & Scoping

| Scope | Visibility | Query Pattern |
|-------|------------|---------------|
| `p:{sub}` | Personal only | `WHERE scope = 'p:{sub}'` (local) |
| `t:{id}` | Workspace members | `WHERE scope = 't:{id}'` AND graph check |
| `s:{id}` | Store staff + customers | `WHERE scope = 's:{id}'` AND role check |
| `public` | Read-only shared | `WHERE public = 1` |

---

## 13. Final Counts

| Component | Count | Notes |
|-----------|-------|-------|
| **Root Entities** | 3 | People, Workspace, Store |
| **Contexts** | 16 | Former "verticals" |
| **Core Tables** | 5 | form, matter, motion, graph, memory |
| **Local Tables** | 5 + extended | Personal cart, wishlist, draft, task, note stored as `matter` with `scope=p:` |
| **Tool Primitives** | 6 | create, read, update, delete, link, search |
| **MCP Servers** | 2 | Local + Cloud |
| **Actions** | ~133 | Grouped by entity |
| **Flows** | ~60 | Reusable DAGs |
| **Agents** | ~50 | Message / Scheduled / Event / Webhook |
| **Sub-Agent DOs** | 6 | Stateless hibernating workers |
| **Opcodes** | ~58 | 100–999 blocks |
| **DO Types** | 3 | Personal DB, Workspace DO, Storefront DO |

---

## The Unified Rule

> **One person. One identity. One schema. One system.**

- **People** = Google ID. Every human. Every contact.
- **Workspace** = Internal work. Every team function.
- **Store** = External business. Every customer transaction.

**Everything is `matter`. Everything is `motion`. Everything is linked by `graph`. Everything is found by `memory`.**

No compromise. Just context.
