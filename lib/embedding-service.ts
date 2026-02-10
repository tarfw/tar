import { useEffect, useMemo } from 'react';
import { ALL_MINILM_L6_V2, useTextEmbeddings } from 'react-native-executorch';

/**
 * Hook to provide on-device semantic embedding generation.
 * Uses all-MiniLM-L6-v2 model via ExecuTorch.
 *
 * The native ResourceFetcher handles model/tokenizer downloads.
 * We stabilize the model config with useMemo to prevent
 * unnecessary re-renders from re-triggering downloads.
 *
 * NOTE: Requires an EAS development build that includes the
 * react-native-executorch native module (C++ tokenizer + model loader).
 * If you see "Unexpected issue while loading tokenizer", rebuild:
 *   eas build --profile development --platform android
 */
export function useEmbeddingService() {
    // Stabilize the model config reference — prevents "Already downloading"
    // errors caused by useModule's useEffect re-triggering on object identity change
    const modelConfig = useMemo(() => ({ ...ALL_MINILM_L6_V2 }), []);

    const {
        forward,
        isReady,
        isGenerating,
        error,
        downloadProgress,
    } = useTextEmbeddings({
        model: modelConfig,
    });

    useEffect(() => {
        if (error) console.error('[ExecuTorch] Load error:', error);
        if (isReady) console.log('[ExecuTorch] Model is ready for inference!');
        if (downloadProgress > 0 && downloadProgress < 1) {
            console.log(`[ExecuTorch] Download progress: ${(downloadProgress * 100).toFixed(1)}%`);
        }
    }, [isReady, error, downloadProgress]);

    const generateEmbedding = async (
        text: string
    ): Promise<Float32Array | null> => {
        if (!text || !isReady || error) return null;

        try {
            return await forward(text);
        } catch (e) {
            console.error('[ExecuTorch] Failed to generate embedding:', e);
            return null;
        }
    };

    return {
        generateEmbedding,
        isEmbeddingReady: isReady,
        isEmbeddingGenerating: isGenerating,
        embeddingError: error,
        downloadProgress,
    };
}