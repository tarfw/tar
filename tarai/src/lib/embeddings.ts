import { useRef, useCallback } from 'react';
import { useTextEmbeddings, initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

let initialized = false;

export function initEmbeddings() {
  if (initialized) return;
  initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialized = true;
}

// LFM2.5 350M embedding model — 1024-dim, quantized (8da4w), XNNPACK backend.
export const EMBEDDING_MODEL = {
  modelName: 'all-minilm-l6-v2' as const, // registry slot; real weights come from the sources below
  modelSource:
    'https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-embedding-350m/resolve/main/xnnpack/lfm_2_5_embedding_350m_xnnpack_8da4w.pte',
  tokenizerSource:
    'https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-embedding-350m/resolve/main/tokenizer.json',
};

export const EMBEDDING_DIM = 1024;

/**
 * True once the model + tokenizer have been downloaded to the on-device cache.
 * Lets us auto-load on app start without re-triggering a download.
 */
export async function isModelCached(): Promise<boolean> {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    const hasModel = files.some((f) => f.includes('lfm_2_5_embedding_350m'));
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
    model: EMBEDDING_MODEL as any,
    preventLoad,
  });

  // Serialize inference — the native module rejects concurrent forward() calls.
  const inferenceLock = useRef(Promise.resolve());

  const generateEmbedding = useCallback(
    async (text: string): Promise<number[]> => {
      const trimmed = (text || '').trim();
      if (!trimmed) {
        return new Array(EMBEDDING_DIM).fill(0);
      }
      if (!model.isReady) {
        throw new Error('[embeddings] Model not ready yet');
      }

      const previous = inferenceLock.current;
      let release!: () => void;
      inferenceLock.current = new Promise((resolve) => {
        release = resolve;
      });

      try {
        await previous;
        const vector = await model.forward(trimmed);
        return Array.from(vector);
      } finally {
        release();
      }
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

  // `useTextEmbeddings` exposes downloadProgress but no explicit "loading" flag.
  // Loading = a download is in flight (0 < progress < 1) OR we've started but
  // the model isn't ready yet and there's no error.
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
