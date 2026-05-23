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
  const engine = await getEmbeddings();
  
  // Use a simple promise chain as a lock to ensure sequential execution
  const currentLock = inferenceLock;
  let release: () => void;
  inferenceLock = new Promise((resolve) => { release = resolve; });
  
  try {
    await currentLock;
    const vector = await engine.forward(text);
    return Array.from(vector);
  } finally {
    release!();
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const engine = await getEmbeddings();
  const results: number[][] = [];
  for (const text of texts) {
    const vector = await engine.forward(text);
    results.push(Array.from(vector));
  }
  return results;
}
