# 11 — Agentic Capabilities

LLM-driven actions and inquiries, from both the merchant and customer sides, mapped to the underlying tables. These are the natural-language commands the AI agent can resolve against the schema.

> New names: `form` (was `matter`), `matter` (was `mass`), `bond` (was `relation`). Examples below use the new terms.

---

## 1. Merchant / operator (business operations)

| Command example | Tables | How it works |
| :--- | :--- | :--- |
| "What's my stock level for Sneakers?" | `matter`, `form` | find product in `form`; aggregate `qty` from `matter` rows type `variant`/`stock` |
| "Which orders need driver assignment?" | `matter`, `bond`, `motion` | scan active `matter` type `trip`/`order`; match `motion` where no driver assigned |
| "ETA for trip `trip_123`?" | `matter`, `motion` | read slot `start`; parse latest `ETA_UPDATED` (404) offsets in `motion` |
| "Summarize open tickets and draft replies." | `matter`, `motion` | fetch active `matter` type `ticket`; read conversation in `motion` |
| "How much is left in the Supplies budget?" | `matter`, `motion` | read `qty` balance on budget `matter` (allocation minus 806 expenses) |
| "Analyze today's sales." | `matter`, `motion` | aggregate `value` on order rows / match `SALE` (201), `PAY_SUCCESS` (802) |
| "Create personal task: call supplier tomorrow." | `form`, `matter` | insert `task` in `form`, route to local-only `user_${self}.db` |
| "Assign driver John to order #456." | `bond`, `motion`, `matter` | `assignDriver()` → updates `matter` + writes `DRIVER_ASSIGNED` (403) phase |

---

## 2. Customer / client (self-service)

| Inquiry example | Tables | How it works |
| :--- | :--- | :--- |
| "Status of my order / when will it arrive?" | `matter`, `motion` | read active `order`/`trip`; track `IN_TRANSIT` (402), `DELIVERED` (109), ETA from `motion` |
| "Is the Pepperoni Pizza in stock?" | `matter`, `form` | read `form` definition; check `qty > 0` in synced `matter` |
| "File a complaint: item damaged." | `matter`, `motion` | create `ticket` `matter`; append `TICKET_OPEN` (306) |
| "Any booking slots tomorrow afternoon?" | `matter` | scan `matter` type `slot` under team scope for open windows |
| "Cancel my delivery request." | `matter`, `motion` | update target `matter`; append `CANCELLED` (703) phase |
| "Submit payment ref for my invoice." | `matter`, `motion` | update invoice `matter`; log `PAY_INIT` (801) / `PAY_SUCCESS` (802) |
| "What are the options/modifiers for this item?" | `form`, `bond` | resolve via `bond` where `type='modifier_of'` back to the product |
| "Refund my sneaker purchase." | `matter`, `motion` | locate order `matter`; append `REFUND` (111) |

---

## 3. Pattern

Every agentic action reduces to the same four moves:

| Intent | Operation |
| :--- | :--- |
| "what is / how much" | **read** `form` (definition) + `matter` (live state) |
| "what happened / status" | **read** `motion` (ledger / phase history) |
| "how are these connected" | **traverse** `bond` (graph) |
| "do this" | **write** a `motion` event (append or phase update) |

This is why one schema serves every vertical: the agent never needs feature-specific tables — it composes reads/writes over the five tables. See [05-domain-opcode-map.md](05-domain-opcode-map.md) for the per-domain table breakdown and [12-code-reference.md](12-code-reference.md) for the exact functions that perform these writes.
