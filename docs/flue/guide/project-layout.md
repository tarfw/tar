# Project Layout

Flue discovers application entrypoints from your project's source directory.

## Example project layout

```
my-project/
├─ package.json
├─ flue.config.ts
├─ src/
│  ├─ app.ts
│  ├─ db.ts
│  ├─ cloudflare.ts
│  ├─ agents/
│  │  └─ support-assistant.ts
│  ├─ workflows/
│  │  └─ summarize-ticket.ts
│  └─ channels/
│     └─ github.ts
└─ dist/
```

## Important files and directories

| Path | Purpose | Learn more |
|---|---|---|
| `app.ts` | Optional entrypoint for composing Flue with your routes and middleware | Routing |
| `db.ts` | Optional Node.js persistence adapter | Database |
| `cloudflare.ts` | Optional Cloudflare-only module for Worker exports | Cloudflare |
| `agents/` | Addressable agents for continuing interactions | Agents |
| `workflows/` | Finite operations that receive input and return a result | Workflows |
| `channels/` | Verified provider HTTP ingress discovered by filename | Channels |

## Source directory

Flue selects one source directory in this order:
1. `.flue/` — Self-contained Flue source area inside a larger application
2. `src/` (Recommended) — The recommended layout for new projects
3. The project root — For small dedicated projects

## Output directory

`dist/` is the default output directory. Configure it:

```typescript
import { defineConfig } from '@flue/cli/config';
export default defineConfig({
  output: './build',
});
```
