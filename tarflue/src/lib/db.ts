/**
 * Database layer for tarflue (Cloudflare Worker).
 * Uses Turso HTTP API instead of libsql client.
 * Same database as tarai, just different connection method.
 */

import { SCHEMA_STATEMENTS } from './schema';

const TURSO_URL = process.env.TURSO_URL || '';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

interface TursoResult {
  results: Array<{
    cols: Array<{ name: string; decltype?: string }>;
    rows: Array<Array<any>>;
    response: { type: string };
  }>;
}

/**
 * Execute SQL via Turso HTTP Pipeline API.
 */
async function tursoExec(sql: string, args: any[] = []): Promise<any[]> {
  if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
    console.warn('[DB] Turso not configured, skipping query');
    return [];
  }

  const httpsUrl = TURSO_URL.replace('libsql://', 'https://');

  const res = await fetch(`${httpsUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map(v => ({ type: 'text', value: String(v ?? '') })),
          },
        },
        { type: 'close' },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Turso error: ${err}`);
  }

  const data = await res.json() as TursoResult;
  const result = data.results?.[0];

  if (!result || result.response.type !== 'ok') {
    return [];
  }

  // Convert rows to objects
  return result.rows.map(row => {
    const obj: Record<string, any> = {};
    result.cols.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

/**
 * Execute SQL and return first row.
 */
export async function dbGet(sql: string, args: any[] = []): Promise<any | null> {
  const rows = await tursoExec(sql, args);
  return rows[0] || null;
}

/**
 * Execute SQL and return all rows.
 */
export async function dbAll(sql: string, args: any[] = []): Promise<any[]> {
  return tursoExec(sql, args);
}

/**
 * Execute SQL (INSERT/UPDATE/DELETE).
 */
export async function dbRun(sql: string, args: any[] = []): Promise<void> {
  await tursoExec(sql, args);
}

/**
 * Execute multiple SQL statements in a transaction.
 */
export async function dbTransaction(statements: Array<{ sql: string; args?: any[] }>): Promise<void> {
  if (!TURSO_URL || !TURSO_AUTH_TOKEN) return;

  const httpsUrl = TURSO_URL.replace('libsql://', 'https://');

  const requests = [
    { type: 'execute', stmt: { sql: 'BEGIN', args: [] } },
    ...statements.map(s => ({
      type: 'execute',
      stmt: {
        sql: s.sql,
        args: (s.args || []).map(v => ({ type: 'text', value: String(v ?? '') })),
      },
    })),
    { type: 'execute', stmt: { sql: 'COMMIT', args: [] } },
    { type: 'close' },
  ];

  const res = await fetch(`${httpsUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    // Rollback on error
    await fetch(`${httpsUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql: 'ROLLBACK', args: [] } },
          { type: 'close' },
        ],
      }),
    }).catch(() => {});
    throw new Error(`Turso transaction failed`);
  }
}

/**
 * Initialize schema if needed.
 */
export async function ensureSchema(): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    try {
      await dbRun(sql);
    } catch (e) {
      // Ignore errors (column already exists, etc.)
    }
  }
}
