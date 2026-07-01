# Channels

Channels bring provider HTTP events into a Flue application. A channel verifies the provider request, parses it into typed provider-native data, and calls your application handler.

## Add a channel

```bash
flue add channel slack --print | codex
```

A typical channel module:

```typescript
import { createSlackChannel } from '@flue/slack';
import { WebClient } from '@slack/web-api';

export const client = new WebClient(process.env.SLACK_BOT_TOKEN);

export const channel = createSlackChannel({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  async events({ payload }) {
    if (payload.type !== 'event_callback') return;
    // Handle payload.event
  },
});
```

## File-based routing

Each immediate file beneath `channels/` exports one named channel binding:
- `src/channels/github.ts` → `/channels/github/webhook`
- `src/channels/slack.ts` → `/channels/slack/events`, `/channels/slack/interactions`, `/channels/slack/commands`

## Handle verified events

```typescript
import { dispatch } from '@flue/runtime';
import { createSlackChannel } from '@flue/slack';
import assistant from '../agents/assistant.ts';

export const channel = createSlackChannel({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  async events({ payload }) {
    if (payload.type !== 'event_callback') return;
    switch (payload.event.type) {
      case 'app_mention': {
        await dispatch(assistant, {
          id: channel.conversationKey({
            teamId: payload.team_id,
            channelId: event.channel,
            threadTs: event.thread_ts ?? event.ts,
          }),
          input: { type: 'slack.app_mention', text: event.text },
        });
        return;
      }
    }
  },
});
```

## Custom Channel

When Flue does not provide a first-party channel:

```bash
flue add channel https://provider.example/webhooks --print | codex
```

## Ownership boundary

| Concern | Owner |
|---|---|
| Request authentication and signature verification | Channel package |
| Provider handshakes and protocol responses | Channel package |
| Discovered routes beneath `/channels/<name>/...` | Flue |
| Provider SDK client and outbound credentials | Application |
| Agent tools and authorization policy | Application |
