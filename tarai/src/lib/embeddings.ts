import { useCallback } from 'react';
import { useTextEmbeddings, initExecutorch, models } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

let initialized = false;

/**
 * Global inference mutex. The native ExecuTorch model rejects concurrent
 * forward() calls (RnExecutorchError code 104, ModelGenerating). Every
 * embedding request in the app — boot-time vector sync, tool seeding, live
 * search — funnels through this single chain so they can never overlap,
 * regardless of which component, closure, or render cycle issued them.
 */
let inferenceChain: Promise<unknown> = Promise.resolve();

function enqueueInference<T>(task: () => Promise<T>): Promise<T> {
  const run = inferenceChain.then(task, task);
  // Keep the chain alive whether the task resolves or rejects, so one failed
  // inference doesn't wedge every subsequent call.
  inferenceChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function initEmbeddings() {
  if (initialized) return;
  initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialized = true;
}

// all-MiniLM-L6-v2 — 384-dim, tuned for semantic search, fast inference.
export const EMBEDDING_MODEL = models.text_embedding.all_minilm_l6_v2();

export const EMBEDDING_DIM = 384;

/**
 * True once the model + tokenizer have been downloaded to the on-device cache.
 */
export async function isModelCached(): Promise<boolean> {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    const hasModel = files.some((f) => f.includes('minilm'));
    const hasTokenizer = files.some((f) => f.includes('tokenizer'));
    return hasModel && hasTokenizer;
  } catch (e) {
    console.warn('[embeddings] isModelCached check failed:', e);
    return false;
  }
}

/** Delete the cached model + tokenizer so the next load re-downloads. */
export async function clearEmbeddingModel(): Promise<void> {
  await ExpoResourceFetcher.deleteResources(
    EMBEDDING_MODEL.modelSource,
    EMBEDDING_MODEL.tokenizerSource
  );
}

export function useEmbeddingsModule(preventLoad = true) {
  const model = useTextEmbeddings({
    model: EMBEDDING_MODEL,
    preventLoad,
  });

  const generateEmbedding = useCallback(
    async (text: string): Promise<number[]> => {
      const trimmed = (text || '').trim();
      if (!trimmed) {
        return new Array(EMBEDDING_DIM).fill(0);
      }
      if (!model.isReady) {
        throw new Error('[embeddings] Model not ready yet');
      }

      // Funnel through the global inference mutex so this forward() can never
      // overlap another (boot sync, tool seeding, search) and trip code 104.
      return enqueueInference(async () => {
        const vector = await model.forward(trimmed);
        return Array.from(vector);
      });
    },
    [model.isReady, model.forward]
  );

  const generateEmbeddings = useCallback(
    async (texts: string[]): Promise<number[][]> => {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await generateEmbedding(text));
      }
      return results;
    },
    [generateEmbedding]
  );

  const isLoading =
    !model.isReady &&
    !model.error &&
    !preventLoad &&
    model.downloadProgress < 1;

  return {
    isReady: model.isReady,
    isGenerating: model.isGenerating,
    isLoading,
    downloadProgress: model.downloadProgress,
    error: model.error,
    generateEmbedding,
    generateEmbeddings,
  };
}
