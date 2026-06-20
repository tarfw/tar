import { useRef, useCallback } from 'react';
import { useTextEmbeddings, initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

let initialized = false;

export function initEmbeddings() {
  if (initialized) return;
  initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  initialized = true;
}

const LFM25_EMBEDDING_MODEL = {
  modelName: 'all-minilm-l6-v2' as const,
  modelSource: 'https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-embedding-350m/resolve/main/xnnpack/lfm_2_5_embedding_350m_xnnpack_8da4w.pte',
  tokenizerSource: 'https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-embedding-350m/resolve/main/tokenizer.json',
};

export function useEmbeddingsModule() {
  const model = useTextEmbeddings({
    model: LFM25_EMBEDDING_MODEL as any,
    preventLoad: false,
  });

  const inferenceLock = useRef(Promise.resolve());

  const generateEmbedding = useCallback(async (text: string): Promise<number[]> => {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      console.warn('[embeddings] Empty text, returning zero vector');
      return new Array(1024).fill(0);
    }

    if (!model.forward) {
      throw new Error('[embeddings] Model not ready yet');
    }

    const currentLock = inferenceLock.current;
    let release: () => void;
    inferenceLock.current = new Promise((resolve) => { release = resolve; });

    try {
      await currentLock;
      console.log(`[embeddings] Forward pass for: "${trimmed.substring(0, 80)}..."`);
      const vector = await model.forward(trimmed);
      console.log(`[embeddings] Vector length: ${vector.length}`);
      return Array.from(vector);
    } finally {
      release!();
    }
  }, [model.forward]);

  const generateEmbeddings = useCallback(async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (const text of texts) {
      const vector = await generateEmbedding(text);
      results.push(vector);
    }
    return results;
  }, [generateEmbedding]);

  return {
    isReady: !!model.forward,
    isLoading: (model as any).isLoading ?? false,
    error: (model as any).error ?? null,
    generateEmbedding,
    generateEmbeddings,
  };
}
