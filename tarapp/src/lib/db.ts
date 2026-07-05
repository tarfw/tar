import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";

const TARFLUE_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tar-54d.workers.dev';

const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;
let syncReadyResolve: (() => void) | null = null;
export const syncReady = new Promise<void>(r => { syncReadyResolve = r; });

const PARTIAL_SYNC_QUERY = [
  "SELECT id FROM form WHERE scope LIKE 'w:%'",
  "SELECT id FROM matter WHERE scope LIKE 'w:%'",
  "SELECT stream AS id FROM motion",
  "SELECT src AS id FROM graph",
  "SELECT id FROM memory",
].join(" UNION ALL ");

export async function getSelfId(): Promise<string> {
  if (cachedSelfId) return cachedSelfId;
  const t0 = Date.now();
  try {
    console.log(`[DB] ${Date.now() - t0}ms — getSelfId: getCurrentUser START`);
    const user = await getCurrentUser();
    console.log(`[DB] ${Date.now() - t0}ms — getSelfId: getCurrentUser done, user: ${user ? user.id : 'null'}`);
    if (user && user.id) {
      cachedSelfId = user.id;
      return user.id;
    }
  } catch (e) {
    console.warn(`[DB] ${Date.now() - t0}ms — getSelfId failed:`, e);
  }
  cachedSelfId = "guest";
  console.log(`[DB] ${Date.now() - t0}ms — getSelfId: fallback to guest`);
  return "guest";
}

type DbListener = (db: Database) => void;
const dbListeners: DbListener[] = [];

export function subscribeDb(listener: DbListener): () => void {
  dbListeners.push(listener);
  return () => {
    const idx = dbListeners.indexOf(listener);
    if (idx !== -1) dbListeners.splice(idx, 1);
  };
}

function notifyDbChange(db: Database) {
  for (const listener of dbListeners) {
    try {
      listener(db);
    } catch (_) {}
  }
}

function createLocalDbConnection(key: string, dbName: string): Database {
  if (!dbConnections[key]) {
    const db = new Database({ path: getDbPath(dbName) });
    dbConnections[key] = db;
    notifyDbChange(db);
  }
  return dbConnections[key];
}

function createSyncDbConnection(key: string, dbName: string, url: string, authToken: string): Database {
  if (dbConnections[key]) delete dbConnections[key];
  const db = new Database({
    path: getDbPath(dbName),
    url,
    authToken,
    partialSyncExperimental: {
      bootstrapStrategy: { kind: 'query', query: PARTIAL_SYNC_QUERY },
    },
  });
  dbConnections[key] = db;
  notifyDbChange(db);
  return db;
}

export function getLocalPrivateDb(userId: string): Database {
  return createLocalDbConnection(`private_${userId}`, `user_${userId}.db`);
}

export function getUserSyncDb(userId: string, url: string, authToken: string): Database {
  return createSyncDbConnection(`private_${userId}`, `user_${userId}.db`, url, authToken);
}

export function getGlobalDb(): Database {
  return createLocalDbConnection("global", "global.db");
}

export function getUserDb(): Database {
  const userId = cachedSelfId || "guest";
  // Return sync DB if available, otherwise local
  const syncKey = `private_${userId}`;
  if (dbConnections[syncKey]?.isSync) {
    return dbConnections[syncKey];
  }
  return getLocalPrivateDb(userId);
}

export const getDbClient = getUserDb;

export function scopePrefix(scope: string | null): 'p' | 'w' | 'o' | 'g' {
  if (!scope || scope === 'p' || scope.startsWith('p:')) return 'p';
  if (scope === 'w' || scope.startsWith('w:')) return 'w';
  if (scope === 'o' || scope.startsWith('o:')) return 'o';
  return 'g';
}

function extractScopeId(scope: string): string {
  return scope.includes(':') ? scope.split(':').slice(1).join(':') : scope;
}

export function getWorkspaceDb(workspaceId: string): Database {
  const id = extractScopeId(workspaceId);
  return createLocalDbConnection(`workspace_${id}`, `workspace_${id}.db`);
}

export function getOrderDb(orderId: string): Database {
  const id = extractScopeId(orderId);
  return createLocalDbConnection(`order_${id}`, `order_${id}.db`);
}

/**
 * Initialize schema and run migrations for any database connection.
 */
export async function ensureDbSchema(db: Database, label: string): Promise<void> {
  await db.connect();
  await migrateMemoryTable(db, label);
  for (const sql of SCHEMA_STATEMENTS) {
    try { await db.exec(sql); } catch (_) {}
  }
}

export function routeDbForEntity(_type: string | null, scope: string | null): Database {
  const selfId = cachedSelfId || "guest";
  const prefix = scopePrefix(scope);

  if (prefix === 'p') {
    return getLocalPrivateDb(selfId);
  }

  if (prefix === 'g') {
    return getGlobalDb();
  }

  // Workspace data lives in the user's sync DB — so it syncs to Turso
  if (prefix === 'w') {
    return getLocalPrivateDb(selfId);
  }

  if (prefix === 'o' && scope) {
    return getOrderDb(scope);
  }

  return getLocalPrivateDb(selfId);
}

/**
 * Return a database for a scope, ensuring it is connected and has the schema.
 */
export async function getPreparedDbForScope(scope: string | null): Promise<Database> {
  const db = routeDbForEntity('form', scope);
  const label = scope || 'p';
  await ensureDbSchema(db, label);
  return db;
}

/**
 * Run a sequence of database operations inside a single SQLite transaction.
 * Automatically COMMIT on success, ROLLBACK on failure.
 */
export async function withTransaction<T>(db: Database, fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    throw e;
  }
}

/**
 * Handles database schema migrations for tables whose layout has changed
 * in the final unified system architecture (memory, graph, and deletion of action).
 */
async function migrateMemoryTable(db: Database, label: string) {
  try {
    const cols = await db.all(`PRAGMA table_info(memory)`).catch(() => [] as any[]);
    if (Array.isArray(cols) && cols.length > 0) {
      const hasFormCol = cols.some((c: any) => c.name === 'form');
      const hasMetaCol = cols.some((c: any) => c.name === 'meta');
      if (hasFormCol || !hasMetaCol) {
        console.log(`[DB] migrating memory table (${label}) → target schema`);
        await db.exec(`DROP TABLE IF EXISTS memory`);
        await db.exec(
          `CREATE TABLE IF NOT EXISTS memory (id TEXT NOT NULL, chunk INTEGER NOT NULL DEFAULT 0, text TEXT, embedding BLOB, meta TEXT, PRIMARY KEY (id, chunk))`
        );
        console.log(`[DB] memory table migrated (${label})`);
      }
    }
  } catch (e) {
    console.warn(`[DB] memory migration failed (${label}):`, e);
  }

  try {
    const cols = await db.all(`PRAGMA table_info(graph)`).catch(() => [] as any[]);
    if (Array.isArray(cols) && cols.length > 0) {
      const hasWeightCol = cols.some((c: any) => c.name === 'weight');
      if (hasWeightCol) {
        console.log(`[DB] migrating graph table (${label}) → removing weight column`);
        await db.exec(`DROP TABLE IF EXISTS graph`);
        await db.exec(
          `CREATE TABLE IF NOT EXISTS graph (src TEXT NOT NULL, rel TEXT NOT NULL, tgt TEXT NOT NULL, active INTEGER DEFAULT 1, data TEXT, time TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (src, rel, tgt))`
        );
        console.log(`[DB] graph table migrated (${label})`);
      }
    }
  } catch (e) {
    console.warn(`[DB] graph migration failed (${label}):`, e);
  }

  try {
    const cols = await db.all(`PRAGMA table_info(matter)`).catch(() => [] as any[]);
    if (Array.isArray(cols) && cols.length > 0) {
      const hasOwnerCol = cols.some((c: any) => c.name === 'owner');
      if (!hasOwnerCol) {
        console.log(`[DB] migrating matter table (${label}) → adding owner column`);
        await db.exec(`ALTER TABLE matter ADD COLUMN owner TEXT`);
        console.log(`[DB] matter table migrated (added owner column) (${label})`);
      }
    }
  } catch (e) {
    console.warn(`[DB] matter migration failed (${label}):`, e);
  }

  try {
    const cols = await db.all(`PRAGMA table_info(form)`).catch(() => [] as any[]);
    if (Array.isArray(cols) && cols.length > 0) {
      const hasOwnerCol = cols.some((c: any) => c.name === 'owner');
      if (!hasOwnerCol) {
        console.log(`[DB] migrating form table (${label}) → adding owner column`);
        await db.exec(`ALTER TABLE form ADD COLUMN owner TEXT`);
        console.log(`[DB] form table migrated (added owner column) (${label})`);
      }
    }
  } catch (e) {
    console.warn(`[DB] form migration failed (${label}):`, e);
  }

  try {
    await db.exec(`DROP TABLE IF EXISTS action`);
  } catch (_) {}
}

export async function switchUser(userId: string): Promise<Database> {
  const t0 = Date.now();
  console.log(`[DB] switchUser START: switching session to user = ${userId}`);
  cachedSelfId = userId;

  const db = getLocalPrivateDb(userId);
  try {
    await db.connect();
    await migrateMemoryTable(db, userId);
    for (const sql of SCHEMA_STATEMENTS) {
      try { await db.exec(sql); } catch (_) {}
    }
  } catch (e) {
    console.error(`[DB] switchUser DB init FAILED:`, e);
    throw e;
  }

  console.log(`[DB] switchUser DONE: switched and initialized in ${Date.now() - t0}ms`);
  return db;
}

export async function initUserSync(userId: string): Promise<void> {
  const t0 = Date.now();
  console.log(`[DB] initUserSync START for user = ${userId}`);

  try {
    console.log(`[DB] initUserSync: fetching Turso creds from ${TARFLUE_URL}/user-db`);
    const res = await fetch(`${TARFLUE_URL}/user-db?userId=${userId}`);
    console.log(`[DB] initUserSync: response ${res.status}`);
    if (!res.ok) {
      console.warn(`[DB] initUserSync: failed to fetch Turso creds (${res.status})`);
      return;
    }
    const data = await res.json();
    const { url, authToken } = data;
    console.log(`[DB] initUserSync: got URL = ${url}`);
    if (!url || !authToken) {
      console.warn(`[DB] initUserSync: no Turso creds returned`, data);
      return;
    }

    console.log(`[DB] initUserSync: creating sync DB connection...`);
    const db = getUserSyncDb(userId, url, authToken);
    console.log(`[DB] initUserSync: connecting...`);
    await db.connect();
    console.log(`[DB] initUserSync: connected, applying schema locally...`);
    await migrateMemoryTable(db, userId);
    for (const sql of SCHEMA_STATEMENTS) {
      try { await db.exec(sql); } catch (_) {}
    }
    console.log(`[DB] initUserSync: DONE in ${Date.now() - t0}ms`);
    syncReadyResolve?.();
  } catch (e) {
    console.warn(`[DB] initUserSync FAILED:`, e);
  }
}

export async function pullSync(userId: string): Promise<void> {
  const t0 = Date.now();
  console.log(`[DB] pullSync START for user = ${userId}`);
  try {
    // Wait for sync DB to be ready (with timeout)
    await Promise.race([syncReady, new Promise(r => setTimeout(r, 10000))]);

    const db = getUserDb();
    if (!db.isSync) {
      console.log(`[DB] pullSync: SKIP — sync DB not ready`);
      return;
    }
    console.log(`[DB] pullSync: db type = sync`);

    console.log(`[DB] pullSync: calling db.push()...`);
    try {
      await db.push();
      console.log(`[DB] pullSync: db.push() success`);
    } catch (pushErr) {
      console.warn(`[DB] pullSync: db.push() failed:`, pushErr);
    }

    console.log(`[DB] pullSync: calling db.pull()...`);
    const changed = await db.pull();
    console.log(`[DB] pullSync: db.pull() success, changed = ${changed}`);
    console.log(`[DB] pullSync: DONE in ${Date.now() - t0}ms`);
  } catch (e) {
    console.warn(`[DB] pullSync FAILED in ${Date.now() - t0}ms:`, e);
  }
}

export async function initDb() {
  const t0 = Date.now();
  console.log(`[DB] ${Date.now() - t0}ms — initDb START`);

  const userId = await getSelfId();
  console.log(`[DB] ${Date.now() - t0}ms — initDb userId = ${userId}, cachedSelfId = ${cachedSelfId}`);

  if (userId === "guest") {
    console.log(`[DB] ${Date.now() - t0}ms — initDb SKIP (no profile)`);
    return;
  }

  await switchUser(userId);
  initUserSync(userId).catch((err) => {
    console.warn(`[DB] background initUserSync failed for ${userId}:`, err);
  });
  console.log(`[DB] ${Date.now() - t0}ms — initDb DONE, cachedSelfId = ${cachedSelfId}`);
}
