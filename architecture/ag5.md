# TAR — Cost-Efficient Plan at ₹100/user/month

**Standard:** 1 USD = ₹100 · AI = $0.30/1M tokens · Turso sync = $0.25/GB

> **TN Scale Power User** — single top Chennai restaurant (e.g., Saravana Bhavan–tier outlet):
> 500 orders/day · 15,000 orders/month · real-time KDS active 12 hrs/day · 50 staff shifts · heavy AI analytics.
> Used as the additional column throughout.

---

## Cloudflare Pricing (no free tier assumed)

### Workers
| Component | Rate | Per user/month (1,000 API calls) | Cost (₹) | **Power User — Top TN Restaurant (15K orders/mo)** | **Cost (₹)** |
|---|---|---|---|---|---|
| Requests | $0.30 / 1M | 1,000 req → 0.001M | ₹0.03 | 15,000 orders × 10 calls = 150,000 req | ₹4.50 |
| CPU Time | $0.02 / 1M CPU ms | 10K ms | ₹0.02 | 150,000 × 15ms = 2.25M ms | ₹4.50 |
| **Workers total** | | | **₹0.05** | | **₹9** |

### Durable Objects (real-time coordination — order routing, KDS, inventory lock)

> **How DO billing actually works with WebSocket Hibernation API:**
> A DO using `ctx.acceptWebSocket()` **hibernates between messages — zero duration cost while idle**.
> It wakes in milliseconds when a message arrives, processes it (~20ms), then sleeps again.
> You pay only for those milliseconds of active processing, NOT for the full connection lifetime.
> Without hibernation (`accept()` instead): you'd pay for the entire open connection — avoid this.

```js
// ✅ CORRECT — DO hibernates between messages, billed only per wake-up (~20ms each)
async fetch(request) {
  const ws = new WebSocketPair();
  this.ctx.acceptWebSocket(ws.server); // hibernation-aware
  return new Response(null, { status: 101, webSocket: ws.client });
}
async webSocketMessage(ws, message) {
  // Only THIS execution window is billed — typically 10–30ms
  await this.handleOrderEvent(JSON.parse(message));
}

// ❌ WRONG — DO stays alive for full connection, billed 300s per order
ws.accept(); // standard accept — no hibernation
```

| Component | Rate | Per user/month | Cost (₹) | **Power User — Top TN Restaurant (hibernation ON)** | **Cost (₹)** |
|---|---|---|---|---|---|
| Requests | $0.15 / 1M | ~200 DO calls | ₹0.003 | 375,000 calls (15K orders × 25 events) | ₹56 |
| Duration | $12.50 / 1M GB-s | 250 GB-s | ₹0.30 | 375,000 wake-ups × 0.020s × 0.128GB = **960 GB-s** → $0.012 | **₹1.20** |
| SQL Rows Written | $1.00 / 1M | ~500 rows | ₹0.05 | ~75,000 rows (5 status updates × 15K orders) → $0.075 | ₹7.50 |
| SQL Rows Read | $0.001 / 1M | ~5,000 rows | ₹0.001 | ~750,000 rows → $0.00075 | ₹0.08 |
| SQL Stored Data | $0.20 / GB-month | ~10MB | ₹0.20 | ~250MB (live order state in DO SQL) → $0.05 | ₹5 |
| **DO total** | | | **₹0.55** | | **~₹70** |

> Without hibernation API: duration = 15,000 × 300s × 0.128GB = 576,000 GB-s → ₹720 **← the wrong model**
> With `ctx.acceptWebSocket()` hibernation: duration = 960 GB-s → **₹1.20** ← correct model

**Total Cloudflare per user/month: ~₹0.60** · **Power User (with hibernation API): ~₹79**

> DOs are only used for real-time scenarios: inventory contention, KDS (kitchen display), live order tracking, WebSocket sessions. A basic notes/tasks user incurs almost no DO cost.

---

## Database Strategy — 3 Layers

### Layer 1 · Personal Data → Device-only SQLite (no Turso)

Tasks, notes, reminders, personal motion feed — stay on device. No sync, no cost.

```js
// No syncUrl = pure local SQLite. Zero Turso cost.
const userDb = createClient({ url: "file:user.db" });
```

- ₹0 sync cost · instant reads · works fully offline
- If phone is lost, personal data is lost (acceptable for notes/tasks)

---

### Layer 2 · Business Tenant Data → Turso with slow sync

```js
const tenantDb = createClient({
  url: "file:tenant.db",
  syncUrl: "libsql://...",
  authToken: "...",
  syncInterval: 300,  // every 5 min — not realtime
  offline: true,      // writes go local first
});
```

**Sync math — two scenarios:**

| Data | Rows/month (50 orders/day) | Size | Cost (₹) | **Rows/month (500 orders/day — TN Power)** | **Size** | **Cost (₹)** |
|---|---|---|---|---|---|---|
| motion (orders, shifts) | ~7,500 | ~30MB | ₹0.75 | ~75,000 | ~300MB | ₹7.50 |
| mass (stock, prices) | ~50 | ~0.2MB | ₹0.005 | ~500 (large menu + daily specials) | ~2MB | ₹0.05 |
| relation (product links) | ~20 | ~0.08MB | ₹0.002 | ~200 | ~0.8MB | ₹0.02 |
| **Total/month per tenant** | | **~30MB** | **~₹0.76** | | **~302MB** | **~₹7.57** |

> One Turso frame = 4KB minimum regardless of row size.
> **Always batch writes** — 10 rows in 1 transaction = 1 frame, not 10.

```js
// Good — 1-2 frames charged instead of 10
await db.batch(rows.map(r => ({ sql: "INSERT INTO motion...", args: [...] })));
```

---

### Layer 3 · Global Catalog → One shared Turso DB + Cloudflare KV cache

```
Search request →
  1. Cloudflare KV cache (<1ms)     ← 95% of requests hit here
  2. Cache miss → Global Turso DB
  3. Result cached in KV, TTL = 1hr
```

- KV paid: $0.50/1M reads = ₹0.0005 per user/month (negligible)
- `matter` rows change rarely → near-zero Turso write cost on global DB

---

## AI Token Strategy

**Baseline rate used in estimates:** $0.30/1M tokens = ₹30/1M tokens *(blended estimate across models)*
**Actual Groq 8B rate:** $0.05/1M input + $0.08/1M output = **~₹5–₹8/1M tokens** ← 6× cheaper

| Task | Tokens | Cost (₹) | **Power User (Top TN Restaurant)** | **Tokens/mo** | **Cost (₹)** |
|---|---|---|---|---|---|
| Parse natural language (reminder, note, task) | ~500 | ₹0.015 | 15,000 orders × 500 = order parsing | 7.5M | ₹225 |
| Fill matter fields from text | ~800 | ₹0.024 | Staff shift + stock updates daily | 0.5M | ₹15 |
| Book taxi / order food (structured JSON) | ~1,000 | ₹0.030 | — (covered in order parsing above) | — | — |
| Sales analytics, daily report | ~3,000 | ₹0.090 | 2 heavy reports/day × 5K tokens × 30 | 0.3M | ₹9 |
| **Power User AI total** | | | | **~8.3M tokens/mo** | **~₹249** |

Use **Groq Llama 3.1 8B** for 90% of tasks (fastest, cheapest).
Reserve 70B models only for explicit heavy requests ("analyse my sales").

> For TN power users, **AI is the largest cost** (DO is now cheap with hibernation). Mitigation: cache common order-parsing templates, batch the 8AM daily report into one 70B call.

**Token pool math at 1,000 users:**

| Scenario | Tokens/user | AI cost/user | Total pool cost | Revenue |
|---|---|---|---|---|
| Max (full 2M) | 2M | ₹60 | ₹60,000 | ₹1,00,000 |
| Typical usage | 500K | ₹15 | ₹15,000 | ₹1,00,000 |
| Light usage | 200K | ₹6 | ₹6,000 | ₹1,00,000 |
| **Power User (TN restaurant)** | **8.3M** | **₹249** | separate tier | separate tier |

Pool tokens across all users — heavy users subsidised by light users.
**Power users must be on a dedicated high-volume tier — cannot be cross-subsidised by ₹100 plan.**

---

## AI Token Efficiency — All Situations

> Goal: bring TN Power User AI cost from **~₹249 → under ₹30/month** without degrading UX.
> Each technique below targets a specific usage scenario in TAR.

---

### Technique 1 · 4-Layer Decision Funnel (before every AI call)

Every input must pass through this funnel cheapest-first. AI is the **last resort**, not the first.

```
User input
    │
    ▼
┌─────────────────────────────────┐
│  Layer A: Regex / Pattern Match │  ← ₹0 · handles "2 idli 1 dosa" structured orders
│  Match? → parse directly        │    ~60% of restaurant orders hit here
└───────────────┬─────────────────┘
                │ no match
    ▼
┌─────────────────────────────────┐
│  Layer B: KV Response Cache     │  ← ₹0 · exact/near-exact string match
│  hash(normalised_input) → KV   │    TTL 24hr · handles repeat orders ("usual")
└───────────────┬─────────────────┘
                │ cache miss
    ▼
┌─────────────────────────────────┐
│  Layer C: Groq 8B (fast/cheap)  │  ← ₹5–8/1M · ~30% of inputs reach here
│  structured JSON output only   │    → cache result in KV for next time
└───────────────┬─────────────────┘
                │ 8B returns low-confidence or "complex"
    ▼
┌─────────────────────────────────┐
│  Layer D: Groq 70B / Gemini    │  ← ₹50–70/1M · < 5% of inputs reach here
│  explicit user request only    │    "analyse my month", multi-step reasoning
└─────────────────────────────────┘
```

**Impact:** 60% of restaurant orders never touch AI at all.

---

### Technique 2 · Prompt Prefix Caching (static system prompt first)

Groq and Cloudflare Workers AI cache the **static prefix** of a prompt at no cost.
Put everything fixed at the top — schema, menu, instructions. Put dynamic input at the bottom.

```js
// ✅ CORRECT — static prefix is cached across all 15,000 orders this month
const prompt = [
  { role: "system", content: STATIC_SYSTEM_PROMPT }, // cached after first call
  { role: "user",   content: `Menu: ${MENU_JSON}` },  // menu rarely changes → cached
  { role: "user",   content: userInput }              // only this part is new each call
];

// ❌ WRONG — dynamic data in prefix breaks cache on every call
const prompt = [
  { role: "system", content: `Today is ${new Date()} and the order is from table ${tableId}...` }
];
```

**Savings:** cached tokens are not re-billed. System prompt (200 tokens) + menu (300 tokens) = 500 tokens saved per call.
15,000 orders × 500 cached tokens = **7.5M tokens saved = ₹37.50 saved/month** at Groq 8B pricing.

---

### Technique 3 · Response Cache in Cloudflare KV (semantic dedup)

For repeat or near-identical inputs, return the cached AI response directly.

```js
// Worker: hash the normalised input, check KV before calling AI
const key = `ai:${await sha256(normalise(input))}`;
const cached = await env.KV.get(key);
if (cached) return JSON.parse(cached); // ₹0 — serve from cache

const result = await callGroq(input);
await env.KV.put(key, JSON.stringify(result), { expirationTtl: 86400 }); // 24hr TTL
return result;
```

**Situations where this saves most:**
- "Usual" / "same as yesterday" repeat orders → 100% cache hit after first parse
- Daily stock check: same 50 menu items parsed every morning → cached after day 1
- Common reminders: "meeting at 10" → pattern matched before even hitting cache

**Impact estimate (TN Power User):**
~40% of 15,000 orders are repeats or near-repeats → 6,000 AI calls eliminated → **saves ₹36/month**

---

### Technique 4 · Structured Output — Fewer Tokens, No Hallucination

Never ask AI to write prose when you need structured data. Strict JSON schema output:
- Shorter prompts (no format explanation needed)
- Shorter output (no preamble, no "Sure! Here is the...", just JSON)
- Faster inference = lower latency

```js
// ✅ CORRECT — strict schema, short output
{
  "response_format": { "type": "json_object" },
  "messages": [{ "role": "user", "content": "Parse: 2 idli 1 sambar. Schema: {items:[{name,qty}]}" }]
}
// Output: {"items":[{"name":"idli","qty":2},{"name":"sambar","qty":1}]}
// ~80 output tokens

// ❌ WRONG — freeform output wastes tokens
// "Sure! I parsed the order. The customer wants 2 idlis and 1 sambar. Here's what I found..."
// ~60 wasted tokens + risk of wrong format
```

**Savings:** Structured output cuts output tokens by ~60%. Output tokens at Groq 8B cost $0.08/1M.
15,000 orders × 60 output tokens saved = 900K tokens = **₹7.20 saved/month**.

---

### Technique 5 · Deferred / Batched Analytics (don't run reports in real-time)

Analytics reports are the heaviest per-call token users (3,000–5,000 tokens each).
Never run them on-demand during peak hours — batch and schedule.

```js
// Cloudflare Worker Cron — runs once at 11PM daily, not on user request
export default {
  async scheduled(event, env) {
    const orders = await getTodayOrders(env.DB); // all 500 orders in one query
    const report = await callGroq70B(buildReportPrompt(orders)); // 1 call, not 500
    await env.KV.put(`report:${today()}`, JSON.stringify(report), { expirationTtl: 86400 });
  }
};

// When user asks "show me today's report" → serve from KV, ₹0 AI cost
```

| Approach | Calls/day | Tokens/day | Cost/month |
|---|---|---|---|
| On-demand per request | 500 | 500 × 3K = 1.5M | ₹225 |
| **Batched nightly (one call)** | **1** | **5K** | **₹0.15** |

**Savings: ₹224.85/month on analytics alone.**

---

### Technique 6 · Context Window Pruning (don't send full history)

Every token in the context window is billed. Never send full chat history.

```js
// ❌ WRONG — grows forever, costs more every message
conversationHistory.push(newMessage);
await callGroq(conversationHistory); // 10K tokens by message 20

// ✅ CORRECT — rolling window of last 3 messages + summary
const context = [
  { role: "system", content: STATIC_PROMPT },
  { role: "assistant", content: await getSummary(sessionId) }, // 100-token summary
  ...conversationHistory.slice(-3) // only last 3 turns
];
```

**Applies to:** AI assistant in TAR, "ask AI" input on home screen, ongoing order modification conversations.
**Savings:** Prevents context blowup — a 20-message conversation stays at ~600 tokens instead of growing to ~10K.

---

### Technique 7 · On-Device Intent Classification (zero token cost)

For mobile (Expo/React Native), run a tiny quantized model **locally on device** to:
- Detect intent (order / reminder / note / search / question)
- Classify complexity (simple / complex)
- Route: simple → Layer A/B, complex → Groq

This costs ₹0 and prevents even a network call for obvious inputs.

```
User types: "remind me at 7pm" → on-device: intent=REMINDER, complexity=SIMPLE
→ goes directly to device SQLite, no AI call at all → ₹0

User types: "why is my Tuesday revenue always lower than Monday?" → on-device: intent=ANALYTICS, complexity=COMPLEX  
→ routes to Groq 70B → full cost, but justified
```

**Suggested model:** Phi-3.5 Mini (3.8B, ~2GB) or Gemma 2B — can run on modern Android/iOS.
Use ONNX Runtime for React Native integration.

---

### Technique 8 · Menu-Aware Short Prompt (restaurant-specific)

For order parsing: don't send the full menu to AI. Send only the relevant section.

```js
// ❌ WRONG — full 200-item menu in every prompt = 3,000 tokens just for context
const prompt = `Menu: ${fullMenu}\nParse order: "2 idli"`;

// ✅ CORRECT — keyword extract first, then send only matched section
const keywords = extractKeywords(userInput); // "idli" → regex, ₹0
const relevantItems = menu.filter(i => keywords.includes(i.name)); // 3 items
const prompt = `Items: ${JSON.stringify(relevantItems)}\nParse: "2 idli"`;
// 50 tokens instead of 3,000
```

**Savings:** 2,950 tokens saved per AI call × 15,000 orders = **44.25M tokens = ₹221/month** at Groq 8B.
(This alone nearly eliminates the order-parsing AI cost.)

---

### Revised Power User AI Cost with All Techniques Applied

| Situation | Baseline Tokens/mo | After Optimisation | Savings |
|---|---|---|---|
| Order parsing (15K orders) | 7.5M (full menu prompt) | **150K** (menu-aware + 60% regex + cache) | **98%** |
| Staff/stock updates | 0.5M | 0.1M (structured output + cache) | 80% |
| Analytics/reports | 0.3M (on-demand) | **5K** (nightly batch, 1 call/day) | **98%** |
| AI assistant conversations | included above | rolling window, on-device intent | 70% |
| **Total** | **8.3M tokens** | **~255K tokens** | **97%** |

**Cost with optimisations at Groq 8B rate ($0.05/1M input):**
255K tokens × $0.05/1M = **$0.013 = ₹1.30/month** for TN Power User ← vs ₹249 unoptimised

> Even with a 5× safety margin for cache misses and growth: **₹7–₹10/month**.
> AI is **no longer the dominant cost** — infrastructure (₹88) is again the ceiling.

---

### Key Rules for Token Efficiency

7. **Regex before AI** — if it matches a pattern, parse locally. No API call.
8. **Static prompt prefix first** — system prompt + menu before any dynamic input.
9. **KV-cache all AI responses** — 24hr TTL, hash(normalised_input) as key.
10. **Menu-aware context** — never send full menu; extract relevant section first.
11. **Batch analytics nightly** — one Cron call at 11PM, serve from KV all day.
12. **Rolling context window** — last 3 turns + 100-token summary, never full history.
13. **On-device classification** — classify intent locally, only call Groq if needed.
14. **Structured JSON output** — always specify schema, never freeform prose.

---

## Key Rules

1. **Personal DB = device-only SQLite.** No Turso, no sync cost.
2. **`syncInterval: 300`** — sync tenant DB every 5 min, not on every write.
3. **Batch all writes** — one transaction = one 4KB frame, not one per row.
4. **Cloudflare KV** — cache global matter lookups, avoid repeated Turso reads.
5. **Default to Groq 8B** — upgrade model only when complexity demands it.
6. **Token pooling** — 2M budget per user, actual average spend ~500K.

---

## Full Cost Summary per User/Month

| Component | Strategy | Standard User (₹) | **Power User — Top TN Restaurant (₹)** |
|---|---|---|---|
| Personal DB (tasks, notes, reminders) | Device-only SQLite / R2 nightly backup | ₹0 | ₹0.02 (R2 backup of larger DB) |
| Tenant DB sync (business data) | Turso, 5-min interval, batched writes | ~₹1 | **~₹8** (300MB/mo sync) |
| Global catalog search | Cloudflare KV + Turso | ~₹0.05 | ~₹0.10 (more catalog queries) |
| Cloudflare Workers (API layer) | $0.30/1M req + $0.02/1M CPU ms | ~₹0.05 | **~₹9** (150K req/mo) |
| Durable Objects (real-time KDS) | `ctx.acceptWebSocket()` hibernation — billed per wake-up only | ~₹0.55 | **~₹70** (960 GB-s active, not 576K) |
| AI (tokens, Groq 8B + efficiency rules) | Funnel: regex→cache→8B→70B · batched analytics · menu-aware prompts | ~₹3 avg | **~₹10** (255K tokens after optimisation, vs 8.3M unoptimised) |
| **Total actual cost (typical)** | | **~₹5/user** | **~₹98/tenant** |
| **Total actual cost (unoptimised AI)** | | **~₹62/user** | **~₹337/tenant** |
| **Recommended charge** | | **₹100/user** | **₹500–₹700/tenant/mo** |
| **Net margin (optimised, typical)** | | **~₹95 (95%)** | **~₹400–₹600 (80%)** |

> **Pricing tiers implied:**
> - 🟢 **Starter** ₹100/user/mo — individuals, freelancers, small kiosks
> - 🟡 **Business** ₹500/tenant/mo — mid-size restaurants (100–200 orders/day)
> - 🔴 **Scale / TN Power** ₹500–₹700/tenant/mo — top-volume restaurants (500+ orders/day), full KDS + AI analytics
>
> 💡 **Key insight:** With all 8 token-efficiency techniques applied, a 500-orders/day TN restaurant costs **~₹98/month** to serve — not ₹337. The order-parsing cost drops 98% via regex funnel + menu-aware prompts. Analytics drops 98% via nightly batching. Margin becomes 80%+ even at power-user scale.
