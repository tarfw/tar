# React Native ExecuTorch — Setup & Usage

Guide for on-device AI inference using [react-native-executorch](https://github.com/software-mansion/react-native-executorch).

---

## Package Versions

| | @tarapp/ (legacy) | @tarai/ (current) |
|---|---|---|
| `react-native-executorch` | `^0.7.2` | `^0.9.2` |
| `react-native-executorch-expo-resource-fetcher` | — | `^0.9.1` |
| API Style | Class-based (`TextEmbeddingsModule`) | Hook-based (`useTextEmbeddings`) |
| Model | `all-MiniLM-L6-v2` (384-dim) | `LFM2.5-350M-Quantized` (1024-dim) |
| Model Source | Local `.pte` asset | Remote URL (HuggingFace) |
| Model Size | ~23 MB | ~431 MB |

---

## Installation

```bash
# Core
npx expo install react-native-executorch

# Expo resource fetcher (required for Expo projects)
npx expo install react-native-executorch-expo-resource-fetcher expo-file-system expo-asset
```

### metro.config.js — Required for .pte files

```javascript
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("pte");
config.resolver.assetExts.push("bin");

module.exports = config;
```

### app.config — Required plugins

```json
{
  "expo": {
    "plugins": [
      "expo-file-system",
      "expo-asset"
    ]
  }
}
```

---

## v0.7.x API (tarapp — Class-Based)

```typescript
import { TextEmbeddingsModule } from 'react-native-executorch';

const MODEL = require('../assets/models/all-MiniLM-L6-v2_xnnpack.pte');
const TOKENIZER = require('../assets/models/tokenizer.json');

let instance: TextEmbeddingsModule | null = null;

async function getEmbeddings() {
  if (!instance) {
    instance = new TextEmbeddingsModule();
    await instance.load({
      modelSource: MODEL,
      tokenizerSource: TOKENIZER,
    });
  }
  return instance;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const engine = await getEmbeddings();
  const vector = await engine.forward(text);
  return Array.from(vector);
}
```

**Pros:** Simple, synchronous init.
**Cons:** Manual singleton management, inference lock needed for sequential calls.

---

## v0.9.x API (tarai — Hook-Based)

```typescript
import { useTextEmbeddings, initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

// Must init before any hook call
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// In a React component
const model = useTextEmbeddings({
  model: LFM2_5_350M_QUANTIZED,  // Predefined model constant
  preventLoad: false,
});

// Use model.forward(text) for inference
const vector = await model.forward("hello world");
```

**Pros:** Automatic loading lifecycle, no manual singleton, better error handling.
**Cons:** Must be inside a React component/context.

---

## tarai Architecture

```
┌─────────────────────────────────────┐
│  EmbeddingsProvider (Context)       │
│  ┌───────────────────────────────┐  │
│  │  useTextEmbeddings (hook)     │  │
│  │  → Downloads model from HF    │  │
│  │  → Loads into ExecuTorch      │  │
│  │  → Exposes generateEmbedding  │  │
│  └───────────────────────────────┘  │
│                                     │
│  setEmbeddingFunction() ──────┐     │
│                               │     │
│  ┌────────────────────────────▼──┐  │
│  │  VectorStore                  │  │
│  │  → cosine similarity search   │  │
│  │  → upsert/delete vectors      │  │
│  │  → auto-sync on first run     │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Turso DB (memory table)      │  │
│  │  → form TEXT PRIMARY KEY      │  │
│  │  → vector BLOB                │  │
│  │  → embedding BLOB             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|---|---|
| `src/lib/embeddings.ts` | Hook-based model loader, `useEmbeddingsModule()` |
| `src/db/embeddings-provider.tsx` | React context, auto-wires vector store on model ready |
| `src/lib/vectorStore.ts` | Cosine similarity, upsert/delete, initial sync |
| `src/lib/schema.ts` | `memory` table with `vector` + `embedding` BLOB columns |

---

## Predefined Model Constants (v0.9.x)

| Constant | Model | Dims | Size |
|---|---|---|---|
| `ALL_MINILM_L6_V2` | MiniLM-L6-v2 | 384 | ~23 MB |
| `ALL_MPNET_BASE_V2` | MPNet-base-v2 | 768 | ~43 MB |
| `LFM2_5_350M` | LFM2.5-350M | 1024 | ~431 MB |
| `LFM2_5_350M_QUANTIZED` | LFM2.5-350M (8da4w) | 1024 | ~431 MB |
| `CLIP_VIT_BASE_PATCH32_TEXT` | CLIP ViT-B/32 | 512 | ~150 MB |

---

## Custom Model (HuggingFace)

```typescript
const LFM25_EMBEDDING_MODEL = {
  modelName: 'all-minilm-l6-v2' as const,  // Required type cast for custom models
  modelSource: 'https://huggingface.co/.../model.pte',
  tokenizerSource: 'https://huggingface.co/.../tokenizer.json',
};

const model = useTextEmbeddings({
  model: LFM25_EMBEDDING_MODEL as any,
});
```

---

## Vector Search Flow

1. **Index:** Form created → `upsertFormVector(id, form)` → `generateEmbedding(text)` → store as Float32 BLOB
2. **Search:** Query text → `generateEmbedding(query)` → brute-force cosine similarity → return top-k
3. **Sync:** On first launch, `checkAndSyncExistingForms()` re-indexes all forms

### Prompt Prefixes (LFM2.5)

The LFM2.5 embedding model is trained with asymmetric prefixes:
- Search queries: prepend `query:` 
- Indexed documents: prepend `document:`

---

## LFM2.5 vs MiniLM

| | MiniLM-L6-v2 | LFM2.5-350M |
|---|---|---|
| Dimensions | 384 | 1024 |
| Model Size | ~23 MB | ~431 MB |
| Quality | Good | Better |
| Speed | Fast | Slower |
| Prompt Prefix | None | `query:` / `document:` |
| Source | Bundled asset | HuggingFace (downloaded) |

---

## tarapp vs tarai — Do We Still Need tarapp?

| Aspect | @tarapp/ | @tarai/ | Verdict |
|---|---|---|---|
| Expo SDK | 54 | 56 | tarai is current |
| ExecuTorch | 0.7.2 (class API) | 0.9.2 (hook API) | tarai is current |
| Embedding Model | MiniLM-L6 (23 MB) | LFM2.5-350M (431 MB) | tarai is better |
| Vector Dimensions | 384 | 1024 | tarai is better |
| DB | Turso sync-react-native 0.5.3 | Turso sync-react-native 0.6.1 | tarai is current |
| Auth | Google Sign-In | Google Sign-In | Same |
| Styling | NativeWind + Tailwind | Plain StyleSheet | tarai is simpler |
| RAG | react-native-rag | Manual vector search | tarai is lighter |
| Status | Legacy prototype | Active development | **tarai replaces tarapp** |

**Recommendation:** @tarai/ supersedes @tarapp/. No new features should be added to tarapp. Archive it after verifying tarai covers all use cases.
