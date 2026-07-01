# Schedules

Schedules often start bounded work such as daily summaries, recurring reports, data synchronization, or cleanup.

## Scheduling a Workflow on Cloudflare

Add a Cron Trigger to `wrangler.jsonc`:

```json
{
  "triggers": {
    "crons": ["0 9 * * *"]
  }
}
```

Then invoke from `src/cloudflare.ts`:

```typescript
import { invoke } from '@flue/runtime';
import dailySummary from './workflows/daily-summary.ts';

export default {
  async scheduled(controller: ScheduledController) {
    await invoke(dailySummary, {
      input: {
        prompt: 'Review recent activity and prepare the daily summary.',
        scheduledAt: new Date(controller.scheduledTime).toISOString(),
      },
    });
  },
};
```

## Scheduling a Workflow on Node.js

```typescript
import { invoke } from '@flue/runtime';
import { Cron } from 'croner';
import dailySummary from './workflows/daily-summary.ts';

new Cron('0 9 * * *', {
  protect: true,
  timezone: 'UTC',
}, async () => {
  await invoke(dailySummary, {
    input: {
      prompt: 'Review recent activity and prepare the daily summary.',
      scheduledAt: new Date().toISOString(),
    },
  });
});
```

## Scheduling input for a continuing Agent

```typescript
import { dispatch } from '@flue/runtime';
import dailySummary from './agents/daily-summary.ts';

await dispatch(dailySummary, {
  id: 'daily-summary',
  input: { type: 'schedule', scheduledAt: new Date().toISOString() },
});
```
