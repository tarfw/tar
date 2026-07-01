# Configuration Reference

Use `flue.config.ts` to select the build target, project root, and build output directory.

```typescript
import { defineConfig } from '@flue/cli/config';

export default defineConfig({
  target: 'node',
});
```

Flue recognizes `flue.config.ts`, `.mts`, `.mjs`, `.js`, `.cjs`, and `.cts`, in that priority order.

## target

- **Type:** `'node' | 'cloudflare'`
- **Default:** none (required)

`'node'` builds a Node.js server. `'cloudflare'` builds a Workers-compatible application.

## root

- **Type:** `string`
- **Default:** directory containing the selected flue.config file

Project root. Must not be empty.

## output

- **Type:** `string`
- **Default:** `<root>/dist`

Build output directory.

## Vite configuration

Export `vite` from `flue.config.ts` to pass native Vite configuration:

```typescript
import { defineConfig as defineViteConfig } from 'vite';
import { defineConfig } from '@flue/cli/config';

export default defineConfig({
  target: 'node',
});

export const vite = defineViteConfig({
  server: {
    watch: {
      ignored: ['**/evals/results/**'],
    },
  },
});
```

## defineConfig()

```typescript
function defineConfig(config: UserFlueConfig): UserFlueConfig;
```

Provides type checking and editor completion for `flue.config.ts`.
