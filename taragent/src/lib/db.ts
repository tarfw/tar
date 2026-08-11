/**
 * Database layer for taragent (CF Worker).
 * Uses @libsql/client HTTP transport to Turso.
 * Supports concurrent requests to different workspace DBs via AsyncLocalStorage context.
 */

import { createClient, type ResultSet } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { SCHEMA_STATEMENTS } from './schema';

export const dbContext = new AsyncLocalStorage<{ url: string; token: string }>();
export const envContext = new AsyncLocalStorage<any>();

const clientCache = new Map<string, ReturnType<typeof createClient>>();
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
  const store = dbContext.getStore();
  let url = store?.url || storedUrl;
  let token = store?.token || storedToken;

  if (!url) {
    try {
      const { getCloudflareContext } = await import('@flue/runtime/cloudflare');
      const { env } = getCloudflareContext();
      url = (env as any).TURSO_DATABASE_URL || '';
      token = (env as any).TURSO_AUTH_TOKEN || '';
    } catch {}
  }

  if (!url) throw new Error('TURSO_DATABASE_URL not configured');

  let cachedClient = clientCache.get(url);
  if (!cachedClient) {
    cachedClient = createClient({ url, authToken: token });
    clientCache.set(url, cachedClient);
  }
  return cachedClient;
}

export async function dbGet(sql: string, args: any[] = []): Promise<any | null> {
  const rs = await (await getClient()).execute({ sql, args });
  return toRows(rs)[0] || null;
}

export async function dbAll(sql: string, args: any[] = []): Promise<any[]> {
  return toRows(await (await getClient()).execute({ sql, args }));
}

export async function dbRun(sql: string, args: any[] = []): Promise<{ rowsAffected: number }> {
  const res = await (await getClient()).execute({ sql, args });
  return { rowsAffected: res.rowsAffected };
}

export async function ensureSchema(): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    try { await dbRun(sql); } catch {}
  }
}

/**
 * Returns a custom client for executing queries against a specific workspace URL and token.
 */
export function getWorkspaceClient(env: any, url: string, token: string) {
  let cachedClient = clientCache.get(url);
  if (!cachedClient) {
    cachedClient = createClient({ url, authToken: token });
    clientCache.set(url, cachedClient);
  }
  return cachedClient;
}

/**
 * Executes a SQL query against the per-workspace Turso DB found in D1's workspaces table.
 */
export async function executeWorkspaceTursoQuery(
  d1: D1Database,
  env: any,
  scope: string,
  sql: string,
  args: any[] = []
): Promise<any> {
  try {
    const subdomain = scope.replace(/^[tw]:/, '');
    
    // Look up workspace Turso DB credentials from D1
    const ws = await d1
      .prepare('SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ? OR scope = ? OR scope = ?')
      .bind(subdomain, scope, `w:${subdomain}`)
      .first<{ turso_url?: string; turso_auth_token?: string }>();

    let url = ws?.turso_url || env?.TURSO_DATABASE_URL;
    let token = ws?.turso_auth_token || env?.TURSO_GROUP_TOKEN || env?.TURSO_AUTH_TOKEN;

    if (!url || !token) {
      console.warn(`[turso] No Turso DB credentials found for scope ${scope}`);
      return null;
    }

    const client = getWorkspaceClient(env, url, token);
    const result = await client.execute({ sql, args });
    console.log(`[turso] Successfully executed query on workspace Turso DB (${url})`);
    return result;
  } catch (err) {
    console.error(`[turso] Error executing query on workspace Turso DB for scope ${scope}:`, err);
    return null;
  }
}

