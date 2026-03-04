// src/db.ts — Turso client factory, schema bootstrap, and group role helpers
// executeAction has moved to src/actions/executeAction.ts

import { Client as LibsqlClient, createClient } from "@libsql/client/web";
import type { Env, GroupRole } from "./types";

// ─── Client Factory ────────────────────────────────────────────────────────────

export function getTursoClient(env: Env): LibsqlClient {
  const url = env.TURSO_URL?.trim();
  if (!url) throw new Error("TURSO_URL env var is not defined");
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN env var is not defined");
  return createClient({ url, authToken });
}

// ─── Schema Bootstrap ─────────────────────────────────────────────────────────

/**
 * One-time schema bootstrap — run via POST /admin/bootstrap after first deploy.
 *
 * 3-table Universal Schema:
 *   state    = long-term semantic memory (users, stores, products, drivers, suppliers…)
 *   instance = short-term cache under state (stock qty, order status, driver location…)
 *   trace    = working memory / operational ledger (every mutation with opcode + delta)
 */
export async function bootstrapSchema(env: Env): Promise<void> {
  const db = getTursoClient(env);
  const queries = [
    // RBAC group → role mapping
    `CREATE TABLE IF NOT EXISTS group_roles (
      chat_group_id TEXT PRIMARY KEY,
      group_role TEXT NOT NULL DEFAULT 'default',
      platform TEXT NOT NULL
    )`,

    // Long-term entity store
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

    // Short-term state cache (under state)
    `CREATE TABLE IF NOT EXISTS instance (
      id TEXT PRIMARY KEY,
      stateid TEXT NOT NULL,
      scope TEXT,
      metadata TEXT,
      qty REAL,
      value REAL,
      currency TEXT,
      available INTEGER DEFAULT 1,
      lat REAL,
      lng REAL,
      h3 TEXT,
      startts TEXT,
      endts TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      payload TEXT,
      FOREIGN KEY (stateid) REFERENCES state(id)
    )`,

    // Operational ledger / working memory
    `CREATE TABLE IF NOT EXISTS trace (
      id TEXT PRIMARY KEY,
      streamid TEXT NOT NULL,
      opcode INTEGER NOT NULL,
      delta REAL,
      lat REAL,
      lng REAL,
      scope TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Useful indexes
    `CREATE INDEX IF NOT EXISTS idx_state_type ON state(type)`,
    `CREATE INDEX IF NOT EXISTS idx_instance_stateid ON instance(stateid)`,
    `CREATE INDEX IF NOT EXISTS idx_trace_streamid ON trace(streamid)`,
    `CREATE INDEX IF NOT EXISTS idx_trace_opcode ON trace(opcode)`,
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      await db.execute(queries[i]);
      console.log(`[DB] Schema query ${i} OK`);
    } catch (e) {
      console.error(`[DB] Schema query ${i} failed:`, e);
      throw e;
    }
  }
}

// ─── Group Role Helpers ───────────────────────────────────────────────────────

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
    return {};
  }
}
