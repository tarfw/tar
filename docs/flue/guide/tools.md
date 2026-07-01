# Tools

Tools let an agent retrieve information or perform actions while it works.

## Custom tools

```typescript
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const lookupOrderStatus = defineTool({
  name: 'lookup_order_status',
  description: 'Look up the current fulfillment status for one order ID.',
  input: v.object({
    orderId: v.pipe(v.string(), v.description('Order ID in the form order_1234')),
  }),
  output: v.object({
    status: v.nullable(v.string()),
  }),
  async run({ input, signal }) {
    const status = orderStatuses.get(input.orderId) ?? null;
    return { status };
  },
});
```

Key parts:
- **name** — Model-facing name used to call the tool
- **description** — Helps the model decide when the capability is appropriate
- **input** — Optional Valibot object schema for model-supplied input
- **output** — Optional Valibot schema for typed structured output
- **run({ input, signal })** — Performs the application-controlled work

## Using tools

```typescript
import { defineAgent } from '@flue/runtime';
import { lookupOrderStatus } from '../shared/order-tools.ts';

export default defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  instructions: 'Help customers check the status of their orders.',
  tools: [lookupOrderStatus],
}));
```

## Protect access

A tool's parameters are model-selected inputs, not an authorization boundary. Your application should decide which customer, account, or resource a tool can use:

```typescript
export default defineAgent(({ id: customerId }) => ({
  model: 'anthropic/claude-haiku-4-5',
  tools: [
    defineTool({
      name: 'lookup_customer_order',
      description: 'Look up one order belonging to this customer.',
      input: v.object({ orderId: v.string() }),
      async run({ input }) {
        const status = await orders.getStatus(customerId, input.orderId);
        return status ?? 'No accessible order was found.';
      },
    }),
  ],
}));
```

## Connect MCP servers

```typescript
import { connectMcpServer, defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';

const inventory = await connectMcpServer('inventory', {
  url: process.env.INVENTORY_MCP_URL!,
  headers: { Authorization: `Bearer ${process.env.INVENTORY_MCP_TOKEN}` },
});

const agent = defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  tools: inventory.tools,
}));
```

## When to use a tool

- A model needs to read or update application data
- An agent needs a narrow interface to an API or service
- Trusted application code must control credentials or authorization scope
- The model should decide whether and when to call a bounded function
