# Quick Start Guide

## Get Started in 3 Steps

### Step 1: Install Dependencies

```bash
cd taragent
npm install
```

### Step 2: Configure API Key

You need an API key from either OpenAI or Groq.

#### Option A: Groq (Recommended for getting started)
1. Go to https://console.groq.com
2. Sign up for free account
3. Generate an API key
4. Add to `.env` file:
```bash
echo "GROQ_API_KEY=your_groq_api_key_here" > .env
```

#### Option B: OpenAI
1. Go to https://platform.openai.com
2. Create account and add credits
3. Generate API key
4. Add to `.env` file:
```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

### Step 3: Run the Server

```bash
# Start the HTTP server on localhost:3141
npm run dev

# Or run standalone tests without server
npm run test
```

## Expected Output

```
🚀 VoltAgent Product Categorizer initialized!

🌐 Server running on http://localhost:4310

📚 Available endpoints:
   - GET  /api/health              - Health check
   - POST /api/categorize          - Categorize single product
   - POST /api/categorize/batch    - Categorize multiple products

💡 Example usage:
   curl -X POST http://localhost:3141/api/categorize \
     -H "Content-Type: application/json" \
     -d '{"title":"Water Melon Mojito"}'

🔍 VoltOps Platform available at http://localhost:3141 (if configured)
```

## Using the API

### Test with curl

```bash
# Single product
curl -X POST http://localhost:4310/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"iPhone 15 Pro"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "title": "iPhone 15 Pro",
#     "category": "Electronics",
#     "confidence": "high",
#     "reason": "Product title contains keywords typical of Electronics products"
#   }
# }
```

### Batch Categorization

```bash
curl -X POST http://localhost:4310/api/categorize/batch \
  -H "Content-Type: application/json" \
  -d '{"titles":["Water Melon Mojito","iPhone 15","Nike Shoes"]}'
```

### Programmatic Usage

```typescript
import { categorizeProduct } from './src/product.js';

const result = await categorizeProduct("iPhone 15 Pro");
console.log(result.category); // "Electronics"
```

### Batch Processing

```typescript
import { categorizeProduct } from './src/product.js';

const products = [
  "Water Melon Mojito",
  "Nike Air Jordan",
  "MacBook Pro 16",
  "Organic Green Tea"
];

// Process all products in parallel
const results = await Promise.all(
  products.map(title => categorizeProduct(title))
);

results.forEach(r => {
  console.log(`${r.title} → ${r.category}`);
});
```

### Custom Agent Prompts

```typescript
import { productAgent } from './src/product.js';

const response = await productAgent.generateText(`
  Analyze this product and provide detailed categorization:
  "Wireless Gaming Keyboard with RGB Lighting"
  
  Consider:
  - Primary use case
  - Target audience
  - Alternative categories
`);

console.log(response.text);
```

## Customization

### Add Custom Categories

Edit `src/product.ts` and add your categories to `categoryPatterns`:

```typescript
const categoryPatterns: Record<string, string[]> = {
  "YourCategory": ["keyword1", "keyword2"],
  "Beverages": ["drink", "juice", ...],
  // ... existing categories
};
```

### Change LLM Provider

The agent automatically detects which API key is available:
- Has `GROQ_API_KEY` → Uses Groq (llama-3.1-8b-instant)
- Has `OPENAI_API_KEY` → Uses OpenAI (gpt-4o-mini)

To force a specific provider, edit `src/product.ts`:

```typescript
// Force Groq
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
export const productAgent = new Agent({
  // ...
  model: groq("llama-3.3-70b-versatile"), // More powerful model
});
```

### Add Memory

To make the agent remember past categorizations:

```typescript
import { Memory, InMemoryStorageAdapter } from "@voltagent/core";

const memory = new Memory({
  storage: new InMemoryStorageAdapter(),
});

export const productAgent = new Agent({
  // ... existing config
  memory, // Add this line
});
```

## Troubleshooting

### "No API key found" Error

Make sure you have created `.env` file with either:
```bash
OPENAI_API_KEY=your_openai_api_key_here
# OR
GROQ_API_KEY=your_groq_api_key_here
```

### Module Resolution Errors

Ensure your `package.json` has:
```json
{
  "type": "module"
}
```

### TypeScript Errors

Run:
```bash
npm run build
```

to check for TypeScript errors.

## Next Steps

1. ✅ Got it working? Try customizing categories
2. ✅ Integrate into your app
3. ✅ Read `ARCHITECTURE.md` to understand the design
4. ✅ Check out VoltAgent docs: https://voltagent.dev

## Support

- **VoltAgent Docs**: https://voltagent.dev/docs
- **VoltAgent Discord**: https://discord.gg/voltagent
- **GitHub Issues**: File issues for bugs or feature requests
