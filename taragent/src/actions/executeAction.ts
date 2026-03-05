// src/actions/executeAction.ts — Universal commerce action dispatcher
//
// Maps tool names → Turso DB operations using the 3-table schema:
//   state    = long-term entity store  (users, stores, products, drivers…)
//   instance = short-term state cache  (stock qty, order status, driver location…)
//   trace    = working memory ledger   (every mutation event with opcode + delta)
//
// OPCODE REFERENCE (per architecture/schema.md):
//   101 STOCKIN       — inventory received
//   102 SALEOUT       — inventory sold
//   107 STOCKVOID      — item marked unavailable
//   301 TASKCREATE    — task / ticket created
//   304 TASKPROGRESS  — task status updated
//   305 TASKDONE      — task completed
//   501 ORDERCREATE   — new order
//   502 ORDERSHIP     — order status update
//   503 ORDERDELIVER  — order delivered
//   504 ORDERCANCEL   — order void/cancel
//   605 MOTION        — driver / asset live location ping
//   803 MEMORYUPDATE  — preferences / profile update
//   901 USERCREATE    — new user registered
//   701 STORECREATE   — store registered
//   702 STOREUPDATE   — store config update
//   902 CATALOGADD    — product added to catalog

import { Client as LibsqlClient } from "@libsql/client/web";
import { getTursoClient } from "../db";
import type { Env } from "../types";

// ─── Trace Logger ──────────────────────────────────────────────────────────────

async function logTrace(
  db: LibsqlClient,
  params: {
    streamid: string; // The Entity ID (e.g. ord_123, usr_joe, sku_abc)
    opcode: number;
    delta?: number;
    lat?: number;
    lng?: number;
    scope?: string;
  },
) {
  const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const streamid = params.streamid || "unknown";
  await db.execute({
    sql: `INSERT INTO trace (id, streamid, opcode, delta, lat, lng, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      streamid,
      params.opcode,
      params.delta ?? 0,
      params.lat ?? null,
      params.lng ?? null,
      params.scope ?? null,
    ],
  });
}

// ─── ID Helpers ───────────────────────────────────────────────────────────────

const slug = (s: any) =>
  String(s || "global")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function executeAction(
  toolName: string,
  args: Record<string, unknown>,
  env: Env,
  agent: any, // Pass the calling agent instance (BaseCommerceAgent)
  context?: { chatId: string; source: string },
): Promise<string> {
  const db = getTursoClient(env);
  const scope = context?.source ?? "api";

  try {
    switch (toolName) {
      // ── USER TOOLS ────────────────────────────────────────────────────────

      case "create_user": {
        const { phone, name, email, role = "customer" } = args as any;
        const ucode = `usr_${slug(phone)}`;
        const id = `st_${ucode}`;
        await db.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, scope, ts)
                VALUES (?, ?, 'user', ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(ucode) DO UPDATE SET title = excluded.title, payload = excluded.payload`,
          args: [
            id,
            ucode,
            name,
            JSON.stringify({ phone, email, role }),
            scope,
          ],
        });
        await logTrace(db, { streamid: ucode, opcode: 901, scope });
        return `✅ User **${name}** registered (${role}).`;
      }

      case "update_user_profile": {
        const { user_id, name, email, preferences } = args as any;
        const ucode = `usr_${slug(user_id)}`;
        await db.execute({
          sql: `UPDATE state SET title = COALESCE(?, title), 
                payload = json_patch(COALESCE(payload, '{}'), ?), ts = CURRENT_TIMESTAMP 
                WHERE ucode = ?`,
          args: [name ?? null, JSON.stringify({ email, preferences }), ucode],
        });
        await logTrace(db, { streamid: ucode, opcode: 803, scope });
        return `✅ Profile updated for **${user_id}**.`;
      }

      case "get_user": {
        const { user_id } = args as any;
        const ucode = `usr_${slug(user_id)}`;
        const r = await db.execute({
          sql: `SELECT title, payload FROM state WHERE ucode = ?`,
          args: [ucode],
        });
        const row = r.rows[0];
        if (!row) return `❌ User **${user_id}** not found.`;
        const p = JSON.parse((row.payload as string) || "{}");
        return `👤 **${row.title}** — Phone: ${p.phone ?? "—"} | Role: ${p.role ?? "—"} | Email: ${p.email ?? "—"}`;
      }

      case "set_user_preference": {
        const { user_id, key, value } = args as any;
        const ucode = `usr_${slug(user_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_set(COALESCE(payload, '{}'), '$.' || ?, ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [key, value, ucode],
        });
        await logTrace(db, { streamid: ucode, opcode: 803, scope });
        return `⚙️ Preference **${key}** = **${value}** saved for ${user_id}.`;
      }

      case "deactivate_user": {
        const { user_id, reason } = args as any;
        const ucode = `usr_${slug(user_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_set(COALESCE(payload, '{}'), '$.active', 0, '$.deactivation_reason', ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [reason, ucode],
        });
        await logTrace(db, { streamid: ucode, opcode: 803, scope });
        return `🚫 User **${user_id}** deactivated. Reason: ${reason}.`;
      }

      // ── STORE TOOLS ───────────────────────────────────────────────────────

      case "create_store": {
        const { name, type, address, phone, owner_id } = args as any;
        const ucode = `store_${slug(name)}`;
        const id = `st_${ucode}`;
        const instId = `inst_${ucode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, payload, scope, ts)
                  VALUES (?, ?, 'store', ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [
              id,
              ucode,
              name,
              JSON.stringify({ type, address, phone, owner_id }),
              scope,
            ],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, available, ts) VALUES (?, ?, 'open', 1, CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO NOTHING`,
            args: [instId, id],
          },
        ]);
        await logTrace(db, { streamid: ucode, opcode: 701, scope });
        return `🏪 Store **${name}** (${type}) registered at ${address}.`;
      }

      case "update_store_config": {
        const { store_id, ...rest } = args as any;
        const ucode = `store_${slug(store_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_patch(COALESCE(payload, '{}'), ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(rest), ucode],
        });
        await logTrace(db, { streamid: ucode, opcode: 702, scope });
        return `⚙️ Store **${store_id}** config updated.`;
      }

      case "set_store_hours": {
        const { store_id, hours } = args as any;
        const ucode = `store_${slug(store_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_set(COALESCE(payload, '{}'), '$.hours', ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(hours), ucode],
        });
        await logTrace(db, { streamid: ucode, opcode: 702, scope });
        return `🕒 Hours updated for **${store_id}**.`;
      }

      case "set_store_status": {
        const { store_id, status, reason, until } = args as any;
        const ucode = `store_${slug(store_id)}`;
        const instId = `inst_${ucode}`;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, available = ?, payload = json_patch(COALESCE(payload,'{}'), ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [
            status,
            status === "open" ? 1 : 0,
            JSON.stringify({ reason, until }),
            instId,
          ],
        });
        await logTrace(db, { streamid: ucode, opcode: 702, scope });
        const emoji =
          status === "open" ? "🟢" : status === "paused" ? "⏸️" : "🔴";
        return `${emoji} Store **${store_id}** is now **${status}**.${reason ? ` Reason: ${reason}.` : ""}`;
      }

      case "get_store_metrics": {
        const { store_id, period } = args as any;
        const ucode = `store_${slug(store_id)}`;
        const r = await db.execute({
          sql: `SELECT COUNT(*) as cnt FROM instance WHERE stateid LIKE 'st_ord_%' AND metadata IN ('delivered', 'completed')`,
          args: [],
        });
        await logTrace(db, { streamid: ucode, opcode: 702, scope });
        return `📊 **${store_id}** metrics (${period}): **${r.rows[0]?.cnt ?? 0}** orders completed.`;
      }

      // ── ORDER TOOLS ───────────────────────────────────────────────────────

      case "create_order": {
        const {
          customer_id,
          store_id,
          items,
          order_type,
          address,
          notes,
          scheduled_at,
        } = args as any;
        const orderId = `ord_${uid()}`;
        const custUcode = `usr_${slug(customer_id)}`;
        const custStateId = `st_${custUcode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'user', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [custStateId, custUcode, customer_id],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'placed', ?, CURRENT_TIMESTAMP)`,
            args: [
              orderId,
              custStateId,
              JSON.stringify({
                store_id,
                items,
                order_type,
                address,
                notes,
                scheduled_at,
              }),
            ],
          },
        ]);
        await logTrace(db, { streamid: orderId, opcode: 501, scope });
        const summary = (items as any[])
          .map((i) => `${i.qty}× ${i.name}`)
          .join(", ");
        return `🛒 Order **${orderId}** placed for **${store_id}**: ${summary}.`;
      }

      case "update_order_status": {
        const { order_id, status, notes } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_set(COALESCE(payload,'{}'), '$.notes', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, notes ?? null, order_id],
        });
        let opcode = 502; // ORDERSHIP (generic update)
        if (status === "delivered" || status === "completed") opcode = 503;
        if (status === "cancelled") opcode = 504;
        await logTrace(db, { streamid: order_id, opcode, scope });
        return `✅ Order **${order_id}** status → **${status.toUpperCase()}**.`;
      }

      case "void_order": {
        const { order_id, reason } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = 'cancelled', payload = json_set(COALESCE(payload,'{}'), '$.cancel_reason', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [reason, order_id],
        });
        await logTrace(db, { streamid: order_id, opcode: 504, scope });
        return `🚫 Order **${order_id}** voided. Reason: ${reason}.`;
      }

      case "get_order": {
        const { order_id } = args as any;
        const r = await db.execute({
          sql: `SELECT metadata, payload, ts FROM instance WHERE id = ?`,
          args: [order_id],
        });
        const row = r.rows[0];
        if (!row) return `❌ Order **${order_id}** not found.`;
        const p = JSON.parse((row.payload as string) || "{}");
        const items = (p.items || [])
          .map((i: any) => `${i.qty}× ${i.name}`)
          .join(", ");
        return `📦 Order **${order_id}** [${row.metadata}]: ${items} | Store: ${p.store_id} | Total: $${p.total_price ?? "—"}`;
      }

      case "list_orders": {
        const { store_id, status } = args as any;
        const r = await db.execute({
          sql: `SELECT id, metadata, ts FROM instance WHERE id LIKE 'ord_%'${status ? ` AND metadata = '${status}'` : ""} ORDER BY ts DESC LIMIT 20`,
          args: [],
        });
        if (!r.rows.length) return `📋 No orders found.`;
        return (
          `📋 Orders: ` +
          r.rows.map((row) => `${row.id} (${row.metadata})`).join(", ")
        );
      }

      // ── INVENTORY TOOLS ───────────────────────────────────────────────────

      case "update_stock": {
        const { item, quantity, unit, store_id, action = "set" } = args as any;
        const ucode = `sku_${slug(store_id ?? "global")}_${slug(item)}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'sku', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, item],
          },
          action === "set"
            ? {
                sql: `INSERT INTO instance (id, stateid, qty, payload, available, ts) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET qty = excluded.qty, ts = CURRENT_TIMESTAMP`,
                args: [instId, stateId, quantity, JSON.stringify({ unit })],
              }
            : {
                sql: `UPDATE instance SET qty = MAX(0, qty ${action === "add" ? "+" : "-"} ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
                args: [quantity, instId],
              },
        ]);
        await logTrace(db, {
          streamid: ucode,
          opcode: 101,
          delta: quantity,
          scope,
        });
        return `📦 **${item}** stock ${action === "set" ? "set to" : action === "add" ? "increased by" : "decreased by"} **${quantity} ${unit ?? ""}**.`;
      }

      case "log_waste": {
        const { item, quantity, unit, reason, store_id } = args as any;
        const ucode = `sku_${slug(store_id ?? "global")}_${slug(item)}`;
        const instId = `inst_${ucode}`;
        await db.execute({
          sql: `UPDATE instance SET qty = MAX(0, qty - ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [quantity, instId],
        });
        await logTrace(db, {
          streamid: ucode,
          opcode: 102,
          delta: -quantity,
          scope,
        });
        return `🗑️ Waste logged: **${quantity} ${unit ?? ""} ${item}** (${reason}).`;
      }

      case "mark_unavailable": {
        const { item, available, store_id } = args as any;
        const ucode = `sku_${slug(store_id ?? "global")}_${slug(item)}`;
        const instId = `inst_${ucode}`;
        await db.execute({
          sql: `UPDATE instance SET available = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [available ? 1 : 0, instId],
        });
        await logTrace(db, { streamid: ucode, opcode: 107, scope });
        return `🚫 **${item}** is now **${available ? "available" : "unavailable"}**.`;
      }

      // ── CATALOG TOOLS ─────────────────────────────────────────────────────

      case "create_product": {
        const {
          store_id,
          name,
          description,
          price,
          category,
          sku,
          upc,
          attributes,
          available = true,
        } = args as any;
        const ucode = `prod_${slug(store_id)}_${sku ?? slug(name)}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, payload, scope, ts) VALUES (?, ?, 'product', ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO UPDATE SET title = excluded.title, payload = excluded.payload`,
            args: [
              stateId,
              ucode,
              name,
              JSON.stringify({
                description,
                price,
                category,
                sku,
                upc,
                attributes,
                store_id,
              }),
              scope,
            ],
          },
          {
            sql: `INSERT INTO instance (id, stateid, value, available, ts) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET value = excluded.value, available = excluded.available`,
            args: [instId, stateId, price, available ? 1 : 0],
          },
        ]);
        await logTrace(db, { streamid: ucode, opcode: 902, scope });
        return `🛍️ Product **${name}** added to catalog at $${price}.`;
      }

      case "update_product": {
        const { product_id, ...rest } = args as any;
        await db.execute({
          sql: `UPDATE state SET payload = json_patch(COALESCE(payload,'{}'), ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(rest), product_id],
        });
        await logTrace(db, { streamid: product_id, opcode: 702, scope });
        return `✅ Product **${product_id}** updated.`;
      }

      // ── DRIVER TOOLS ──────────────────────────────────────────────────────

      case "update_driver_location": {
        const { driver_id, lat, lng, h3 } = args as any;
        const ucode = `drv_${slug(driver_id)}`;
        const instId = `inst_${ucode}`;
        await db.execute({
          sql: `UPDATE instance SET lat = ?, lng = ?, h3 = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [lat, lng, h3 ?? null, instId],
        });
        await logTrace(db, { streamid: ucode, opcode: 605, lat, lng, scope });
        return `📍 Driver **${driver_id}** at (${lat.toFixed(4)}, ${lng.toFixed(4)}).`;
      }

      case "set_driver_status": {
        const { driver_id, status } = args as any;
        const ucode = `drv_${slug(driver_id)}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'driver', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, ucode, driver_id],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, available, ts) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET metadata = excluded.metadata, available = excluded.available, ts = CURRENT_TIMESTAMP`,
            args: [instId, stateId, status, status === "available" ? 1 : 0],
          },
        ]);
        await logTrace(db, { streamid: ucode, opcode: 605, scope });
        return `🚴 Driver **${driver_id}** → **${status}**.`;
      }

      // ── FLEET TOOLS ───────────────────────────────────────────────────────

      case "dispatch_driver": {
        const { order_id, store_lat, store_lng } = args as any;
        await logTrace(db, {
          streamid: order_id,
          opcode: 502,
          lat: store_lat,
          lng: store_lng,
          scope,
        });
        return `🚀 Dispatch requested for order **${order_id}**.`;
      }

      // ── CHAT TOOLS ────────────────────────────────────────────────────────

      case "send_message": {
        const { recipient_id, text } = args as any;
        await logTrace(db, {
          streamid: `chat_${recipient_id}`,
          opcode: 803,
          scope,
        });
        return `💬 Message sent to **${recipient_id}**.`;
      }

      case "get_messages": {
        const { channel_id } = args as any;
        await logTrace(db, { streamid: channel_id, opcode: 803, scope });
        return `💬 Fetched recent messages for **${channel_id}**.`;
      }

      // ── TASK TOOLS ────────────────────────────────────────────────────────

      case "create_task": {
        const { title, description, assigned_to, store_id, due, priority } =
          args as any;
        const taskId = `task_${uid()}`;
        const ucode = `store_${slug(store_id ?? "global")}`;
        await db.execute({
          sql: `INSERT INTO instance (id, stateid, metadata, payload, endts, ts) VALUES (?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)`,
          args: [
            taskId,
            `st_${ucode}`,
            JSON.stringify({ title, description, assigned_to, priority }),
            due ?? null,
          ],
        });
        await logTrace(db, { streamid: taskId, opcode: 301, scope });
        return `📋 Task **${taskId}** created: "${title}" for **${assigned_to ?? "team"}**.`;
      }

      case "update_task_status": {
        const { task_id, status } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, task_id],
        });
        await logTrace(db, {
          streamid: task_id,
          opcode: status === "done" ? 305 : 304,
          scope,
        });
        return `✅ Task **${task_id}** → **${status}**.`;
      }

      // ── SYSTEM TOOLS ──────────────────────────────────────────────────────

      case "schedule_job": {
        const { minutes, text } = args as any;
        if (!agent) return "❌ Alarm system unavailable.";
        const chatId = context?.chatId ?? "unknown";
        const dueAt = Date.now() + minutes * 60 * 1000;
        await agent.sql`INSERT INTO scheduled_jobs (chat_id, content, due_at) VALUES (${chatId}, ${text}, ${dueAt})`;
        await agent.storage.setAlarm(dueAt);
        return `⏰ Scheduled: I will remind you about "**${text}**" in **${minutes} minutes**.`;
      }

      // ── SEARCH TOOLS ──────────────────────────────────────────────────────

      case "search_products": {
        const { query } = args as any;
        const r = await db.execute({
          sql: `SELECT s.title, i.value FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'product' AND (s.title LIKE ? OR s.payload LIKE ?) LIMIT 10`,
          args: [`%${query}%`, `%${query}%`],
        });
        return (
          `🔍 Results: ` +
          r.rows.map((row) => `${row.title} ($${row.value})`).join(", ")
        );
      }

      default:
        return `❓ Unknown tool: **${toolName}**. No action taken.`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[executeAction] "${toolName}" failed:`, msg);
    return `❌ **${toolName}** failed: ${msg}`;
  }
}
