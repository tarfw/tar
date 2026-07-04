/**
 * Local-first POS — offline queue for sales when device is offline.
 * Queued sales are pushed to DO on reconnect with validation.
 */

import { getUserDb } from './db';

export interface OfflineSale {
  id: string;
  type: 'sale' | 'stock_adjust' | 'refund';
  data: {
    items: Array<{ productId: string; name: string; qty: number; price: number }>;
    total: number;
    paymentMethod: string;
  };
  created_at: string;
  status: 'pending' | 'sent' | 'accepted' | 'rejected';
  error?: string;
  retry_count: number;
}

/**
 * Initialize the offline_queue table in local SQLite
 */
export async function initOfflineQueue(): Promise<void> {
  const db = getUserDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error TEXT,
      retry_count INTEGER DEFAULT 0
    )
  `);
}

/**
 * Add a sale to the offline queue
 */
export async function queueOfflineSale(sale: {
  items: Array<{ productId: string; name: string; qty: number; price: number }>;
  paymentMethod: string;
}): Promise<string> {
  const db = getUserDb();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const total = sale.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  await db.run(
    'INSERT INTO offline_queue (id, type, data, created_at, status, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
    [id, 'sale', JSON.stringify({ items: sale.items, total, paymentMethod: sale.paymentMethod }), new Date().toISOString(), 'pending', 0]
  );

  return id;
}

/**
 * Get all pending offline sales
 */
export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = getUserDb();
  const rows = await db.all(
    "SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return (rows || []).map((r: any) => ({
    ...r,
    data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
  }));
}

/**
 * Mark a sale as sent
 */
export async function markSaleSent(id: string): Promise<void> {
  const db = getUserDb();
  await db.run(
    "UPDATE offline_queue SET status = 'sent' WHERE id = ?",
    [id]
  );
}

/**
 * Mark a sale as accepted
 */
export async function markSaleAccepted(id: string): Promise<void> {
  const db = getUserDb();
  await db.run(
    "UPDATE offline_queue SET status = 'accepted' WHERE id = ?",
    [id]
  );
}

/**
 * Mark a sale as rejected with error message
 */
export async function markSaleRejected(id: string, error: string): Promise<void> {
  const db = getUserDb();
  await db.run(
    "UPDATE offline_queue SET status = 'rejected', error = ? WHERE id = ?",
    [error, id]
  );
}

/**
 * Get effective stock for a product (last known minus offline sales)
 */
export async function getEffectiveStock(productId: string, lastKnownQty: number): Promise<number> {
  const db = getUserDb();
  const rows = await db.all(
    "SELECT data FROM offline_queue WHERE status = 'pending'"
  );

  let offlineSold = 0;
  for (const row of rows || []) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const item = data.items?.find((i: any) => i.productId === productId);
    if (item) offlineSold += item.qty;
  }

  return lastKnownQty - offlineSold;
}

/**
 * Reconnect handler — push pending sales to DO one by one
 */
export async function syncPendingSales(
  sendToServer: (sale: OfflineSale) => Promise<{ accepted: boolean; error?: string }>
): Promise<{ accepted: number; rejected: number }> {
  const pending = await getPendingSales();
  let accepted = 0;
  let rejected = 0;

  for (const sale of pending) {
    try {
      await markSaleSent(sale.id);
      const result = await sendToServer(sale);
      if (result.accepted) {
        await markSaleAccepted(sale.id);
        accepted++;
      } else {
        await markSaleRejected(sale.id, result.error || 'Rejected by server');
        rejected++;
      }
    } catch (e: any) {
      await markSaleRejected(sale.id, e.message);
      rejected++;
    }
  }

  return { accepted, rejected };
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  pending: number;
  accepted: number;
  rejected: number;
}> {
  const db = getUserDb();
  const pending = await db.all(
    "SELECT COUNT(*) as count FROM offline_queue WHERE status = 'pending'"
  );
  const accepted = await db.all(
    "SELECT COUNT(*) as count FROM offline_queue WHERE status = 'accepted'"
  );
  const rejected = await db.all(
    "SELECT COUNT(*) as count FROM offline_queue WHERE status = 'rejected'"
  );
  return {
    pending: (pending as any)?.[0]?.count || 0,
    accepted: (accepted as any)?.[0]?.count || 0,
    rejected: (rejected as any)?.[0]?.count || 0,
  };
}
