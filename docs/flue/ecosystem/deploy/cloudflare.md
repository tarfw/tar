# Deploy to Cloudflare

Build and deploy Flue agents on Cloudflare Workers.

## Hello World

### 1. Set up your project

```bash
mkdir my-flue-worker && cd my-flue-worker
npm init -y
npm install @flue/runtime valibot 'agents@^0.14.1'
npm install -D @flue/cli wrangler
```

### 2. Create your first agent

`.flue/workflows/translate.ts`:

```typescript
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

export const route: WorkflowRouteHandler = async (_c, next) => next();

const translator = defineAgent(() => ({ model: 'anthropic/claude-sonnet-4-6' }));

export default defineWorkflow({
  agent: translator,
  input: v.object({ text: v.string(), language: v.string() }),
  async run({ harness, input }) {
    const { data } = await (
      await harness.session()
    ).prompt(`Translate this to ${input.language}: "${input.text}"`, {
      result: v.object({
        translation: v.string(),
        confidence: v.picklist(['low', 'medium', 'high']),
      }),
    });
    return data;
  },
});
```

### 3. Configure Durable Object migrations

`wrangler.jsonc`:

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-flue-worker",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat"],
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["FlueRegistry", "FlueTranslateWorkflow"] }
  ]
}
```

### 4. Build and deploy

```bash
npx flue build --target cloudflare
npx wrangler deploy --config dist/my-flue-worker/wrangler.json
```

### 5. Add your API key

```bash
cat > .dev.vars <<'EOF'
ANTHROPIC_API_KEY="your-api-key"
EOF
npx wrangler secret put ANTHROPIC_API_KEY
```

### 6. Try it locally

```bash
npx flue dev --target cloudflare

curl http://localhost:3583/workflows/translate?wait=result \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "French"}'
```

## Using the sandbox

### Virtual sandbox (default)

```typescript
const reporter = defineAgent(() => ({ model: 'openai/gpt-5.5' }));

export default defineWorkflow({
  agent: reporter,
  input: v.object({ topic: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    await session.shell(`mkdir -p /workspace/data`);
    await session.shell(`cat > /workspace/data/config.json << 'EOF'\n{"rules": ["Be concise"]}\nEOF`);
    return await session.prompt(`Generate a report about: ${input.topic}`);
  },
});
```

### Remote sandbox (Cloudflare Sandbox)

```typescript
import { sandbox } from '@cloudflare/sandbox';
import { cloudflareSandbox } from '@flue/runtime/cloudflare';
import { getSandbox } from '@cloudflare/sandbox';

export default defineAgent(({ id, env }) => ({
  sandbox: cloudflareSandbox(getSandbox(env.Sandbox, id)),
  model: 'anthropic/claude-opus-4-7',
}));
```

## Interruption and recovery semantics

| Operation | After interruption |
|---|---|
| Direct attached agent HTTP prompt | Requeued and reconciled with conservative replay rules |
| Dispatched agent input | Durable delivery with dispatchId deduplication |
| Flue workflow invocation | Terminalized as errored. No automatic replacement |
