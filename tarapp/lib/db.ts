import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";

// Configuration from environment variables
const TURSO_SYNC_URL = process.env.EXPO_PUBLIC_TURSO_SYNC_URL || "";
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "";

let dbInstance: Database | null = null;

/**
 * Get or initialize the Turso Database instance
 */
export function getDbClient(): Database {
  if (!dbInstance) {
    const dbPath = getDbPath("tar.db");
    
    // Create database with sync capabilities if URL is provided
    dbInstance = new Database({
      path: dbPath,
      url: TURSO_SYNC_URL,
      authToken: TURSO_AUTH_TOKEN,
    });
  }
  return dbInstance;
}

/**
 * Initialize the local database with the 5-table schema
 * and perform the first sync.
 */
export async function initDb() {
  const db = getDbClient();

  try {
    // 1. Connect (bootstraps from remote if empty)
    await db.connect();
    console.log("[DB] Connected to database");

    // 2. Execute schema initialization
    for (const sql of SCHEMA_STATEMENTS) {
      try {
        await db.exec(sql);
      } catch (e) {
        console.error("[DB] Failed statement:", sql);
        throw e;
      }
    }
    console.log("[DB] Local database created/verified");

    // 3. Perform background sync if remote URL is provided
    if (TURSO_SYNC_URL) {
      console.log("[DB] Starting initial sync...");
      await db.push(); // Push local changes to remote
      await db.pull(); // Pull remote changes to local
      console.log("[DB] Sync completed");
    }
  } catch (error) {
    console.error("[DB] Initialization error:", error);
    throw error;
  }
}
