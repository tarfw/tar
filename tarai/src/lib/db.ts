import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";

const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;

export async function getSelfId(): Promise<string> {
  if (cachedSelfId) return cachedSelfId;
  try {
    const user = await getCurrentUser();
    if (user && user.id) {
      cachedSelfId = user.id;
      return user.id;
    }
  } catch (e) {
    console.warn("[DB] Failed to fetch current user for selfId:", e);
  }
  cachedSelfId = "guest";
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

export async function initDb() {
  cachedSelfId = null;
  const selfId = await getSelfId();
  console.log(`[DB] Initializing database files for user: ${selfId}`);

  const privateDb = getLocalPrivateDb(selfId);
  try {
    await privateDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      try { await privateDb.exec(sql); } catch (_) {}
    }
    console.log(`[DB:Private] Connected & Verified for ${selfId}`);
  } catch (e) {
    console.error(`[DB:Private] Initialization failed:`, e);
    throw e;
  }

  const globalDb = getGlobalDb();
  try {
    await globalDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      try { await globalDb.exec(sql); } catch (_) {}
    }
    console.log(`[DB:Global] Connected & Verified`);
  } catch (e) {
    console.error(`[DB:Global] Initialization failed:`, e);
  }
}
