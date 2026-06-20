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
    return getGlobalDb();
  }
  return getLocalPrivateDb(selfId);
}

/**
 * One-time migration of the `memory` table from the old single-vector-per-form
 * schema (PK `form`) to the chunked schema (composite PK `(form, chunk)`).
 *
 * `CREATE TABLE IF NOT EXISTS` can't alter an existing table, and
 * `ALTER TABLE ADD COLUMN` can't add `chunk` to the PRIMARY KEY — so we detect
 * the old shape via PRAGMA and DROP+recreate. This only discards cached
 * vectors; the source `form` rows are untouched and re-embed automatically
 * (the bumped sync flags in vectorStore/skills force a full re-index).
 */
async function migrateMemoryTable(db: Database, label: string) {
  try {
    const cols = await db.all(`PRAGMA table_info(memory)`).catch(() => [] as any[]);
    if (!Array.isArray(cols) || cols.length === 0) return; // fresh DB — CREATE handles it
    const hasChunk = cols.some((c: any) => c.name === 'chunk');
    if (hasChunk) return;
    console.log(`[DB] migrating memory table (${label}) → chunked schema`);
    await db.exec(`DROP TABLE IF EXISTS memory`);
    await db.exec(
      `CREATE TABLE IF NOT EXISTS memory (form TEXT NOT NULL, chunk INTEGER NOT NULL DEFAULT 0, vector BLOB, embedding BLOB, PRIMARY KEY (form, chunk))`
    );
    console.log(`[DB] memory table migrated (${label})`);
  } catch (e) {
    console.warn(`[DB] memory migration failed (${label}):`, e);
  }
}

export async function initDb() {
  const t0 = Date.now();
  console.log(`[DB] ${Date.now() - t0}ms — initDb START`);

  const privateDb = getLocalPrivateDb("guest");
  try {
    console.log(`[DB] ${Date.now() - t0}ms — privateDb.connect() START`);
    await privateDb.connect();
    console.log(`[DB] ${Date.now() - t0}ms — privateDb.connect() DONE`);
    await migrateMemoryTable(privateDb, "guest");
    for (const sql of SCHEMA_STATEMENTS) {
      try { await privateDb.exec(sql); } catch (_) {}
    }
    console.log(`[DB] ${Date.now() - t0}ms — privateDb schema applied`);
  } catch (e) {
    console.error(`[DB] ${Date.now() - t0}ms — privateDb FAILED:`, e);
    throw e;
  }

  const globalDb = getGlobalDb();
  try {
    console.log(`[DB] ${Date.now() - t0}ms — globalDb.connect() START`);
    await globalDb.connect();
    console.log(`[DB] ${Date.now() - t0}ms — globalDb.connect() DONE`);
    await migrateMemoryTable(globalDb, "global");
    for (const sql of SCHEMA_STATEMENTS) {
      try { await globalDb.exec(sql); } catch (_) {}
    }
    console.log(`[DB] ${Date.now() - t0}ms — globalDb schema applied`);
  } catch (e) {
    console.error(`[DB] ${Date.now() - t0}ms — globalDb FAILED:`, e);
  }

  console.log(`[DB] ${Date.now() - t0}ms — initDb DONE (guest, upgrading async)`);

  getSelfId().then((userId) => {
    if (userId !== "guest") {
      console.log(`[DB] — getSelfId resolved: ${userId}, upgrading DB`);
      const userDb = getLocalPrivateDb(userId);
      userDb.connect().then(async () => {
        await migrateMemoryTable(userDb, userId);
        for (const sql of SCHEMA_STATEMENTS) {
          userDb.exec(sql).catch(() => {});
        }
        console.log(`[DB] — user DB ready for ${userId}`);
      }).catch((e) => console.warn(`[DB] — user DB upgrade failed:`, e));
    }
  });
}
