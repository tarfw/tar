import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import * as SecureStore from "expo-secure-store";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";
import { connectToScope, onSync, pushChanges } from "./sync";

export const CLOUDFLARE_WORKER_URL = "https://tar-worker.wetarteam.workers.dev";

// Cache of dynamically opened database connections
const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;
let initialized = false;

export async function isCollabSyncEnabled(): Promise<boolean> {
  // Always enabled with DO-based sync
  return true;
}

/**
 * Retrieves the current logged-in user ID or falls back to 'guest'
 */
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

/**
 * Returns the private local-only database for a specific user
 */
export function getLocalPrivateDb(userId: string): Database {
  const key = `private_${userId}`;
  if (!dbConnections[key]) {
    const dbName = `user_${userId}.db`;
    const config = { path: getDbPath(dbName) };
    const db = new Database(config);
    
    // Enforce strictly offline/local-only behavior
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

/**
 * Returns the primary synced database for a specific user
 * Now uses local SQLite + WebSocket sync via DO
 */
export function getPrimarySyncDb(userId: string): Database {
  const key = `sync_${userId}`;
  if (!dbConnections[key]) {
    const dbName = `user_sync_${userId}.db`;
    const config = { path: getDbPath(dbName) };
    const db = new Database(config);
    
    // Local SQLite only - sync happens via WebSocket
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

/**
 * Returns the synced database belonging to another user (for collaboration)
 */
export function getCollaboratorSyncDb(ownerId: string, delegatedToken?: string): Database {
  const key = `sync_${ownerId}`;
  if (!dbConnections[key]) {
    const dbName = `user_sync_${ownerId}.db`;
    const config = { path: getDbPath(dbName) };
    const db = new Database(config);
    
    // Local SQLite only - sync happens via WebSocket
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

/**
 * Returns the global database cache
 */
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

/**
 * Default getter returning the private database of the currently active session
 */
export function getUserDb(): Database {
  const userId = cachedSelfId || "guest";
  return getLocalPrivateDb(userId);
}

// Map standard getters to the dynamic architecture
export const getCollabDb = () => getPrimarySyncDb(cachedSelfId || "guest");
export const getTenantDb = () => getPrimarySyncDb(cachedSelfId || "guest");
export const getDbClient = getUserDb;

/**
 * Route entity database operations based on scope and ownership
 */
export function routeDbForEntity(type: string | null, scope: string | null, scopeOwnerId?: string): Database {
  const selfId = cachedSelfId || "guest";
  
  // 1. Private data stays strictly in local isolated DB
  if (!scope || scope === "p" || scope.startsWith("p:")) {
    return getLocalPrivateDb(selfId);
  }

  // 2. Global shared lists
  if (scope === "g") {
    return getGlobalDb();
  }

  // 3. Collaborative spaces owned by another user
  if (scopeOwnerId && scopeOwnerId !== selfId) {
    return getCollaboratorSyncDb(scopeOwnerId);
  }

  // 4. Default: User's own synced workspaces
  return getPrimarySyncDb(selfId);
}

/**
 * Push local changes to the DO via WebSocket
 */
export async function pushLocalChanges(scope: string, changes: {
  motion?: any[];
  form?: any[];
  matter?: any[];
  bond?: any[];
}): Promise<void> {
  await pushChanges(scope, changes);
}

/**
 * Subscribe to sync events from the DO
 */
export function subscribeToSync(callback: (data: any) => void): () => void {
  return onSync(callback);
}

/**
 * Initialization function called during app boot and session switches
 */
export async function initDb() {
  cachedSelfId = null;
  const selfId = await getSelfId();
  console.log(`[DB] Initializing database files for user: ${selfId}`);

  // 1. Initialize & migrate private database
  const privateDb = getLocalPrivateDb(selfId);
  try {
    await privateDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      await privateDb.exec(sql);
    }
    console.log(`[DB:Private] Connected & Verified for ${selfId}`);
  } catch (e) {
    console.error(`[DB:Private] Initialization failed:`, e);
    throw e;
  }

  // 2. Initialize & migrate primary sync database
  const syncDb = getPrimarySyncDb(selfId);
  try {
    await syncDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      await syncDb.exec(sql);
    }
    console.log(`[DB:Sync] Connected & Verified for ${selfId}`);
  } catch (e) {
    console.error(`[DB:Sync] Initialization failed:`, e);
  }

  // 3. Initialize & migrate global database
  const globalDb = getGlobalDb();
  try {
    await globalDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      await globalDb.exec(sql);
    }
    console.log(`[DB:Global] Connected & Verified`);
  } catch (e) {
    console.error(`[DB:Global] Initialization failed:`, e);
  }

  // 4. Connect to WebSocket sync for user's scope
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
