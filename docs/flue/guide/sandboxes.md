# Sandboxes

Sandboxes give an agent a workspace to read, write, and run commands in while it works.

## Virtual sandbox (default)

By default, an initialized agent works in a virtual sandbox — a lightweight, in-memory workspace powered by just-bash.

```typescript
const reviewer = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  cwd: '/workspace',
}));

export default defineWorkflow({
  agent: reviewer,
  input: v.object({ document: v.string() }),
  async run({ harness, input }) {
    await harness.fs.writeFile('document.md', input.document);
    await (await harness.session())
      .prompt('Review document.md and write your findings to review.md.');
    return { review: await harness.fs.readFile('review.md') };
  },
});
```

## Local sandbox (Node.js only)

Use `local()` when an agent should operate directly on the host filesystem and shell:

```typescript
import { local } from '@flue/runtime/node';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  sandbox: local(),
  cwd: '/srv/checkouts/catalog-service',
}));
```

## Remote sandboxes

Use a remote sandbox via integrations like Daytona, E2B, Modal, or Cloudflare Sandbox.

## Persistence and security

| Decision | Controlled by |
|---|---|
| Conversation history available later | Session persistence via `db.ts` adapter or target default |
| Files, packages, artifacts available later | The sandbox or workspace lifecycle |
| Access to repos, APIs, credentials | Sandbox environment, tools, and authorization policy |

## Virtual vs Remote sandbox

| Aspect | Virtual sandbox | Remote sandbox |
|---|---|---|
| Startup | Millisecond startup | Seconds to start |
| Capabilities | Grep, glob, read, basic shell | Full Linux: git, Node.js, Python, browsers |
| Storage | R2 or inline files | Real persistent filesystem |
| Use case | High-traffic agents | Coding agents, complex environments |
