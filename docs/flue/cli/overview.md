# CLI Reference

Install `@flue/cli` as a development dependency:

```bash
npm install --save-dev @flue/cli
npx flue dev
```

Requires Node.js >=22.19.0.

## Commands

| Command | Description |
|---|---|
| `flue init` | Create an initial `flue.config.ts` |
| `flue dev` | Serve and watch the local application |
| `flue run` | Execute one agent prompt or workflow invocation, then exit |
| `flue build` | Create deployable application artifacts |
| `flue add` | Fetch sandbox, channel, or database installation blueprints |
| `flue update` | Fetch a current blueprint for newer upgrade guides |
| `flue docs` | List, read, and search the bundled Flue documentation |

## flue dev

```bash
npx flue dev
```

Serves the application for its configured target, watches source files, and rebuilds on changes.

## flue run

```bash
npx flue run assistant --input '{"message":"Summarize this repository."}'
npx flue run summarize-ticket --input '{"ticket":"Ticket details"}'
```

Use `--server` for a non-root mount:

```bash
npx flue run workflow:summarize-ticket \
  --server https://example.com/api/flue \
  --input '{"ticket":"Ticket details"}'
```

## flue build

```bash
npx flue build
```

Creates target-specific deployment output.

## flue add

Fetches integration blueprints for your coding agent:

```bash
flue add channel slack --print | codex
flue add sandbox daytona --print | codex
flue add tooling vitest-evals --print | codex
```
