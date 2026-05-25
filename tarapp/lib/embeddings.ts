import { TextEmbeddingsModule } from 'react-native-executorch';

const MODEL_ASSET = require('../assets/models/all-MiniLM-L6-v2_xnnpack.pte');
const TOKENIZER_ASSET = require('../assets/models/tokenizer.json');

let embeddingsInstance: TextEmbeddingsModule | null = null;

export async function getEmbeddings() {
  if (!embeddingsInstance) {
    console.log('[embeddings] Instantiating TextEmbeddingsModule...');
    const instance = new TextEmbeddingsModule();
    await instance.load({
      modelSource: MODEL_ASSET,
      tokenizerSource: TOKENIZER_ASSET,
    });
    embeddingsInstance = instance;
    console.log('[embeddings] TextEmbeddingsModule loaded successfully');
  }
  return embeddingsInstance;
}

let inferenceLock = Promise.resolve();

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    console.warn(`[embeddings] generateEmbedding received empty/whitespace text. Returning 384-dimension zero vector.`);
    return new Array(384).fill(0);
  }

  const engine = await getEmbeddings();
  
  // Use a simple promise chain as a lock to ensure sequential execution
  const currentLock = inferenceLock;
  let release: () => void;
  inferenceLock = new Promise((resolve) => { release = resolve; });
  
  try {
    await currentLock;
    console.log(`[embeddings] Running forward pass for text: "${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}" (length: ${trimmed.length})`);
    const vector = await engine.forward(trimmed);
    console.log(`[embeddings] Forward pass succeeded. Vector length: ${vector.length}`);
    return Array.from(vector);
  } catch (err) {
    console.error(`[embeddings] Error during forward pass for text "${trimmed.substring(0, 100)}":`, err);
    throw err;
  } finally {
    release!();
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vector = await generateEmbedding(text);
    results.push(vector);
  }
  return results;
}
