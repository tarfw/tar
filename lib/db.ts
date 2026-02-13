import { connect, Database } from '@tursodatabase/sync-react-native';

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL || '';
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || '';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = await connect({
            path: 'tar.db',
            url: TURSO_URL,
            authToken: TURSO_AUTH_TOKEN,
        });

        // Initialize schema
        const schema = [
            `CREATE TABLE IF NOT EXISTS actors (
                id TEXT PRIMARY KEY,
                parentid TEXT,
                actortype TEXT NOT NULL,
                globalcode TEXT NOT NULL,
                name TEXT NOT NULL,
                metadata TEXT,
                vector F32_BLOB(384),
                pushtoken TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS collab (
                id TEXT PRIMARY KEY,
                actorid TEXT NOT NULL,
                targettype TEXT NOT NULL,
                targetid TEXT NOT NULL,
                role TEXT NOT NULL,
                permissions TEXT,
                createdat TEXT NOT NULL,
                expiresat TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                parentid TEXT,
                nodetype TEXT NOT NULL,
                universalcode TEXT NOT NULL,
                title TEXT NOT NULL,
                payload TEXT,
                embedding F32_BLOB(384)
            )`,
            `CREATE TABLE IF NOT EXISTS points (
                id TEXT PRIMARY KEY,
                noderef TEXT NOT NULL,
                sellerid TEXT NOT NULL,
                sku TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                stock TEXT,
                price REAL NOT NULL,
                notes TEXT,
                version INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS streams (
                id TEXT PRIMARY KEY,
                scope TEXT NOT NULL,
                createdby TEXT NOT NULL,
                createdat TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS streamcollab (
                streamid TEXT NOT NULL,
                actorid TEXT NOT NULL,
                role TEXT NOT NULL,
                joinedat TEXT,
                PRIMARY KEY (streamid, actorid)
            )`,
            `CREATE TABLE IF NOT EXISTS orevents (
                id TEXT PRIMARY KEY,
                streamid TEXT NOT NULL,
                opcode INTEGER NOT NULL,
                refid TEXT NOT NULL,
                lat REAL,
                lng REAL,
                delta REAL DEFAULT 0,
                payload TEXT,
                scope TEXT NOT NULL,
                status TEXT,
                ts TEXT NOT NULL
            )`
        ];

        for (const statement of schema) {
            await dbInstance.exec(statement);
        }
    }
    return dbInstance;
}

/**
 * DB Event System for Reactivity
 */
type DbChangeListener = () => void;
const listeners = new Set<DbChangeListener>();

export function subscribeToDbChanges(listener: DbChangeListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function notifyDbChanges() {
    listeners.forEach(l => l());
}

/**
 * Universal Sync Function
 * Pulls changes from remote and pushes local changes to remote.
 */
export async function syncDb() {
    const database = await getDb();
    if (TURSO_URL && TURSO_AUTH_TOKEN) {
        try {
            console.log('[Sync] Starting bidirectional sync...');
            const pullApplied = await database.pull();
            if (pullApplied) {
                console.log('[Sync] Remote changes pulled and applied.');
                notifyDbChanges();
            }
            await database.push();
            console.log('[Sync] Local changes pushed to remote.');
            console.log('[Sync] Sync complete!');
            return true;
        } catch (error) {
            console.error('[Sync] Sync failed:', error);
            return false;
        }
    } else {
        console.warn('[Sync] Turso URL or Auth Token missing. Running in local-only mode.');
        return false;
    }
}

/**
 * DATABASE HELPERS
 */

export const dbHelpers = {
    // Actors
    getActors: async () => {
        const db = await getDb();
        return await db.all('SELECT * FROM actors');
    },
    insertActor: async (actor: { id: string, actortype: string, globalcode: string, name: string, parentid?: string, metadata?: string }) => {
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO actors (id, actortype, globalcode, name, parentid, metadata) VALUES (?, ?, ?, ?, ?, ?)',
            [actor.id, actor.actortype, actor.globalcode, actor.name, actor.parentid || null, actor.metadata || null]
        );
        notifyDbChanges();
        return result;
    },

    // Nodes (Catalog/Categories/Products)
    getNodes: async (parentid?: string) => {
        const db = await getDb();
        if (parentid) {
            return await db.all('SELECT * FROM nodes WHERE parentid = ?', [parentid]);
        }
        return await db.all('SELECT * FROM nodes');
    },
    insertNode: async (node: { id: string, nodetype: string, universalcode: string, title: string, parentid?: string, payload?: string }) => {
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO nodes (id, nodetype, universalcode, title, parentid, payload) VALUES (?, ?, ?, ?, ?, ?)',
            [node.id, node.nodetype, node.universalcode, node.title, node.parentid || null, node.payload || null]
        );
        notifyDbChanges();
        return result;
    },

    // OREvents (Operational Events)
    getEvents: async (streamid?: string) => {
        const db = await getDb();
        if (streamid) {
            return await db.all('SELECT * FROM orevents WHERE streamid = ? ORDER BY ts DESC', [streamid]);
        }
        return await db.all('SELECT * FROM orevents ORDER BY ts DESC');
    },
    insertEvent: async (event: { id: string, streamid: string, opcode: number, refid: string, scope: string, status?: string, payload?: string }) => {
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO orevents (id, streamid, opcode, refid, scope, status, payload, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [event.id, event.streamid, event.opcode, event.refid, event.scope, event.status || 'pending', event.payload || null, new Date().toISOString()]
        );
        notifyDbChanges();
        return result;
    },

    // Collab
    getCollab: async () => {
        const db = await getDb();
        return await db.all('SELECT * FROM collab');
    },

    // Points
    getPoints: async () => {
        const db = await getDb();
        return await db.all('SELECT * FROM points');
    },

    // Streams
    getStreams: async () => {
        const db = await getDb();
        return await db.all('SELECT * FROM streams');
    },

    // StreamCollab
    getStreamCollab: async () => {
        const db = await getDb();
        return await db.all('SELECT * FROM streamcollab');
    },

    // Semantic Search
    semanticSearchNodes: async (queryVector: Float32Array, limit: number = 5) => {
        const db = await getDb();
        // Turso native vector search syntax
        // Using vector_distance_cos for cosine similarity
        return await db.all(
            `SELECT *, vector_distance_cos(embedding, ?) as distance 
             FROM nodes 
             WHERE embedding IS NOT NULL 
             ORDER BY distance 
             LIMIT ?`,
            [queryVector.buffer as ArrayBuffer, limit]
        );
    },
    semanticSearchActors: async (queryVector: Float32Array, limit: number = 5) => {
        const db = await getDb();
        return await db.all(
            `SELECT *, vector_distance_cos(vector, ?) as distance 
             FROM actors 
             WHERE vector IS NOT NULL 
             ORDER BY distance 
             LIMIT ?`,
            [queryVector.buffer.slice(0) as ArrayBuffer, limit]
        );
    }
};
