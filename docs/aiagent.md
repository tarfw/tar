# AI Agent & Tool Architecture

## 1. Core Architecture (Tools, Flows, & Primitives)

```
┌──────────────────────────────────────────────────────────┐
│                    1. USER INTERFACE                     │
│    (User enters inputs manually OR writes in Chat)       │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                2. MCP CLIENT (THE AGENT)                 │
│                                                          │
│  [CONTEXT] (Session/device state: user_id, location)     │
│  [PROMPTS] (Procedural Memory: Reusable templates)       │
│  [SHORT-TERM MEMORY] (Active chat message history)       │
└────────────────────────────┬─────────────────────────────┘
                             │ (Sends schemas & executions)
                             ▼
┌──────────────────────────────────────────────────────────┐
│         3. MCP SERVER (PROVIDES ACTIONS & DATA)          │
│                                                          │
│  [TOOLS] (Active Actions)                                │
│  - A. FLOWS (Step sequences / Workflows)                 │
│  - B. TOOLS (Single action handlers: SQL, APIs)          │
│  - C. SUB-AGENTS (Task-specific child agents: DO/Worker) │
│  - D. MEMORY WRITER (Saves facts to Long-Term Memory)    │
│                                                          │
│  [RESOURCES] (Read-only Data)                            │
│  - SQLite queries, local files, and                      │
│  - [LONG-TERM MEMORIES] (Persistent factual memory)      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    4. EXECUTION LAYER                    │
│    - Writes data into Local SQLite (e.g. workspace DB)   │
│    - Calls external APIs/APIs to sync to the Cloud       │
└──────────────────────────────────────────────────────────┘
```

### MCP Core Primitives & Memory Mapping

| Primitive        | Description                          | Application & Memory Mapping                                                           |
| :--------------- | :----------------------------------- | :------------------------------------------------------------------------------------- |
| 🛠️ **Tools**     | Active actions the model can invoke. | **Action Handlers** (SQL writes, API requests, **Saving new long-term memories**).     |
| 📄 **Resources** | Read-only pieces of data or state.   | **Database Queries** (Reading SQLite tables, files, **Querying long-term memories**).  |
| 📝 **Prompts**   | Reusable templates for tasks.        | **System Prompt Presets** (Task instructions / **Procedural memory**).                 |
| 🧠 **Context**   | Useful external information.         | **Session/Device State** (Active user ID, active screen, **Short-term chat history**). |

### `tar` Architecture & Execution Flow (Client + Server + Webhook)

```
┌──────────────────────────────────────────────────────────┐
│                  CLIENT (MOBILE PHONE)                   │
│                                                          │
│   ┌──────────────────┐            ┌───────────────────┐  │
│   │    Chat / LLM    │            │     Manual UI     │  │
│   │   (MCP Client)   │            │   (Auto-Forms)    │  │
│   └────────┬─────────┘            └─────────┬─────────┘  │
│            │ (Queries / Runs)               │            │
│            ▼                                ▼            │
│   ┌───────────────────────────────────────────────────┐  │
│   │                 LOCAL MCP SERVER                  │  │
│   │      - Exposes Local Actions & SQLite Data        │  │
│   └────────────────────────┬──────────────────────────┘  │
│                            │ (Read/Write)                │
│                            ▼                             │
│                   ┌─────────────────┐                    │
│                   │  Local SQLite   │                    │
│                   └────────┬────────┘                    │
└────────────────────────────┼─────────────────────────────┘
                             │
                             │ (WebSocket / DO Sync Protocol)
                             ▼
┌──────────────────────────────────────────────────────────┐  ┌──────────────────┐
│          SERVER (TARWORKER / CLOUDFLARE WORKERS)         │  │ Telegram/Discord │
│                                                          │  │   User Client    │
│   ┌───────────────┐        ┌─────────────────┐           │  └────────┬─────────┘
│   │ Webhook Route │ ◄──────┼─────────────────┼───────────┼───────────┘ (HTTP POST)
│   └───────┬───────┘        │  Workspace DO   │           │
│           │                │  (Workspace DB) │ ◄─────────┼── (Updates State)
│           └──────────────> └────────┬────────┘           │
│                                     │ (Spawns / Triggers)│
│                                     ▼                    │
│            ┌──────────────────────────────────┐          │
│            │         CLOUD MCP SERVER         │          │
│            ├──────────────┬──────────────┬────┤          │
│            │  A. FLOWS    │  B. TOOLS    │ C. │          │
│            └──────────────┴──────────────┴────┘          │
└──────────────────────────────────────────────────────────┘
```

| Server Type | Location                | Accesses                           | Best For                       |
| :---------- | :---------------------- | :--------------------------------- | :----------------------------- |
| **Local**   | On-Device (In-Process)  | Local SQLite (Workspace DB)        | Offline-first, fast operations |
| **Cloud**   | Remote Server           | Third-party APIs, global DBs       | Heavy compute, integrations    |
| **Hybrid**  | Client connects to both | Local + Remote APIs simultaneously | Complete assistant tasks       |

---

## 2. Terminology Mapping

| Layer         | Term               | Description                                         | Example               |
| :------------ | :----------------- | :-------------------------------------------------- | :-------------------- |
| **UI**        | **Action**         | Visual forms representing tools.                    | _"Browse Actions"_    |
| **Code & DB** | **Action Schema**  | The JSON Schema defining fields and DB mappings.    | `ActionDef` interface |
| **LLM**       | **Tool**           | Standardized function signatures passed to the AI.  | `getToolsForLLM()`    |
| **Execution** | **Action Handler** | Function that runs the inputs and writes to the DB. | `executeAction()`     |

## 3. Decoupled UI & Execution Architecture

Actions decouple the presentation layer from the execution handler. Triggering an action goes through a three-tier pipeline:

```
┌──────────────────────────────────────────────────────────┐
│                   1. UI PRESENTATION                     │
│  (Static Components / Dynamic Layouts / Generated UIs)   │
└────────────────────────────┬─────────────────────────────┘
                             │ (renders)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   2. INPUT INTERACTION                   │
│      (Form Controls / Expo UI Elements / Text / Voice)   │
└────────────────────────────┬─────────────────────────────┘
                             │ (submits inputs to)
                             ▼
┌──────────────────────────────────────────────────────────┐
│            3. EXECUTION TIER (MCP CLIENT/SERVER)         │
│                                                          │
│  A. TOOL      ──► MCP Tool Call (tools/call)             │
│  B. WORKFLOW  ──► Chained sequential MCP Tool Calls      │
│  C. AGENT     ──► MCP Client Orchestration Session       │
└──────────────────────────────────────────────────────────┘
```

### The Three-Tier Architecture

#### 1. UI Presentation

- **Static UI:** Standard pre-built screens or structured forms.
- **Dynamic UI:** Interface adapts conditionally based on user options or state.
- **Generated UI:** Dynamic screens rendered on-the-fly from JSON Schema or AI-generated specifications.

#### 2. Input Interaction

- **Structured Inputs:** Text boxes, dropdowns, switches, dates (Expo UI elements).
- **Conversational Inputs:** Open-ended natural language text fields / chat.
- **Voice Inputs:** Audio speech-to-text inputs.

#### 3. Execution Tier (MCP Mapping)

- **Tool:** A single functional block (e.g., SQLite query, HTTP request). _Maps directly to an **MCP Tool** (`tools/call`)_.
- **Workflow (Flow):** A deterministic, chained sequence of tools (e.g., Task A $\rightarrow$ Task B $\rightarrow$ Task C). _Executed as a sequential pipeline of **MCP Tool Calls**._
- **Agent:** An LLM-orchestrated executor that uses planning, memory, and tool-calling to solve open-ended tasks dynamically. _Acts as an **MCP Client** session that dynamically queries **MCP Resources** and invokes **MCP Tools**._

---

## 4. Action Lifecycle & Customization

| Action        | Execution Flow                         | Storage & Sync Mechanism                                                               |
| :------------ | :------------------------------------- | :------------------------------------------------------------------------------------- |
| **Create**    | User edits UI Action Schema.           | Inserts into local SQLite DB $\rightarrow$ WebSocket push to Workspace DO.             |
| **Import**    | User clones a shared public action.    | Downloads schema JSON $\rightarrow$ Local SQLite $\rightarrow$ Synced to Workspace DO. |
| **Update**    | User edits an action configuration.    | SQLite `UPDATE` locally $\rightarrow$ WebSocket push to Workspace DO.                  |
| **Delete**    | User removes an action.                | Soft delete (`active = 0`) locally $\rightarrow$ WebSocket push to Workspace DO.       |
| **Customize** | User overrides a built-in seed action. | **Copy-on-Write:** Clones built-in config to local SQLite as custom override.          |

---

## 5. Security & Scoping

| Scope          | Visibility                                                 | SQLite Selection Query                           |
| :------------- | :--------------------------------------------------------- | :----------------------------------------------- |
| **`team`**     | Shared across workspace devices (via WebSocket DO Sync).   | `SELECT * FROM action WHERE scope = 'team'`      |
| **`personal`** | Kept private to the creator's user ID on the local device. | `... OR (scope = 'personal' AND creator_id = ?)` |

---

## 6. Sub-Agent Execution (DO Hibernation)

```
[Workspace DO (Parent)] ──(Spawns on-demand)──> [Sub-Agent DO (Child: DO/Worker)]
                                                      │
                                                      ▼ (Runs task / writes to SQLite)
[Hibernate (0 cost)]    ◄──(Erase active memory)──────┘
```

| Step            | Entity       | Execution Details                                            |
| :-------------- | :----------- | :----------------------------------------------------------- |
| **1. Spawn**    | Workspace DO | Spawns a stateless, task-specific child instance.            |
| **2. Execute**  | Sub-Agent    | Reads/writes DB and runs isolated processing logic.          |
| **3. Shutdown** | Sub-Agent    | Erases active memory, saves state to SQLite, and hibernates. |
