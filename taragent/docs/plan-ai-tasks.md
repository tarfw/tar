# AI Tasks — Complete Implementation Plan

## Overview

Users interact with their workspace through **AI Tasks** — predefined business operations sourced from SKILL.md files on S3. Two execution paths:

- **App UI** (no LLM): User taps AI Task → fills params → submits → direct tool call
- **Channel/API** (LLM): WhatsApp/Telegram message → LLM picks AI Task from compact index → executor runs steps

## Terminology

| Term | What | Example |
|---|---|---|
| Module | Skill group (from SKILL.md) | Orders, Inventory, CRM |
| AI Task | User-facing business operation | Create Order, Add Product |
| Step | Individual CRUD operation | create, read, update, link |
| Agent | LLM-powered handler (future) | WhatsApp channel handler |

### Hierarchy

```
Module: Orders
  └── AI Task: Create Order (3 steps)
        ├── Step 1: create(table='matter', type='order', ...)
        ├── Step 2: create(table='motion', type='order', ...)
        └── Step 3: read(product) → update(qty)

Module: Inventory
  ├── AI Task: Add Product (2 steps)
  └── AI Task: Check Low Stock (1 step)
```

---

## What Exists Now (Tier 1 & 2 — Done)

| Component | Status | Details |
|---|---|---|
| S3 integration | Done | `s3-client.ts` with V4 signing, no DOMParser |
| Vertical templates on S3 | Done | `verticals/restaurant/*.md` (8 files) |
| Workspace copies on S3 | Done | `workspaces/w-{subdomain}/*.md` (copied on create) |
| `GET /skills` reads from S3 | Done | `listWorkspaceModules()` + `readWorkspaceFile()` |
| `POST /tools/:name` endpoint | Done | `create`, `read`, `update`, `delete`, `link`, `search` |
| `tar.tool()` client API | Done | Calls `POST /tools/:name` |
| D1 `vertical` column | Done | Workspace stores its vertical type |
| Agent reads vertical from D1 | Done | No longer hardcoded to `restaurant` |

---

## Phase A — Parser + Endpoint (Server-Side)

### A1: SKILL.md Parser

**File:** `src/lib/skill-parser.ts` (new)

Parse SKILL.md markdown into structured data:

```typescript
interface ParsedSkill {
  name: string;
  version: string;
  tools: string[];
  actions: ParsedAction[];
}

interface ParsedAction {
  name: string;           // "action_create_order"
  purpose: string;        // "Create a new order for a customer"
  intents: string[];      // ["order", "sell", "record sale"]
  params: ParamDef[];     // extracted from {param} placeholders
  steps: ActionStep[];    // parsed tool calls
}

interface ParamDef {
  name: string;           // "customer"
  type: 'text' | 'number' | 'select';
  required: boolean;
}

interface ActionStep {
  tool: string;           // "create", "read", "update", "link"
  table: string;          // "matter", "motion"
  type?: string;          // "order", "product"
  params: Record<string, string>;
}
```

**Parsing logic:**
1. Split frontmatter (between `---` markers) → extract `name`, `version`, `tools`
2. Find `### action_*` sections → extract name, purpose, steps
3. Find `## Intent Matching` table → extract trigger words per action
4. Scan step lines for `{param}` placeholders → build param definitions

### A2: AI Tasks Endpoint

**File:** `src/app.ts` (modify)

```
GET /ai-tasks?scope=w:xxx
```

Response:
```json
{
  "module": "orders",
  "actions": [
    {
      "name": "action_create_order",
      "module": "orders",
      "purpose": "Create a new order for a customer",
      "intents": ["order", "sell", "record sale"],
      "params": [
        {"name": "customer", "type": "text", "required": true},
        {"name": "items", "type": "text", "required": true},
        {"name": "total", "type": "number", "required": true},
        {"name": "payment_method", "type": "text", "required": false}
      ],
      "steps": 3
    }
  ]
}
```

**Logic:**
1. Read all `{module}.md` files from workspace S3
2. Parse each with `skill-parser.ts`
3. Merge all actions into single list
4. Cache in KV (5min TTL)
5. Return structured JSON

### A3: Compact Index for LLM

**File:** `src/lib/skill-parser.ts` (add function)

Generate compact action index for LLM system prompt:

```
ACTIONS (name → purpose, triggers):
- action_create_order → Create order. Triggers: order, sell, sale
- action_confirm_order → Confirm order. Triggers: confirm
- action_cancel_order → Cancel order, restore stock. Triggers: cancel
- action_add_product → Add product to inventory. Triggers: add product, new item
- action_check_low_stock → Find low stock. Triggers: low stock, running out
- action_create_lead → Add customer. Triggers: new customer, add lead
- action_follow_up → Schedule follow-up. Triggers: follow up, remind

OUTPUT: {"action":"action_name","params":{...}}
```

~300 tokens vs ~4500 for full SKILL.md. 14x cheaper per message.

---

## Phase B — App Client API + State (Client-Side)

### B1: Skills API Client

**File:** `src/lib/tar.ts` (modify)

Add:
```typescript
aiTasks: (scope: string) =>
  get('/ai-tasks', { scope }),
```

### B2: Fetch AI Tasks on Workspace Open

**File:** `src/app/workspace.tsx` (modify)

- On workspace open: call `tar.aiTasks(scope)`
- Store in state: `AITask[]`
- Group by module for category chips
- Cache in component state (refetch on focus)

### B3: Search Bar

**File:** `src/app/workspace.tsx` (modify)

- TextInput with placeholder "Search AI Tasks..."
- Filters tasks by name, purpose, and intents
- Real-time filter as user types
- Clear button when text present

---

## Phase C — UI Components (Client-Side)

### C1: AI Tasks Tab

**File:** `src/app/workspace.tsx` (modify)

Add "AI Tasks" tab alongside existing Storefront/Products/Info tabs.

Layout:
```
┌─────────────────────────────────┐
│ 🔍 Search AI Tasks...           │
├─────────────────────────────────┤
│ [All] [Orders] [Inventory] [CRM]│  ← module filter chips
├─────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ │
│ │ Create Order│ │ Confirm Order│ │  ← AI Task cards
│ │ Orders      │ │ Orders      │ │
│ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ Add Product │ │ Create Lead │ │
│ │ Inventory   │ │ CRM         │ │
│ └─────────────┘ └─────────────┘ │
└─────────────────────────────────┘
```

### C2: AI Task Card Component

**File:** `src/components/AITaskCard.tsx` (new)

Props: `{ name, module, purpose, stepCount, onPress }`

Design:
```
┌─────────────────────────────────┐
│ 🟦 Create Order                │
│ Orders · 3 steps               │
│                                 │
│ Create a new order for a        │
│ customer                        │
│                                 │
│ "order", "sell", "sale"         │
└─────────────────────────────────┘
```

- Module badge (colored pill)
- Step count indicator
- Intent keywords as tags
- Pressable → opens param form

### C3: AI Task Form Component

**File:** `src/components/AITaskForm.tsx` (new)

Props: `{ task: ParsedAction, scope, onSubmit, onCancel }`

Dynamic form built from task's `params` array:

```
┌─────────────────────────────────┐
│ ← Create Order                  │
│                                 │
│ Customer  [________________]    │
│ Items     [________________]    │
│ Total     [________________]    │
│ Payment   [________________]    │
│                                 │
│      [ Execute ]   [ Cancel ]   │
└─────────────────────────────────┘
```

- Text inputs for text params
- Numeric keyboard for number params
- Required fields marked
- Submit calls `tar.tool()` directly (no LLM)

### C4: Submit Handler

**File:** `src/app/workspace.tsx` (modify)

On submit:
1. Map form fields to tool params
2. Call `tar.tool(task.tool, { table, type, ...params, scope })`
3. Show success toast / error message
4. Refresh products list if relevant
5. Close form

---

## Phase D — LLM Path for Channels (Server-Side)

### D1: Rewrite Agent System Prompt

**File:** `src/app.ts` (modify)

Replace `BASE_SYSTEM_PROMPT` with compact action index:

```
You are a business assistant.

AVAILABLE AI TASKS:
- action_create_order → Create order. Triggers: order, sell, sale
- action_confirm_order → Confirm order. Triggers: confirm
- action_add_product → Add product. Triggers: add product, new item
- action_create_lead → Add customer. Triggers: new customer, add lead

RESPONSE FORMAT:
When user wants to DO something, respond with ONLY:
{"action":"action_name","params":{"key":"value"}}

For questions/greetings, respond with plain text.
If params are missing, ask a follow-up.
```

~300 tokens system prompt. 14x cheaper than full SKILL.md.

### D2: Action Executor

**File:** `src/lib/action-executor.ts` (new)

```typescript
async function executeAITask(
  env: any,
  actionName: string,
  params: Record<string, any>,
  scope: string
): Promise<AITaskResult>
```

Logic:
1. Load parsed SKILL.md from cache (or S3)
2. Find action by name
3. For each step in action definition:
   a. Substitute `{param}` placeholders with user params
   b. Call `executeCreate/Read/Update/Delete`
   c. Capture result (especially `{id}` from creates)
   d. Feed result into next step's params
4. Return final result + step history

### D3: Agent Route Rewrite

**File:** `src/app.ts` (modify agent route)

After LLM responds:
1. Parse action name from response
2. Look up action in parsed SKILL.md
3. Call action executor with params
4. Return result to user

---

## Phase E — Cleanup

### E1: Remove Hardcoded Skills

**File:** `src/lib/skills.ts` (delete or empty)

`RESTAURANT_SKILLS` and `SKILLS_BY_VERTICAL` no longer needed. All skills come from S3.

### E2: Remove Debug Endpoints

Clean up any `/debug/*` routes added during Tier 1-2.

---

## File Summary

| File | Action | Phase |
|---|---|---|
| `src/lib/skill-parser.ts` | **Create** | A |
| `src/lib/action-executor.ts` | **Create** | D |
| `src/lib/skill-cache.ts` | **Create** | A (optional) |
| `src/app.ts` | **Modify** | A, D |
| `src/lib/tar.ts` | **Modify** | B |
| `src/app/workspace.tsx` | **Modify** | B, C |
| `src/components/AITaskCard.tsx` | **Create** | C |
| `src/components/AITaskForm.tsx` | **Create** | C |
| `src/lib/skills.ts` | **Delete** | E |

---

## Execution Order

| Phase | Tasks | Depends On | Estimated |
|---|---|---|---|
| **A** | Parser + `/ai-tasks` endpoint | Tier 1-2 (done) | 2-3 hours |
| **B** | Client API + state + search | Phase A | 1-2 hours |
| **C** | Card + form + submit UI | Phase B | 3-4 hours |
| **D** | LLM prompt + executor | Phase A | 2-3 hours |
| **E** | Cleanup | Phase C, D | 30 min |
| **Total** | | | ~10-12 hours |

---

## Token Cost Comparison

| Path | System Prompt | Per Message | Monthly (1K msgs) |
|---|---|---|---|
| App UI (no LLM) | 0 | 0 | $0 |
| Channel (compact index) | ~300 tokens | ~320 | ~$0.10 |
| Channel (full SKILL.md) | ~4500 tokens | ~4500 | ~$1.35 |

---

## Design Reference

### AI Tasks Tab
```
┌─────────────────────────────────┐
│ 🔍 Search AI Tasks...           │
├─────────────────────────────────┤
│ [All] [Orders] [Inventory] [CRM]│
├─────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ │
│ │ 🟦 Create   │ │ 🟩 Confirm  │ │
│ │    Order    │ │    Order    │ │
│ │ Orders·3step│ │ Orders·2step│ │
│ │ order,sell  │ │ confirm     │ │
│ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ 🟨 Add      │ │ 🟪 Create   │ │
│ │   Product   │ │   Lead      │ │
│ │ Inventory·2 │ │ CRM·2step   │ │
│ │ add,new item│ │ new customer│ │
│ └─────────────┘ └─────────────┘ │
└─────────────────────────────────┘
```

### AI Task Form (on card tap)
```
┌─────────────────────────────────┐
│ ← Create Order                  │
│                                 │
│ Customer  [________________] *  │
│ Items     [________________] *  │
│ Total     [________________] *  │
│ Payment   [________________]    │
│                                 │
│      [ Execute ]   [ Cancel ]   │
└─────────────────────────────────┘
```

### Execution Flow (App UI)
```
User taps "Create Order" card
  → Form appears with fields
  → User fills: Customer="Ravi", Items="2 pepsi", Total="60"
  → Taps "Execute"
  → App calls tar.tool('create', {table:'matter', type:'order', ...})
  → Response: "Order #1042 created"
  → Toast shown, form closes
```

### Execution Flow (WhatsApp)
```
User sends: "order 2 pepsi for table 5"
  → LLM sees compact index (~300 tokens)
  → LLM responds: {"action":"action_create_order","params":{...}}
  → Executor loads action steps from SKILL.md
  → Step 1: create(order) → ID=1042
  → Step 2: create(motion) → tracking
  → Step 3: read(product) → update(qty)
  → Reply: "Order #1042 created: 2x Pepsi"
```
