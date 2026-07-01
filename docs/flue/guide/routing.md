# Routing

`src/app.ts` is an optional entrypoint for providing your own HTTP application in a Flue project.

## app.ts

```typescript
import { flue } from '@flue/runtime/routing';
import { Hono, type MiddlewareHandler } from 'hono';
import { authenticate } from './auth.ts';

const requireUser: MiddlewareHandler = async (c, next) => {
  const user = await authenticate(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};

const app = new Hono();
app.get('/health', (c) => c.json({ ok: true }));
app.use('/agents/*', requireUser);
app.use('/workflows/*', requireUser);
app.route('/', flue());
export default app;
```

## Add custom routes

```typescript
import { dispatch } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';
import supportAssistant from './agents/support-assistant.ts';

const app = new Hono();
app.post('/webhooks/support-comments', async (c) => {
  const event = await parseVerifiedSupportComment(c.req.raw);
  const receipt = await dispatch(supportAssistant, {
    id: event.ticketId,
    input: { type: 'support.comment.created', text: event.text },
  });
  return c.json(receipt, 202);
});
app.route('/', flue());
export default app;
```

## Customized routing

Mount Flue beneath a prefix:

```typescript
app.route('/api', flue());
```

## Exposing agents and workflows

| Module export | Available through mounted Flue application |
|---|---|
| Agent `route` | HTTP prompts at `POST /agents/:name/:id` and event streaming at `GET /agents/:name/:id` |
| Workflow `route` | HTTP invocation at `POST /workflows/:name` |
| Workflow `runs` | Authorized HTTP operations on existing runs at `/runs/:runId` |
| Channel `channel` | Provider-declared HTTP surfaces at `/channels/:name/<suffix>` |
