# TAR Agent — Cloudflare AI Agent

> **TAR Commerce AI Agent** — Natural language operations assistant for Telegram, WhatsApp & Slack, powered by Cloudflare Workers + Agents SDK + Groq AI + Turso.

---

## Architecture Overview

```
Client (Telegram / WhatsApp / Slack / React Native App)
        │
        ▼
Cloudflare Worker (Hono Router)  ← src/index.ts
        │
        ▼
TarAgent (Cloudflare Agents SDK / Durable Object)  ← src/agent.ts
        │         │                 │
        │         ▼                 ▼
        │   Groq LLM API        Embedded SQLite
        │   (Function Calling)  (Conversation History)
        │
        ▼
Turso DB (Persistent Business State — Inventory, Orders, Staff, etc.)
```

### RBAC (Role-Based Access Control)

Each Telegram group / Slack channel is mapped to a **role** in Turso. The Worker only provides Groq the tools allowed for that role — so the LLM cannot execute restricted actions even if asked.

| Role             | Allowed Tools                                            |
| ---------------- | -------------------------------------------------------- |
| `management`     | All 21 tools                                             |
| `kitchen`        | Inventory, waste, 86 items, maintenance, purchase orders |
| `front_of_house` | Reservations, menu, reviews                              |
| `delivery`       | Delivery orders, order status, menu                      |
| `default`        | Menu queries only                                        |

---

## Project Structure

```
taragent/
├── src/
│   ├── index.ts          # Main Worker + Hono routes
│   ├── agent.ts          # TarAgent class (Agents SDK)
│   ├── tools.ts          # 21 Groq function-call tool definitions
│   ├── rbac.ts           # Role → tool filtering
│   ├── db.ts             # Turso client + executeAction() dispatcher
│   ├── prompts.ts        # LLM system prompt
│   ├── types.ts          # Shared TypeScript interfaces
│   └── adapters/
│       ├── telegram.ts   # Telegram Bot API
│       ├── whatsapp.ts   # WhatsApp Cloud API (Meta)
│       └── slack.ts      # Slack Events API
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

---

## Setup

### 1. Install Dependencies

```bash
cd taragent
npm install
```

### 2. Create a Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create tar-commerce

# Get credentials
turso db show tar-commerce   # → TURSO_URL
turso db tokens create tar-commerce  # → TURSO_AUTH_TOKEN
```

### 3. Set Secrets

```bash
wrangler secret put GROQ_API_KEY
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put WHATSAPP_ACCESS_TOKEN
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
```

### 4. Update `wrangler.jsonc` vars

Fill in the non-secret values in `wrangler.jsonc`:

- `TURSO_URL` — your Turso DB URL (e.g. `libsql://tar-commerce-xxx.turso.io`)
- `WHATSAPP_PHONE_NUMBER_ID` — from Meta Developer Console
- `TELEGRAM_BOT_USERNAME` — your bot's username without `@`
- `WHATSAPP_VERIFY_TOKEN` — any string you choose (must match Meta dashboard)

---

## Local Development

```bash
npm run dev
# Worker starts at http://localhost:8787
```

### Bootstrap DB Schema (first run only)

```bash
curl -X POST http://localhost:8787/admin/bootstrap
```

### Register a Group Role

```bash
curl -X POST http://localhost:8787/admin/group-role \
  -H "Content-Type: application/json" \
  -d '{"chatGroupId": "-100123456789", "role": "kitchen", "platform": "telegram"}'
```

### Test Health

```bash
curl http://localhost:8787/health
# → {"status":"ok","service":"tar-agent","timestamp":"..."}
```

### Simulate Telegram Message

```bash
curl -X POST http://localhost:8787/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": 123, "first_name": "Chef"},
      "chat": {"id": -100123456789, "type": "supergroup", "title": "Kitchen"},
      "text": "@TarBot we are out of heavy cream"
    }
  }'
```

---

## Deploy

```bash
npm run deploy
```

---

## Platform Setup

### Telegram

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Set webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tar-agent.<subdomain>.workers.dev/webhook/telegram"
   ```
3. Add bot to your staff group chats. Enable privacy mode so it only responds to `@TarBot` mentions.
4. Register each group's chat ID via `/admin/group-role`.

### WhatsApp

1. Create app at [developers.facebook.com](https://developers.facebook.com) → add WhatsApp product
2. Set webhook URL: `https://tar-agent.<subdomain>.workers.dev/webhook/whatsapp`
3. Set verify token to match `WHATSAPP_VERIFY_TOKEN` in your config
4. Subscribe to `messages` events

### Slack

1. Create app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Event Subscriptions** → Request URL: `https://tar-agent.<subdomain>.workers.dev/webhook/slack`
3. Subscribe to `app_mention` bot event
4. Add bot to workspace channels and register them via `/admin/group-role`

---

## WebSocket (React Native Client)

Connect from your React Native app using the Agents SDK:

```typescript
import { AgentClient } from "agents/client";

const client = new AgentClient({
  host: "tar-agent.<subdomain>.workers.dev",
  agent: "TarAgent",
  name: "main",
});

client.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "activity") {
    // Real-time activity feed from all platforms
    console.log(msg);
  }
});
```

---

## Cost Optimisation

- AI is **only used** for natural language parsing + complex decisions (30% of interactions)
- Deterministic state changes (status updates, inventory counts) use direct SQL — no AI
- Groq `llama3-70b-8192` is ~10–50× cheaper than GPT-4o for structured extraction
- Conversation history is limited to last 10 messages per context window
