import { useEffect, useMemo, useState, useCallback } from 'react';
import { ALL_MINILM_L6_V2, useTextEmbeddings } from 'react-native-executorch';

/**
 * Hook to provide on-device semantic embedding generation.
 * Uses all-MiniLM-L6-v2 model via ExecuTorch.
 *
 * The native ResourceFetcher handles model/tokenizer downloads.
 * We stabilize the model config with useMemo to prevent
 * unnecessary re-renders from re-triggering downloads.
 *
 * Using react-native-executorch@0.5.10 which has a working
 * tokenizer implementation (v0.7.0's HFTokenizer has a bug
 * with WordPiece tokenizers on Android).
 */

// Maximum time to wait for model download before considering it stuck (2 minutes)
const MODEL_LOAD_TIMEOUT = 2 * 60 * 1000;

export function useEmbeddingService() {
    // Stabilize the model config reference — prevents "Already downloading"
    // errors caused by useModule's useEffect re-triggering on object identity change
    // Add a key that changes on retry to force re-initialization
    const [retryKey, setRetryKey] = useState(0);
    const modelConfig = useMemo(() => ({ ...ALL_MINILM_L6_V2, key: retryKey }), [retryKey]);

    const [loadTimeout, setLoadTimeout] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 3;

    const {
        forward,
        isReady,
        isGenerating,
        error,
        downloadProgress,
    } = useTextEmbeddings({
        model: modelConfig,
    });

    // Clear corrupted cache and retry - triggers re-download by changing model config key
    const clearCacheAndRetry = useCallback(async () => {
        console.log('[ExecuTorch] Clearing cache and retrying...');
        // Increment retry key to force useTextEmbeddings to re-initialize
        setRetryKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (downloadProgress > 0 && downloadProgress < 1) {
            console.log(`[ExecuTorch] Download progress: ${(downloadProgress * 100).toFixed(1)}%`);

            // Set timeout to detect stuck downloads
            if (!timeoutId && !isReady) {
                timeoutId = setTimeout(() => {
                    setLoadTimeout(true);
                    console.warn('[ExecuTorch] Model download timed out, will retry...');
                }, MODEL_LOAD_TIMEOUT);
            }
        }

        if (error) {
            console.warn('[ExecuTorch] Model load error:', error);
        }

        if (isReady) {
            console.log('[ExecuTorch] Model is ready for inference!');
            if (timeoutId) clearTimeout(timeoutId);
            setLoadTimeout(false);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isReady, error, downloadProgress]);

    // Handle timeout and retry logic
    useEffect(() => {
        if (loadTimeout && retryCount < MAX_RETRIES) {
            const retryTimer = setTimeout(() => {
                setRetryCount(prev => prev + 1);
                setLoadTimeout(false);
                clearCacheAndRetry(); // This increments retryKey, forcing re-initialization
                console.log(`[ExecuTorch] Retrying model load (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            }, 2000);
            return () => clearTimeout(retryTimer);
        } else if (loadTimeout && retryCount >= MAX_RETRIES) {
            console.error('[ExecuTorch] Max retries reached. Model failed to load.');
        }
    }, [loadTimeout, retryCount, clearCacheAndRetry]);

    const generateEmbedding = async (
        text: string
    ): Promise<Float32Array | null> => {
        if (!text || error) return null;
        
        // Allow generation even if isReady is false but download completed
        if (downloadProgress < 1 && !isReady) {
            console.warn('[ExecuTorch] Model not ready yet');
            return null;
        }

        try {
            return await forward(text);
        } catch (e) {
            console.error('[ExecuTorch] Failed to generate embedding:', e);
            return null;
        }
    };

    // Manual retry function to clear cache and restart download
    const retryModelLoad = useCallback(() => {
        setRetryCount(0);
        setLoadTimeout(false);
        clearCacheAndRetry();
        console.log('[ExecuTorch] Manual retry initiated');
    }, [clearCacheAndRetry]);

    return {
        generateEmbedding,
        isEmbeddingReady: isReady,
        isEmbeddingGenerating: isGenerating,
        embeddingError: error,
        downloadProgress,
        isLoadTimeout: loadTimeout,
        retryCount,
        retryModelLoad,
    };
}