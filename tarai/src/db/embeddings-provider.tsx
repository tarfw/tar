import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useEmbeddingsModule } from '@/lib/embeddings';
import { setEmbeddingFunction } from '@/lib/vectorStore';

interface EmbeddingsContextType {
  isReady: boolean;
  isLoading: boolean;
  error: any;
  generateEmbedding: (text: string) => Promise<number[]>;
  generateEmbeddings: (texts: string[]) => Promise<number[][]>;
}

const EmbeddingsContext = createContext<EmbeddingsContextType>({
  isReady: false,
  isLoading: false,
  error: null,
  generateEmbedding: async () => [],
  generateEmbeddings: async () => [],
});

export function EmbeddingsProvider({ children }: { children: ReactNode }) {
  const embeddings = useEmbeddingsModule();

  useEffect(() => {
    if (embeddings.isReady && embeddings.generateEmbedding) {
      setEmbeddingFunction(embeddings.generateEmbedding);
    }
  }, [embeddings.isReady, embeddings.generateEmbedding]);

  return (
    <EmbeddingsContext.Provider value={embeddings}>
      {children}
    </EmbeddingsContext.Provider>
  );
}

export function useEmbeddings() {
  return useContext(EmbeddingsContext);
}
