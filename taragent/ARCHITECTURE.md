# Architecture Overview

## Project Structure

```
taragent/
├── src/
│   ├── index.ts          # Main entry point, VoltAgent initialization
│   ├── product.ts        # Product categorization agent & tool
│   └── example.ts        # Usage examples
├── .voltagent/           # VoltAgent local data (observability, memory)
├── node_modules/         # Dependencies
├── .env                  # API keys (not committed)
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # Documentation
```

## Components

### 1. Product Agent (`src/product.ts`)

The core agent responsible for categorizing products.

**Key Features:**
- Uses VoltAgent's Agent class for orchestration
- Supports both OpenAI (gpt-4o-mini) and Groq (llama-3.1-8b-instant)
- Stateless design (no memory) for simple categorization
- Custom tool integration for pattern matching

**Configuration:**
```typescript
export const productAgent = new Agent({
  name: "ProductCategorizer",
  description: "...", // Detailed instructions
  model: groq("llama-3.1-8b-instant") // Or openai("gpt-4o-mini")
  tools: [categorizeTool],
  memory: false,
});
```

### 2. Categorization Tool

A custom VoltAgent tool that implements pattern matching logic.

**Schema:**
```typescript
parameters: z.object({
  title: z.string(),
  suggestedCategory: z.string().optional()
})
```

**Logic:**
1. Pattern matching against keyword dictionaries
2. Fallback to AI-suggested category
3. Returns structured result with confidence level

### 3. Helper Function

`categorizeProduct(title: string)` - Simplified interface for common use case.

**Returns:**
```typescript
{
  title: string;
  category: string;
  confidence: string;
  reason: string;
}
```

## Data Flow

```
User Input (Product Title)
    ↓
categorizeProduct() function
    ↓
Product Agent receives prompt
    ↓
Agent analyzes and decides to use tool
    ↓
categorizeTool executes
    ├─→ Pattern matching
    └─→ Returns category + confidence
    ↓
Agent formats final response
    ↓
Result returned to user
```

## Design Decisions

### Why VoltAgent?

1. **Type Safety**: Full TypeScript support with Zod schemas
2. **Observability**: Built-in event tracking and monitoring
3. **Modularity**: Easy to add tools, sub-agents, memory
4. **Flexibility**: Support multiple LLM providers

### Why Pattern Matching + LLM?

- **Speed**: Pattern matching provides instant results for common cases
- **Accuracy**: LLM reasoning handles edge cases and ambiguity
- **Cost**: Reduces API calls for obvious categorizations
- **Hybrid Approach**: Best of both worlds

### Why Stateless?

Product categorization is a pure function:
- Same input → same output
- No need to remember past categorizations
- Simpler, faster, more scalable

## Extension Points

### Adding New Categories

Edit `categoryPatterns` in `src/product.ts`:

```typescript
const categoryPatterns: Record<string, string[]> = {
  "YourCategory": ["keyword1", "keyword2", ...],
  // ... existing categories
};
```

### Adding Sub-Agents

```typescript
import { skuGeneratorAgent } from './agents/sku-generator.js';

export const productAgent = new Agent({
  // ... existing config
  subAgents: [skuGeneratorAgent], // Add sub-agents
});
```

### Adding Memory

```typescript
import { Memory, InMemoryStorageAdapter } from "@voltagent/core";

const memory = new Memory({
  storage: new InMemoryStorageAdapter(),
});

export const productAgent = new Agent({
  // ... existing config
  memory, // Enable memory
});
```

### Adding More Tools

```typescript
import { createTool } from "@voltagent/core";
import { z } from "zod";

const validateTool = createTool({
  name: "validate_category",
  description: "Validates if a category assignment is appropriate",
  parameters: z.object({
    title: z.string(),
    category: z.string()
  }),
  execute: async (args) => {
    // Validation logic
    return { valid: true };
  }
});

// Add to agent
tools: [categorizeTool, validateTool]
```

## Performance Considerations

### Response Times

- **Pattern Matching**: ~1-5ms
- **LLM Call (Groq)**: ~200-500ms
- **LLM Call (OpenAI)**: ~500-1500ms

### Cost Optimization

- Use Groq for development (free tier)
- Pattern matching reduces API calls by ~70%
- GPT-4o-mini is cost-effective for production

### Scaling

- Stateless design allows horizontal scaling
- Consider caching common categorizations
- Batch processing for bulk operations

## Future Enhancements

1. **Multi-language Support**: Categorize products in different languages
2. **Custom Categories**: Allow users to define custom category rules
3. **Confidence Tuning**: ML model to improve confidence scoring
4. **A/B Testing**: Compare different LLM providers
5. **Analytics**: Track categorization accuracy over time
