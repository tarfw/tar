# Agents

Agents are useful when your application needs a model to keep working within a continuing context.

## Creating a new agent

In a Flue project, an agent is a file in `src/agents/` whose default export is created with `defineAgent(...)`:

```typescript
import { defineAgent, type AgentRouteHandler } from '@flue/runtime';

export const description = 'Tells a short joke in response to each message.';
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  instructions: 'Tell a short joke in response to each message.',
}));
```

## Agent configuration

```typescript
import { defineAgent } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import reviewChecklist from '../skills/review-checklist/SKILL.md' with { type: 'skill' };
import { reviewChange } from '../actions/review-change.ts';
import { repositoryTools } from '../shared/repository-tools.ts';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Review the requested change and report only findings supported by evidence.',
  cwd: '/srv/repositories/catalog-service',
  actions: [reviewChange],
  tools: repositoryTools,
  skills: [reviewChecklist],
  sandbox: local(),
}));
```

## Agent ID

Each agent is initialized with an `id`, which identifies the continuing instance:

```
POST /agents/support-assistant/ticket-8472
              └─────────┘ id
```

## Agent profiles

```typescript
import { defineAgent, defineAgentProfile } from '@flue/runtime';
import { supportTools } from '../shared/support-tools.ts';

const support = defineAgentProfile({
  model: 'anthropic/claude-haiku-4-5',
  instructions: 'Answer customer support questions clearly and accurately.',
  tools: supportTools,
});

export default defineAgent(() => ({
  profile: support,
}));
```

## Subagents

Subagents let an agent delegate focused work to another agent:

```typescript
const policyResearcherSubagent = defineAgentProfile({
  name: 'policy_researcher',
  description: 'Finds relevant policy text and quotes the supporting passages.',
  instructions: 'Read the policy workspace and return supporting quotations with file paths.',
});

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Answer policy questions only after delegating source lookup to policy_researcher.',
  sandbox: local(),
  subagents: [policyResearcherSubagent],
}));
```

## Interacting with your agent

### HTTP

```http
POST /agents/support-assistant/ticket-8472
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "Can you summarize the open issues in my case?" }
```

### dispatch()

Use `dispatch(...)` for asynchronous events:

```typescript
import { dispatch } from '@flue/runtime';

app.post('/webhooks/support-comments', async (c) => {
  const receipt = await dispatch(supportAssistant, {
    id: event.ticketId,
    input: { type: 'support.comment.created', commentId: event.commentId, text: event.text },
  });
  return c.json(receipt, 202);
});
```
