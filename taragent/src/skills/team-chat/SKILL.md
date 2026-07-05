---
name: team-chat
description: How to handle internal team messaging, notifications, and channel communication
---

# Team Chat Skill

## Core Concepts

### Channel
A communication channel (Telegram, Slack, Discord) mapped to a workspace scope via D1.
- `channel_groups` table: `{ chat_id, scope, name, platform }`

### Message
A team message stored as `matter` with `type='message'`.
- `data` = `{ sender, channel, content, platform }`

## Common Operations (6-Tool Pattern)

### Send Team Message
1. `create(table='matter', type='message', title:'Message from {sender}', data:{sender, channel, content, platform}, scope='{scope}')`
2. `create(table='motion', stream:'{channel}', action=99993, data:{event:'message_sent', sender, preview: content.substring(0, 100)}, scope='{scope}')`

### List Channel Messages
1. `read(table='matter', type='message', scope='{scope}', filters:[{key:'channel', val:'{channelId}'}], limit:50)`

### Search Messages
1. `search(query='{searchTerm}', scope='{scope}')`

### Notify Team
1. `create(table='matter', type='notification', title='{title}', data:{message, severity, channel}, scope='{scope}')`
2. `create(table='motion', stream:'{channel}', action=99993, data:{event:'notification', title, severity}, scope='{scope}')`

## Channel Setup

### Telegram
1. User creates group → adds bot → bot registers in D1
2. First message triggers: `INSERT INTO channel_groups VALUES (chatId, 'w:{scope}', '{name}', 'telegram')`

### Slack
1. Bot creates channel via `conversations.create` API
2. Register in D1

### Discord
1. Bot creates channel via Discord API
2. Register in D1

## Best Practices

- Link messages to channels via `data.channel`
- Store sender info in `data.sender`
- Log notifications to motion for audit
- Use `data.platform` to route responses correctly
