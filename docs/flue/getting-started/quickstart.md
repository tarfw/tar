# Getting Started with Flue

Flue is a TypeScript framework for building AI agents. Define your agents using the exact same harness-driven architecture used by Claude Code and other coding agents to build truly autonomous software. Write your agents with Flue and then run them anywhere (local CI, Node.js server, Cloudflare, etc.).

## Prerequisites

- **Node.js** — >=22.19.0 minimum required version
- **LLM** — At least one model specifier (e.g., `anthropic/claude-sonnet-4-6` or `cloudflare/@cf/moonshotai/kimi-k2.6`)
- **LLM Provider** — API key(s) to your favorite model provider
- **A coding agent (recommended)** — Several Flue features assume you have a coding agent available locally
- **A container sandbox (optional)** — For a real VM instead of the built-in virtual sandbox

## Manual Installation

### 1. Install Flue

```bash
npm install @flue/runtime
npm install --save-dev @flue/cli
echo 'ANTHROPIC_API_KEY="your-api-key"' > .env
npx flue init --target node   # or: --target cloudflare
```

### 2. Create your first agent module

Create `agents/hello-world.ts`:

```typescript
import { defineAgent } from '@flue/runtime';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Tell a funny "hello world" engineering joke.',
}));
```

### 3. Run your agent locally

```bash
npx flue run hello-world --input '{"message":"Tell me a joke."}'
```

## Next Steps

- [Agents](/docs/concepts/agents/) — Understanding agents and sessions
- [Workflows](/docs/guide/workflows/) — Creating bounded operations
- [Configuration](/docs/reference/configuration/) — Targets and environment setup
- [Sandboxes](/docs/guide/sandboxes/) — Execution capabilities
