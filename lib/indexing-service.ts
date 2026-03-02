import { useCallback, useEffect, useRef, useState } from "react";
import { getDb, subscribeToDbChanges } from "./db";
import { useEmbeddingService } from "./embedding-service";

export function useIndexingService() {
  const { generateEmbedding, isEmbeddingReady } = useEmbeddingService();
  // Use a ref to track indexing status without triggering re-renders or dependency changes
  const _isIndexing = useRef(false);
  const [isIndexing, setIndexingState] = useState(false);

  const isIndexingRef = useCallback((val?: boolean) => {
    if (typeof val !== "undefined") {
      _isIndexing.current = val;
      setIndexingState(val);
    }
    return _isIndexing.current;
  }, []);

  const [stats, setStats] = useState({ totalProcessed: 0, totalErrors: 0 });

  const indexMissingData = useCallback(async () => {
    if (!isEmbeddingReady || _isIndexing.current) return;

    isIndexingRef(true);
    console.log("[Indexing] Starting background indexing scan...");

    try {
      const db = await getDb();

      // 1. Process States (including Nodes, Actors, products, etc.)
      const unindexedStates = await db.all(
        "SELECT * FROM state WHERE embedding IS NULL LIMIT 20",
      );

      if (unindexedStates.length > 0) {
        console.log(
          `[Indexing] Found ${unindexedStates.length} unindexed states.`,
        );

        for (const state of unindexedStates) {
          try {
            const textParts = [
              state.title,
              state.type,
              state.ucode,
              state.payload || "",
            ].filter(Boolean);

            const textToEmbed = textParts.join(" ");
            const embedding = await generateEmbedding(textToEmbed);

            if (embedding) {
              await db.run("UPDATE state SET embedding = ? WHERE id = ?", [
                embedding.buffer as ArrayBuffer,
                state.id,
              ]);
              setStats((prev) => ({
                ...prev,
                totalProcessed: prev.totalProcessed + 1,
              }));
            }
          } catch (e) {
            console.error(`[Indexing] Failed to index state ${state.id}:`, e);
            setStats((prev) => ({
              ...prev,
              totalErrors: prev.totalErrors + 1,
            }));
          }
        }
      }

      // 2. Process Traces (formerly Events)
      const unindexedTraces = await db.all(
        "SELECT * FROM trace WHERE payload IS NOT NULL LIMIT 20",
      ); // Simple heuristic if we want to index trace payload

      if (unindexedTraces.length > 0) {
        console.log(
          `[Indexing] Found ${unindexedTraces.length} unindexed traces.`,
        );

        for (const trace of unindexedTraces) {
          // Traces don't have a dedicated embedding column in the new schema yet,
          // but we could store it in payload or add a column if needed.
          // For now, we'll skip or just update stats if we did something.
        }
      }
    } catch (error) {
      console.error("[Indexing] Indexing process failed:", error);
    } finally {
      isIndexingRef(false);
      // console.log('[Indexing] Indexing scan complete.');
    }
  }, [isEmbeddingReady, generateEmbedding, isIndexingRef]);

  // Auto-run on mount and subscribe to DB changes
  useEffect(() => {
    if (isEmbeddingReady) {
      // Initial run to catch up
      indexMissingData();

      // Subscribe to DB changes (inserts/syncs)
      const unsubscribe = subscribeToDbChanges(() => {
        console.log("[Indexing] DB change detected, triggering scan...");
        indexMissingData();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isEmbeddingReady, indexMissingData]);

  return {
    indexMissingData,
    isIndexing,
    stats,
  };
}
