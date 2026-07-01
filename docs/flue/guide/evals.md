# Evals

Model output can change when you revise instructions, switch models, or alter the tools available to an agent. Evals give those changes a repeatable set of scenarios and expectations.

## vitest-evals

```bash
flue add tooling vitest-evals
```

### Write an eval

```typescript
import { expect } from 'vitest';
import { describeEval, toolCalls } from 'vitest-evals';
import { createFlueAgentHarness } from './harness.ts';

const harness = createFlueAgentHarness({ agentName: 'service-status' });

describeEval('Flue service status agent', { harness }, (it) => {
  it('checks live service status before answering', async ({ run }) => {
    const result = await run('Is the checkout service currently operational?');
    expect(result.output).toContain('operational');
    expect(toolCalls(result).map((call) => call.name)).toContain('get_service_status');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });
});
```

### Run evals

```bash
# Terminal 1: Start the application
pnpm exec flue dev

# Terminal 2: Run the eval suite
pnpm run evals
```

### Evaluate a deployed application

```bash
FLUE_BASE_URL=https://your-app.example.com pnpm run evals
```
