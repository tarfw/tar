import { ALL_MINILM_L6_V2, useTextEmbeddings } from 'react-native-executorch';

/**
 * Hook to provide on-device semantic embedding generation.
 * Uses all-MiniLM-L6-v2 model via ExecuTorch.
 */
export function useEmbeddingService() {
    const { modelSource, tokenizerSource } = ALL_MINILM_L6_V2;

    // Initialize the module
    const {
        forward,
        isReady,
        isGenerating,
        error
    } = useTextEmbeddings({
        model: {
            modelSource,
            tokenizerSource,
        }
    });

    const generateEmbedding = async (text: string): Promise<Float32Array | null> => {
        if (!text || !isReady || error) return null;

        try {
            const result = await forward(text);
            return result;
        } catch (e) {
            console.error('Failed to generate embedding:', e);
            return null;
        }
    };

    return {
        generateEmbedding,
        isEmbeddingReady: isReady,
        isEmbeddingGenerating: isGenerating,
        embeddingError: error,
    };
}

/**
 * Static utility for non-hook contexts (if needed)
 * NOTE: ExecuTorch typically requires a registered component/hook to keep JSI alive
 * but we can wrap it in a singleton if necessary.
 */
