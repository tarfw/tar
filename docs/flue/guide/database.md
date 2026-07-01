# Database

Flue uses a database for agent session history, accepted agent submissions, and workflow-run records.

## db.ts

On Node.js, add a source-root `db.ts` file when state should survive process restart:

```typescript
import { sqlite } from '@flue/runtime/node';
export default sqlite('./data/flue.db');
```

Cloudflare does not use `db.ts`. Generated agent and workflow Durable Objects use SQLite automatically.

## SQLite on Node.js

```typescript
import { sqlite } from '@flue/runtime/node';

// File-backed: survives process restart on the same host
export default sqlite('./data/flue.db');

// In-memory: equivalent to omitting db.ts
// export default sqlite();
```

## Postgres on Node.js

```typescript
import { postgres } from '@flue/postgres';
export default postgres(process.env.DATABASE_URL!);
```

## Choosing an adapter

| Use case | Recommended adapter |
|---|---|
| Local development | `sqlite()` with a file path, or no `db.ts` |
| Single-host Node deployment | File-backed `sqlite()` |
| Multi-replica Node deployment | `@flue/postgres` |
| Cloudflare deployment | Built-in Durable Object SQLite |
| Another database backend | Custom `PersistenceAdapter` |

## What the database stores

| Stored by Flue | Not stored by Flue |
|---|---|
| Agent session messages and compaction state | Sandbox files and installed dependencies |
| Accepted direct prompts and dispatch submissions | External API side effects |
| Workflow-run records and persisted events | Application-owned business data |
| Run indexing | Provider credentials or secrets |
