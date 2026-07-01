# Skills

Flue supports Agent Skills: reusable instructions and supporting resources that agents can load for specialized, repeatable work.

## Add a skill

```
src/
├─ agents/
│  └─ assistant.ts
├─ skills/
│  └─ review/
│     ├─ SKILL.md
│     └─ references/
│        └─ checklist.md
└─ workflows/
   └─ review-change.ts
```

## Import a skill

```typescript
import { defineAgent } from '@flue/runtime';
import review from '../skills/review/SKILL.md' with { type: 'skill' };
import triage from '../skills/triage/SKILL.md' with { type: 'skill' };

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  skills: [review, triage],
}));
```

## Frontmatter support

| Field | Spec | Flue support |
|---|---|---|
| `name` | Required | Validated: lowercase, numbers, hyphens |
| `description` | Required | Validated: max 1024 chars |
| `license` | Optional | Informational |
| `compatibility` | Optional | Max 500 chars |
| `metadata` | Optional | String-to-string mapping |
| `allowed-tools` | Optional | Accepted, not enforced |

## Invoke a skill in workflows

```typescript
import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import review from '../skills/review/SKILL.md' with { type: 'skill' };

const agent = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  skills: [review],
}));

export default defineWorkflow({
  agent,
  input: v.object({ change: v.string() }),
  async run({ harness, input }) {
    const response = await (
      await harness.session()
    ).skill('review', {
      args: { change: input.change },
      result: v.object({ approved: v.boolean(), summary: v.string() }),
    });
    return response.data;
  },
});
```
