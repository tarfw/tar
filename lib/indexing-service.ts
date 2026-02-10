import { useCallback, useEffect, useState } from 'react';
import { getDb } from './db';
import { useEmbeddingService } from './embedding-service';

export function useIndexingService() {
    const { generateEmbedding, isEmbeddingReady } = useEmbeddingService();
    const [isIndexing, setIsIndexing] = useState(false);
    const [stats, setStats] = useState({ totalProcessed: 0, totalErrors: 0 });

    const indexMissingData = useCallback(async () => {
        if (!isEmbeddingReady || isIndexing) return;

        setIsIndexing(true);
        console.log('[Indexing] Starting background indexing scan...');

        try {
            const db = await getDb();

            // 1. Process Nodes
            const unindexedNodes = await db.all('SELECT * FROM nodes WHERE embedding IS NULL LIMIT 20');
            console.log(`[Indexing] Found ${unindexedNodes.length} unindexed nodes.`);

            for (const node of unindexedNodes) {
                try {
                    const textToEmbed = `${node.title} ${node.nodetype} ${node.universalcode}`;
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

            // 2. Process Actors
            const unindexedActors = await db.all('SELECT * FROM actors WHERE vector IS NULL LIMIT 20');
            console.log(`[Indexing] Found ${unindexedActors.length} unindexed actors.`);

            for (const actor of unindexedActors) {
                try {
                    const textToEmbed = `${actor.name} ${actor.actortype} ${actor.globalcode}`;
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

        } catch (error) {
            console.error('[Indexing] Indexing process failed:', error);
        } finally {
            setIsIndexing(false);
            console.log('[Indexing] Indexing scan complete.');
        }
    }, [isEmbeddingReady, isIndexing, generateEmbedding]);

    // Optional: Auto-run on mount or periodically
    useEffect(() => {
        if (isEmbeddingReady) {
            indexMissingData();
        }
    }, [isEmbeddingReady]);

    return {
        indexMissingData,
        isIndexing,
        stats
    };
}
