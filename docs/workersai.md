# Cloudflare Worker AI Setup (workersai.md)

## Overview
The `cloudflare-worker` directory contains a Cloudflare Worker that provides AI-powered APIs using Groq's LLaMA models. The worker serves as a backend API for chat and product generation functionality.

## Project Structure
```
cloudflare-worker/
├── src/
│   └── index.ts          # Main worker code with API endpoints
├── package.json          # Dependencies (@ai-sdk/groq, ai)
├── wrangler.toml         # Cloudflare Worker configuration
└── node_modules/         # Dependencies
```

## Dependencies
- `@ai-sdk/groq`: Groq AI SDK for model integration
- `ai`: Vercel AI SDK for text generation and structured outputs
- `zod`: Schema validation (used implicitly via ai SDK)

## API Endpoints

### `/api/chat` (POST)
General chat endpoint using Groq's LLaMA 3.1 8B Instant model.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ]
}
```

**Response:**
```json
{
  "text": "Hello! I'm doing well, thank you for asking..."
}
```

### `/api/products/generate` (POST)
Product generation endpoint with structured output using Zod schema.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Create a red t-shirt product"}
  ],
  "existingProduct": null  // Optional: existing product to modify
}
```

**Response:**
```json
{
  "product": {
    "title": "Red T-Shirt",
    "category": "Clothing",
    "img": "https://example.com/image.jpg",
    "status": "active",
    "supplier": "FashionCo",
    "options": {
      "Color": [["Red", "#FF0000"], ["Blue", "#0000FF"]],
      "Size": [["Small", "S"], ["Medium", "M"], ["Large", "L"]]
    }
  },
  "items": [
    {
      "sku": "red-t-shirt-red-s-1",
      "option": "Color:Red(#FF0000) Size:Small(S)",
      "price": null,
      "cost": null,
      "barcode": null,
      "image": "https://example.com/image.jpg",
      "attribute": {}
    },
    {
      "sku": "red-t-shirt-red-m-2",
      "option": "Color:Red(#FF0000) Size:Medium(M)",
      "price": null,
      "cost": null,
      "barcode": null,
      "image": "https://example.com/image.jpg",
      "attribute": {}
    },
    {
      "sku": "red-t-shirt-blue-s-3",
      "option": "Color:Blue(#0000FF) Size:Small(S)",
      "price": null,
      "cost": null,
      "barcode": null,
      "image": "https://example.com/image.jpg",
      "attribute": {}
    },
    {
      "sku": "red-t-shirt-blue-m-4",
      "option": "Color:Blue(#0000FF) Size:Medium(M)",
      "price": null,
      "cost": null,
      "barcode": null,
      "image": "https://example.com/image.jpg",
      "attribute": {}
    }
  ],
  "text": "Generated product data..."
}
```

## Product Schema
The worker uses a Zod schema for structured product output:

```typescript
const ProductSchema = z.object({
  title: z.string().describe('Product title/name'),
  category: z.string().describe('Product category'),
  img: z.string().url().optional().describe('Primary product image URL'),
  medias: z.array(z.string().url()).optional().describe('Additional media URLs'),
  status: z.string().optional().describe('Product status'),
  supplier: z.string().optional().describe('Product supplier'),
  options: z.record(z.union([
    z.array(z.string()), // Simple options like ["Red", "Blue"]
    z.array(z.tuple([z.string(), z.string()])) // Options with identifiers
  ])).optional().describe('Product options/variants')
});
```

## Configuration

### Wrangler Configuration (`wrangler.toml`)
```toml
name = "chat-api-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
# GROQ_API_KEY will be set as a secret
```

### Environment Variables
- `GROQ_API_KEY`: Required API key for Groq AI service

## Deployment
1. Set the GROQ_API_KEY secret: `wrangler secret put GROQ_API_KEY`
2. Deploy: `wrangler deploy`

## CORS Configuration
The worker includes CORS headers allowing:
- Origin: `*` (all origins)
- Methods: `POST, OPTIONS`
- Headers: `Content-Type`

## Model Used
- **Primary Model**: `llama-3.1-8b-instant` from Groq
- **Capabilities**: Fast inference, structured output generation, chat completion

## Error Handling
- Returns appropriate HTTP status codes (404, 405, 500)
- Includes CORS headers in all responses
- Logs errors to console for debugging
- Structured error responses for product generation failures
