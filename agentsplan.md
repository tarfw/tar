# 🚀 2-DAY IMPLEMENTATION PLAN: Mastra AI + Cloudflare Workers

**Goal:** Deploy 8 AI agents with Cloudflare Workers as a separate API endpoint in 2 days

**Cost Target:** $0-15/month (vs $70-120 with Vercel + Groq only)

---

## 📋 OVERVIEW

### What We're Building
- **Separate Workers Project:** `tar-workers/` (standalone API)
- **8 AI Agents:** Space, Orders, Products, Items, Stores, Files, Locations, Customers
- **Smart Routing:** Cloudflare AI (free) + Groq (paid fallback)
- **Real Data:** InstantDB tools for querying your database
- **Streaming:** Real-time responses to Expo app

### Architecture
```
React Native App (tar/)
    ↓ HTTPS
Cloudflare Workers (tar-workers/)
    ↓
Mastra AI Framework
    ↓
Cloudflare AI (70%) + Groq (30%)
    ↓
InstantDB (your data)
```

---

## 📁 PROJECT STRUCTURE

```
tar-workers/                    [NEW - Separate project]
├── src/
│   ├── index.ts               [Workers entry point + /api/chat route]
│   ├── agents/
│   │   ├── space.ts           [Space agent]
│   │   ├── orders.ts          [Orders agent]
│   │   ├── products.ts        [Products agent]
│   │   ├── items.ts           [Items agent]
│   │   ├── stores.ts          [Stores agent]
│   │   ├── files.ts           [Files agent]
│   │   ├── locations.ts       [Locations agent]
│   │   └── customers.ts       [Customers agent]
│   ├── tools/
│   │   ├── orders.ts          [Order query tools]
│   │   ├── products.ts        [Product query tools]
│   │   └── instantdb.ts       [InstantDB client]
│   ├── utils/
│   │   ├── mastra.ts          [Mastra config]
│   │   └── streaming.ts       [Response streaming]
│   └── types.ts               [TypeScript types]
├── wrangler.toml              [Cloudflare config]
├── package.json
├── tsconfig.json
└── .env.example

tar/                            [EXISTING - Expo app]
├── app/
│   └── api/
│       └── chat+api.ts        [REFERENCE ONLY - not used in production]
├── .env                       [UPDATE: Add Workers URL]
└── ...
```

---

## ⏱️ DAY 1: INFRASTRUCTURE + BASIC AGENT (8 hours)

### Hour 1: Prerequisites & Setup

#### ✅ Checklist
- [ ] Cloudflare account created (https://dash.cloudflare.com/sign-up)
- [ ] Node.js 20+ verified (`node --version`)
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Logged into Wrangler (`wrangler login`)

#### Commands
```bash
# Verify environment
node --version        # Should be 20+
npm install -g wrangler
wrangler login       # Opens browser for auth
```

---

### Hour 2-3: Create Workers Project

#### Step 1: Initialize Project
```bash
# In your workspace (next to tar/ folder)
cd C:/tarfwk

# Create new Workers project
npm create cloudflare@latest tar-workers -- --type hello-world --no-git

cd tar-workers
```

#### Step 2: Install Dependencies
```bash
npm install @mastra/core @ai-sdk/groq ai zod
npm install -D @cloudflare/workers-types typescript
```

#### Step 3: Configure wrangler.toml
```toml
name = "tar-ai-api"
main = "src/index.ts"
compatibility_date = "2025-10-24"
node_compat = true

[ai]
binding = "AI"

# Environment variables (set via wrangler secret)
# GROQ_API_KEY - Set via: wrangler secret put GROQ_API_KEY
# INSTANT_APP_ID - Set via: wrangler secret put INSTANT_APP_ID
```

#### Step 4: Configure tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "jsx": "react",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### Step 5: Create .env.example
```bash
GROQ_API_KEY=your_groq_key_here
INSTANT_APP_ID=your_instant_id_here
```

#### ✅ Deliverable
- [ ] Workers project created
- [ ] Dependencies installed
- [ ] Configuration files ready
- [ ] Test deploy works: `wrangler deploy`

---

### Hour 4: Basic API Endpoint

#### Step 1: Create src/index.ts
```typescript
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // CORS handling
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { messages, agentId = 'space' } = body;

        // TODO: Route to Mastra agents
        return new Response(
          JSON.stringify({ message: 'Endpoint ready', agentId }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

#### Step 2: Deploy & Test
```bash
# Deploy to Cloudflare
wrangler deploy

# Test with curl
curl https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev/health

# Expected: {"status":"ok"}
```

#### ✅ Deliverable
- [ ] Basic endpoint deployed
- [ ] Health check works
- [ ] CORS configured
- [ ] POST /api/chat accepts requests

---

### Hour 5-6: Mastra Setup + First Agent

#### Step 1: Create src/utils/mastra.ts
```typescript
import { Mastra } from '@mastra/core';
import { createGroq } from '@ai-sdk/groq';

export function createMastra(env: any) {
  const groq = createGroq({
    apiKey: env.GROQ_API_KEY,
  });

  return new Mastra({
    agents: [],  // Will add agents next
    llms: {
      groq: groq,
    },
  });
}
```

#### Step 2: Create src/agents/space.ts
```typescript
import { Agent } from '@mastra/core';

export const spaceAgent = new Agent({
  name: 'space',
  instructions: `You are Space, a helpful AI assistant for business intelligence.
You help users understand their store data, orders, products, and customers.
Be concise, friendly, and always provide actionable insights.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],  // Will add tools on Day 2
});
```

#### Step 3: Create src/utils/streaming.ts
```typescript
import { streamText } from 'ai';

export async function streamAgentResponse(
  agent: any,
  messages: any[],
  env: any
) {
  const result = streamText({
    model: agent.model,
    messages: messages,
    system: agent.instructions,
  });

  // Convert to Response with streaming
  return new Response(result.toDataStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

#### Step 4: Update src/index.ts
```typescript
import { spaceAgent } from './agents/space';
import { streamAgentResponse } from './utils/streaming';
import { createMastra } from './utils/mastra';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // ... (keep CORS and health check)

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { messages, agentId = 'space' } = body;

        // Initialize Mastra
        const mastra = createMastra(env);

        // For now, only Space agent
        if (agentId === 'space') {
          return await streamAgentResponse(spaceAgent, messages, env);
        }

        return new Response(
          JSON.stringify({ error: 'Agent not found' }),
          { status: 404 }
        );
      } catch (error) {
        // ... error handling
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

#### Step 5: Set Secrets & Deploy
```bash
# Set environment secrets
wrangler secret put GROQ_API_KEY
# Paste: YOUR_GROQ_API_KEY_HERE

wrangler secret put INSTANT_APP_ID
# Paste: 1be71d54-11aa-4705-a2b1-e96753009db4

# Deploy
wrangler deploy

# Note your URL: https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev
```

#### ✅ Deliverable
- [ ] Mastra initialized
- [ ] Space agent working
- [ ] Streaming responses work
- [ ] Deployed to Cloudflare

---

### Hour 7-8: Connect Expo App

#### Step 1: Update tar/.env
```bash
# Change API URL to Cloudflare Workers
EXPO_PUBLIC_API_BASE_URL=https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev
EXPO_PUBLIC_INSTANT_APP_ID=1be71d54-11aa-4705-a2b1-e96753009db4
```

#### Step 2: Test in Expo App
```bash
cd C:/tarfwk/tar
npm start

# Open in Android/iOS
# Go to Agents tab → Space
# Send a message
```

#### Step 3: Verify Streaming
- [ ] Message appears in chat
- [ ] Response streams word-by-word
- [ ] No errors in console
- [ ] Multiple messages work

#### ✅ End of Day 1 Deliverable
- [ ] Cloudflare Workers deployed
- [ ] Space agent responding
- [ ] Expo app connected
- [ ] Streaming works end-to-end

---

## ⏱️ DAY 2: ALL AGENTS + TOOLS + OPTIMIZATION (8 hours)

### Hour 1-2: Create Remaining 7 Agents

#### Step 1: Create Agent Files

**src/agents/orders.ts**
```typescript
import { Agent } from '@mastra/core';

export const ordersAgent = new Agent({
  name: 'orders',
  instructions: `You are the Orders Agent. You help users query and manage orders.
You can search orders by status, date, customer, and provide order analytics.
Be precise with order data and always confirm actions before making changes.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],  // Will add in Hour 3-4
});
```

**src/agents/products.ts**
```typescript
import { Agent } from '@mastra/core';

export const productsAgent = new Agent({
  name: 'products',
  instructions: `You are the Products Agent. You help users query the product catalog.
You can search products, check inventory levels, and provide product insights.
Focus on helping users find products and understand stock levels.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

**src/agents/items.ts**
```typescript
import { Agent } from '@mastra/core';

export const itemsAgent = new Agent({
  name: 'items',
  instructions: `You are the Items Agent. You manage SKU-level inventory.
You can look up items by SKU, check inventory across locations, and verify availability.
Be precise with SKU codes and inventory numbers.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

**src/agents/stores.ts**
```typescript
import { Agent } from '@mastra/core';

export const storesAgent = new Agent({
  name: 'stores',
  instructions: `You are the Stores Agent. You provide information about stores and locations.
You can look up store details, list locations, and help with multi-store operations.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

**src/agents/files.ts**
```typescript
import { Agent } from '@mastra/core';

export const filesAgent = new Agent({
  name: 'files',
  instructions: `You are the Files Agent. You help users search and retrieve documents.
You can search files by path and provide file URLs.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

**src/agents/locations.ts**
```typescript
import { Agent } from '@mastra/core';

export const locationsAgent = new Agent({
  name: 'locations',
  instructions: `You are the Locations Agent. You manage warehouse and location data.
You can list locations and show inventory distribution across locations.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

**src/agents/customers.ts**
```typescript
import { Agent } from '@mastra/core';

export const customersAgent = new Agent({
  name: 'customers',
  instructions: `You are the Customers Agent. You provide customer insights and analytics.
You can find customers, show order history, and identify top customers.
Always respect customer privacy and data sensitivity.`,
  model: {
    provider: 'groq',
    name: 'llama-3.1-8b-instant',
  },
  tools: [],
});
```

#### Step 2: Update src/index.ts with Agent Router
```typescript
import { spaceAgent } from './agents/space';
import { ordersAgent } from './agents/orders';
import { productsAgent } from './agents/products';
import { itemsAgent } from './agents/items';
import { storesAgent } from './agents/stores';
import { filesAgent } from './agents/files';
import { locationsAgent } from './agents/locations';
import { customersAgent } from './agents/customers';

// Agent map
const agents = {
  space: spaceAgent,
  orders: ordersAgent,
  products: productsAgent,
  items: itemsAgent,
  stores: storesAgent,
  files: filesAgent,
  locations: locationsAgent,
  customers: customersAgent,
};

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // ... (in chat endpoint)
    
    const agent = agents[agentId];
    if (!agent) {
      return new Response(
        JSON.stringify({ error: `Agent '${agentId}' not found` }),
        { status: 404 }
      );
    }

    return await streamAgentResponse(agent, messages, env);
  },
};
```

#### ✅ Deliverable
- [ ] All 8 agents created
- [ ] Agent routing works
- [ ] Can switch between agents in Expo app

---

### Hour 3-4: Add InstantDB Tools

#### Step 1: Create src/tools/instantdb.ts
```typescript
import { z } from 'zod';
import { tool } from 'ai';

// InstantDB REST API helper
async function queryInstantDB(query: any, env: any) {
  const response = await fetch('https://api.instantdb.com/runtime/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.INSTANT_APP_ID}`,
    },
    body: JSON.stringify(query),
  });
  
  if (!response.ok) {
    throw new Error(`InstantDB query failed: ${response.statusText}`);
  }
  
  return await response.json();
}

// Search orders tool
export const searchOrdersTool = (env: any) => tool({
  description: 'Search orders by status, date range, or amount',
  parameters: z.object({
    status: z.string().optional().describe('Order status: pending, paid, cancelled, etc'),
    startDate: z.string().optional().describe('Start date in ISO format'),
    endDate: z.string().optional().describe('End date in ISO format'),
    minAmount: z.number().optional().describe('Minimum order amount'),
  }),
  execute: async ({ status, startDate, endDate, minAmount }) => {
    const query = {
      orders: {
        $: {
          where: {},
          limit: 50,
        },
      },
    };

    // Add filters
    if (status) {
      query.orders.$.where['fullstatus'] = status;
    }

    const result = await queryInstantDB(query, env);
    
    // Filter by date and amount in code (InstantDB doesn't support complex where)
    let orders = result.orders || [];
    
    if (startDate) {
      orders = orders.filter(o => o.createdat >= startDate);
    }
    if (endDate) {
      orders = orders.filter(o => o.createdat <= endDate);
    }
    if (minAmount) {
      orders = orders.filter(o => o.total >= minAmount);
    }

    return {
      count: orders.length,
      orders: orders.slice(0, 10), // Return max 10 for readability
      summary: `Found ${orders.length} orders matching criteria`,
    };
  },
});

// Search products tool
export const searchProductsTool = (env: any) => tool({
  description: 'Search products by title, type, vendor, or status',
  parameters: z.object({
    query: z.string().optional().describe('Search query for product title'),
    type: z.string().optional().describe('Product type'),
    vendor: z.string().optional().describe('Vendor name'),
    status: z.string().optional().describe('Product status'),
  }),
  execute: async ({ query, type, vendor, status }) => {
    const instantQuery = {
      products: {
        $: {
          limit: 50,
        },
      },
    };

    const result = await queryInstantDB(instantQuery, env);
    let products = result.products || [];

    // Filter in code
    if (query) {
      products = products.filter(p => 
        p.title?.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (type) {
      products = products.filter(p => p.type === type);
    }
    if (vendor) {
      products = products.filter(p => p.vendor === vendor);
    }
    if (status) {
      products = products.filter(p => p.status === status);
    }

    return {
      count: products.length,
      products: products.slice(0, 10),
      summary: `Found ${products.length} products`,
    };
  },
});

// Find by SKU tool
export const findBySKUTool = (env: any) => tool({
  description: 'Find item by SKU code',
  parameters: z.object({
    sku: z.string().describe('SKU code to search'),
  }),
  execute: async ({ sku }) => {
    const query = {
      items: {
        $: {
          limit: 10,
        },
      },
    };

    const result = await queryInstantDB(query, env);
    const items = result.items || [];
    
    const item = items.find(i => i.sku === sku);

    if (!item) {
      return { found: false, message: `No item found with SKU: ${sku}` };
    }

    return {
      found: true,
      item: item,
      summary: `Found item: ${item.sku}`,
    };
  },
});

// Get store info tool
export const getStoreInfoTool = (env: any) => tool({
  description: 'Get store information by name or domain',
  parameters: z.object({
    name: z.string().optional().describe('Store name'),
    domain: z.string().optional().describe('Store domain'),
  }),
  execute: async ({ name, domain }) => {
    const query = {
      stores: {
        $: {
          limit: 10,
        },
      },
    };

    const result = await queryInstantDB(query, env);
    let stores = result.stores || [];

    if (name) {
      stores = stores.filter(s => 
        s.name?.toLowerCase().includes(name.toLowerCase())
      );
    }
    if (domain) {
      stores = stores.filter(s => s.domain === domain);
    }

    return {
      count: stores.length,
      stores: stores,
      summary: `Found ${stores.length} stores`,
    };
  },
});

// Find customer tool
export const findCustomerTool = (env: any) => tool({
  description: 'Find customer by email, phone, or name',
  parameters: z.object({
    email: z.string().optional().describe('Customer email'),
    phone: z.string().optional().describe('Customer phone'),
    name: z.string().optional().describe('Customer name'),
  }),
  execute: async ({ email, phone, name }) => {
    const query = {
      customers: {
        $: {
          limit: 50,
        },
      },
    };

    const result = await queryInstantDB(query, env);
    let customers = result.customers || [];

    if (email) {
      customers = customers.filter(c => c.email === email);
    }
    if (phone) {
      customers = customers.filter(c => c.phone === phone);
    }
    if (name) {
      customers = customers.filter(c => 
        c.name?.toLowerCase().includes(name.toLowerCase())
      );
    }

    return {
      count: customers.length,
      customers: customers.slice(0, 10),
      summary: `Found ${customers.length} customers`,
    };
  },
});
```

#### Step 2: Add Tools to Agents

Update each agent file to include tools:

**src/agents/space.ts** - Add all tools:
```typescript
import { searchOrdersTool, searchProductsTool, findBySKUTool, 
         getStoreInfoTool, findCustomerTool } from '../tools/instantdb';

export function createSpaceAgent(env: any) {
  return new Agent({
    name: 'space',
    instructions: `...`,
    model: { ... },
    tools: [
      searchOrdersTool(env),
      searchProductsTool(env),
      findBySKUTool(env),
      getStoreInfoTool(env),
      findCustomerTool(env),
    ],
  });
}
```

**src/agents/orders.ts** - Orders tools only:
```typescript
import { searchOrdersTool } from '../tools/instantdb';

export function createOrdersAgent(env: any) {
  return new Agent({
    // ...
    tools: [searchOrdersTool(env)],
  });
}
```

Repeat for other agents with relevant tools.

#### Step 3: Update src/index.ts to Pass env
```typescript
// Change from static agents to factory functions
const agent = agents[agentId](env);  // Pass env to create agent with tools
```

#### ✅ Deliverable
- [ ] InstantDB tools created
- [ ] Tools added to agents
- [ ] Can query real data via chat

---

### Hour 5: Testing All Agents

#### Test Each Agent:

**Space Agent:**
```
Test: "Show me recent orders"
Expected: Calls searchOrdersTool, returns order list
```

**Orders Agent:**
```
Test: "Find all pending orders"
Expected: Calls searchOrdersTool with status='pending'
```

**Products Agent:**
```
Test: "Search for 'shirt' products"
Expected: Calls searchProductsTool with query='shirt'
```

**Items Agent:**
```
Test: "Find SKU ABC123"
Expected: Calls findBySKUTool
```

**Stores Agent:**
```
Test: "Show store information"
Expected: Calls getStoreInfoTool
```

**Customers Agent:**
```
Test: "Find customer John Doe"
Expected: Calls findCustomerTool
```

#### Debugging:
- Check Cloudflare Workers logs: `wrangler tail`
- Check Expo app console for errors
- Verify InstantDB queries return data

#### ✅ Deliverable
- [ ] All 8 agents tested
- [ ] Tools working correctly
- [ ] Data returned from InstantDB

---

### Hour 6: Cost Optimization (Optional but Recommended)

#### Add Cloudflare AI for Simple Queries

**Update wrangler.toml:**
```toml
[ai]
binding = "AI"
```

**Create src/utils/model-router.ts:**
```typescript
export function shouldUseCloudflareAI(messages: any[]): boolean {
  const lastMessage = messages[messages.length - 1];
  const text = lastMessage.content || '';
  
  // Simple queries go to Cloudflare AI (free)
  const simplePatterns = [
    /what is/i,
    /how many/i,
    /list all/i,
    /show me/i,
    /explain/i,
  ];
  
  // Short messages are usually simple
  if (text.length < 100) {
    return true;
  }
  
  // Check if matches simple patterns
  return simplePatterns.some(pattern => pattern.test(text));
}
```

**Update agent creation to use dual models:**
```typescript
import { shouldUseCloudflareAI } from '../utils/model-router';

// In agent creation
const modelProvider = shouldUseCloudflareAI(messages) ? 'cloudflare' : 'groq';
```

#### ✅ Deliverable (Optional)
- [ ] Cloudflare AI integrated
- [ ] 50-70% of queries use free tier
- [ ] Fallback to Groq for complex queries

---

### Hour 7: Polish & Error Handling

#### Add Better Error Messages
```typescript
try {
  // ... agent execution
} catch (error) {
  console.error('Agent error:', error);
  
  return new Response(
    JSON.stringify({
      error: 'Sorry, I encountered an error. Please try again.',
      details: error.message,
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
```

#### Add Request Logging
```typescript
console.log(`Request: ${agentId} - ${messages.length} messages`);
```

#### Add Rate Limiting (Simple)
```typescript
// Track requests in memory (for basic protection)
const requestCounts = new Map();

function checkRateLimit(ip: string): boolean {
  const count = requestCounts.get(ip) || 0;
  if (count > 100) return false;  // Max 100 per minute
  requestCounts.set(ip, count + 1);
  return true;
}
```

#### ✅ Deliverable
- [ ] Better error messages
- [ ] Request logging
- [ ] Basic rate limiting

---

### Hour 8: Final Deploy & Documentation

#### Step 1: Final Deploy
```bash
# Deploy to production
wrangler deploy

# Test all endpoints
curl https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev/health
```

#### Step 2: Update Expo App .env (Final)
```bash
EXPO_PUBLIC_API_BASE_URL=https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev
EXPO_PUBLIC_INSTANT_APP_ID=1be71d54-11aa-4705-a2b1-e96753009db4
```

#### Step 3: Test in Production
- [ ] Open Expo app
- [ ] Test each agent tab
- [ ] Verify data queries work
- [ ] Check streaming performance

#### Step 4: Document Deployment

**Create tar-workers/README.md:**
```markdown
# TAR AI Agents API

Cloudflare Workers + Mastra AI backend for TAR Expo app.

## Deployed URL
https://tar-ai-api.YOUR_SUBDOMAIN.workers.dev

## Agents
- Space (General AI)
- Orders (Order queries)
- Products (Product catalog)
- Items (Inventory/SKU)
- Stores (Store info)
- Files (Document search)
- Locations (Location data)
- Customers (Customer insights)

## Endpoints
- GET /health - Health check
- POST /api/chat - Chat with agents

## Deployment
```bash
wrangler deploy
```

## Secrets
```bash
wrangler secret put GROQ_API_KEY
wrangler secret put INSTANT_APP_ID
```

## Monitoring
- Dashboard: https://dash.cloudflare.com
- Logs: `wrangler tail`
- Analytics: Workers Analytics dashboard
```

#### ✅ End of Day 2 Deliverable
- [ ] All 8 agents deployed
- [ ] InstantDB tools working
- [ ] Expo app fully connected
- [ ] Production ready

---

## 📊 SUCCESS CRITERIA

### ✅ Day 1 Complete
- [ ] Cloudflare Workers project created
- [ ] Space agent deployed and working
- [ ] Expo app connects to Workers
- [ ] Streaming works smoothly

### ✅ Day 2 Complete
- [ ] All 8 agents deployed
- [ ] InstantDB tools integrated
- [ ] All agents can query real data
- [ ] Production deployment successful

### ✅ Overall Success
- [ ] Users can chat with all 8 agents
- [ ] Agents return real data from InstantDB
- [ ] Streaming responses work smoothly
- [ ] Cost stays within $0-15/month
- [ ] No major errors or crashes

---

## 💰 EXPECTED COSTS

### Free Tier Coverage
- **Cloudflare Workers:** 100k requests/day (FREE)
- **Cloudflare AI:** 10k Neurons/day (~90k tokens) (FREE)
- **Groq:** Pay per use (fallback)

### Estimated Monthly Cost
**Development/Testing:** $0  
**Small Usage (100 users):** $5-10  
**Growing (1000 users):** $15-25  

**Compared to Vercel + All-Groq:** Save $50-100/month (60-80% cheaper)

---

## 🚀 NEXT STEPS (Post 2-Day MVP)

### Week 1: Monitor & Optimize
- Monitor Cloudflare dashboard
- Track cost per request
- Optimize slow queries
- Improve system prompts

### Week 2: Add Features
- More tools (analytics, insights)
- Caching for common queries
- Better error messages
- User feedback collection

### Week 3: Scale
- Add embeddings for semantic search
- Implement memory across sessions
- Multi-agent coordination
- Advanced analytics

---

## 🆘 TROUBLESHOOTING

### Issue: Workers not deploying
```bash
# Check wrangler auth
wrangler whoami

# Re-login
wrangler login

# Check syntax
npm run build
```

### Issue: CORS errors in Expo app
- Check Access-Control-Allow-Origin header
- Verify Cloudflare Workers URL in .env
- Test with curl first

### Issue: InstantDB queries failing
- Verify INSTANT_APP_ID is correct
- Check InstantDB API key permissions
- Test query directly with fetch

### Issue: Streaming not working
- Check Content-Type: text/event-stream
- Verify Expo app using correct transport
- Test with simple text first

### Issue: Tools not being called
- Check tool description is clear
- Verify parameters schema is correct
- Test tool execution manually
- Check agent has tools registered

---

## 📞 SUPPORT RESOURCES

- **Cloudflare Workers Docs:** https://developers.cloudflare.com/workers/
- **Mastra Docs:** https://mastra.ai/docs
- **Groq API Docs:** https://console.groq.com/docs
- **InstantDB Docs:** https://instantdb.com/docs
- **Cloudflare Dashboard:** https://dash.cloudflare.com

---

## ✨ YOU'RE READY TO BUILD!

**Start Day 1 when ready. Good luck! 🚀**
