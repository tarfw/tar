# Google Chat Integration — tarai

> Status: Future implementation. Documented for later reference.
> Last updated: 2025-07-01

---

## Overview

Google Chat serves as a free channel for team collaboration, similar to Telegram groups. Users create Spaces, invite the tarai bot, and the bot connects that Space to a store scope.

---

## Why Google Chat

| Factor | Benefit |
|---|---|
| Cost | Free (no per-conversation fees) |
| Team spaces | Native support for group collaboration |
| Enterprise ready | Works with Google Workspace |
| OAuth simplicity | One-click user connection |
| API maturity | Stable, well-documented |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Google Chat    │     │    tarflue-v2    │     │   StorefrontDO   │
│     Space        │────▶│    Webhook       │────▶│   (s:store-101)  │
│                  │◀────│                  │◀────│                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
   Bot replies              D1 routes to              Order stored
   to space                 correct store             in SQLite
```

---

## User Onboarding Flow

### Step 1: Connect Google Chat (One-time)

| Step | User Action | System Action |
|---|---|---|
| 1 | Open tarai → Settings → Channels → Google Chat | — |
| 2 | Click "Connect Google Chat" | Redirect to Google OAuth |
| 3 | Sign in with Google, click Allow | tarai stores refresh token |
| 4 | Return to tarai | Bot connected to user's account |

### Step 2: Create Space & Invite Bot

| Step | User Action | System Action |
|---|---|---|
| 1 | Create Google Space (e.g., "Kitchen Team") | — |
| 2 | Invite `tarai-bot` to the space | Bot receives ADDED_TO_SPACE event |
| 3 | Bot asks: "Which store should this space connect to?" | — |
| 4 | User selects from their stores | Bot saves mapping in D1 |
| 5 | Done! Messages in space route to store scope | — |

### Step 3:日常 Usage

| User Types in Space | System Does |
|---|---|
| "5 Pepsi order from Aisha" | Creates order in StorefrontDO |
| "Check stock for biryani" | Reads matter from StorefrontDO |
| "Assign delivery to Kumar" | Creates motion in Kumar's Inbox |

---

## Multiple Spaces, One Store

```
┌─────────────────┐
│ Kitchen Team    │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌──────────────────┐
│ Delivery Staff  │──┼───▶│ StorefrontDO     │
└─────────────────┘  │    │ s:store-101      │
                     │    │                  │
┌─────────────────┐  │    │ All spaces see   │
│ Marketing       │──┘    │ same inventory   │
└─────────────────┘       └──────────────────┘
```

---

## D1 Schema

```sql
CREATE TABLE channel_groups (
  chat_id TEXT PRIMARY KEY,     -- spaces/ABC123
  scope TEXT NOT NULL,           -- s:store-101
  name TEXT,                     -- "Kitchen Team"
  platform TEXT,                 -- 'googlechat'
  created_by TEXT,               -- users/XYZ789
  created_at TEXT
);
```

### Example Data

| chat_id | scope | name | platform |
|---|---|---|---|
| spaces/ABC123 | s:store-101 | Kitchen Team | googlechat |
| spaces/DEF456 | s:store-101 | Delivery Staff | googlechat |
| spaces/GHI789 | s:store-202 | My Shop Team | googlechat |

---

## Webhook Events

| Event Type | What Happens |
|---|---|
| `MESSAGE` | User sends text → process with AI agent |
| `ADDED_TO_SPACE` | Bot joins space → ask which store to link |
| `REMOVED_FROM_SPACE` | Bot leaves space → cleanup D1 mapping |
| `CARD_CLICKED` | User clicks interactive card → handle action |

---

## Webhook Handler (tarflue-v2)

```typescript
// src/channels/googlechat.ts

async function handleGoogleChatWebhook(request: Request, env: Env) {
  const body = await request.json();
  
  switch (body.type) {
    case 'MESSAGE':
      return handleMessage(body, env);
    case 'ADDED_TO_SPACE':
      return handleBotAdded(body, env);
    case 'REMOVED_FROM_SPACE':
      return handleBotRemoved(body, env);
    case 'CARD_CLICKED':
      return handleCardClick(body, env);
  }
}

async function handleMessage(body: any, env: Env) {
  const spaceId = body.message.space.name;
  const senderId = body.message.sender.name;
  const text = body.message.text;
  
  // 1. Look up space → store mapping
  const mapping = await env.DB.prepare(
    "SELECT scope FROM channel_groups WHERE chat_id = ?"
  ).bind(spaceId).first();
  
  if (!mapping) {
    return linkSpacePrompt();
  }
  
  // 2. Process with AI agent
  const reply = await processMessage(text, mapping.scope, senderId);
  
  // 3. Return reply
  return { text: reply };
}
```

---

## OAuth Setup (Developer)

### Step 1: Create Google Cloud Project

| Action | Where |
|---|---|
| Go to | console.cloud.google.com |
| Create project | Name: `tarai-bot` |
| Enable API | Google Chat API |

### Step 2: Create Service Account

| Action | Where |
|---|---|
| Go to | APIs & Services → Credentials |
| Create | Service Account → name: `tarai-chat-bot` |
| Download | JSON key file (store securely) |

### Step 3: Create Chat App

| Field | Value |
|---|---|
| App name | `tarai` (what users search for) |
| Avatar URL | Bot logo |
| Description | "AI assistant for store management" |
| Interactive features | Enabled |
| Connection | HTTP endpoint URL |
| Webhook URL | `https://tarflue.your-domain.com/channels/googlechat/webhook` |
| Visibility | Private (your workspace only) |

---

## ACL Model

| Level | Check | Enforced By |
|---|---|---|
| Space-level | Is this space mapped to a scope? | D1 query |
| Role-level | What can this user do? | Agent logic |

| User Role | Can See | Can Do |
|---|---|---|
| Store owner | All space motions | All actions |
| Staff/member | Assigned motions | Role-based actions |
| Viewer | Read-only | No actions |

---

## Card Components by motion.type

| motion.type | Card | Actions |
|---|---|---|
| `order` | OrderCard | Confirm, Ready, Cancel |
| `delivery` | DeliveryCard | Accept, Delivered |
| `task` | TaskCard | Complete, Reassign |
| `stock_alert` | StockCard | Restock, Dismiss |
| `lead` | LeadCard | Contact, Convert |
| `chat_message` | ChatCard | Reply |

---

## Comparison with Other Channels

| Feature | Telegram | Slack | Discord | Google Chat |
|---|---|---|---|---|
| Cost | Free | Free | Free | Free |
| Team groups | ✅ | ✅ | ✅ | ✅ |
| Mini apps | ✅ | ✅ | ✅ | ❌ |
| Bot setup | Easy | Easy | Easy | Medium |
| OAuth required | No | No | No | Yes |
| Enterprise ready | No | Yes | No | Yes |

---

## Future Considerations

| Item | Status |
|---|---|
| OAuth flow | To implement |
| Webhook handler | To implement |
| Space → store mapping | To implement |
| Interactive cards | To implement |
| Typing indicators | To implement |

---

## References

- [Google Chat API Docs](https://developers.google.com/chat/quickstart)
- [Google Chat Webhooks](https://developers.google.com/chat/how-tos/webhooks)
- [Google Cloud Console](https://console.cloud.google.com)
