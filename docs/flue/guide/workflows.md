# Workflows

Workflows are finite, inspectable operations for background jobs, document transformations, reviews, and CI tasks.

## Create a workflow

A file in `src/workflows/` defines a discovered workflow:

```typescript
import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';

export default defineWorkflow({
  agent: defineAgent(() => ({ model: 'anthropic/claude-haiku-4-5' })),
  input: v.object({ text: v.string() }),
  output: v.object({ summary: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(input.text);
    return { summary: response.text };
  },
});
```

## Use a reusable Action

```typescript
import { defineAgent, defineWorkflow } from '@flue/runtime';
import { summarize } from '../actions/summarize.ts';

export default defineWorkflow({
  agent: defineAgent(() => ({ model: 'anthropic/claude-haiku-4-5' })),
  action: summarize,
});
```

## Invoke a workflow

### CLI

```bash
pnpm exec flue run summarize --input '{"text":"Summarize this."}'
```

### Application code

```typescript
import { invoke } from '@flue/runtime';
import summarize from './workflows/summarize.ts';

const { runId } = await invoke(summarize, {
  input: { text: 'Summarize this document.' },
});
```

## Expose a workflow over HTTP

```typescript
import type { WorkflowRouteHandler, WorkflowRunsHandler } from '@flue/runtime';
import { requireUser } from '../auth.ts';

export const route: WorkflowRouteHandler = requireUser;
export const runs: WorkflowRunsHandler = requireUser;
```

## Use the workflow harness

```typescript
async run({ harness, input }) {
  await harness.fs.writeFile('document.md', input.document);
  const session = await harness.session();
  await session.prompt('Review document.md and write findings to review.md.');
  return { review: await harness.fs.readFile('review.md') };
}
```
