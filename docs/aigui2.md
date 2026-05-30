# AI Autocomplete & High-Fidelity Slot-Filling Interface (Plan 2: aigui2)

This document defines the final design, UX specifications, and model initialization strategies for the **Interactive Inline Slot-Filling Autocomplete Omnibox** inside the Tar mobile application. 

It replicates a conversational booking flow where slots (e.g. `[from where]`, `[on date]`, `[blend]`, `[size]`) are rendered as inline interactive pills directly inside the input container, paired with floating context suggestions above the keyboard.

---

## 1. UX Design & Keyboard Interaction Flow

Instead of standard chips rendered outside the input box, slots are rendered **inline** alongside the user's typed text. The input area is a styled rounded capsule (glowing white or dark glassmorphism).

```
+-------------------------------------------------------------+
| [📈 Unified Workspace Feed - Pure White FlatList]           |
|                                                             |
|   (Scrollable list of Matter, Mass, Motion, Relation logs)   |
|                                                             |
+-------------------------------------------------------------+
|                                                             |
|   [ Floating Suggestion Card ]                              |
|   (Shows context-relevant options for the active pill slot) |
|   +-----------------------------------------------------+   |
|   | ☕ Light Roast           (Bright, high acidity)     |   |
|   | ☕ Medium Roast          (Smooth)                   |   |
|   | ☕ Major Dickason's      (Low acidity)              |   |
|   +-----------------------------------------------------+   |
|                                                             |
|   [🤖 Autocomplete Omnibox Capsule]                         |
|   +-----------------------------------------------------+   |
|   | Buy k cups Peet's  (blend)  (size)  (every month) ↑ |   |
|   +-----------------------------------------------------+   |
|     (Typed Text)     (Active Pill) (Inactive Pills)  (Run)  |
|                                                             |
+-------------------------------------------------------------+
```

### Slot-Filling Step-by-Step Flow:
1. **Trigger Phrase Entry:** The user starts typing: `"Buy thermos"` or `"Deliver food"`.
2. **Slot Pill Appending:** Based on the matched intent (Storefront, Delivery, Task), the system appends empty parameters as inline pills:
   * *Deliver food* $\rightarrow$ Appends `[to where]`, `[instructions]`, `[by time]`
   * *Buy thermos* $\rightarrow$ Appends `[quantity]`, `[destination]`, `[frequency]`
   * *Clock in* $\rightarrow$ Appends `[role]`, `[workstation]`
3. **Floating Context Autocomplete:** A list of matching options (e.g. Warehouses from database, or Roasts from coffee catalog) floats right above the input capsule.
4. **Interactive Pill Focus:** Tapping any inline pill focuses it. The floating list shifts to suggest values relevant for that specific parameter.
5. **Selection & Conversion:** Tapping a suggestion fills the active pill (e.g. changing `[to where]` to `🏠 SFO Home`), locks it, and shifts focus to the next empty pill.
6. **Execution:** Clicking the arrow button (`↑`) generates the corresponding database schema mutation and writes it to the routed SQLite file.

---

## 2. Core Use Cases Mapping (docs/plan.md)

The Autocomplete Omnibox fully resolves inputs for all three business domains defined in the system plan:

### Use Case 1: Deliveries & Logistics
* **Intent Trigger:** `"deliver"`, `"pickup"`, `"food"`, `"order"`
* **Inline Slots:** `[item]` $\rightarrow$ `[to where]` $\rightarrow$ `[instructions]`
* **Database Action:** 
  * Appends a new delivery task in `matter` (`type = 'food'`).
  * Inserts tracking stream `motion` with status `READY_FOR_PICKUP`.
  * Context suggestions pull recent delivery addresses from the database.

### Use Case 2: Storefront & Commerce (POS/SCM)
* **Intent Trigger:** `"buy"`, `"order"`, `"purchase"`, `"thermos"`, `"stock"`
* **Inline Slots:** `[item]` $\rightarrow$ `[quantity]` $\rightarrow$ `[destination]`
* **Database Action:**
  * Inserts/updates `mass` entries representing inventory adjustments (`type = 'stock'`, matching `matter` ID).
  * Creates `relation` links (`src = product`, `tgt = warehouse`, `type = 'located_in'`).

### Use Case 3: Dispatch & Task Scheduling
* **Intent Trigger:** `"assign"`, `"job"`, `"task"`, `"plumb"`, `"fix"`
* **Inline Slots:** `[task]` $\rightarrow$ `[technician]` $\rightarrow$ `[scheduled slot]`
* **Database Action:**
  * Creates a task row in `matter`.
  * Creates allocation entry in `mass` (`type = 'slot'`).

---

## 3. Local Model (LFM) Loading & Execution Plan

### A. Initialization Performance (Background vs Lazy Load)
Loading local weights (e.g., LFM 350M or 1.2B Instruct) from storage into RAM takes **1.5 to 3 seconds** on mobile devices.
To ensure a zero-lag user experience:
1. **Background Persistence:** The model initialization is kicked off globally at app boot time inside `App.tsx` / `_layout.tsx` (via a shared Zustand store/context). This avoids re-loading when the user navigates between home and `aigui2.tsx`.
2. **Immediate Hybrid Fallback:** 
   * ** Keystroke Loop (00ms Delay):** The input field does not wait for the LLM. It instantly uses a local SQLite word similarity query and regex matcher to display context suggestions.
   * **Smart Loop (Fallback to Groq):** While the local model status is `LOADING`, NLP extraction requests fall back to a local mock parser or a fast Groq API call, transitioning silently to local on-device inference once `isReady` is true.

### B. UI Status Indicator
A subtle glowing dot inside the input capsule indicates the status of the local intelligence layer:
* 🟢 **Green (Local LLM Ready):** Model loaded in memory; processing slots offline.
* 🟡 **Yellow (LLM Initializing):** Model is loading from storage; using immediate SQLite regex fallback.
* 🔵 **Blue (Local Search Enabled):** Local database index search active.

---

## 4. Implementation Steps for aigui2.tsx Screen

1. **State Redesign:**
   * Introduce `slots` array state: `Array<{ key: string, label: string, value: string | null, active: boolean }>` representing the inline parameters.
   * Introduce `selectedIntent` state mapping to the current active use case.
2. **Capsule UI Rendering:**
   * Design a scrollable container for the `TextInput` and the list of horizontal pill components *inside* the capsule wrapper.
3. **Database-backed Autocomplete Feed:**
   * Implement real-time queries against `matter` and `mass` to populate the floating suggestion list based on the active focused slot (e.g., querying scopes matching `w:*` if the focused slot is `[destination]`).
4. **Submit Logic Integration:**
   * Create schema builder executing transactions on target DB scope matching the resolved entities.
