---
type: Channel
title: Telegram integration
description: Telegram groups map to workspace scopes via D1. Members stay in Telegram. Bot processes messages.
resource: tarflue-v2://src/channels/telegram.ts
tags: [channel, telegram, groups, d1]
timestamp: 2026-07-04T00:00:00Z
---

# Telegram integration

Telegram groups are how teams access workspaces. The bot processes messages and routes them to the correct workspace.

## Setup flow

```
1. User creates Telegram group "Kitchen Team"
2. User adds @tarai_bot to the group
3. First message triggers D1 insert:
   INSERT INTO channel_groups VALUES (-100123456, 'w:rest-101', 'Kitchen Team', 'telegram')
4. All subsequent messages route to w:rest-101
```

## D1 schema

```sql
CREATE TABLE channel_groups (
  chat_id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,  -- 'w:rest-101'
  name TEXT,
  platform TEXT,
  created_by INTEGER,
  created_at TEXT
);
```

## Message flow

```
User sends "5 Burgers order" in Telegram group
  → Telegram POSTs to /channels/telegram/webhook
  → chat_id -100123456 → D1 lookup → scope: w:rest-101
  → from.id → user identity
  → Agent processes with w:rest-101 scope
  → Writes motion to user's Inbox
  → Worker replies in Telegram: "5 Burgers order recorded"
```

## Multiple groups per workspace

```
Telegram Group A → w:rest-101
Telegram Group B → w:rest-101

Both access the same WorkspaceDO.
Inventory is shared. Writes are serialized.
```

## Deep link shortcut

Bot generates `t.me/` link that opens group creation with bot pre-added. Reduces setup to 2 taps.

## Cost

D1 is 45x cheaper than KV for channel routing:
- 10M groups: ~$0.33/mo reads
- D1 included in Cloudflare paid plan

## Related

- [Architecture: Scopes](/architecture/scopes.md) — w:, o:, p:, g: prefixes
- [Slack](/channels/slack.md) — similar pattern
- [Discord](/channels/discord.md) — similar pattern
