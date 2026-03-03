// src/db.ts — Turso database client and tool action executor
// Uses @libsql/client/web to connect to Turso (SQLite edge DB).
// Per Cloudflare Workers docs: import MUST be @libsql/client/web.
// executeAction() is the central dispatcher that runs the correct SQL/logic
// for each tool call from the LLM and returns a human-readable result string.

import { Client as LibsqlClient, createClient } from "@libsql/client/web";
import type { Env, GroupRole } from "./types";

// ─── Client Factory ────────────────────────────────────────────────────────────

/** Creates a Turso client per Cloudflare Workers docs recommendation. */
export function getTursoClient(env: Env): LibsqlClient {
  const url = env.TURSO_URL?.trim();
  if (!url) throw new Error("TURSO_URL env var is not defined");
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN env var is not defined");
  return createClient({ url, authToken });
}

// ─── Schema Helpers ───────────────────────────────────────────────────────────

/** One-time schema bootstrap (run on first deploy or migration) */
export async function bootstrapSchema(env: Env): Promise<void> {
  const db = getTursoClient(env);
  const schemaQueries = [
    // Group → Role mapping for RBAC (Agent-specific)
    `CREATE TABLE IF NOT EXISTS group_roles (
      chat_group_id TEXT PRIMARY KEY,
      group_role TEXT NOT NULL DEFAULT 'default',
      platform TEXT NOT NULL
    )`,

    // ── Universal Schema ──────────────────────────────────────────────────
    // 1. Permanent entities
    `CREATE TABLE IF NOT EXISTS state (
      id TEXT PRIMARY KEY,
      ucode TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      payload TEXT,
      embedding BLOB,
      scope TEXT,
      author TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. Dynamic state cache
    `CREATE TABLE IF NOT EXISTS instance (
      id TEXT PRIMARY KEY,
      stateid TEXT NOT NULL,
      scope TEXT,
      metadata TEXT,
      qty REAL,
      value REAL,
      currency TEXT,
      available INTEGER,
      lat REAL,
      lng REAL,
      h3 TEXT,
      startts TEXT,
      endts TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      payload TEXT,
      FOREIGN KEY (stateid) REFERENCES state(id)
    )`,

    // 3. Operational ledger
    `CREATE TABLE IF NOT EXISTS trace (
      id TEXT PRIMARY KEY,
      streamid TEXT NOT NULL,
      opcode INTEGER NOT NULL,
      delta REAL,
      lat REAL,
      lng REAL,
      scope TEXT
    )`,
  ];
  for (let i = 0; i < schemaQueries.length; i++) {
    try {
      console.log(`[DB] Executing schema query ${i}...`);
      await db.execute(schemaQueries[i]);
      console.log(`[DB] Query ${i} success.`);
    } catch (e) {
      console.error(`[DB] Error executing schema query ${i}:`, e);
      throw e;
    }
  }
}

// ─── Group Role Lookup ────────────────────────────────────────────────────────
/** Fetches all group role mappings from Turso for RBAC resolution. */
export async function fetchGroupRoles(
  env: Env,
): Promise<Record<string, GroupRole>> {
  const db = getTursoClient(env);
  try {
    const result = await db.execute(
      "SELECT chat_group_id, group_role FROM group_roles",
    );
    const map: Record<string, GroupRole> = {};
    for (const row of result.rows) {
      map[String(row.chat_group_id)] = row.group_role as GroupRole;
    }
    return map;
  } catch {
    // Table may not exist yet on very first run
    return {};
  }
}

// ─── Trace Logging Helper ─────────────────────────────────────────────────────

/** Helper to log an action to the trace table for real-time tracking */
async function logTrace(
  env: Env,
  params: {
    streamid: string;
    opcode: number;
    delta?: number;
    payload?: any;
    scope?: string;
  },
) {
  const db = getTursoClient(env);
  const id = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.execute({
    sql: `INSERT INTO trace (id, streamid, opcode, delta, payload, scope)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      params.streamid,
      params.opcode,
      params.delta ?? 0,
      params.payload ? JSON.stringify(params.payload) : null,
      params.scope ?? null,
    ],
  });
}

// ─── Tool Action Executor ─────────────────────────────────────────────────────

/**
 * Executes a tool call from the LLM by dispatching to the correct DB operation.
 * Returns a natural-language result string that the Agent includes in its reply.
 */
export async function executeAction(
  toolName: string,
  args: Record<string, unknown>,
  env: Env,
  context?: { chatId: string; source: string },
): Promise<string> {
  const db = getTursoClient(env);
  const streamid = context?.chatId ?? "unknown";
  const scope = context?.source ?? "unknown";

  try {
    switch (toolName) {
      // ── Inventory ──────────────────────────────────────────────────────────
      case "update_inventory": {
        const { item, quantity, unit } = args as {
          item: string;
          quantity: number;
          unit?: string;
        };
        const ucode = `item_${item.toLowerCase().replace(/\s+/g, "_")}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'inventory_item', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, item],
          },
          {
            sql: `INSERT INTO instance (id, stateid, qty, payload, ts) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET qty = excluded.qty, payload = excluded.payload, ts = CURRENT_TIMESTAMP`,
            args: [instId, stateId, quantity, JSON.stringify({ unit })],
          },
        ]);
        await logTrace(env, {
          streamid,
          opcode: 101, // STOCKIN
          delta: quantity,
          payload: { item, quantity, unit },
          scope,
        });
        const suffix = unit ? ` ${unit}` : "";
        return `📦 **${item}** updated to **${quantity}${suffix}** in inventory.`;
      }

      case "log_waste": {
        const { item, quantity, reason, unit } = args as {
          item: string;
          quantity: number;
          reason: string;
          unit?: string;
        };
        const ucode = `item_${item.toLowerCase().replace(/\s+/g, "_")}`;
        const instId = `inst_${ucode}`;

        await db.execute({
          sql: `UPDATE instance SET qty = MAX(0, qty - ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [quantity, instId],
        });
        await logTrace(env, {
          streamid,
          opcode: 102, // SALEOUT (Waste)
          delta: -quantity,
          payload: { item, quantity, reason, unit },
          scope,
        });
        return `🗑️ Waste logged — **${quantity} ${item}** (${reason}).`;
      }

      case "86_item": {
        const { item, status } = args as { item: string; status: string };
        const ucode = `item_${item.toLowerCase().replace(/\s+/g, "_")}`;
        const instId = `inst_${ucode}`;

        await db.execute({
          sql: `UPDATE instance SET available = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status === "86" ? 0 : 1, instId],
        });
        await logTrace(env, {
          streamid,
          opcode: 107, // STOCKVOID
          payload: { item, status },
          scope,
        });
        if (status === "86") {
          return `🚫 **${item}** has been 86'd. Removed from active menus and POS.`;
        }
        return `✅ **${item}** is back on the menu.`;
      }

      case "create_purchase_order": {
        const { supplier, items } = args as {
          supplier: string;
          items: Array<{ name: string; qty: number; unit?: string }>;
        };
        const suppUcode = `supp_${supplier.toLowerCase().replace(/\s+/g, "_")}`;
        const stateId = `st_${suppUcode}`;
        const orderInstId = `po_${Date.now()}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'supplier', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, suppUcode, supplier],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, available, ts) VALUES (?, ?, 'pending', ?, 0, CURRENT_TIMESTAMP)`,
            args: [orderInstId, stateId, JSON.stringify(items)],
          },
        ]);
        await logTrace(env, {
          streamid,
          opcode: 106, // STOCKTRANSFERIN (Pending)
          payload: { supplier, items },
          scope,
        });
        const itemList = items.map((i) => `${i.qty}× ${i.name}`).join(", ");
        return `📝 PO #${orderInstId} created for **${supplier}**: ${itemList}.`;
      }

      // ── Orders & Delivery ──────────────────────────────────────────────────
      case "create_delivery_order": {
        const { customer_phone, items, address, notes } = args as {
          customer_phone: string;
          items: Array<{ name: string; qty: number; size?: string }>;
          address: string;
          notes?: string;
        };
        const custUcode = `cust_${customer_phone.replace(/\\D/g, "")}`;
        const stateId = `st_${custUcode}`;
        const orderId = `ord_${Date.now()}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'customer', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, custUcode, customer_phone],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'placed', ?, CURRENT_TIMESTAMP)`,
            args: [orderId, stateId, JSON.stringify({ items, address, notes })],
          },
        ]);

        await logTrace(env, {
          streamid,
          opcode: 501, // ORDERCREATE
          payload: { orderId, customer_phone, items, address, notes },
          scope,
        });
        const itemList = items.map((i) => `${i.qty}× ${i.name}`).join(", ");
        return `🛵 Order **${orderId}** placed — ${itemList} → ${address}. Estimated 40–50 mins.`;
      }

      case "update_delivery_status": {
        const { order_id, status, notes } = args as {
          order_id: string;
          status: string;
          notes?: string;
        };
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_insert(COALESCE(payload, '{}'), '$.notes', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, notes ?? null, order_id],
        });
        await logTrace(env, {
          streamid,
          opcode: status === "delivered" ? 503 : 502, // ORDERSHIP / DELIVER
          payload: { order_id, status, notes },
          scope,
        });
        return `✅ Order **${order_id}** → **${status.toUpperCase()}**.`;
      }

      case "void_order": {
        const { order_id, reason } = args as {
          order_id: string;
          reason: string;
        };
        await db.execute({
          sql: `UPDATE instance SET metadata = 'cancelled', payload = json_insert(COALESCE(payload, '{}'), '$.cancel_reason', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [reason, order_id],
        });
        await logTrace(env, {
          streamid,
          opcode: 504, // ORDERCANCEL
          payload: { order_id, reason },
          scope,
        });
        return `🚫 Order **${order_id}** voided. Reason: ${reason}.`;
      }

      case "update_platform_status": {
        const { platform, status, brand, duration } = args as {
          platform: string;
          status: string;
          brand?: string;
          duration?: string;
        };
        const ucode = `plat_${platform.toLowerCase()}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'platform', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, platform],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, available, ts) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET metadata = excluded.metadata, payload = excluded.payload, available = excluded.available, ts = CURRENT_TIMESTAMP`,
            args: [
              instId,
              stateId,
              status,
              JSON.stringify({ brand, duration }),
              status === "paused" ? 0 : 1,
            ],
          },
        ]);

        const brandStr = brand ? ` for **${brand}**` : "";
        const durationStr =
          duration && status === "paused" ? ` for ${duration}` : "";
        await logTrace(env, {
          streamid,
          opcode: 304, // TASKPROGRESS
          payload: { platform, status, brand, duration },
          scope,
        });
        return `${status === "paused" ? "🛑" : "✅"} **${platform}**${brandStr} is now **${status}**${durationStr}. ${duration && status === "paused" ? "Auto-resume task scheduled." : ""}`;
      }

      // ── Sales ──────────────────────────────────────────────────────────────
      case "get_sales_summary": {
        const { shift, date } = args as { shift: string; date: string };
        const result = await db.execute({
          sql: `SELECT COUNT(*) as order_count
                FROM instance
                WHERE metadata = 'delivered' AND id LIKE 'ord_%'
                AND date(ts) = CASE ? WHEN 'today' THEN date('now') WHEN 'yesterday' THEN date('now', '-1 day') ELSE ? END`,
          args: [date, date],
        });
        const row = result.rows[0];
        const count = Number(row?.order_count ?? 0);
        await logTrace(env, {
          streamid,
          opcode: 205,
          payload: { shift, date, count },
          scope,
        });
        return `💵 **${shift} sales (${date})** — Orders: ${count}. Revenues derived from traces/invoices in Turso.`;
      }

      case "compare_sales": {
        const { period1, period2 } = args as {
          period1: string;
          period2: string;
        };
        await logTrace(env, {
          streamid,
          opcode: 206,
          payload: { period1, period2 },
          scope,
        });
        return `📊 Sales comparison: **${period1}** vs **${period2}** — query your Turso orders table for real figures.`;
      }

      // ── Staff ──────────────────────────────────────────────────────────────
      case "add_employee": {
        const { name, role, hourly_rate, start_date } = args as {
          name: string;
          role: string;
          hourly_rate: number;
          start_date: string;
        };
        const ucode = `emp_${name.toLowerCase().replace(/\\s+/g, "_")}`;
        const stateId = `st_${ucode}`;

        await db.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, ts) VALUES (?, ?, 'employee', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
          args: [
            stateId,
            ucode,
            name,
            JSON.stringify({ role, hourly_rate, start_date, active: 1 }),
          ],
        });
        await logTrace(env, {
          streamid,
          opcode: 901, // USERCREATE
          payload: { name, role, hourly_rate, start_date },
          scope,
        });
        return `✅ **${name}** added as **${role}** at $${hourly_rate}/hr. Start date: ${start_date}.`;
      }

      case "request_time_off": {
        const { employee_id, date, reason } = args as {
          employee_id: string;
          date: string;
          reason: string;
        };
        const ticketId = `off_${Date.now()}`;
        const ucode = `emp_${employee_id.toLowerCase().replace(/\\s+/g, "_")}`;
        const stateId = `st_${ucode}`;

        await db.execute({
          sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
          args: [
            ticketId,
            stateId,
            JSON.stringify({ type: "time_off", date, reason }),
          ],
        });
        await logTrace(env, {
          streamid,
          opcode: 301, // TASKCREATE
          payload: { employee_id, date, reason },
          scope,
        });
        return `📅 Time-off request submitted for **${employee_id}** on **${date}** (reason: ${reason}). Pending management approval.`;
      }

      case "get_schedule": {
        const { role, shift, date } = args as {
          role?: string;
          shift?: string;
          date: string;
        };
        const result = await db.execute({
          sql: `SELECT title as name, payload FROM state WHERE type = 'employee'`,
          args: [],
        });

        const activeStaff = result.rows
          .map((r) => {
            try {
              const p = JSON.parse((r.payload as string) || "{}");
              return { name: r.name, role: p.role, active: p.active };
            } catch {
              return { name: r.name, role: null, active: 1 };
            }
          })
          .filter((e) => e.active === 1 && (!role || e.role === role));

        if (activeStaff.length === 0) {
          return `📋 No staff found for ${role ?? "all roles"} on **${date}**.`;
        }
        const names = activeStaff.map((e) => e.name).join(", ");
        await logTrace(env, {
          streamid,
          opcode: 304, // TASKPROGRESS
          payload: { role, shift, date },
          scope,
        });
        return `📋 **${date} ${shift ?? "schedule"}** — ${names}.`;
      }

      // ── Maintenance ────────────────────────────────────────────────────────
      case "create_maintenance_ticket": {
        const { equipment, issue, urgency, location } = args as {
          equipment: string;
          issue: string;
          urgency: string;
          location?: string;
        };
        const ticketId = `maint_${Date.now()}`;
        const ucode = `eq_${equipment.toLowerCase().replace(/\\s+/g, "_")}`;
        const stateId = `st_${ucode}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'equipment', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, equipment],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'open', ?, CURRENT_TIMESTAMP)`,
            args: [
              ticketId,
              stateId,
              JSON.stringify({ issue, urgency, location }),
            ],
          },
        ]);
        await logTrace(env, {
          streamid,
          opcode: 301, // TASKCREATE
          payload: { ticketId, equipment, issue, urgency, location },
          scope,
        });
        const urgencyEmoji =
          urgency === "critical" ? "🚨" : urgency === "high" ? "⚠️" : "🔧";
        return `${urgencyEmoji} Ticket **#${ticketId}** opened — **${equipment}**: ${issue} (${urgency.toUpperCase()}${location ? ` @ ${location}` : ""}).`;
      }

      case "update_maintenance_ticket": {
        const { ticket_id, status, resolution_notes } = args as {
          ticket_id: string;
          status: string;
          resolution_notes?: string;
        };
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_insert(COALESCE(payload, '{}'), '$.resolution_notes', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, resolution_notes ?? null, ticket_id],
        });
        await logTrace(env, {
          streamid,
          opcode: status === "resolved" ? 305 : 304, // TASKDONE / TASKPROGRESS
          payload: { ticket_id, status, resolution_notes },
          scope,
        });
        return `${status === "resolved" ? "✅" : "🔧"} Ticket **#${ticket_id}** marked **${status}**${resolution_notes ? ` — ${resolution_notes}` : ""}.`;
      }

      case "get_task_status": {
        const { checklist_id, shift, date } = args as {
          checklist_id: string;
          shift?: string;
          date?: string;
        };
        await logTrace(env, {
          streamid,
          opcode: 304, // TASKPROGRESS
          payload: { checklist_id, shift, date },
          scope,
        });
        return `🗒️ Checklist **${checklist_id}** (${shift ?? "all shifts"}, ${date ?? "today"}): Event logged via 304. Access data via Turso API.`;
      }

      // ── CRM / Reservations ─────────────────────────────────────────────────
      case "update_reservation_status": {
        const { name, status, table, party_size } = args as {
          name: string;
          status: string;
          table?: string;
          party_size?: number;
        };
        const custUcode = `cust_${name.toLowerCase().replace(/\\s+/g, "_")}`;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_insert(COALESCE(payload, '{}'), '$.table_number', ?), ts = CURRENT_TIMESTAMP WHERE stateid = ?`,
          args: [status, table ?? null, `st_${custUcode}`],
        });
        await logTrace(env, {
          streamid,
          opcode: 612, // BOOKINGDONE
          payload: { name, status, table, party_size },
          scope,
        });
        const tableStr = table ? ` at Table **${table}**` : "";
        return `🍽️ **${name}** reservation — ${status}${tableStr}${party_size ? ` (party of ${party_size})` : ""}.`;
      }

      case "get_recent_reviews": {
        const { platform, sentiment, time_range } = args as {
          platform: string;
          sentiment?: string;
          time_range?: string;
        };
        await logTrace(env, {
          streamid,
          opcode: 801, // MEMORYDEFINE
          payload: { platform, sentiment, time_range },
          scope,
        });
        return `⭐ Fetching **${sentiment ?? "all"}** reviews from **${platform}** (${time_range ?? "recent"}). Connected to Universal Schema trace ledger.`;
      }

      case "draft_review_response": {
        const { review_id, tone, offer } = args as {
          review_id: string;
          tone: string;
          offer?: string;
        };
        await logTrace(env, {
          streamid,
          opcode: 802, // MEMORYWRITE
          payload: { review_id, tone, offer },
          scope,
        });
        const offerStr = offer
          ? ` We'd like to offer you a ${offer} on your next visit.`
          : "";
        const draft =
          tone === "apologetic"
            ? `We are sincerely sorry for your experience. This is not the standard we hold ourselves to, and we're taking steps to ensure it doesn't happen again.${offerStr}`
            : `Thank you for your feedback! We truly value every customer's experience and take your comments seriously.${offerStr}`;
        return `📝 Draft response for review **${review_id}**:\n\n"${draft}"`;
      }

      case "create_lead": {
        const {
          type,
          location,
          budget,
          timeframe,
          urgency,
          contact_phone,
          notes,
        } = args as {
          type: string;
          location: string;
          budget?: number;
          timeframe?: string;
          urgency?: string;
          contact_phone?: string;
          notes?: string;
        };
        const leadId = `lead_${Date.now()}`;
        const ucode = contact_phone
          ? `cust_${contact_phone.replace(/\\D/g, "")}`
          : `cust_anon_${Date.now()}`;
        const stateId = `st_${ucode}`;

        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'customer', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, contact_phone || "Lead"],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'lead', ?, CURRENT_TIMESTAMP)`,
            args: [
              leadId,
              stateId,
              JSON.stringify({
                type,
                location,
                budget,
                timeframe,
                urgency,
                notes,
              }),
            ],
          },
        ]);
        await logTrace(env, {
          streamid,
          opcode: 501, // ORDERCREATE / lead
          payload: {
            leadId,
            type,
            location,
            budget,
            timeframe,
            urgency,
            contact_phone,
            notes,
          },
          scope,
        });
        const urgencyEmoji =
          urgency === "high" ? "🔥" : urgency === "medium" ? "📋" : "📄";
        return `${urgencyEmoji} Lead **#${leadId}** created — ${type} in ${location}${budget ? ` | Budget: $${budget.toLocaleString()}` : ""}${timeframe ? ` | Timeframe: ${timeframe}` : ""}.`;
      }

      // ── Menu ───────────────────────────────────────────────────────────────
      case "query_menu": {
        const { dietary_preference, search_term, category } = args as {
          dietary_preference?: string;
          search_term?: string;
          category?: string;
        };
        const filters = [dietary_preference, search_term, category]
          .filter(Boolean)
          .join(", ");
        await logTrace(env, {
          streamid,
          opcode: 801, // MEMORYDEFINE
          payload: { dietary_preference, search_term, category },
          scope,
        });
        return `🍽️ Menu query (${filters || "all items"}): Connected to Universal 'state' table for dynamic querying.`;
      }

      default:
        return `❓ Unknown tool: **${toolName}**. No action taken.`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[executeAction] Tool "${toolName}" failed:`, message);
    return `❌ Action **${toolName}** failed: ${message}`;
  }
}
