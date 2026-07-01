# Cloudflare Target

The Cloudflare target builds your agents and workflows for the Cloudflare platform. Generated agents and workflows run inside Durable Objects.

## Generated Durable Objects

Flue generates a Durable Object class and Wrangler binding for each discovered agent and workflow:

```
src/agents/support-chat.ts -> FlueSupportChatAgent
                              env.FLUE_SUPPORT_CHAT_AGENT
src/workflows/translate.ts  -> FlueTranslateWorkflow
                              env.FLUE_TRANSLATE_WORKFLOW
```

## wrangler.jsonc

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-flue-worker",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat"],
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["FlueRegistry", "FlueSupportChatAgent", "FlueTranslateWorkflow"]
    }
  ]
}
```

## Managing migrations

```json
{
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["FlueRegistry", "FlueSupportChatAgent"] },
    { "tag": "v2", "new_sqlite_classes": ["FlueTranslateWorkflow"] }
  ]
}
```

## Durable agent execution

Cloudflare agents durably admit direct HTTP prompts together with dispatch(...) inputs in the same queue:

```
direct HTTP prompt ─────────────────────┐
├→ durable per-session queue → stored session history
dispatch(...) input ────────────────────┘
```

## Workers AI

```typescript
export default defineAgent(() => ({
  model: 'cloudflare/@cf/meta/llama-3.1-8b-instruct',
}));
```

## Cloudflare Sandbox

```typescript
import { getSandbox } from '@cloudflare/sandbox';
import { defineAgent } from '@flue/runtime';
import { cloudflareSandbox } from '@flue/runtime/cloudflare';

type Env = { Sandbox: DurableObjectNamespace };

export default defineAgent(({ id, env }) => ({
  model: 'anthropic/claude-sonnet-4-6',
  sandbox: cloudflareSandbox(getSandbox(env.Sandbox, id)),
  cwd: '/workspace',
}));
```

## Extending Agents

```typescript
import { defineAgent } from '@flue/runtime';
import { extend } from '@flue/runtime/cloudflare';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
}));

export const cloudflare = extend({
  base: (Base) =>
    class extends Base {
      async onStart() {
        await this.scheduleEvery(60, 'heartbeat');
      }
      async heartbeat() {
        this.setState({ ...this.state, lastHeartbeatAt: Date.now() });
      }
    },
});
```

## API Reference

### `extend(...)`

```typescript
import { extend } from '@flue/runtime/cloudflare';
function extend<TBase extends object = CloudflareAgentLike>(
  extension: CloudflareExtension<TBase>,
): CloudflareExtension<TBase>;
```

### `getCloudflareContext()`

```typescript
import { getCloudflareContext } from '@flue/runtime/cloudflare';
function getCloudflareContext(): CloudflareContext;
```

Returns the current Cloudflare runtime context including `env` and `storage`.

### `getDurableObjectIdentity()`

```typescript
import { getDurableObjectIdentity } from '@flue/runtime/cloudflare';
function getDurableObjectIdentity(): FlueDurableObjectIdentity;
```

Returns the generated Durable Object identity.
