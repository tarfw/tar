# TarAgent - Product Categorization Agent

A VoltAgent-powered AI agent that automatically categorizes products based on their titles.

**Built with [VoltAgent Framework](https://voltagent.dev)** - The modern TypeScript framework for building AI agents.

## Features

- 🤖 **Intelligent Categorization**: Uses AI to analyze product titles and assign appropriate categories
- 🎯 **High Accuracy**: Combines pattern matching with LLM reasoning for reliable results
- ⚡ **Fast**: Optimized with GPT-4o-mini for quick responses
- 🛠️ **Extensible**: Built on VoltAgent framework with custom tools

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API key:**
   ```bash
   # Create .env file and add your API key
   # Option 1: OpenAI (recommended for best quality)
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   
   # Option 2: Groq (faster, free tier available at https://console.groq.com)
   echo "GROQ_API_KEY=your_groq_api_key_here" > .env
   ```

3. **Run the server:**
   ```bash
   # Start the server on http://localhost:4310
   npm run dev
   
   # Or just run tests without server
   npm run test
   ```

## Usage

### HTTP API

Once the server is running on `http://localhost:4310`:

**Categorize single product:**
```bash
curl -X POST http://localhost:4310/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"Water Melon Mojito"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Water Melon Mojito",
    "category": "Beverages",
    "confidence": "high",
    "reason": "Product title contains keywords typical of Beverages products"
  }
}
```

**Batch categorization:**
```bash
curl -X POST http://localhost:4310/api/categorize/batch \
  -H "Content-Type: application/json" \
  -d '{"titles":["iPhone 15","Nike Shoes","Green Tea"]}'
```

**Swagger UI:**  
Visit http://localhost:4310/ui for interactive API documentation.

### Programmatic Usage

```typescript
import { categorizeProduct } from './src/product.js';

const result = await categorizeProduct("Water Melon Mojito");
console.log(result.category); // "Beverages"
```

### Categories (Google Shopping Taxonomy)

- Apparel & Accessories
- Electronics
- Food, Beverages & Tobacco
- Home & Garden
- Health & Beauty
- Sports & Entertainment
- Vehicles & Parts
- Other

## Architecture

The agent uses:
- **VoltAgent Core**: Framework for agent orchestration
- **Custom Tool**: `categorize_product` tool with pattern matching logic
- **LLM Reasoning**: GPT-4o-mini for intelligent analysis
- **Type Safety**: Full TypeScript support with Zod schemas

## Development

```bash
# Watch mode (auto-restart on changes)
npm run dev

# Single run
npm start

# Build
npm run build
```

## Integration

### Quick Integration

```typescript
import { categorizeProduct } from './src/product.js';

// Simple function call
const result = await categorizeProduct("Water Melon Mojito");
console.log(result.category); // "Beverages"
```

### Advanced Usage

```typescript
import { productAgent } from './src/product.js';

// Direct agent interaction for custom prompts
const response = await productAgent.generateText(
  'Analyze this product and suggest the best category: "Wireless Gaming Mouse RGB"'
);
```

### Batch Processing

```typescript
const products = ["Product 1", "Product 2", "Product 3"];
const results = await Promise.all(
  products.map(title => categorizeProduct(title))
);
```

## License

MIT
