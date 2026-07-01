# Observability

Observability helps you understand whether Flue work completed, failed, became slow, or used more model resources than expected.

## Inspect workflow runs

Each workflow invocation has a `runId`. Use `log.info(...)`, `log.warn(...)`, and `log.error(...)` in action context:

```typescript
async run({ harness, log, input }) {
  log.info('Summarization requested', { characters: input.text.length });
  const response = await (await harness.session()).prompt(input.text);
  log.info('Summarization completed', {
    tokens: response.usage.totalTokens,
    cost: response.usage.cost.total,
  });
  return { summary: response.text };
},
```

## Observe application activity

```typescript
import { observe } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

observe((event) => {
  if (event.type === 'run_end' && event.isError) {
    console.error('Workflow failed', event.runId, event.error);
  }
  if (event.type === 'operation' && event.durationMs > 5_000) {
    console.warn('Slow operation', event.operationKind, event.durationMs);
  }
});

const app = new Hono();
app.route('/', flue());
export default app;
```

## Choose an observability provider

| Provider | Choose it when |
|---|---|
| **OpenTelemetry** | You need vendor-neutral traces or already operate an OTel-compatible backend |
| **Braintrust** | You want content-bearing agent traces, model usage, costs, and evaluation-oriented debugging |
| **Sentry** | You primarily want actionable workflow failures and error logs without exporting model content |
