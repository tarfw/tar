# LLM (Models & Providers)

## Model specifier

A model specifier combines a provider ID with a model ID:

```
anthropic/claude-sonnet-4-6
└──provider─┘ └──model──┘

openai/gpt-5.5
cloudflare/@cf/moonshotai/kimi-k2.6
openrouter/moonshotai/kimi-k2.6
```

```typescript
export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
}));
```

## Model reasoning effort

| Value | Intent |
|---|---|
| `'off'` | Do not request additional reasoning |
| `'minimal'` | Smallest reasoning effort |
| `'low'` | Lower cost or latency |
| `'medium'` | Balanced (Flue's default) |
| `'high'` | More careful reasoning |
| `'xhigh'` | Highest exposed effort tier |

```typescript
export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  thinkingLevel: 'high',
}));
```

## Providers

| Provider ID | Environment variable |
|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |

## Cloudflare Workers AI

```typescript
export default defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
}));
```

## Custom providers

```typescript
import { registerProvider } from '@flue/runtime';

registerProvider('ollama', {
  api: 'openai-completions',
  baseUrl: 'http://localhost:11434/v1',
});
```

Then use `ollama/llama3.1:8b` in any agent.
