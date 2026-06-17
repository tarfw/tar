import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import * as SecureStore from "expo-secure-store";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";
import { connectToScope, onSync, onPostSync, pushChanges, getLastSyncedTime } from "./sync";

export const CLOUDFLARE_WORKER_URL = "https://tar-sync.tar-54d.workers.dev";
export const TURSO_WORKER_URL = "https://turso-db.tar-54d.workers.dev";

const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;
let initialized = false;

export async function isCollabSyncEnabled(): Promise<boolean> {
  return true;
}

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

export function getPrimarySyncDb(userId: string): Database {
  const key = `sync_${userId}`;
  if (!dbConnections[key]) {
    const dbName = `user_sync_${userId}.db`;
    const config = { path: getDbPath(dbName) };
    const db = new Database(config);
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

export function getCollaboratorSyncDb(ownerId: string): Database {
  const key = `sync_${ownerId}`;
  if (!dbConnections[key]) {
    const dbName = `user_sync_${ownerId}.db`;
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

export const getCollabDb = () => getPrimarySyncDb(cachedSelfId || "guest");
export const getTenantDb = () => getPrimarySyncDb(cachedSelfId || "guest");
export const getDbClient = getUserDb;

export function routeDbForEntity(type: string | null, scope: string | null, scopeOwnerId?: string): Database {
  const selfId = cachedSelfId || "guest";

  if (!scope || scope === "p" || scope.startsWith("p:")) {
    return getLocalPrivateDb(selfId);
  }
  if (scope === "g") {
    return getGlobalDb();
  }
  if (scopeOwnerId && scopeOwnerId !== selfId) {
    return getCollaboratorSyncDb(scopeOwnerId);
  }
  return getPrimarySyncDb(selfId);
}

export async function pushLocalChanges(scope: string, changes: {
  motion?: any[];
  form?: any[];
  matter?: any[];
  bond?: any[];
}): Promise<void> {
  await pushChanges(scope, changes);
}

export async function queryPendingChanges(db: any): Promise<{
  form: any[];
  matter: any[];
  bond: any[];
  motion: any[];
}> {
  const since = getLastSyncedTime();
  try {
    const [form, matter, bond, motion] = await Promise.all([
      db.all("SELECT * FROM form WHERE time >= ?", [since]),
      db.all("SELECT * FROM matter WHERE time >= ?", [since]),
      db.all("SELECT * FROM bond WHERE time >= ?", [since]),
      db.all("SELECT * FROM motion WHERE time >= ?", [since]),
    ]);
    return { form: form || [], matter: matter || [], bond: bond || [], motion: motion || [] };
  } catch (e) {
    console.warn("[Sync] queryPendingChanges error:", e);
    return { form: [], matter: [], bond: [], motion: [] };
  }
}

let syncPushRegistered = false;

export function registerSyncPush(): void {
  if (syncPushRegistered) return;
  syncPushRegistered = true;
  onPostSync(async () => {
    const selfId = cachedSelfId || "guest";
    if (selfId === "guest") return;
    const scope = `s:${selfId}`;
    const db = getPrimarySyncDb(selfId);
    const changes = await queryPendingChanges(db);
    const total = changes.form.length + changes.matter.length + changes.bond.length + changes.motion.length;
    if (total > 0) {
      console.log(`[Sync] Post-sync push: ${total} rows (${changes.form.length} form, ${changes.matter.length} matter, ${changes.bond.length} bond, ${changes.motion.length} motion)`);
      await pushChanges(scope, changes);
    }
  });
}

export function subscribeToSync(callback: (data: any) => void): () => void {
  return onSync(callback);
}

export async function initDb() {
  cachedSelfId = null;
  registerSyncPush();
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

  const syncDb = getPrimarySyncDb(selfId);
  try {
    await syncDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      try { await syncDb.exec(sql); } catch (_) {}
    }
    console.log(`[DB:Sync] Connected & Verified for ${selfId}`);
  } catch (e) {
    console.error(`[DB:Sync] Initialization failed:`, e);
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

  if (selfId && selfId !== "guest") {
    try {
      const scope = `s:${selfId}`;
      await connectToScope(scope);
      console.log(`[DB:Sync] WebSocket connected for scope ${scope}`);
    } catch (e) {
      console.warn(`[DB:Sync] WebSocket connection failed:`, e);
    }
  }

  initialized = true;
}
