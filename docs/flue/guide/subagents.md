# Subagents

Subagents let an agent delegate a piece of work to a named specialist while it continues to own the interaction.

## Define a subagent

```typescript
import { defineAgent, defineAgentProfile } from '@flue/runtime';

const issueClassifier = defineAgentProfile({
  name: 'issue_classifier',
  description: 'Classifies support issues for routing.',
  instructions: 'Return the likely product area and urgency for the reported issue.',
});

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Help resolve support requests. Delegate classification when it helps your answer.',
  subagents: [issueClassifier],
}));
```

## Use subagents in workflows

```typescript
import { defineAgent, defineWorkflow, defineAgentProfile } from '@flue/runtime';
import * as v from 'valibot';

const reviewer = defineAgentProfile({
  name: 'reviewer',
  instructions: 'Review the proposed change and identify concrete correctness risks.',
});

const coordinator = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  subagents: [reviewer],
}));

const Review = v.object({
  summary: v.string(),
  risks: v.array(v.string()),
});

export default defineWorkflow({
  agent: coordinator,
  input: v.object({ change: v.string() }),
  output: Review,
  async run({ harness, input }) {
    const response = await (
      await harness.session()
    ).task(input.change, {
      agent: 'reviewer',
      result: Review,
    });
    return response.data;
  },
});
```

## Configuration inheritance

| Field | Behavior |
|---|---|
| `instructions`, `tools`, `skills`, `subagents` | Profile-owned. Only the profile's declarations apply; omitted means none |
| `model`, `thinkingLevel`, `compaction` | Inherits as a default. Profile value wins when declared |
| `durability` | Rejected on subagent profiles |
