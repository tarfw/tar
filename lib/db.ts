import { Database, getDbPath } from "@tursodatabase/sync-react-native";

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL || "";
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "";

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

let localDbInstance: Database | null = null;
let localInitPromise: Promise<Database> | null = null;

/**
 * Get the Sync Database (Turso Remote Sync)
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dbPath = getDbPath("tar.db");
    const instance = new Database({
      path: dbPath,
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN,
    });

    await instance.connect();

    // Initialize Global/Sync Schema
    const schema = [
      `CREATE TABLE IF NOT EXISTS state (
                id TEXT PRIMARY KEY,
                ucode TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                title TEXT,
                payload TEXT,
                embedding F32_BLOB(384),
                scope TEXT,
                author TEXT,
                ts TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
      `CREATE TABLE IF NOT EXISTS instance (
                id TEXT PRIMARY KEY,
                stateid TEXT NOT NULL,
                scope TEXT,
                metadata TEXT,
                qty REAL,
                value REAL,
                currency TEXT,
                available INTEGER,
                lat REAL,
                lng REAL,
                h3 TEXT,
                startts TEXT,
                endts TEXT,
                ts TEXT DEFAULT CURRENT_TIMESTAMP,
                payload TEXT,
                FOREIGN KEY (stateid) REFERENCES state(id)
            )`,
      `CREATE TABLE IF NOT EXISTS trace (
                id TEXT PRIMARY KEY,
                streamid TEXT NOT NULL,
                opcode INTEGER NOT NULL,
                delta REAL,
                lat REAL,
                lng REAL,
                payload TEXT,
                ts TEXT DEFAULT CURRENT_TIMESTAMP,
                scope TEXT
            )`,
    ];

    try {
      console.log("[DB] Initializing new schema...");
      for (const statement of schema) {
        await instance.exec(statement);
      }
      console.log("[DB] Schema initialization complete.");
    } catch (e) {
      console.error("[DB] Critical: Failed to initialize schema:", e);
      throw e;
    }

    dbInstance = instance;
    return instance;
  })();

  return initPromise;
}

/**
 * Get the Local-Only Database (No Sync)
 */
export async function getLocalDb(): Promise<Database> {
  if (localDbInstance) return localDbInstance;
  if (localInitPromise) return localInitPromise;

  localInitPromise = (async () => {
    const dbPath = getDbPath("local.db");
    const instance = new Database({
      path: dbPath,
    });

    await instance.connect();

    // Initialize Local-Only Schema (Preferences, Cache, etc.)
    const schema = [
      `CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`,
      `CREATE TABLE IF NOT EXISTS private_profile (
                id TEXT PRIMARY KEY,
                key_type TEXT NOT NULL,
                encrypted_blob TEXT NOT NULL,
                created_at TEXT NOT NULL
            )`,
    ];

    for (const statement of schema) {
      await instance.exec(statement);
    }

    localDbInstance = instance;
    return instance;
  })();

  return localInitPromise;
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
  listeners.forEach((l) => l());
}

/**
 * Universal Sync Function
 * Pulls changes from remote and pushes local changes to remote.
 */
export async function syncDb() {
  const database = await getDb();
  if (TURSO_URL && TURSO_AUTH_TOKEN) {
    try {
      console.log("[Sync] Starting bidirectional sync...");
      await database.push();
      const pullApplied = await database.pull();
      if (pullApplied) {
        notifyDbChanges();
      }
      console.log("[Sync] Sync complete!");
      return true;
    } catch (error) {
      console.error("[Sync] Sync failed:", error);
      return false;
    }
  } else {
    console.warn(
      "[Sync] Turso URL or Auth Token missing. Running in local-only mode.",
    );
    return false;
  }
}

/**
 * DATABASE HELPERS
 */

export const dbHelpers = {
  // State (Catalog/Categories/Products/Actors)
  getStates: async (scope?: string) => {
    const db = await getDb();
    if (scope) {
      return await db.all("SELECT * FROM state WHERE scope = ?", [scope]);
    }
    return await db.all("SELECT * FROM state");
  },
  insertState: async (state: {
    id: string;
    ucode: string;
    type: string;
    title?: string;
    payload?: string;
    scope?: string;
    author?: string;
  }) => {
    const db = await getDb();
    const result = await db.run(
      "INSERT INTO state (id, ucode, type, title, payload, scope, author) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        state.id,
        state.ucode,
        state.type,
        state.title || null,
        state.payload || null,
        state.scope || null,
        state.author || null,
      ],
    );
    notifyDbChanges();
    return result;
  },
  updateState: async (
    id: string,
    updates: { title?: string; ucode?: string; payload?: string },
  ) => {
    const db = await getDb();
    const sets: string[] = [];
    const vals: any[] = [];
    if (updates.title !== undefined) {
      sets.push("title = ?");
      vals.push(updates.title);
    }
    if (updates.ucode !== undefined) {
      sets.push("ucode = ?");
      vals.push(updates.ucode);
    }
    if (updates.payload !== undefined) {
      sets.push("payload = ?");
      vals.push(updates.payload);
    }
    if (sets.length === 0) return;
    vals.push(id);
    const result = await db.run(
      `UPDATE state SET ${sets.join(", ")} WHERE id = ?`,
      vals,
    );
    notifyDbChanges();
    return result;
  },

  // Trace (Operational Events)
  getTraces: async (streamid?: string) => {
    const db = await getDb();
    if (streamid) {
      return await db.all(
        "SELECT * FROM trace WHERE streamid = ? ORDER BY ts DESC",
        [streamid],
      );
    }
    return await db.all("SELECT * FROM trace ORDER BY ts DESC");
  },
  insertTrace: async (trace: {
    id: string;
    streamid: string;
    opcode: number;
    delta?: number;
    lat?: number;
    lng?: number;
    payload?: string;
    scope?: string;
  }) => {
    const db = await getDb();
    const result = await db.run(
      "INSERT INTO trace (id, streamid, opcode, delta, lat, lng, payload, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        trace.id,
        trace.streamid,
        trace.opcode,
        trace.delta || 0,
        trace.lat || null,
        trace.lng || null,
        trace.payload || null,
        trace.scope || null,
      ],
    );
    notifyDbChanges();
    return result;
  },

  // Instances
  getInstances: async (stateid?: string) => {
    const db = await getDb();
    if (stateid) {
      return await db.all("SELECT * FROM instance WHERE stateid = ?", [
        stateid,
      ]);
    }
    return await db.all("SELECT * FROM instance");
  },
  insertInstance: async (instance: {
    id: string;
    stateid: string;
    scope?: string;
    metadata?: string;
    qty?: number;
    value?: number;
    currency?: string;
    available?: number;
    lat?: number;
    lng?: number;
    h3?: string;
    payload?: string;
  }) => {
    const db = await getDb();
    const result = await db.run(
      "INSERT INTO instance (id, stateid, scope, metadata, qty, value, currency, available, lat, lng, h3, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        instance.id,
        instance.stateid,
        instance.scope || null,
        instance.metadata || null,
        instance.qty || 0,
        instance.value || 0,
        instance.currency || null,
        instance.available || 1,
        instance.lat || null,
        instance.lng || null,
        instance.h3 || null,
        instance.payload || null,
      ],
    );
    notifyDbChanges();
    return result;
  },

  // Legacy compatibility helpers (to avoid breaking the whole app at once)
  getNodes: async (parentid?: string) => {
    // Mapping parentid to scope or a custom payload field if needed,
    // but for now, we'll just return all states.
    return await dbHelpers.getStates();
  },
  insertNode: async (node: any) => {
    return await dbHelpers.insertState({
      id: node.id,
      ucode: node.universalcode,
      type: node.nodetype,
      title: node.title,
      payload: node.payload,
    });
  },
  getPoints: async () => {
    return await dbHelpers.getInstances();
  },
  getEvents: async (streamid?: string) => {
    return await dbHelpers.getTraces(streamid);
  },
  insertEvent: async (event: any) => {
    return await dbHelpers.insertTrace({
      id: event.id,
      streamid: event.streamid,
      opcode: event.opcode,
      payload: event.payload,
      scope: event.scope,
    });
  },

  // Semantic Search
  semanticSearchState: async (queryVector: Float32Array, limit: number = 5) => {
    const db = await getDb();
    return await db.all(
      `SELECT *, vector_distance_cos(embedding, ?) as distance 
             FROM state 
             WHERE embedding IS NOT NULL 
             ORDER BY distance 
             LIMIT ?`,
      [queryVector.buffer as ArrayBuffer, limit],
    );
  },
  semanticSearchTraces: async (
    queryVector: Float32Array,
    limit: number = 5,
  ) => {
    // Trace table currently does not have an embedding column for vector search.
    // Returning an empty result instead of crashing.
    console.warn(
      "[DB] semanticSearchTraces called but trace table has no embedding column.",
    );
    return [];
  },
};

/**
 * LOCAL-ONLY DATABASE HELPERS
 */
export const localDbHelpers = {
  getSetting: async (key: string) => {
    const db = await getLocalDb();
    const result = await db.get(
      "SELECT value FROM app_settings WHERE key = ?",
      [key],
    );
    return result?.value as string | undefined;
  },
  setSetting: async (key: string, value: string) => {
    const db = await getLocalDb();
    return await db.run(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      [key, value],
    );
  },
};
