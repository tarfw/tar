/**
 * Cron jobs — scheduled tasks for maintenance and automation.
 */

import { dbAll, dbRun } from '../lib/db';

/**
 * Expiry scanner — finds products past expiry or expiring soon.
 * Runs daily at 6 AM local time via Cloudflare Cron Trigger.
 */
export async function expiryScanner(): Promise<{ scanned: number; alerts: number }> {
  const products = await dbAll(
    `SELECT id, title, qty, end, data FROM matter
     WHERE type = 'product'
       AND active = 1
       AND end IS NOT NULL
       AND end <= datetime('now', '+7 days')
     ORDER BY end ASC`
  );

  let alerts = 0;
  const now = new Date().toISOString();

  for (const product of products) {
    const isExpired = new Date(product.end) < new Date();
    const data = typeof product.data === 'string' ? JSON.parse(product.data) : product.data || {};

    // Create expiry motion
    const nextSeqRes = await dbAll(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
      [product.id]
    );
    const seq = Number(nextSeqRes[0]?.next ?? 1);

    await dbRun(
      `INSERT INTO motion (stream, seq, action, data, time) VALUES (?, ?, 99993, ?, ?)`,
      [
        product.id,
        seq,
        JSON.stringify({
          event: 'expiry_alert',
          productId: product.id,
          title: product.title,
          qty: product.qty,
          status: isExpired ? 'expired' : 'expiring_soon',
          expiryDate: product.end,
        }),
        now,
      ]
    );
    alerts++;
  }

  return { scanned: products.length, alerts };
}

/**
 * Motion archival — moves rows older than 7 days to motion_archive table.
 * Runs daily at 3 AM UTC.
 */
export async function motionArchival(): Promise<{ archived: number }> {
  // Ensure archive table exists
  await dbRun(
    `CREATE TABLE IF NOT EXISTS motion_archive (
      stream TEXT NOT NULL,
      seq INTEGER NOT NULL,
      action INTEGER NOT NULL,
      phase INTEGER,
      delta REAL,
      client_ref TEXT,
      data TEXT,
      time TEXT,
      PRIMARY KEY (stream, seq)
    )`
  );

  // Move old rows
  await dbRun(
    `INSERT OR IGNORE INTO motion_archive SELECT * FROM motion WHERE time < datetime('now', '-7 days')`
  );

  const result = await dbRun(
    `DELETE FROM motion WHERE time < datetime('now', '-7 days')`
  );

  return { archived: 0 }; // Would return actual count in production
}

/**
 * Soft-delete cleanup — purges soft-deleted rows older than 30 days.
 */
export async function softDeleteCleanup(): Promise<{ cleaned: number }> {
  const tables = ['form', 'matter'];

  for (const table of tables) {
    await dbRun(
      `DELETE FROM ${table} WHERE active = 0 AND updated < datetime('now', '-30 days')`
    );
  }

  return { cleaned: 0 };
}
