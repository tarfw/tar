# Actions

An Action is reusable logic that orchestrates an agent harness in a deterministic, reliable way. Use one when a sensitive or reliability-critical task needs application-controlled steps, context, and results.

## Define an Action

```typescript
import { defineAction } from '@flue/runtime';
import * as v from 'valibot';

export const summarize = defineAction({
  name: 'summarize_document',
  description: 'Summarize a document clearly and concisely.',
  input: v.object({ text: v.string() }),
  output: v.object({ summary: v.string() }),
  async run({ harness, input, log }) {
    log.info('Summarizing document');
    const session = await harness.session();
    const response = await session.prompt(`Summarize this text:\n\n${input.text}`);
    return { summary: response.text };
  },
});
```

Key parts:
- **name** — Model-facing name used when an agent exposes the Action
- **description** — Helps the model decide when to call it
- **input** — Optional Valibot object schema for validation
- **output** — Optional Valibot schema for validated returns
- **run({ harness, input, log })** — Performs the operation

## Use an Action in a workflow

```typescript
import { defineAgent, defineWorkflow } from '@flue/runtime';
import { summarize } from '../actions/summarize.ts';

export default defineWorkflow({
  agent: defineAgent(() => ({ model: 'anthropic/claude-haiku-4-5' })),
  action: summarize,
});
```

## Give an Action to an agent

```typescript
import { defineAgent } from '@flue/runtime';
import { summarize } from '../actions/summarize.ts';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Help the user edit and understand their documents.',
  actions: [summarize],
}));
```

## When to use an Action

- Application code needs to control the sequence of agent operations
- Sensitive or reliability-critical work needs validated inputs and results
- A multi-step task should behave consistently instead of relying on the model to plan every step
- The same agent-backed operation should be available to workflows, agents, or both
