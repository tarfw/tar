import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";
import * as SecureStore from "expo-secure-store";

const TURSO_SYNC_URL = process.env.EXPO_PUBLIC_TURSO_SYNC_URL || "";
const TURSO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || "";

let globalDb: Database | null = null;
let collabDb: Database | null = null;
let userDb: Database | null = null;

let customCollabUrl: string | null = null;
let customCollabToken: string | null = null;

export function setCustomCollabCredentials(url: string, token: string) {
  customCollabUrl = url;
  customCollabToken = token;
  collabDb = null; // Clear existing connection so it reinstantiates with new credentials
}

export async function isCollabSyncEnabled(): Promise<boolean> {
  try {
    const plan = await SecureStore.getItemAsync("user_pricing_plan");
    // Free plan has sync disabled. Paid and Free Community plans have sync enabled.
    // Default to Paid plan for easy local testing.
    return plan === null || plan === "Paid" || plan === "Free Community";
  } catch (e) {
    return true;
  }
}

/**
 * Global Public DB (Products catalog, store info)
 */
export function getGlobalDb(): Database {
  if (!globalDb) {
    const config: any = { path: getDbPath("global.db") };
    globalDb = new Database(config);
    // Disallow background replication sync to minimize bandwidth and storage overhead
    (globalDb as any).push = async () => {};
    (globalDb as any).pull = async () => {};
  }
  return globalDb;
}

/**
 * Collab DB (Shared business/group operations, stock, sales, shift schedules)
 */
export function getCollabDb(): Database {
  if (!collabDb) {
    const url = customCollabUrl || process.env.EXPO_PUBLIC_COLLAB_SYNC_URL || process.env.EXPO_PUBLIC_TENANT_SYNC_URL || TURSO_SYNC_URL;
    const authToken = customCollabToken || process.env.EXPO_PUBLIC_COLLAB_AUTH_TOKEN || process.env.EXPO_PUBLIC_TENANT_AUTH_TOKEN || TURSO_AUTH_TOKEN;
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
    { name: "Global", db: getGlobalDb(), url: "" },
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
        const syncEnabled = item.name !== "Collab" || await isCollabSyncEnabled();
        if (syncEnabled) {
          console.log(`[DB] Syncing ${item.name} DB...`);
          await item.db.push();
          await item.db.pull();
          console.log(`[DB] Sync completed for ${item.name}`);
        } else {
          console.log(`[DB] Sync skipped for ${item.name} (Sync disabled on Free Plan)`);
        }
      }
    } catch (e) {
      console.error(`[DB] Failed to initialize ${item.name} DB:`, e);
      throw e;
    }
  }

  // Seed mock data for Cross-DB Joins
  try {
    await seedMockDataForJoins(getUserDb(), getCollabDb());
  } catch (err) {
    console.error("[DB] Mock seeding failed:", err);
  }
}

export async function seedMockDataForJoins(userDb: Database, collabDb: Database) {
  try {
    const userMatters = await userDb.all("SELECT COUNT(*) as count FROM matter");
    if (userMatters && userMatters[0] && (userMatters[0] as any).count > 0) {
      console.log("[DB] Seeding skipped: database already populated");
      return;
    }

    console.log("[DB] Seeding mock data for Cross-DB Joins...");
    const nowStr = new Date().toISOString();

    // --- USE CASE 1: Restaurant / Delivery Routing ---
    const orderId = "ord_delivery_909";
    await collabDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [orderId, "DELIV_909", "food", "delivery", "restaurant_staff", "Spicy Paneer Biryani + Mango Lassi", JSON.stringify({ customer_phone: "+1-555-0199" })]
    );
    await collabDb.run(
      "INSERT OR REPLACE INTO motion (id, stream, seq, action, status, delta, scope, data) VALUES (?, ?, 1, 201, 'READY_FOR_PICKUP', 250.00, 'delivery', ?)",
      ["mot_deliv_header", orderId, JSON.stringify({ delivery_address: "128 Oak Avenue, Sector 4" })]
    );
    await userDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      [orderId, "DELIV_909", "Route Instructions & Gate Code", JSON.stringify({ shortcut: "Gate code is *4082. Back door drop-off requested.", contact_name: "Mrs. Sarah Jenkins" })]
    );

    // --- USE CASE 2: Retail Store Margins ---
    const productId = "prod_thermos_99";
    await collabDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [productId, "THERMOS_99", "product", "global", "store_owner", "Stainless Steel Hydro-Flask (1L)", JSON.stringify({ category: "Kitchenware" })]
    );
    await collabDb.run(
      "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active) VALUES (?, ?, 'stock', 'warehouse', 45, 899.00, 1)",
      ["mas_stock_99", productId]
    );
    await userDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      [productId, "THERMOS_99", "Supplier Contract Details", JSON.stringify({ supplier_cost: 340.00, supplier_name: "Zenith Imports Ltd." })]
    );

    // --- USE CASE 3: Field Services Dispatch Checklist ---
    const jobId = "job_plumb_88";
    await collabDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [jobId, "PLUMB_88", "task", "dispatch", "dispatch_officer", "Water Heater Pressure Release Leak", JSON.stringify({ client: "John Adams", urgency: "High" })]
    );
    await collabDb.run(
      "INSERT OR REPLACE INTO mass (id, matter, type, scope, active, start, end, data) VALUES (?, ?, 'slot', 'dispatch', 1, ?, ?, ?)",
      ["mas_job_88", jobId, nowStr, nowStr, JSON.stringify({ required_tool: "gas_leak_detector" })]
    );
    await userDb.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      ["technician_tools", "TOOLS", "note", "personal", "Personal Tool Belt Status", JSON.stringify({ tools: ["pipe_wrench", "teflon_tape", "adjustable_spanner"] })]
    );

    console.log("[DB] Seeding completed successfully!");
  } catch (e) {
    console.error("[DB] Error seeding mock data:", e);
  }
}

