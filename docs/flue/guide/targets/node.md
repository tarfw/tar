# Node.js Target

The Node.js target builds your agents and workflows as a standard Node.js server.

## Generated server

```bash
npx flue build --target node
node dist/server.mjs
```

The server listens on port 3000 by default. Set `PORT` to change it. `flue dev --target node` uses port 3583 and reloads on changes.

## State and durability

Without `db.ts`, the generated Node server uses process-local in-memory SQLite. With a durable adapter, direct prompts and `dispatch(...)` inputs enter a SQL-backed per-instance queue.

## local() sandbox

Node is the only target with the built-in `local()` sandbox factory:

```typescript
import { local } from '@flue/runtime/node';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  sandbox: local(),
}));
```

Only shell-essential environment variables are exposed by default. Pass specific values through `env`:

```typescript
const reviewer = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  sandbox: local({
    env: { GH_TOKEN: process.env.GH_TOKEN },
  }),
}));
```

## Environment and secrets

```bash
# Development
npx flue dev --target node

# Production
set -a; source .env; set +a
node dist/server.mjs
```

## API Reference

### `local(...)`

```typescript
import { local } from '@flue/runtime/node';
function local(options?: LocalSandboxOptions): SandboxFactory;
```

Options:
- `cwd` — Working directory. Defaults to `process.cwd()`
- `env` — Additional environment variables

### `sqlite(...)`

```typescript
import { sqlite } from '@flue/runtime/node';
function sqlite(path?: string): PersistenceAdapter;
```

Omit `path` for in-memory storage, or pass a file path for persistence.
