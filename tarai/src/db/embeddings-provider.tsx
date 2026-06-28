import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useEmbeddingsModule, clearEmbeddingModel, isModelCached, EMBEDDING_DIM } from '@/lib/embeddings';
import { setEmbeddingFunction } from '@/lib/vectorStore';
// Flue: old store.ts removed - actions now use Flue tool_store_memory

interface EmbeddingsContextType {
  isReady: boolean;
  isLoading: boolean;
  downloadProgress: number;
  error: any;
  loadModel: () => void;
  clearModel: () => Promise<void>;
  generateEmbedding: (text: string) => Promise<number[]>;
  generateEmbeddings: (texts: string[]) => Promise<number[][]>;
}

const EmbeddingsContext = createContext<EmbeddingsContextType>({
  isReady: false,
  isLoading: false,
  downloadProgress: 0,
  error: null,
  loadModel: () => {},
  clearModel: async () => {},
  generateEmbedding: async () => [],
  generateEmbeddings: async () => [],
});

type HookState = {
  isReady: boolean;
  isLoading: boolean;
  downloadProgress: number;
  error: any;
};

/**
 * Thin wrapper that actually runs the ExecuTorch hook. It's keyed from the
 * provider so we can fully tear down + recreate the native model (after a
 * Clear, or to start a download) without remounting the whole app tree.
 * It owns no state of its own — it just pushes hook state up and registers
 * the embedding fn with the vector store.
 */
function ModelRunner({
  preventLoad,
  onState,
  onFns,
}: {
  preventLoad: boolean;
  onState: (s: HookState) => void;
  onFns: (fns: {
    generateEmbedding: (t: string) => Promise<number[]>;
    generateEmbeddings: (t: string[]) => Promise<number[][]>;
  }) => void;
}) {
  const mod = useEmbeddingsModule(preventLoad);

  useEffect(() => {
    onState({
      isReady: mod.isReady,
      isLoading: mod.isLoading,
      downloadProgress: mod.downloadProgress,
      error: mod.error,
    });
  }, [mod.isReady, mod.isLoading, mod.downloadProgress, mod.error, onState]);

  // Keep the provider's callable refs pointed at the latest hook fns. Cheap, so
  // it's fine for this to run whenever the fn identities change.
  useEffect(() => {
    onFns({
      generateEmbedding: mod.generateEmbedding,
      generateEmbeddings: mod.generateEmbeddings,
    });
  }, [mod.generateEmbedding, mod.generateEmbeddings, onFns]);

  // Register the embedding fn with the stores + seed tools — but only on the
  // ready transition, not on every render. The stores call through the
  // provider's stable ref (set above), so they always reach the live model.
  useEffect(() => {
    if (!mod.isReady) return;
    // Both the form vector store and the tool store share the same model, hence
    // the same global inference mutex (see lib/embeddings) — they can't collide.
    setEmbeddingFunction(mod.generateEmbedding);
    setActionEmbeddingFunction(mod.generateEmbedding);
    // Idempotent: SecureStore flag + in-flight guard make repeat calls no-ops.
    seedActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.isReady]);

  return null;
}

export function EmbeddingsProvider({ children }: { children: ReactNode }) {
  // `runnerKey` forces a fresh ModelRunner (and thus a fresh native model).
  const [runnerKey, setRunnerKey] = useState(0);
  // Start with loading prevented; flip to false once we decide to load.
  const [preventLoad, setPreventLoad] = useState(true);

  const [state, setState] = useState<HookState>({
    isReady: false,
    isLoading: false,
    downloadProgress: 0,
    error: null,
  });

  const generateEmbeddingRef = useRef<(t: string) => Promise<number[]>>(
    async () => new Array(EMBEDDING_DIM).fill(0)
  );
  const generateEmbeddingsRef = useRef<(t: string[]) => Promise<number[][]>>(
    async () => []
  );

  // On startup: if the model is already cached, auto-load it (no download).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await isModelCached();
      if (!cancelled && cached) {
        console.log('[EMB-PROVIDER] model cached — auto-loading');
        setPreventLoad(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleState = useCallback((s: HookState) => setState(s), []);

  const handleFns = useCallback(
    (fns: {
      generateEmbedding: (t: string) => Promise<number[]>;
      generateEmbeddings: (t: string[]) => Promise<number[][]>;
    }) => {
      generateEmbeddingRef.current = fns.generateEmbedding;
      generateEmbeddingsRef.current = fns.generateEmbeddings;
    },
    []
  );

  const loadModel = useCallback(() => {
    console.log('[EMB-PROVIDER] loadModel — starting download/load');
    setState({ isReady: false, isLoading: true, downloadProgress: 0, error: null });
    setPreventLoad(false);
    setRunnerKey((k) => k + 1);
  }, []);

  const clearModel = useCallback(async () => {
    console.log('[EMB-PROVIDER] clearModel START');
    // 1. Stop the model loading and tear down the native instance.
    setPreventLoad(true);
    setState({ isReady: false, isLoading: false, downloadProgress: 0, error: null });
    setEmbeddingFunction(async () => new Array(EMBEDDING_DIM).fill(0));
    setRunnerKey((k) => k + 1);
    // 2. Delete cached files so a future load re-downloads.
    try {
      await clearEmbeddingModel();
      console.log('[EMB-PROVIDER] clearModel DONE — cache deleted');
    } catch (e) {
      console.warn('[EMB-PROVIDER] clearModel — delete failed:', e);
    }
  }, []);

  return (
    <EmbeddingsContext.Provider
      value={{
        isReady: state.isReady,
        isLoading: state.isLoading,
        downloadProgress: state.downloadProgress,
        error: state.error,
        loadModel,
        clearModel,
        generateEmbedding: (text) => generateEmbeddingRef.current(text),
        generateEmbeddings: (texts) => generateEmbeddingsRef.current(texts),
      }}
    >
      <ModelRunner
        key={runnerKey}
        preventLoad={preventLoad}
        onState={handleState}
        onFns={handleFns}
      />
      {children}
    </EmbeddingsContext.Provider>
  );
}

export function useEmbeddings() {
  return useContext(EmbeddingsContext);
}
