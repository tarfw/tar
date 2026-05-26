import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";

const TURSO_SYNC_URL = process.env.EXPO_PUBLIC_TURSO_SYNC_URL || "";
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "";

let globalDb: Database | null = null;
let collabDb: Database | null = null;
let userDb: Database | null = null;

/**
 * Global Public DB (Products catalog, store info)
 */
export function getGlobalDb(): Database {
  if (!globalDb) {
    const url = process.env.EXPO_PUBLIC_GLOBAL_SYNC_URL || TURSO_SYNC_URL;
    const authToken = process.env.EXPO_PUBLIC_GLOBAL_AUTH_TOKEN || TURSO_AUTH_TOKEN;
    const config: any = { path: getDbPath("global.db") };
    if (url) {
      config.url = url;
      config.authToken = authToken;
    }
    globalDb = new Database(config);
    if (!url) {
      (globalDb as any).push = async () => {};
      (globalDb as any).pull = async () => {};
    }
  }
  return globalDb;
}

/**
 * Collab DB (Shared business/group operations, stock, sales, shift schedules)
 */
export function getCollabDb(): Database {
  if (!collabDb) {
    const url = process.env.EXPO_PUBLIC_COLLAB_SYNC_URL || process.env.EXPO_PUBLIC_TENANT_SYNC_URL || TURSO_SYNC_URL;
    const authToken = process.env.EXPO_PUBLIC_COLLAB_AUTH_TOKEN || process.env.EXPO_PUBLIC_TENANT_AUTH_TOKEN || TURSO_AUTH_TOKEN;
    const config: any = { path: getDbPath("collab.db") };
    if (url) {
      config.url = url;
      config.authToken = authToken;
    }
    collabDb = new Database(config);
    if (!url) {
      (collabDb as any).push = async () => {};
      (collabDb as any).pull = async () => {};
    }
  }
  return collabDb;
}

/**
 * Backward compatibility alias for getCollabDb
 */
export const getTenantDb = getCollabDb;

/**
 * User Private DB (Personal tasks, private feed, notes, reminders)
 */
export function getUserDb(): Database {
  if (!userDb) {
    const url = process.env.EXPO_PUBLIC_USER_SYNC_URL || "";
    const authToken = process.env.EXPO_PUBLIC_USER_AUTH_TOKEN || "";
    const config: any = { path: getDbPath("user.db") };
    if (url) {
      config.url = url;
      config.authToken = authToken;
    }
    userDb = new Database(config);
    // User DB is strictly local-only and must never sync to the cloud
    (userDb as any).push = async () => {};
    (userDb as any).pull = async () => {};
  }
  return userDb;
}

/**
 * Default DB client for backward compatibility
 */
export function getDbClient(): Database {
  return getCollabDb();
}

/**
 * Dynamically routes matter/mass/motion target based on type/scope
 */
export function routeDbForEntity(type: string | null, scope: string | null): Database {
  const t = (type || "").toLowerCase();
  const s = (scope || "").toLowerCase();

  // Global public items (products/stores catalog)
  if (t === "product" || t === "store" || t === "food") {
    return getGlobalDb();
  }

  // Personal items (notes, tasks, personal reminders)
  if (t === "note" || t === "task" || s === "reminder" || s === "personal" || s === "deadline") {
    return getUserDb();
  }

  // Default to Collab DB for business/collaborative activities (stock, sales, shift schedules, retail, delivery, dine-in)
  return getCollabDb();
}

/**
 * Initialize all three databases with the 5-table schema
 */
export async function initDb() {
  const dbs = [
    { name: "Global", db: getGlobalDb(), url: process.env.EXPO_PUBLIC_GLOBAL_SYNC_URL || TURSO_SYNC_URL },
    { name: "Collab", db: getCollabDb(), url: process.env.EXPO_PUBLIC_COLLAB_SYNC_URL || process.env.EXPO_PUBLIC_TENANT_SYNC_URL || TURSO_SYNC_URL },
    { name: "User", db: getUserDb(), url: "" }
  ];

  for (const item of dbs) {
    try {
      await item.db.connect();
      console.log(`[DB] Connected to ${item.name} DB`);

      for (const sql of SCHEMA_STATEMENTS) {
        await item.db.exec(sql);
      }
      console.log(`[DB] Local database verified for ${item.name}`);

      if (item.url) {
        console.log(`[DB] Syncing ${item.name} DB...`);
        await item.db.push();
        await item.db.pull();
        console.log(`[DB] Sync completed for ${item.name}`);
      }
    } catch (e) {
      console.error(`[DB] Failed to initialize ${item.name} DB:`, e);
      throw e;
    }
  }
}
