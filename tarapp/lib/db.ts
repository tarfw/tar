import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import * as SecureStore from "expo-secure-store";
import { SCHEMA_STATEMENTS } from "./schema";
import { getCurrentUser } from "./auth";

export const CLOUDFLARE_WORKER_URL = "https://s3storage.tamilframework.workers.dev";

// Cache of dynamically opened database connections and session tokens
const dbConnections: Record<string, Database> = {};
export let cachedSelfId: string | null = null;
let cachedSyncUrl: string = "";
let cachedSyncToken: string = "";

export function setCustomCollabCredentials(url: string, token: string) {
  cachedSyncUrl = url;
  cachedSyncToken = token;
}

export async function isCollabSyncEnabled(): Promise<boolean> {
  return !!(cachedSyncUrl || process.env.EXPO_PUBLIC_TURSO_SYNC_URL);
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
    
    // Enforce strictly offline/local-only behavior by making sync methods no-ops
    (db as any).push = async () => {};
    (db as any).pull = async () => {};
    (db as any).sync = async () => {};
    
    dbConnections[key] = db;
  }
  return dbConnections[key];
}

/**
 * Returns the primary synced database for a specific user
 */
export function getPrimarySyncDb(userId: string): Database {
  const key = `sync_${userId}`;
  if (!dbConnections[key]) {
    const dbName = `user_sync_${userId}.db`;
    
    // Choose dynamic session credentials if we are matching the active user, fallback to env variables
    const remoteUrl = (userId === cachedSelfId && cachedSyncUrl) 
      ? cachedSyncUrl 
      : (process.env.EXPO_PUBLIC_TURSO_SYNC_URL || "");
      
    const token = (userId === cachedSelfId && cachedSyncToken) 
      ? cachedSyncToken 
      : (process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "");
    
    const config: any = {
      path: getDbPath(dbName),
    };
    
    if (remoteUrl && token) {
      config.url = remoteUrl;
      config.authToken = token;
      console.log(`[DB:Sync] Initialized remote sync config for ${userId} to ${remoteUrl}`);
    } else {
      console.log(`[DB:Sync] Initialized local-only fallback sync for ${userId} (no remote credentials)`);
    }
    
    const db = new Database(config);
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
    const remoteUrl = `libsql://db-${ownerId}.turso.io`;
    
    const config: any = {
      path: getDbPath(dbName),
    };
    
    if (delegatedToken) {
      config.url = remoteUrl;
      config.authToken = delegatedToken;
    }
    
    const db = new Database(config);
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
    (db as any).push = async () => {}; // Read-only global cache
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

// Map standard legacy getters to the dynamic architecture
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
 * Initialization function called during app boot and session switches
 */
export async function initDb() {
  cachedSelfId = null;
  const selfId = await getSelfId();
  console.log(`[DB] Initializing database files for user: ${selfId}`);
  
  // Clean up cached dynamic credentials on session switch
  cachedSyncUrl = "";
  cachedSyncToken = "";

  // If user is logged in, attempt to fetch/restore remote sync credentials from Cloudflare Worker
  if (selfId && selfId !== "guest") {
    try {
      let storedUrl = await SecureStore.getItemAsync(`user_sync_url_${selfId}`);
      let storedToken = await SecureStore.getItemAsync(`user_sync_token_${selfId}`);

      // Clear legacy database name prefixes (db-usr- or usr-) from SecureStore cache to force recreation/refresh
      if (storedUrl && (storedUrl.includes("/db-usr-") || storedUrl.includes("/usr-"))) {
        console.log(`[DB] Clearing legacy cached URL: ${storedUrl}`);
        await SecureStore.deleteItemAsync(`user_sync_url_${selfId}`);
        await SecureStore.deleteItemAsync(`user_sync_token_${selfId}`);
        storedUrl = null;
        storedToken = null;
      }

      if (!storedUrl || !storedToken) {
        console.log(`[DB] Requesting database creation/token from Worker for user: ${selfId}`);
        const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/user/get-or-create-db`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${selfId}`
          },
          body: JSON.stringify({ userId: selfId })
        });

        if (response.ok) {
          const data = await response.json();
          storedUrl = data.syncUrl;
          storedToken = data.authToken;

          if (storedUrl && storedToken) {
            await SecureStore.setItemAsync(`user_sync_url_${selfId}`, storedUrl);
            await SecureStore.setItemAsync(`user_sync_token_${selfId}`, storedToken);
            console.log(`[DB] Remote sync credentials saved securely for user: ${selfId}`);
          }
        } else {
          const errText = await response.text();
          console.warn(`[DB] Worker rejected get-or-create-db request: ${errText}`);
          try {
            const { Alert } = require("react-native");
            Alert.alert("Database Error", `Worker rejected database creation: ${errText}`);
          } catch (_) {}
        }
      }

      if (storedUrl && storedToken) {
        cachedSyncUrl = storedUrl;
        cachedSyncToken = storedToken;
      }
    } catch (err: any) {
      console.warn("[DB] Error loading/fetching sync credentials from worker:", err);
      try {
        const { Alert } = require("react-native");
        Alert.alert("Sync Network Error", `Failed to contact database provisioning service: ${err.message || String(err)}`);
      } catch (_) {}
    }
  }

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
    // If the database connection was already opened under a mock configuration, we close it so it reconnects with the fetched sync credentials
    const connKey = `sync_${selfId}`;
    if (dbConnections[connKey]) {
      try {
        await dbConnections[connKey].close();
      } catch (_) {}
      delete dbConnections[connKey];
    }
    
    const reSyncDb = getPrimarySyncDb(selfId);
    await reSyncDb.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      await reSyncDb.exec(sql);
    }
    
    const syncEnabled = await isCollabSyncEnabled();
    if (syncEnabled) {
      console.log(`[DB:Sync] Synchronizing schema with remote Turso...`);
      try {
        await reSyncDb.push();
        await reSyncDb.pull();
        console.log(`[DB:Sync] Schema synchronized with remote Turso successfully`);
      } catch (syncErr) {
        console.warn(`[DB:Sync] Initial schema sync warning:`, syncErr);
      }
    }
    
    console.log(`[DB:Sync] Connected & Verified for ${selfId}`);
  } catch (e) {
    console.error(`[DB:Sync] Initialization failed:`, e);
    try {
      await SecureStore.deleteItemAsync(`user_sync_url_${selfId}`);
      await SecureStore.deleteItemAsync(`user_sync_token_${selfId}`);
    } catch (_) {}
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

}
