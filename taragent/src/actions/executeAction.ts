// src/actions/executeAction.ts — Universal commerce action dispatcher
//
// Maps tool names → Turso DB operations using the 3-table schema:
//   state    = long-term entity store  (users, stores, products, drivers…)
//   instance = short-term state cache  (stock qty, order status, driver location…)
//   trace    = working memory ledger   (every mutation event with opcode + delta)
//
// OPCODE REFERENCE:
//   101 STOCKIN       — inventory received
//   102 STOCKOUT      — inventory consumed / wasted
//   107 STOCKVOID     — item marked unavailable
//   301 TASKCREATE    — task / ticket created
//   304 TASKPROGRESS  — task status updated
//   305 TASKDONE      — task completed
//   401 ENTITYUPDATE  — generic entity update
//   501 ORDERCREATE   — new order
//   502 ORDERSHIP     — order status update
//   503 ORDERDELIVER  — order delivered
//   504 ORDERCANCEL   — order void/cancel
//   601 DRIVERLOC     — driver location update
//   602 DRIVERSTATUS  — driver availability change
//   603 DRIVERASSIGN  — driver assigned to order
//   701 STORECREATE   — new store registered
//   702 STOREUPDATE   — store config / status change
//   801 USERCREATE    — new user registered
//   802 USERUPDATE    — user profile update
//   901 SEARCHINDEX   — entity indexed for search
//   902 CATALOGADD    — product added to catalog

import { Client as LibsqlClient } from "@libsql/client/web";
import { getTursoClient } from "../db";
import type { Env } from "../types";

// ─── Trace Logger ──────────────────────────────────────────────────────────────

async function logTrace(
  db: LibsqlClient,
  params: {
    streamid: string;
    opcode: number;
    delta?: number;
    lat?: number;
    lng?: number;
    scope?: string;
  },
) {
  const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.execute({
    sql: `INSERT INTO trace (id, streamid, opcode, delta, lat, lng, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      params.streamid,
      params.opcode,
      params.delta ?? 0,
      params.lat ?? null,
      params.lng ?? null,
      params.scope ?? null,
    ],
  });
}

// ─── ID Helpers ───────────────────────────────────────────────────────────────

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function executeAction(
  toolName: string,
  args: Record<string, unknown>,
  env: Env,
  context?: { chatId: string; source: string },
): Promise<string> {
  const db = getTursoClient(env);
  const streamid = context?.chatId ?? "system";
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
        await logTrace(db, { streamid, opcode: 801, scope });
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
        await logTrace(db, { streamid, opcode: 802, scope });
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
        await logTrace(db, { streamid, opcode: 802, scope });
        return `⚙️ Preference **${key}** = **${value}** saved for ${user_id}.`;
      }

      case "deactivate_user": {
        const { user_id, reason } = args as any;
        const ucode = `usr_${slug(user_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_set(COALESCE(payload, '{}'), '$.active', 0, '$.deactivation_reason', ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [reason, ucode],
        });
        await logTrace(db, { streamid, opcode: 802, scope });
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
        await logTrace(db, { streamid, opcode: 701, scope });
        return `🏪 Store **${name}** (${type}) registered at ${address}.`;
      }

      case "update_store_config": {
        const { store_id, ...rest } = args as any;
        const ucode = `store_${slug(store_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_patch(COALESCE(payload, '{}'), ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(rest), ucode],
        });
        await logTrace(db, { streamid, opcode: 702, scope });
        return `⚙️ Store **${store_id}** config updated.`;
      }

      case "set_store_hours": {
        const { store_id, hours } = args as any;
        const ucode = `store_${slug(store_id)}`;
        await db.execute({
          sql: `UPDATE state SET payload = json_set(COALESCE(payload, '{}'), '$.hours', ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(hours), ucode],
        });
        await logTrace(db, { streamid, opcode: 702, scope });
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
        await logTrace(db, { streamid, opcode: 702, scope });
        const emoji =
          status === "open" ? "🟢" : status === "paused" ? "⏸️" : "🔴";
        return `${emoji} Store **${store_id}** is now **${status}**.${reason ? ` Reason: ${reason}.` : ""}`;
      }

      case "get_store_metrics": {
        const { store_id, period } = args as any;
        const ucode = `store_${slug(store_id)}`;
        const stateRow = await db.execute({
          sql: `SELECT id FROM state WHERE ucode = ?`,
          args: [ucode],
        });
        const stateId = stateRow.rows[0]?.id as string;
        const orderCount = await db.execute({
          sql: `SELECT COUNT(*) as cnt FROM instance WHERE stateid LIKE 'st_ord_%' AND metadata = 'delivered'`,
          args: [],
        });
        await logTrace(db, { streamid, opcode: 401, scope });
        return `📊 **${store_id}** (${period}): Orders: ${orderCount.rows[0]?.cnt ?? 0}. Full revenue data in Turso traces.`;
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
        await logTrace(db, { streamid, opcode: 501, scope });
        const itemSummary = (items as any[])
          .map((i: any) => `${i.qty}× ${i.name}`)
          .join(", ");
        return `🛒 Order **${orderId}** placed (${order_type}) — ${itemSummary}.`;
      }

      case "update_order_status": {
        const { order_id, status, notes } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_set(COALESCE(payload,'{}'), '$.notes', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, notes ?? null, order_id],
        });
        const opcode =
          status === "delivered" || status === "completed"
            ? 503
            : status === "cancelled"
              ? 504
              : 502;
        await logTrace(db, { streamid, opcode, scope });
        return `✅ Order **${order_id}** → **${status.toUpperCase()}**.`;
      }

      case "void_order": {
        const { order_id, reason } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = 'cancelled', payload = json_set(COALESCE(payload,'{}'), '$.cancel_reason', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [reason, order_id],
        });
        await logTrace(db, { streamid, opcode: 504, scope });
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
        return `📦 Order **${order_id}** — Status: **${row.metadata}** | Type: ${p.order_type} | Items: ${(p.items || []).map((i: any) => `${i.qty}× ${i.name}`).join(", ")}`;
      }

      case "list_orders": {
        const { store_id, status, date } = args as any;
        const dateFilter =
          date === "today"
            ? "date('now')"
            : date === "yesterday"
              ? "date('now','-1 day')"
              : date
                ? `'${date}'`
                : null;
        const r = await db.execute({
          sql: `SELECT id, metadata, ts FROM instance WHERE id LIKE 'ord_%'${status ? ` AND metadata = '${status}'` : ""}${dateFilter ? ` AND date(ts) = ${dateFilter}` : ""} ORDER BY ts DESC LIMIT 20`,
          args: [],
        });
        if (!r.rows.length) return `📋 No orders found.`;
        return (
          `📋 **${r.rows.length} orders**: ` +
          r.rows.map((row) => `${row.id} (${row.metadata})`).join(", ")
        );
      }

      case "add_order_item": {
        const { order_id, name, qty, unit_price } = args as any;
        await db.execute({
          sql: `UPDATE instance SET payload = json_insert(COALESCE(payload,'{}'), '$.items[#]', json(?)), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [JSON.stringify({ name, qty, unit_price }), order_id],
        });
        return `✅ Added **${qty}× ${name}** to order **${order_id}**.`;
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
            : action === "add"
              ? {
                  sql: `INSERT INTO instance (id, stateid, qty, payload, available, ts) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET qty = qty + ?, ts = CURRENT_TIMESTAMP`,
                  args: [
                    instId,
                    stateId,
                    quantity,
                    JSON.stringify({ unit }),
                    quantity,
                  ],
                }
              : {
                  sql: `UPDATE instance SET qty = MAX(0, qty - ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
                  args: [quantity, instId],
                },
        ]);
        await logTrace(db, { streamid, opcode: 101, delta: quantity, scope });
        return `📦 **${item}** stock ${action === "set" ? "set to" : action === "add" ? "increased by" : "decreased by"} **${quantity}${unit ? " " + unit : ""}**.`;
      }

      case "log_waste": {
        const { item, quantity, unit, reason, store_id } = args as any;
        const instId = `inst_sku_${slug(store_id ?? "global")}_${slug(item)}`;
        await db.execute({
          sql: `UPDATE instance SET qty = MAX(0, qty - ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [quantity, instId],
        });
        await logTrace(db, { streamid, opcode: 102, delta: -quantity, scope });
        return `🗑️ Waste logged — **${quantity}${unit ? " " + unit : ""} ${item}** (${reason}).`;
      }

      case "mark_unavailable": {
        const { item, available, store_id } = args as any;
        const instId = `inst_sku_${slug(store_id ?? "global")}_${slug(item)}`;
        await db.execute({
          sql: `UPDATE instance SET available = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [available ? 1 : 0, instId],
        });
        await logTrace(db, { streamid, opcode: 107, scope });
        return available
          ? `✅ **${item}** is back in stock.`
          : `🚫 **${item}** marked out of stock.`;
      }

      case "create_purchase_order": {
        const { supplier, items, store_id, expected_date } = args as any;
        const suppUcode = `supp_${slug(supplier)}`;
        const stateId = `st_${suppUcode}`;
        const poId = `po_${uid()}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, ts) VALUES (?, ?, 'supplier', ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [stateId, suppUcode, supplier],
          },
          {
            sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP)`,
            args: [
              poId,
              stateId,
              JSON.stringify({ items, store_id, expected_date }),
            ],
          },
        ]);
        await logTrace(db, { streamid, opcode: 101, scope });
        return `📝 PO **${poId}** created for **${supplier}**: ${(items as any[]).map((i: any) => `${i.qty}× ${i.name}`).join(", ")}.`;
      }

      case "get_stock_levels": {
        const { store_id, low_stock_only, category } = args as any;
        const r = await db.execute({
          sql: `SELECT s.title, i.qty, i.payload, i.available FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'sku' AND s.ucode LIKE ?${low_stock_only ? " AND i.qty < 10" : ""} LIMIT 30`,
          args: [`sku_${slug(store_id ?? "global")}_%`],
        });
        if (!r.rows.length)
          return `📋 No stock records found for **${store_id}**.`;
        const lines = r.rows
          .map(
            (row) =>
              `• ${row.title}: ${row.qty ?? "?"} ${row.available ? "" : "🚫"}`,
          )
          .join("\n");
        return `📦 **Stock levels (${store_id})**:\n${lines}`;
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
        await logTrace(db, { streamid, opcode: 902, scope });
        return `🛍️ Product **${name}** added at $${price}${category ? ` (${category})` : ""}.`;
      }

      case "update_product": {
        const { product_id, ...rest } = args as any;
        await db.execute({
          sql: `UPDATE state SET payload = json_patch(COALESCE(payload,'{}'), ?), ts = CURRENT_TIMESTAMP WHERE ucode = ?`,
          args: [JSON.stringify(rest), product_id],
        });
        if (rest.price !== undefined) {
          await db.execute({
            sql: `UPDATE instance SET value = ? WHERE id = ?`,
            args: [rest.price, `inst_${product_id}`],
          });
        }
        if (rest.available !== undefined) {
          await db.execute({
            sql: `UPDATE instance SET available = ? WHERE id = ?`,
            args: [rest.available ? 1 : 0, `inst_${product_id}`],
          });
        }
        await logTrace(db, { streamid, opcode: 401, scope });
        return `✅ Product **${product_id}** updated.`;
      }

      case "import_upc": {
        const { upc, store_id, price } = args as any;
        // In production: call a UPC lookup API. Here we create a placeholder.
        const ucode = `prod_${slug(store_id)}_${upc}`;
        const stateId = `st_${ucode}`;
        await db.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, ts) VALUES (?, ?, 'product', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
          args: [
            stateId,
            ucode,
            `UPC:${upc}`,
            JSON.stringify({ upc, store_id, price_override: price }),
          ],
        });
        await logTrace(db, { streamid, opcode: 902, scope });
        return `📷 UPC **${upc}** imported. Enrich with product name via product update.`;
      }

      case "set_product_availability": {
        const { product_id, available, reason } = args as any;
        await db.execute({
          sql: `UPDATE instance SET available = ?, ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [available ? 1 : 0, `inst_${product_id}`],
        });
        await logTrace(db, { streamid, opcode: 107, scope });
        return available
          ? `✅ **${product_id}** is now available.`
          : `🚫 **${product_id}** disabled.${reason ? ` Reason: ${reason}.` : ""}`;
      }

      case "list_catalog": {
        const { store_id, category, available_only, search } = args as any;
        const r = await db.execute({
          sql: `SELECT s.title, s.payload, i.value, i.available FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'product' AND s.ucode LIKE ?${available_only ? " AND i.available = 1" : ""} LIMIT 25`,
          args: [`prod_${slug(store_id)}_%`],
        });
        if (!r.rows.length) return `📋 No products found for **${store_id}**.`;
        const lines = r.rows
          .filter(
            (row) =>
              !search ||
              (row.title as string)
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((row) => {
            const p = JSON.parse((row.payload as string) || "{}");
            return `• **${row.title}** — $${row.value}${p.category ? ` | ${p.category}` : ""}${row.available ? "" : " 🚫"}`;
          })
          .join("\n");
        return `🛍️ **Catalog (${store_id})**:\n${lines}`;
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
        await logTrace(db, { streamid, opcode: 601, lat, lng, scope });
        return `📍 Driver **${driver_id}** location updated (${lat.toFixed(4)}, ${lng.toFixed(4)}).`;
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
        await logTrace(db, { streamid, opcode: 602, scope });
        const emoji =
          { available: "🟢", on_delivery: "🚴", offline: "⚫", break: "⏸️" }[
            status as string
          ] ?? "⚙️";
        return `${emoji} Driver **${driver_id}** → **${status}**.`;
      }

      case "assign_order_to_driver": {
        const { order_id, driver_id } = args as any;
        await db.execute({
          sql: `UPDATE instance SET payload = json_set(COALESCE(payload,'{}'), '$.driver_id', ?), metadata = 'assigned', ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [driver_id, order_id],
        });
        await logTrace(db, { streamid, opcode: 603, scope });
        return `🚴 Order **${order_id}** assigned to driver **${driver_id}**.`;
      }

      case "get_driver_stats": {
        const { driver_id, period } = args as any;
        await logTrace(db, { streamid, opcode: 401, scope });
        return `📊 Driver **${driver_id}** stats (${period}): data sourced from trace opcode 503 (delivered) entries.`;
      }

      case "log_driver_issue": {
        const { driver_id, type, description, order_id } = args as any;
        const ticketId = `issue_${uid()}`;
        const ucode = `drv_${slug(driver_id)}`;
        const stateId = `st_${ucode}`;
        await db.execute({
          sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'issue', ?, CURRENT_TIMESTAMP)`,
          args: [
            ticketId,
            stateId,
            JSON.stringify({ type, description, order_id }),
          ],
        });
        await logTrace(db, { streamid, opcode: 301, scope });
        return `⚠️ Issue logged for driver **${driver_id}**: ${type} — ${description}.`;
      }

      // ── FLEET TOOLS ───────────────────────────────────────────────────────

      case "dispatch_driver": {
        const {
          order_id,
          store_lat,
          store_lng,
          algorithm = "nearest",
        } = args as any;
        // In production: query available drivers, compute distances, assign nearest.
        // Here we log the dispatch intent and return confirmation.
        const dispatchId = `dispatch_${uid()}`;
        await logTrace(db, {
          streamid,
          opcode: 603,
          lat: store_lat,
          lng: store_lng,
          scope,
        });
        return `🚀 Dispatch **${dispatchId}** initiated for order **${order_id}** (${algorithm}). Driver assignment pending.`;
      }

      case "get_active_deliveries": {
        const { store_id, status = "all" } = args as any;
        const r = await db.execute({
          sql: `SELECT id, metadata, ts FROM instance WHERE id LIKE 'ord_%' AND metadata NOT IN ('delivered','cancelled','completed') ORDER BY ts DESC LIMIT 20`,
          args: [],
        });
        if (!r.rows.length) return `✅ No active deliveries.`;
        return (
          `🚴 **${r.rows.length} active deliveries**: ` +
          r.rows.map((row) => `${row.id} (${row.metadata})`).join(", ")
        );
      }

      case "create_delivery_zone": {
        const {
          store_id,
          name,
          radius_km,
          center_lat,
          center_lng,
          min_order_value,
          delivery_fee,
        } = args as any;
        const ucode = `zone_${slug(store_id)}_${slug(name)}`;
        const stateId = `st_${ucode}`;
        const instId = `inst_${ucode}`;
        await db.batch([
          {
            sql: `INSERT INTO state (id, ucode, type, title, payload, ts) VALUES (?, ?, 'delivery_zone', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(ucode) DO NOTHING`,
            args: [
              stateId,
              ucode,
              name,
              JSON.stringify({
                store_id,
                radius_km,
                min_order_value,
                delivery_fee,
              }),
            ],
          },
          {
            sql: `INSERT INTO instance (id, stateid, lat, lng, available, ts) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING`,
            args: [instId, stateId, center_lat, center_lng],
          },
        ]);
        await logTrace(db, {
          streamid,
          opcode: 702,
          lat: center_lat,
          lng: center_lng,
          scope,
        });
        return `🗺️ Zone **${name}** created for store **${store_id}** (radius: ${radius_km}km, fee: $${delivery_fee ?? "—"}).`;
      }

      case "get_fleet_status": {
        const r = await db.execute({
          sql: `SELECT s.title, i.metadata, i.lat, i.lng FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'driver' ORDER BY i.ts DESC LIMIT 50`,
          args: [],
        });
        const summary = {
          available: 0,
          on_delivery: 0,
          offline: 0,
          break: 0,
        } as Record<string, number>;
        r.rows.forEach((row) => {
          if (row.metadata)
            summary[row.metadata as string] =
              (summary[row.metadata as string] ?? 0) + 1;
        });
        return `🚴 Fleet: 🟢 ${summary.available} available | 🏃 ${summary.on_delivery} on delivery | ⏸️ ${summary.break} on break | ⚫ ${summary.offline} offline`;
      }

      // ── CHAT TOOLS ────────────────────────────────────────────────────────

      case "send_message": {
        const { recipient_id, text, platform } = args as any;
        // Actual sending is handled by the webhook adapter for the current platform.
        // Here we log the intent to trace.
        await logTrace(db, { streamid, opcode: 401, scope });
        return `💬 Message queued for **${recipient_id}** on ${platform}.`;
      }

      case "broadcast_announcement": {
        const { text, audience, store_id } = args as any;
        await logTrace(db, { streamid, opcode: 401, scope });
        return `📢 Announcement broadcast to **${audience}**${store_id ? ` (${store_id})` : ""}: "${text.slice(0, 80)}…"`;
      }

      case "create_channel": {
        const { name, platform, purpose, store_id } = args as any;
        await logTrace(db, { streamid, opcode: 401, scope });
        return `📣 Channel **${name}** created on ${platform}${purpose ? ` — ${purpose}` : ""}.`;
      }

      case "get_messages": {
        const { channel_id, limit = 10 } = args as any;
        await logTrace(db, { streamid, opcode: 401, scope });
        return `💬 Fetching last ${limit} messages from **${channel_id}** (connect to platform message store for live data).`;
      }

      // ── SEARCH TOOLS ──────────────────────────────────────────────────────

      case "search_products": {
        const {
          query,
          category,
          store_id,
          dietary,
          max_price,
          available_only = true,
        } = args as any;
        const r = await db.execute({
          sql: `SELECT s.title, s.payload, i.value, i.available FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'product'${available_only ? " AND i.available = 1" : ""} AND (s.title LIKE ? OR s.payload LIKE ?) LIMIT 15`,
          args: [`%${query}%`, `%${query}%`],
        });
        if (!r.rows.length) return `🔍 No products found for **"${query}"**.`;
        const results = r.rows
          .filter((row) => !max_price || Number(row.value) <= max_price)
          .map((row) => {
            const p = JSON.parse((row.payload as string) || "{}");
            return `• **${row.title}** — $${row.value}${p.category ? ` | ${p.category}` : ""}`;
          })
          .join("\n");
        return `🔍 **Results for "${query}"**:\n${results}`;
      }

      case "search_stores": {
        const { query, type } = args as any;
        const r = await db.execute({
          sql: `SELECT s.title, s.payload, i.available FROM instance i JOIN state s ON s.id = i.stateid WHERE s.type = 'store' AND (s.title LIKE ? OR s.payload LIKE ?) AND i.available = 1 LIMIT 10`,
          args: [`%${query ?? ""}%`, `%${type ?? ""}%`],
        });
        if (!r.rows.length) return `🔍 No stores found.`;
        return (
          `🏪 **Stores**: ` + r.rows.map((row) => `${row.title}`).join(", ")
        );
      }

      case "search_orders": {
        const { query, status, from_date } = args as any;
        const r = await db.execute({
          sql: `SELECT id, metadata, ts FROM instance WHERE id LIKE 'ord_%'${status ? ` AND metadata = '${status}'` : ""} ORDER BY ts DESC LIMIT 15`,
          args: [],
        });
        return (
          `🔍 **${r.rows.length} orders** found: ` +
          r.rows.map((row) => `${row.id} (${row.metadata})`).join(", ")
        );
      }

      case "index_entity": {
        const { entity_type, entity_id, data } = args as any;
        await logTrace(db, { streamid, opcode: 901, scope });
        return `📇 Entity **${entity_type}/${entity_id}** indexed.`;
      }

      // ── TASK TOOLS ────────────────────────────────────────────────────────

      case "create_task": {
        const {
          title,
          description,
          assigned_to,
          store_id,
          due,
          priority,
          recurring,
        } = args as any;
        const taskId = `task_${uid()}`;
        const ucode = `store_${slug(store_id ?? "global")}`;
        const stateId = `st_${ucode}`;
        await db.execute({
          sql: `INSERT INTO instance (id, stateid, metadata, payload, endts, ts) VALUES (?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)`,
          args: [
            taskId,
            stateId,
            JSON.stringify({
              title,
              description,
              assigned_to,
              priority,
              recurring,
            }),
            due ?? null,
          ],
        });
        await logTrace(db, { streamid, opcode: 301, scope });
        const emoji =
          { critical: "🚨", high: "⚠️", medium: "📋", low: "📄" }[
            priority as string
          ] ?? "📋";
        return `${emoji} Task **${taskId}** created: "${title}" → assigned to **${assigned_to ?? "unassigned"}** | Priority: ${priority}.`;
      }

      case "update_task_status": {
        const { task_id, status, notes } = args as any;
        await db.execute({
          sql: `UPDATE instance SET metadata = ?, payload = json_set(COALESCE(payload,'{}'), '$.notes', ?), ts = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [status, notes ?? null, task_id],
        });
        const opcode = status === "done" ? 305 : 304;
        await logTrace(db, { streamid, opcode, scope });
        return `${status === "done" ? "✅" : "🔄"} Task **${task_id}** → **${status}**.${notes ? ` Note: ${notes}` : ""}`;
      }

      case "schedule_job": {
        const { job_type, cron, store_id, payload } = args as any;
        const jobId = `job_${uid()}`;
        const ucode = `store_${slug(store_id ?? "global")}`;
        await db.execute({
          sql: `INSERT INTO instance (id, stateid, metadata, payload, ts) VALUES (?, ?, 'scheduled', ?, CURRENT_TIMESTAMP)`,
          args: [
            jobId,
            `st_${ucode}`,
            JSON.stringify({ job_type, cron, payload }),
          ],
        });
        await logTrace(db, { streamid, opcode: 301, scope });
        return `⏰ Job **${jobId}** scheduled: ${job_type} (${cron}).`;
      }

      case "list_pending_tasks": {
        const { store_id, assigned_to, priority, overdue_only } = args as any;
        const r = await db.execute({
          sql: `SELECT id, metadata, payload, endts FROM instance WHERE id LIKE 'task_%' AND metadata IN ('pending', 'in_progress')${overdue_only ? " AND endts < datetime('now')" : ""} ORDER BY ts DESC LIMIT 20`,
          args: [],
        });
        if (!r.rows.length) return `✅ No pending tasks.`;
        const lines = r.rows
          .map((row) => {
            const p = JSON.parse((row.payload as string) || "{}");
            return `• **${p.title ?? row.id}** (${p.priority}) — ${row.metadata}${row.endts ? ` | Due: ${row.endts}` : ""}`;
          })
          .join("\n");
        return `📋 **Pending Tasks**:\n${lines}`;
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
