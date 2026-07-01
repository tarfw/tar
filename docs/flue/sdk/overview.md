# SDK Overview

The client SDK is exported from `@flue/sdk`. Use it from applications that consume deployed Flue agents and workflows.

```typescript
import { createFlueClient } from '@flue/sdk';

const client = createFlueClient({
  baseUrl: 'https://example.com/api',
  token: process.env.FLUE_TOKEN,
});
```

## Client

`createFlueClient(...)` configures access to a deployed Flue application.

### API namespaces

- `client.agents` — invokes persistent agent instances and streams their events
- `client.workflows` — starts workflow runs
- `client.runs` — inspects and streams runs exposed by their owning workflows

## Running the SDK locally

When using the SDK against a local Flue application, configure the client with your local base URL and any required headers for development.

### Errors

Errors describes HTTP and stream errors. Events and records describes observable events, records, and normalized model-turn data.
