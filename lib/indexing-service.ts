import { useCallback, useEffect, useRef, useState } from 'react';
import { getDb, subscribeToDbChanges } from './db';
import { useEmbeddingService } from './embedding-service';

export function useIndexingService() {
    const { generateEmbedding, isEmbeddingReady } = useEmbeddingService();
    // Use a ref to track indexing status without triggering re-renders or dependency changes
    const _isIndexing = useRef(false);
    const [isIndexing, setIndexingState] = useState(false);

    const isIndexingRef = useCallback((val?: boolean) => {
        if (typeof val !== 'undefined') {
            _isIndexing.current = val;
            setIndexingState(val);
        }
        return _isIndexing.current;
    }, []);

    const [stats, setStats] = useState({ totalProcessed: 0, totalErrors: 0 });

    const indexMissingData = useCallback(async () => {
        if (!isEmbeddingReady || _isIndexing.current) return;

        isIndexingRef(true);
        console.log('[Indexing] Starting background indexing scan...');

        try {
            const db = await getDb();

            // 1. Process Nodes
            const unindexedNodes = await db.all('SELECT * FROM nodes WHERE embedding IS NULL LIMIT 20');

            if (unindexedNodes.length > 0) {
                console.log(`[Indexing] Found ${unindexedNodes.length} unindexed nodes.`);

                for (const node of unindexedNodes) {
                    try {
                        // Include payload in embedding source text for better search results
                        const textParts = [
                            node.title,
                            node.nodetype,
                            node.universalcode,
                            node.payload || ''
                        ].filter(Boolean);

                        const textToEmbed = textParts.join(' ');
                        const embedding = await generateEmbedding(textToEmbed);

                        if (embedding) {
                            await db.run(
                                'UPDATE nodes SET embedding = ? WHERE id = ?',
                                [embedding.buffer as ArrayBuffer, node.id]
                            );
                            setStats(prev => ({ ...prev, totalProcessed: prev.totalProcessed + 1 }));
                        }
                    } catch (e) {
                        console.error(`[Indexing] Failed to index node ${node.id}:`, e);
                        setStats(prev => ({ ...prev, totalErrors: prev.totalErrors + 1 }));
                    }
                }
            }

            // 2. Process Actors
            const unindexedActors = await db.all('SELECT * FROM actors WHERE vector IS NULL LIMIT 20');

            if (unindexedActors.length > 0) {
                console.log(`[Indexing] Found ${unindexedActors.length} unindexed actors.`);

                for (const actor of unindexedActors) {
                    try {
                        const textParts = [
                            actor.name,
                            actor.actortype,
                            actor.globalcode,
                            actor.metadata || ''
                        ].filter(Boolean);

                        const textToEmbed = textParts.join(' ');
                        const vector = await generateEmbedding(textToEmbed);

                        if (vector) {
                            await db.run(
                                'UPDATE actors SET vector = ? WHERE id = ?',
                                [vector.buffer as ArrayBuffer, actor.id]
                            );
                            setStats(prev => ({ ...prev, totalProcessed: prev.totalProcessed + 1 }));
                        }
                    } catch (e) {
                        console.error(`[Indexing] Failed to index actor ${actor.id}:`, e);
                        setStats(prev => ({ ...prev, totalErrors: prev.totalErrors + 1 }));
                    }
                }
            }

            // 3. Process Events (Timeline)
            const unindexedEvents = await db.all('SELECT * FROM orevents WHERE embedding IS NULL LIMIT 20');

            if (unindexedEvents.length > 0) {
                console.log(`[Indexing] Found ${unindexedEvents.length} unindexed events.`);

                for (const event of unindexedEvents) {
                    try {
                        const textParts = [
                            event.scope,
                            event.status,
                            event.payload || ''
                        ].filter(Boolean);

                        const textToEmbed = textParts.join(' ');
                        const embedding = await generateEmbedding(textToEmbed);

                        if (embedding) {
                            await db.run(
                                'UPDATE orevents SET embedding = ? WHERE id = ?',
                                [embedding.buffer as ArrayBuffer, event.id]
                            );
                            setStats(prev => ({ ...prev, totalProcessed: prev.totalProcessed + 1 }));
                        }
                    } catch (e) {
                        console.error(`[Indexing] Failed to index event ${event.id}:`, e);
                        setStats(prev => ({ ...prev, totalErrors: prev.totalErrors + 1 }));
                    }
                }
            }

        } catch (error) {
            console.error('[Indexing] Indexing process failed:', error);
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
                console.log('[Indexing] DB change detected, triggering scan...');
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
        stats
    };
}
