# Durable Agents

Durable execution is about recovering safely when running work is disrupted by a server restart, deployment, lost connection, or unexpected failure. Flue handles that recovery differently for continuing agents and finite workflows.

## Durable Agents

Agents are continuing, stateful contexts. Each agent instance is a single conversation that records history so later operations can continue from where earlier work ended.

```
agent input → stored session history → operation completes
↓
later input → reopens the same session → continues with earlier context
```

### Persist session history

To store session history in an application-controlled database, create a `src/db.ts` file that default-exports a `PersistenceAdapter`. See [Database](/docs/guide/database/) for setup.

### Durable Agents on Cloudflare

On Cloudflare, generated Durable Object-backed agents store session history in SQLite by default. They also protect accepted agent input while it is being processed.

### Durable Agents on Node.js

On Node.js, sessions and accepted input live in process memory by default. Restarting the process loses all in-flight work and session history. To persist across restarts, create a `src/db.ts` that exports a `PersistenceAdapter` such as `sqlite()` (file-backed) or `postgres()`.

## Durable Workflows

Workflows are finite function invocations. Each invocation runs your authored `run(...)` function once and receives its own `runId`. Flue workflows are **not resumable**. If a workflow is interrupted, your application decides whether starting the workflow again is appropriate.

### Retry workflows explicitly

Design workflows so they can be invoked again when retry is appropriate, like CI jobs.

```
workflow invocation → run(...) → result or error
interrupted invocation
└→ start a new invocation when retry is appropriate
```
