import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";

const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;

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

export function getLocalPrivateDb(userId: string): Database {
  const key = `private_${userId}`;
  if (!dbConnections[key]) {
    const dbName = `user_${userId}.db`;
    const config = { path: getDbPath(dbName) };
    const db = new Database(config);
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

export function getGlobalDb(): Database {
  const key = "global";
  if (!dbConnections[key]) {
    const config = { path: getDbPath("global.db") };
    const db = new Database(config);
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

export function getUserDb(): Database {
  const userId = cachedSelfId || "guest";
  return getLocalPrivateDb(userId);
}

export const getDbClient = getUserDb;

export function routeDbForEntity(type: string | null, scope: string | null): Database {
  const selfId = cachedSelfId || "guest";
  if (!scope || scope === "p" || scope.startsWith("p:")) {
    return getLocalPrivateDb(selfId);
  }
  if (scope === "g") {
    return getLocalPrivateDb(selfId);
  }
  return getLocalPrivateDb(selfId);
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
      const hasTypeCol = cols.some((c: any) => c.name === 'type');
      if (hasTypeCol) {
        console.log(`[DB] migrating graph table (${label}) → target schema`);
        await db.exec(`DROP TABLE IF EXISTS graph`);
        await db.exec(
          `CREATE TABLE IF NOT EXISTS graph (src TEXT NOT NULL, rel TEXT NOT NULL, tgt TEXT NOT NULL, weight REAL DEFAULT 1.0, active INTEGER DEFAULT 1, time TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (src, rel, tgt))`
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

  try {
    const { setActionUserId } = await import('@/actions/store');
    setActionUserId(userId);
  } catch (e) {
    console.warn('[DB] Failed to set action user ID:', e);
  }

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

  try {
    const { ensureBuiltins } = await import('@/actions/seed');
    await ensureBuiltins();
  } catch (e) {
    console.warn('[DB] Failed to ensure built-in actions:', e);
  }

  try {
    const { seedActions } = await import('@/actions/store');
    await seedActions();
  } catch (e) {
    console.warn('[DB] Failed to seed action embeddings:', e);
  }

  console.log(`[DB] switchUser DONE: switched and initialized in ${Date.now() - t0}ms`);
  return db;
}

export async function initDb() {
  const t0 = Date.now();
  console.log(`[DB] ${Date.now() - t0}ms — initDb START`);

  // 1. Resolve current user identity first
  const userId = await getSelfId();

  // 2. Initialize the user's private database
  await switchUser(userId);

  // 3. Keep guest DB available just in case, but no need to wait for it if logged in as user
  if (userId !== "guest") {
    const guestDb = getLocalPrivateDb("guest");
    guestDb.connect().then(async () => {
      await migrateMemoryTable(guestDb, "guest");
      for (const sql of SCHEMA_STATEMENTS) {
        try { await guestDb.exec(sql); } catch (_) {}
      }
    }).catch(() => {});
  }

  console.log(`[DB] ${Date.now() - t0}ms — initDb DONE`);
}
