import { Database, getDbPath } from "@tursodatabase/sync-react-native";
import { SCHEMA_STATEMENTS } from "./schema";

let userDb: Database | null = null;

export function setCustomCollabCredentials(url: string, token: string) {
  // No-op in local-only mode
}

export async function isCollabSyncEnabled(): Promise<boolean> {
  return false;
}

export function getUserDb(): Database {
  if (!userDb) {
    const config: any = { path: getDbPath("user.db") };
    userDb = new Database(config);
    // User DB is strictly local-only and must never sync to the cloud
    (userDb as any).push = async () => {};
    (userDb as any).pull = async () => {};
  }
  return userDb;
}

export const getGlobalDb = getUserDb;
export const getCollabDb = getUserDb;
export const getTenantDb = getUserDb;
export const getDbClient = getUserDb;

export function routeDbForEntity(type: string | null, scope: string | null): Database {
  return getUserDb();
}

export async function initDb() {
  const db = getUserDb();
  try {
    await db.connect();
    for (const sql of SCHEMA_STATEMENTS) {
      await db.exec(sql);
    }
    console.log(`[DB:Local:User] Connected & Verified`);
  } catch (e) {
    console.error(`[DB:Local:User] Initialization failed:`, e);
    throw e;
  }

  // Seed mock data
  try {
    await seedMockData(db);
  } catch (err) {
    console.error("[DB:Local] Mock seeding failed:", err);
  }
}

export async function seedMockData(db: Database) {
  try {
    const userMatters = await db.all("SELECT COUNT(*) as count FROM matter");
    if (userMatters && userMatters[0] && (userMatters[0] as any).count > 0) {
      console.log("[DB:Local] Seeding skipped (already populated)");
      return;
    }

    console.log("[DB:Local] Seeding mock data...");
    const nowStr = new Date().toISOString();

    // --- USE CASE 1: Restaurant / Delivery Routing ---
    const orderId = "ord_delivery_909";
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [orderId, "DELIV_909", "food", "delivery", "restaurant_staff", "Spicy Paneer Biryani + Mango Lassi", JSON.stringify({ customer_phone: "+1-555-0199" })]
    );
    await db.run(
      "INSERT OR REPLACE INTO motion (id, stream, seq, action, status, delta, scope, data) VALUES (?, ?, 1, 201, 'READY_FOR_PICKUP', 250.00, 'delivery', ?)",
      ["mot_deliv_header", orderId, JSON.stringify({ delivery_address: "128 Oak Avenue, Sector 4" })]
    );
    // Use unique ID/code for personal note to avoid primary key conflicts
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      [orderId + "_note", "DELIV_909_NOTE", "Route Instructions & Gate Code", JSON.stringify({ shortcut: "Gate code is *4082. Back door drop-off requested.", contact_name: "Mrs. Sarah Jenkins" })]
    );

    // --- USE CASE 2: Retail Store Margins ---
    const productId = "prod_thermos_99";
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [productId, "THERMOS_99", "product", "global", "store_owner", "Stainless Steel Hydro-Flask (1L)", JSON.stringify({ category: "Kitchenware" })]
    );
    await db.run(
      "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active) VALUES (?, ?, 'stock', 'warehouse', 45, 899.00, 1)",
      ["mas_stock_99", productId]
    );
    // Use unique ID/code for personal supplier details to avoid primary key conflicts
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      [productId + "_note", "THERMOS_99_NOTE", "Supplier Contract Details", JSON.stringify({ supplier_cost: 340.00, supplier_name: "Zenith Imports Ltd." })]
    );

    // --- USE CASE 3: Field Services Dispatch Checklist ---
    const jobId = "job_plumb_88";
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [jobId, "PLUMB_88", "task", "dispatch", "dispatch_officer", "Water Heater Pressure Release Leak", JSON.stringify({ client: "John Adams", urgency: "High" })]
    );
    await db.run(
      "INSERT OR REPLACE INTO mass (id, matter, type, scope, active, start, end, data) VALUES (?, ?, 'slot', 'dispatch', 1, ?, ?, ?)",
      ["mas_job_88", jobId, nowStr, nowStr, JSON.stringify({ required_tool: "gas_leak_detector" })]
    );
    await db.run(
      "INSERT OR REPLACE INTO matter (id, code, type, scope, title, data) VALUES (?, ?, 'note', 'personal', ?, ?)",
      ["technician_tools", "TOOLS", "note", "personal", "Personal Tool Belt Status", JSON.stringify({ tools: ["pipe_wrench", "teflon_tape", "adjustable_spanner"] })]
    );

    console.log("[DB] Seeding completed successfully!");
  } catch (e) {
    console.error("[DB] Error seeding mock data:", e);
  }
}

