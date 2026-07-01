/**
 * Database layer for tarflue (CF Worker).
 * Uses @libsql/client HTTP transport to Turso.
 * Inside Durable Objects: uses getCloudflareContext() from Flue AsyncLocalStorage.
 * On main Worker thread: uses initClient() called by Hono middleware.
 */

import { createClient, type ResultSet } from '@libsql/client';
import { SCHEMA_STATEMENTS } from './schema';

let client: ReturnType<typeof createClient> | null = null;
let storedUrl = '';
let storedToken = '';

export function initClient(url: string, token: string) {
  storedUrl = url;
  storedToken = token;
}

function toRows(rs: ResultSet) {
  return rs.rows.map(row => Object.fromEntries(rs.columns.map(col => [col, row[col]])));
}

async function getClient() {
  if (client) return client;

  let url = storedUrl;
  let token = storedToken;

  if (!url) {
    try {
      const { getCloudflareContext } = await import('@flue/runtime/cloudflare');
      const { env } = getCloudflareContext();
      url = (env as any).TURSO_DATABASE_URL || '';
      token = (env as any).TURSO_AUTH_TOKEN || '';
    } catch {}
  }

  if (!url) throw new Error('TURSO_DATABASE_URL not configured');
  client = createClient({ url, authToken: token });
  return client;
}

export async function dbGet(sql: string, args: any[] = []): Promise<any | null> {
  const rs = await (await getClient()).execute({ sql, args });
  return toRows(rs)[0] || null;
}

export async function dbAll(sql: string, args: any[] = []): Promise<any[]> {
  return toRows(await (await getClient()).execute({ sql, args }));
}

export async function dbRun(sql: string, args: any[] = []): Promise<void> {
  await (await getClient()).execute({ sql, args });
}

export async function ensureSchema(): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    try { await dbRun(sql); } catch {}
  }
}
