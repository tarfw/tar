import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";

const TURSO_SYNC_URL = process.env.EXPO_PUBLIC_TURSO_SYNC_URL || "";
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "";

let globalDb: Database | null = null;
let tenantDb: Database | null = null;
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
  }
  return globalDb;
}

/**
 * Tenant DB (Shared business operations, stock, sales, shift schedules)
 */
export function getTenantDb(): Database {
  if (!tenantDb) {
    const url = process.env.EXPO_PUBLIC_TENANT_SYNC_URL || TURSO_SYNC_URL;
    const authToken = process.env.EXPO_PUBLIC_TENANT_AUTH_TOKEN || TURSO_AUTH_TOKEN;
    const config: any = { path: getDbPath("tenant.db") };
    if (url) {
      config.url = url;
      config.authToken = authToken;
    }
    tenantDb = new Database(config);
  }
  return tenantDb;
}

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
  }
  return userDb;
}

/**
 * Default DB client for backward compatibility
 */
export function getDbClient(): Database {
  return getTenantDb();
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

  // Default to Tenant DB for business activities (stock, sales, shift schedules, retail, delivery, dine-in)
  return getTenantDb();
}

/**
 * Initialize all three databases with the 5-table schema
 */
export async function initDb() {
  const dbs = [
    { name: "Global", db: getGlobalDb(), url: process.env.EXPO_PUBLIC_GLOBAL_SYNC_URL || TURSO_SYNC_URL },
    { name: "Tenant", db: getTenantDb(), url: process.env.EXPO_PUBLIC_TENANT_SYNC_URL || TURSO_SYNC_URL },
    { name: "User", db: getUserDb(), url: process.env.EXPO_PUBLIC_USER_SYNC_URL || "" }
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
