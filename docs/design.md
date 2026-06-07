# Concept 1 — CATALOG (grid)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 1 — CATALOG (grid)            ║
  ╠═══════════════════════════════════════╣
  ║ ←  Catalog · s:102           ⊕ new   ║
  ╟───────────────────────────────────────╢
  ║ 🔍 product, sku, barcode…             ║
  ║                                       ║
  ║ [all][drinks][food][retail][low ●]    ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  ┌──────────┐  ┌──────────┐          ║
  ║  │  ▣▣▣▣▣▣  │  │  ▣▣▣▣▣▣  │          ║
  ║  │  Latte   │  │ Capuccino│          ║
  ║  │  ₹120    │  │  ₹130    │          ║
  ║  │  ● 42    │  │  ● 18    │          ║
  ║  └──────────┘  └──────────┘          ║
  ║                                       ║
  ║  ┌──────────┐  ┌──────────┐          ║
  ║  │  ▣▣▣▣▣▣  │  │  ▣▣▣▣▣▣  │          ║
  ║  │ Espresso │  │  Mocha   │          ║
  ║  │  ₹100    │  │  ₹150    │          ║
  ║  │  ● 27    │  │ ⚠ low 4  │          ║
  ║  └──────────┘  └──────────┘          ║
  ║                                       ║
  ║  ┌──────────┐  ┌──────────┐          ║
  ║  │  ▣▣▣▣▣▣  │  │  ▣▣▣▣▣▣  │          ║
  ║  │ Croissant│  │  Bagel   │          ║
  ║  │  ₹90     │  │  ₹70     │          ║
  ║  │  ● 12    │  │  ○ 0     │          ║
  ║  └──────────┘  └──────────┘          ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  📦 stock   🏷 prices   ⇄ transfer   ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 2 — NEW PRODUCT · sentence

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 2 — NEW PRODUCT · sentence    ║
  ╠═══════════════════════════════════════╣
  ║  ✕                            publish ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   ┌ product ▾ ┐  in  ┌ s:102 ▾ ┐    ║
  ║                                       ║
  ║   ┌─────────────────────────────┐    ║
  ║   │                             │    ║
  ║   │        📷 add photo         │    ║
  ║   │                             │    ║
  ║   └─────────────────────────────┘    ║
  ║                                       ║
  ║   ╭─────────────────────────────╮    ║
  ║   │ Iced Caramel Latte          │    ║
  ║   ╰─────────────────────────────╯    ║
  ║                                       ║
  ║   ₹ ┌ 160 ┐    sku ┌ ICL-001 ┐      ║
  ║                                       ║
  ║   category  ┌ drinks ▾ ┐             ║
  ║                                       ║
  ║   options                             ║
  ║   size   S · M · L                    ║
  ║   milk   oat · soy · skim             ║
  ║   ⊕ add option                        ║
  ║                                       ║
  ║   ╭ ai suggested ───────────────╮    ║
  ║   │ +cold brew tag · +iced cat. │    ║
  ║   │ tab ⇥                       │    ║
  ║   ╰─────────────────────────────╯    ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  🌐 s:102   👁 public      next →    ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 3 — INITIAL STOCK (mass row)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 3 — INITIAL STOCK (mass row)  ║
  ╠═══════════════════════════════════════╣
  ║  ←   Iced Caramel Latte               ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  Set opening stock                    ║
  ║                                       ║
  ║  where                                ║
  ║  ┌─────────────────────────────────┐ ║
  ║  │ s:102 · Central Store           │ ║
  ║  └─────────────────────────────────┘ ║
  ║                                       ║
  ║  quantity                             ║
  ║      ┌──────────────────┐            ║
  ║      │       50         │            ║
  ║      └──────────────────┘            ║
  ║       −10  −1  +1  +10                ║
  ║                                       ║
  ║  unit cost                            ║
  ║      ┌──────────────────┐            ║
  ║      │     ₹ 38         │            ║
  ║      └──────────────────┘            ║
  ║                                       ║
  ║  reorder at                           ║
  ║      ┌──────────────────┐            ║
  ║      │       10         │            ║
  ║      └──────────────────┘            ║
  ║                                       ║
  ║  ╭ writes ────────────────────────╮  ║
  ║  │ matter  prod_icl_001           │  ║
  ║  │ mass    stock × 50  @ s:102    │  ║
  ║  │ motion  406  TRANSFER_IN       │  ║
  ║  ╰────────────────────────────────╯  ║
  ║                                       ║
  ║  ╭───────────────────────────────╮   ║
  ║  │       SAVE & ADD TO SHELF     │   ║
  ║  ╰───────────────────────────────╯   ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 4 — PRODUCT DETAIL

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 4 — PRODUCT DETAIL            ║
  ╠═══════════════════════════════════════╣
  ║  ←   Iced Caramel Latte         ⋯    ║
  ╟───────────────────────────────────────╢
  ║   ┌─────────────────────────────┐    ║
  ║   │           ▣▣▣▣▣              │    ║
  ║   └─────────────────────────────┘    ║
  ║                                       ║
  ║   ICL-001          drinks · public    ║
  ║                                       ║
  ║   ₹160   cost ₹38   margin 76%        ║
  ║                                       ║
  ║  stock by location                    ║
  ║  ───────────────────────────          ║
  ║  ● s:102  Central         42          ║
  ║  ● s:103  Anna Nagar      18 ⚠        ║
  ║  ● w:ch03 Warehouse      240          ║
  ║              ─────                    ║
  ║              300 units                ║
  ║                                       ║
  ║  options                              ║
  ║  size   S  M  L                       ║
  ║  milk   oat  soy  skim                ║
  ║                                       ║
  ║  recent motion                        ║
  ║  ───────────────────────────          ║
  ║  2h  101 SOLD     −3   s:102          ║
  ║  4h  101 SOLD     −2   s:102          ║
  ║  yda 406 TRANS_IN +50  s:102          ║
  ║  yda 405 TRANS_OUT−50  w:ch03         ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ⊞ shelf   ⇄ transfer   🏷 edit      ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 5 — STOCK COUNT (scan flow)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 5 — STOCK COUNT (scan flow)   ║
  ╠═══════════════════════════════════════╣
  ║  ✕   Count · Aisle 3        18 / 42  ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║       ┌────────────────────┐         ║
  ║       │                    │         ║
  ║       │      ▣ ▣ ▣ ▣       │         ║
  ║       │       scan         │         ║
  ║       │                    │         ║
  ║       └────────────────────┘         ║
  ║                                       ║
  ║  last scanned                         ║
  ║  ───────────────────────────          ║
  ║  Latte                ICL-001         ║
  ║  expected 42 · counted ┌ 40 ┐  −2 ⚠  ║
  ║                                       ║
  ║  Capuccino            CAP-002         ║
  ║  expected 18 · counted ┌ 18 ┐   ok    ║
  ║                                       ║
  ║  Mocha                MOC-004         ║
  ║  expected 4 · counted  ┌ 6  ┐  +2     ║
  ║                                       ║
  ║  ─ unscanned (24) ─                   ║
  ║  ○ Espresso                           ║
  ║  ○ Bagel                              ║
  ║  ○ Croissant                          ║
  ║                                       ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ⌨ manual   📷 batch       commit →  ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 6 — TRANSFER (warehouse→shop)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 6 — TRANSFER (warehouse→shop) ║
  ╠═══════════════════════════════════════╣
  ║  ✕   Transfer                  draft  ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   from   ┌ w:ch03 warehouse ▾ ┐      ║
  ║                                       ║
  ║          ⇣                            ║
  ║                                       ║
  ║   to     ┌ s:102 central    ▾ ┐      ║
  ║                                       ║
  ║   items                               ║
  ║   ───────────────────────────         ║
  ║   Latte           ┌ 50 ┐  ⊖ ⊕        ║
  ║   Capuccino       ┌ 30 ┐  ⊖ ⊕        ║
  ║   Mocha           ┌ 20 ┐  ⊖ ⊕        ║
  ║   Bagel           ┌ 40 ┐  ⊖ ⊕        ║
  ║                                       ║
  ║   ⊕ scan item                         ║
  ║                                       ║
  ║   ──────────────                      ║
  ║   140 units · ₹ 5,320 cost            ║
  ║                                       ║
  ║  ╭ writes ────────────────────────╮  ║
  ║  │ motion 405 TRANSFER_OUT w:ch03 │  ║
  ║  │ motion 406 TRANSFER_IN  s:102  │  ║
  ║  │ relation parent-child (batch)  │  ║
  ║  ╰────────────────────────────────╯  ║
  ║                                       ║
  ║  ╭───────────────────────────────╮   ║
  ║  │       DISPATCH TRANSFER       │   ║
  ║  ╰───────────────────────────────╯   ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 7 — LOW-STOCK on timeline

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 7 — LOW-STOCK on timeline     ║
  ╠═══════════════════════════════════════╣
  ║ ◉ Anu          s:102 ▾        ⌗ 0241 ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║   NOW                                 ║
  ║   │                                   ║
  ║   ● shift · 3h 12m                    ║
  ║   ⚠ low stock                         ║
  ║     ├ Mocha           4 left          ║
  ║     ├ Bagel           0 left          ║
  ║     └ Oat milk        2 left          ║
  ║                 [reorder all]         ║
  ║                                       ║
  ║   ○ Order #441 · prep                 ║
  ║   ○ Reply Ravi · ticket               ║
  ║                                       ║
  ║   PAST                                ║
  ║   2h  101 SOLD  −3 Latte   ₹360       ║
  ║   3h  101 SOLD  −1 Mocha   ₹150       ║
  ║   4h  406 IN   +50 Latte   w→s        ║
  ║                                       ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  🧑   ⊞   +          ●REC   AI   ↑  ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 8 — BULK IMPORT (AI paste)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 8 — BULK IMPORT (AI paste)    ║
  ╠═══════════════════════════════════════╣
  ║  ✕   Bulk add products                ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║  paste · csv · photo of menu          ║
  ║                                       ║
  ║  ╭─────────────────────────────────╮ ║
  ║  │ Latte 120                       │ ║
  ║  │ Cappuccino 130                  │ ║
  ║  │ Espresso 100                    │ ║
  ║  │ Mocha 150 oat milk +20          │ ║
  ║  │ Croissant 90                    │ ║
  ║  ╰─────────────────────────────────╯ ║
  ║                                       ║
  ║          ai parsing…  ▮▮▮▮▯           ║
  ║                                       ║
  ║  detected · 5 products                ║
  ║  ───────────────────────────          ║
  ║  ✓ Latte         ₹120  drinks         ║
  ║  ✓ Cappuccino    ₹130  drinks         ║
  ║  ✓ Espresso      ₹100  drinks         ║
  ║  ✓ Mocha         ₹150  drinks         ║
  ║    ↳ option milk: oat (+₹20)          ║
  ║  ✓ Croissant     ₹90   food           ║
  ║                                       ║
  ║  opening stock for all                ║
  ║  ┌ 25 ┐  units  @  ┌ s:102 ▾ ┐       ║
  ║                                       ║
  ║  ╭───────────────────────────────╮   ║
  ║  │   PUBLISH 5 PRODUCTS          │   ║
  ║  ╰───────────────────────────────╯   ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 9 — STOCK ADJUSTMENT drawer

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 9 — STOCK ADJUSTMENT drawer   ║
  ╠═══════════════════════════════════════╣
  ║   ░░ catalog behind ░░                ║
  ║   ░░░░░░░░░░░░░░░░░░░                ║
  ║                                       ║
  ║  ▬▬▬                                  ║
  ║                                       ║
  ║  Mocha · s:102                        ║
  ║  current  4   ⚠ below reorder         ║
  ║                                       ║
  ║  reason                               ║
  ║  ◉ receive    ○ damage                ║
  ║  ○ recount    ○ giveaway              ║
  ║                                       ║
  ║  delta                                ║
  ║      ┌──────────────────┐            ║
  ║      │      + 24        │            ║
  ║      └──────────────────┘            ║
  ║       −10  −1  +1  +10                ║
  ║                                       ║
  ║  new total           28               ║
  ║                                       ║
  ║  note                                 ║
  ║  ╭─────────────────────────────╮     ║
  ║  │ supplier delivery — INV#88  │     ║
  ║  ╰─────────────────────────────╯     ║
  ║                                       ║
  ║  writes  motion 406 TRANSFER_IN +24   ║
  ║                                       ║
  ║  ╭───────────────────────────────╮   ║
  ║  │           CONFIRM             │   ║
  ║  ╰───────────────────────────────╯   ║
  ╚═══════════════════════════════════════╝
```

---

# Concept 10 — STOCK SPINE (per-product)

```text
  ╔═══════════════════════════════════════╗
  ║ CONCEPT 10 — STOCK SPINE (per-product)║
  ╠═══════════════════════════════════════╣
  ║  ←   Mocha · stock history            ║
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║          stock                        ║
  ║   50 ┤      ╱╲                        ║
  ║      │     ╱  ╲___                    ║
  ║   25 ┤    ╱       ╲__                 ║
  ║      │ __╱            ╲___            ║
  ║    0 ┤                    ╲___        ║
  ║      └──────────────────────────      ║
  ║       mon  tue  wed  thu  fri         ║
  ║                                       ║
  ║  motion log                           ║
  ║  ───────────────────────────          ║
  ║  ● now    ⚠ reorder triggered         ║
  ║                                       ║
  ║  ─ today ─                            ║
  ║  09:42  101 SOLD     −1    s:102      ║
  ║  10:15  101 SOLD     −2    s:102      ║
  ║  11:08  101 SOLD     −1    s:102      ║
  ║                                       ║
  ║  ─ yesterday ─                        ║
  ║  18:30  204 SHIFT_END                 ║
  ║  14:22  101 SOLD     −3               ║
  ║  09:00  406 TRANS_IN +20   w:ch03→    ║
  ║                                       ║
  ║  ─ mon ─                              ║
  ║  16:11  111 REFUND   +1    #438       ║
  ║  11:55  101 SOLD     −2               ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ⇄ transfer   🏷 edit       ⊕ adjust  ║
  ╚═══════════════════════════════════════╝
```

---

---

# PART II — SYSTEM-WIDE DESIGN ("Ledger Minimal")

Concepts 1–10 cover catalog & stock. Part II defines how the SAME design
language scales to *every* domain in `plan.md` (CRM, POS, SCM, logistics, HR,
forms, bookings, payments, ERP) using the spacetime model.

**Core thesis — TAR is not 15 apps. It is one spatiotemporal ledger with 3 axes:**

> **WHERE** (scope pill) × **WHEN** (timeline lane) × **WHAT** (primitive)

Every screen is a slice of that cube. The user never "opens the CRM app" —
they pick a *space* (scope), a *time lane* (future/now/past), and the same
feed reshapes itself.

---

## D0 — Design Tokens (codified from profile.tsx / home.tsx)

| Token | Value | Use |
| :--- | :--- | :--- |
| `ink` | `#0f172a` | Primary text, active icons |
| `ink-soft` | `#64748b` | Secondary text (db names, roles, time) |
| `ink-faint` | `#94a3b8` | Section headers (11px uppercase) |
| `canvas` | `#ffffff` | All backgrounds — no gray screens, ever |
| `hairline` | `#f1f5f9` | 1px row separators — the ONLY border in the app |
| `chip` | `#f1f5f9` | Badge / button fill |
| `danger` | `#ef4444` on `#fee2e2` | REMOVE / EXIT |
| `accent` | `#6366f1` | Indigo — interactive emphasis only |

Typography: title 18/700/−0.5 · row 15/700 · sub 11/`ink-soft` ·
section 11/700/UPPERCASE/0.8 · **codes & opcodes always monospace 12/700** ·
amounts tabular-nums.

Stack decision: stay on `StyleSheet` (the codebase idiom — NativeWind is
installed but unused). Extract `lib/theme.ts` with these tokens instead of
migrating mid-flight.

### Opcode Family Colors — the semantic layer

The single most important new rule: **the user learns 9 colors, not 70
opcodes.** Every `motion.action` is tinted by its hundreds-family, everywhere,
always — timeline dots, badges, filter chips, swipe backgrounds.

| Family | Domain | Color | Pastel bg |
| :--- | :--- | :--- | :--- |
| 100s | Commerce / Orders | `#10b981` green | `#d1fae5` |
| 200s | POS / Kitchen | `#f59e0b` amber | `#fef3c7` |
| 300s | CRM / Helpdesk | `#3b82f6` blue | `#dbeafe` |
| 400s | Logistics / SCM | `#8b5cf6` violet | `#ede9fe` |
| 500s | HR / Rosters | `#ec4899` pink | `#fce7f3` |
| 600s | Marketing / Forms | `#06b6d4` cyan | `#cffafe` |
| 700s | Bookings / Services | `#14b8a6` teal | `#ccfbf1` |
| 800s | Payments / Ledger | `#22c55e` emerald | `#dcfce7` |
| 900s | ERP / Fleet | `#f97316` orange | `#ffedd5` |

Opcode badge anatomy (monospace, same shape as the scope badge in profile.tsx):

```text
  ┌────────────────┐
  │ ● 501 CLOCK_IN │   dot = family color · text = ink · bg = family pastel
  └────────────────┘
```

### Primitive Iconography

| Primitive | Ionicons | Mental model |
| :--- | :--- | :--- |
| `matter` | `cube-outline` | "Thing" — blueprint / catalog |
| `mass` | `layers-outline` | "Amount / Slot" — stock, booking, shift |
| `motion` | `flash-outline` | "Action" — sold, clocked-in, delivered |
| `relation` | `git-branch-outline` | "Link" — belongs-to, blocked-by |

### The Universal Row

ONE row component renders ANY entity (lead, product, shift, ticket, trip,
invoice). This is what makes 15 domains feel like one app:

```text
  ┌────────────────────────────────────────────────────┐
  │ (◯ 48px)  Title 15/700                  ┌────────┐ │
  │  avatar   subtitle · scope · time       │ BADGE  │ │
  │           person → InitialAvatar        └────────┘ │
  │           entity → IconAvatar(primitive)           │
  └──────────────────── hairline ──────────────────────┘
```

- Trailing badge = status / opcode / qty / ₹value depending on primitive.
- **Swipe right** → fires the domain's "done" opcode (task→done, order→
  delivered, token→served). Swipe background = family color.
- **Swipe left** → contextual quick actions (assign, reschedule, refund).
- Tap → Entity Stream (D5).

---

## D1 — NAVIGATION SHELL (5 anchors)

```text
  ╔═══════════════════════════════════════╗
  ║ D1 — NAVIGATION SHELL                 ║
  ╠═══════════════════════════════════════╣
  ║ [● s:102 Store ▾]          ⌕   ◯ Anu ║  ← scope pill (global) · search · profile
  ╟───────────────────────────────────────╢
  ║                                       ║
  ║                                       ║
  ║          ACTIVE SCREEN                ║
  ║                                       ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ◷ Timeline  ▦ Space  (+)  ✦ Agents  ☰ Logs
  ╚═══════════════════════════════════════╝
```

| Anchor | Evolves from | Answers |
| :--- | :--- | :--- |
| **Timeline** | `home.tsx` | *When?* — future / now / past feed |
| **Space** | `space.tsx` | *Where / what exists?* — catalog, stock, slots |
| **(+)** | new drawer | *Create* — define / allocate / act |
| **Agents** | `tagents.tsx` | *Who?* — scopes, members, playbooks |
| **Logs** | `history.tsx` | *What happened?* — immutable ledger |

The scope pill is the single "where am I" control. Switching scope re-tints
the pill with that scope's pastel and re-filters all five anchors.

---

## D2 — SCOPE SWITCHER (bottom sheet)

Surfaces the Database-per-User routing from plan.md §2 honestly but quietly:
power users see exactly which DB file their data lives in; casual users see a
lock or sync glyph.

```text
  ╔═══════════════════════════════════════╗
  ║ D2 — SCOPE SWITCHER (sheet)           ║
  ╠═══════════════════════════════════════╣
  ║  ▬▬▬                                  ║
  ║  SWITCH SPACE                         ║
  ║  ─────────────────────────────────    ║
  ║  ◉ [p]      Personal     🔒 local     ║
  ║  ○ [g]      Global       ⟳ cache      ║
  ║  ○ [s:102]  Corner Store ⟳ 2m ago     ║
  ║  ○ [t:99]   Dev Team     ⟳ 5m ago     ║
  ║  ○ [h:staff] HR          ⟳ 1h ago     ║
  ║  ○ [w:ch03] Warehouse    ⟳ 12m ago    ║
  ║  ○ [c:vip]  VIP Clients  ⟳ 3m ago     ║
  ║  ─────────────────────────────────    ║
  ║  ◌ All spaces (unified timeline)      ║
  ║  ⊕ Join or create a space             ║
  ╚═══════════════════════════════════════╝
```

- Monospace prefix badge (existing `scopePrefixBadge` style) + name +
  sync-state glyph: `🔒 local-only` (p) · `⟳ cache` (g) · `⟳ <ago>` (sync DBs).
- Pull-to-refresh anywhere spins *inside the scope pill* — reinforcing "this
  space syncs to `db_${owner}`". Never a blocking spinner.

---

## D3 — TIMELINE (Home, evolved)

Direct implementation of spacetime.md §1 lanes + Pattern C chips.

```text
  ╔═══════════════════════════════════════╗
  ║ D3 — TIMELINE (home)                  ║
  ╠═══════════════════════════════════════╣
  ║ [● s:102 ▾]                 ⌕   ◯    ║
  ╟───────────────────────────────────────╢
  ║ (all)(commerce)(pos)(crm)(log)(hr) →  ║  ← family-colored chips
  ║                                       ║
  ║  NOW ────────────────────────────     ║
  ║  ⬤ Open Tab · Table 4   ₹1,240 CART  ║  ← mass cart · amber
  ║  ⬤ Token #18            CALLED  209  ║  ← motion status · amber
  ║  ⬤ Mocha stock low      4 left STOCK ║  ← mass qty alert
  ║  ⬤ Order #1042        PREPARING 107  ║  ← green (100s)
  ║                                       ║
  ║  FUTURE ─────────────────────────     ║
  ║  ○ Shift · Priya 2–10pm        SLOT  ║
  ║  ○ Booking · Haircut 4:30pm     701  ║
  ║                                       ║
  ║  PAST ──────── today ────────────     ║
  ║  ✓ 201 SALE  ₹860 · 3 items   2:14p  ║
  ║  ✓ 501 CLOCK_IN  Arun         9:01a  ║
  ║                                       ║
  ╟───────────────────────────────────────╢
  ║  ◷    ▦    (+)    ✦    ☰             ║
  ╚═══════════════════════════════════════╝
```

- Chips = opcode-range filters (Pattern C): `[pos]` →
  `action BETWEEN 200 AND 299` + `mass.type IN ('cart','stock')`. Active chip
  fills with its family pastel.
- **NOW is computed, not stored**: active masses (`active=1`,
  `start<=now<=end`), non-terminal motions, low-stock (`qty<threshold`).
- FUTURE = `mass.start > now` (hollow dots). PAST = terminal motions (✓).
- Swipe right on a NOW row = the domain's completing opcode.

---

## D4 — ACTION PALETTE — the (+) drawer

spacetime.md Pattern B, verbatim, as the ONLY creation entry point in the app.

```text
  ╔═══════════════════════════════════════╗
  ║ D4 — ACTION PALETTE (+ drawer)        ║
  ╠═══════════════════════════════════════╣
  ║  ▬▬▬                                  ║
  ║  ▣ DEFINE (matter)                    ║
  ║  product · task · note · form · profile
  ║                                       ║
  ║  ▤ ALLOCATE (mass)                    ║
  ║  stock · slot · cart · shift · trip · lead
  ║                                       ║
  ║  ⚡ ACT (motion)                       ║
  ║  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     ║
  ║  │ 201 │ │ 501 │ │ 206 │ │ 806 │  …  ║  ← haptic quick-tap grid,
  ║  │SALE │ │CLOCK│ │FIRE │ │SPEND│     ║    family-colored
  ║  └─────┘ └─────┘ └─────┘ └─────┘     ║
  ║                                       ║
  ║  🎙 "remind me to restock mocha…"     ║  ← voice → LLM → primitives
  ╚═══════════════════════════════════════╝
```

- **Scope-aware**: the grid only shows opcodes + types the current scope's
  agent playbook permits (D6). In `s:102` you see SALE/FIRE/TOKEN; in
  `h:staff` CLOCK_IN/LEAVE; in `p` EXPENSE/TASK. This is how 70 opcodes stay
  usable.
- DEFINE → `create.tsx` with type preset; ALLOCATE → `realization.tsx` with
  type chips reduced to the scope's valid types (spacetime.md §3 matrix).
- Voice row keeps the existing home.tsx Groq/local-LLM pipeline, promoted to
  a first-class citizen.

---

## D5 — ENTITY STREAM (universal detail)

Tap anything anywhere → ONE detail screen with four zones mirroring the four
primitives. Replaces all per-domain detail screens. (Concept 4's product
detail is this screen in Storefront clothing.)

```text
  ╔═══════════════════════════════════════╗
  ║ D5 — ENTITY STREAM                    ║
  ╠═══════════════════════════════════════╣
  ║ ←  Water Heater Repair   [task] [p]   ║  ← MATTER: title, type, scope
  ║    THERMO_FIX_01 · created jun 2      ║
  ╟───────────────────────────────────────╢
  ║  ALLOCATIONS (mass)                   ║
  ║  ▤ slot  jun 7 · 2–4pm  [active] ⬡geo ║
  ║  ▤ stock 2 spare valves               ║
  ║                                       ║
  ║  TIMELINE (motion)                    ║
  ║  ● 306 TICKET_OPEN      jun 2 10:01   ║
  ║  ● 304 CONTACTED        jun 3 14:20   ║
  ║  ◌ 308 RESOLVED         — tap to fire ║  ← GHOST OPCODE
  ║                                       ║
  ║  LINKS (relation)                     ║
  ║  ⌥ assigned_to → Arun                 ║
  ║  ⌥ blocked_by  → Buy valve 🔒 (open)  ║
  ╚═══════════════════════════════════════╝
```

**The hero idea — the ghost opcode (◌):** the timeline renders the *next legal
action* as a hollow, tappable entry. The plan.md §3 write matrix becomes
literally visible: solid dots = done, ghost = next transition. Tapping fires
it (Status-Update edits in place; Append inserts) and the dot fills with its
family color. Users learn the entire workflow engine by looking at one
timeline.

- `blocked_by` targets render dimmed + 🔒 until the blocker's stream reaches
  terminal state (relation-driven unlock, spacetime.md §2). The unlock pops
  the lock glyph off with a spring scale.

---

## D6 — AGENT PLAYBOOK (tagents detail)

`tagents.tsx` keeps its scope→member list; each scope gains a detail page —
spacetime.md Pattern A. The mock DUMMY_MEMBERS move here from profile.tsx.

```text
  ╔═══════════════════════════════════════╗
  ║ D6 — AGENT PLAYBOOK                   ║
  ╠═══════════════════════════════════════╣
  ║ ←  Storefront · [s:102]               ║
  ║    user_sync_owner.db · ⟳ 2m ago      ║
  ╟───────────────────────────────────────╢
  ║  MEMBERS                              ║
  ║  ◯ Priya — Manager        [admin]     ║
  ║  ◯ Arun — Cashier         [member]    ║
  ║  ⊕ invite                             ║
  ║                                       ║
  ║  PLAYBOOK                             ║
  ║  ▸ Manage Catalog                     ║
  ║      matter  [✓ product]              ║
  ║  ▸ Conduct Checkout                   ║
  ║      mass    [✓ cart] [✓ stock]       ║
  ║      motion  [✓ 201 SALE][✓ 111 REFND]║
  ║  ▸ Kitchen Queue                      ║
  ║      motion  [✓ 206 FIRE][✓ 207 READY]║
  ║                                       ║
  ║  toggles drive the (+) palette and    ║
  ║  swipe actions for every member       ║
  ╚═══════════════════════════════════════╝
```

- Toggle chips reuse the monospace scope-badge visual; checked = family
  pastel fill.
- The playbook is itself stored as `matter (type='form')` with toggles in
  `data` — the system describing itself in its own primitives.

---

## D7 — LOGS, the honest ledger (history evolved)

plan.md makes accounts books / invoices / payroll first-class — this view IS
the accounts book with zero extra schema.

```text
  ╔═══════════════════════════════════════╗
  ║ D7 — LOGS (ledger)                    ║
  ╠═══════════════════════════════════════╣
  ║ (all)(800s pay)(200s pos)(500s hr) →  ║
  ╟───────────────────────────────────────╢
  ║  TODAY                      ₹ +4,320  ║  ← daily delta sum
  ║  ● 802 PAY_OK   ord_1042  +860  2:14p ║
  ║  ● 201 SALE     3 items   +860  2:14p ║
  ║  ● 501 CLOCK_IN Arun        —   9:01a ║
  ║                                       ║
  ║  YESTERDAY                  ₹ +9,105  ║
  ║  ● 201 SALE     5 items  +1,420 6:02p ║
  ║  ● 503 PAYROLL  Priya   −12,000 5:00p ║
  ║  ● 806 EXPENSE  supplies  −340  1:11p ║
  ║                                       ║
  ║  ⚠ seq gap detected — sync incomplete ║  ← motion.seq audit banner
  ╚═══════════════════════════════════════╝
```

- Grouped by day with running `delta` sums — receipts-feel: no avatars, no
  swipe actions, monospace-forward, immutable.
- Tap row → Entity Stream of its `stream` id.
- A `seq` gap detector surfaces a "sync incomplete" banner (out-of-order
  opcode guard from plan.md motion.seq design).

---

## D8 — SPACE, scope-adaptive (space.tsx evolved)

Three segments; ONE screen with twelve personalities, driven entirely by the
spacetime.md §3 scope→type matrix. Concepts 1–10 are this screen's Storefront
and Warehouse faces.

```text
  ( catalog )  ( stock & slots )  ( map )
```

| Scope | Default segment | Grid contents |
| :--- | :--- | :--- |
| Storefront `s:` | Catalog (POS mode) | products + sticky cart bar |
| Warehouse `w:` | Stock & Slots | bins, transfer actions |
| HR `h:` | Stock & Slots | shift calendar rows |
| Logistics `d` | Map | trips, live driver routes |
| Client `c:` | Catalog | profiles, lead pipeline |
| Forms `x:` | Catalog | form blueprints, run instances |
| Personal `p` | Catalog | notes, tasks |

- Stock & Slots uses Universal Rows: inline qty steppers for `stock`, time
  ranges for `slot`/`shift`, `geo` as a small H3 hex chip ⬡.
- Map plots masses with `geo`; `trip` masses draw live routes.

---

## D9 — PROFILE, restructured (profile.tsx)

Current screen mixes identity, scope table, storage, AI models in one scroll.
Keep every visual primitive (they're good); restructure into four sections:

```text
  ╔═══════════════════════════════════════╗
  ║ D9 — PROFILE (restructured)           ║
  ╠═══════════════════════════════════════╣
  ║  ◯ Tarun Kumar                        ║
  ║    tarun@gmail.com                    ║
  ╟───────────────────────────────────────╢
  ║  PLAN & TOKENS                        ║
  ║  ▸ Community Plan            [FREE]   ║
  ║  ▸ 2,140,000 ▓▓▓▓▓▓░░     [+ add]    ║  ← meter, not a bare number
  ║                                       ║
  ║  SPACES & SYNC                        ║  ← was "Scope Mapping"
  ║  ▸ [p]     Personal  🔒 local  18 MB  ║
  ║  ▸ [g]     Global    ⟳ cache  1m ago  ║
  ║  ▸ [s:102] Store     ⟳ sync   2m ago  ║
  ║  (tap → Agent Playbook D6)            ║
  ║                                       ║
  ║  DEVICE                               ║
  ║  ▸ Backup DB    last 2:14p   [RUN]    ║
  ║  ▸ AI Models    3 of 6 · 1.2 GB  →    ║  ← collapse to sub-page
  ║                                       ║
  ║  ▸ Sign Out                  [EXIT]   ║
  ╚═══════════════════════════════════════╝
```

Changes from current profile.tsx:

1. **DUMMY_MEMBERS move out** → Agent Playbook (D6). Profile's scope list
   becomes a compact *sync-health dashboard*: prefix badge + lock/sync glyph
   + last-sync + local DB size — the user-facing face of plan.md §2 routing.
2. **Token meter** replaces the raw number (tokens gate sync + AI, plan.md
   §6); plan chip alongside; "Add Tokens" flow unchanged.
3. **AI models → sub-page**: the two long lists (LFM + Vision) collapse to a
   summary row pushing to a screen that reuses the existing GET/REMOVE rows
   unchanged.
4. **Backup** also appends a `motion` (scope `p`) on success, so backups
   appear in Logs — *everything is ledger*.

---

## D10 — Motion & Feedback Language

| Event | Feedback |
| :--- | :--- |
| Opcode fired (Append) | Haptic Success + row flashes family pastel → settles |
| Status-Update (in place) | Badge cross-fades old → new status text |
| Swipe-complete | Row slides out of NOW, FadeInDown into PAST |
| Sync push/pull | Scope pill pulses its pastel — never a blocking spinner |
| blocked_by unlocked | 🔒 pops off with spring scale |
| Offline | Thin amber hairline under header: "offline — writing to local ledger". Never a modal: local-first means offline is normal, not an error. |

All via the already-installed `react-native-reanimated` + `expo-haptics`.

---

## D11 — Build Order

| Phase | Deliverable | Touches |
| :--- | :--- | :--- |
| 1 | `lib/theme.ts` tokens + `OpcodeBadge` + `UniversalRow` | new `components/` |
| 2 | Scope pill + switcher sheet; `activeScope` in state | `_layout.tsx`, `lib/state.ts` |
| 3 | Timeline lanes + family chips | `home.tsx` |
| 4 | Action Palette drawer (scope-aware grid) | new `palette.tsx` |
| 5 | Entity Stream + ghost opcode | new `stream/[id].tsx` |
| 6 | Profile restructure + Agent Playbook | `profile.tsx`, `tagents.tsx` |
| 7 | Space segments + Logs ledger | `space.tsx`, `history.tsx` |
