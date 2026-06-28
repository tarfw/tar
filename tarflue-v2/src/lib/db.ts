/**
 * Database layer for tarflue (Cloudflare Worker).
 * Uses @libsql/client with HTTP transport to Turso.
 * Same database as tarai, proper client library.
 */

import { createClient, type ResultSet } from '@libsql/client';
import { SCHEMA_STATEMENTS } from './schema';

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL not set');
    client = createClient({ url, authToken: token });
  }
  return client;
}

function toRows(rs: ResultSet) {
  return rs.rows.map(row => Object.fromEntries(rs.columns.map(col => [col, row[col]])));
}

export async function dbGet(sql: string, args: any[] = []): Promise<any | null> {
  const rs = await getClient().execute({ sql, args });
  const rows = toRows(rs);
  return rows[0] || null;
}

export async function dbAll(sql: string, args: any[] = []): Promise<any[]> {
  const rs = await getClient().execute({ sql, args });
  return toRows(rs);
}

export async function dbRun(sql: string, args: any[] = []): Promise<void> {
  await getClient().execute({ sql, args });
}

export async function dbTransaction(fn: (q: (sql: string, args?: any[]) => Promise<any[]>) => Promise<void>): Promise<void> {
  const tx = await getClient().transaction('write');
  try {
    const q = async (sql: string, args: any[] = []) => {
      const rs = await tx.execute({ sql, args });
      return toRows(rs);
    };
    await fn(q);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}

export async function ensureSchema(): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    try { await dbRun(sql); } catch {}
  }
}
