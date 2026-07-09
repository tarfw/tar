/**
 * Cron jobs — scheduled tasks for maintenance and automation.
 * Runs in a multi-tenant fashion across all workspace databases.
 */

import { dbContext } from '../lib/db';
import { executeRead, executeDelete, executeUpdate, executeCreate } from '../lib/helpers';
import { getOrCreateWorkspaceDb } from '../lib/workspace-db';
import { uploadWorkspaceFile } from '../lib/okf';

interface WorkspaceRow {
  subdomain: string;
  scope: string;
  turso_url: string;
  turso_auth_token: string;
}

/**
 * Iterates through all workspaces in D1 and executes a callback within each workspace DB context.
 */
async function forEachWorkspaceDb(env: any, fn: (ws: WorkspaceRow) => Promise<void>) {
  if (!env.DB) return;
  try {
    const { results } = await env.DB.prepare(
      'SELECT subdomain, scope, turso_url, turso_auth_token FROM workspaces'
    ).all() as { results: WorkspaceRow[] };

    for (const ws of results) {
      let dbUrl = ws.turso_url;
      let dbToken = ws.turso_auth_token;

      if (!dbUrl && env.TURSO_PLATFORM_TOKEN) {
        try {
          const creds = await getOrCreateWorkspaceDb(env.DB, ws.subdomain, ws.scope, env.TURSO_PLATFORM_TOKEN);
          dbUrl = creds.url;
          dbToken = creds.authToken;
        } catch (credsErr) {
          console.error(`[cron] Failed to get/create credentials for ${ws.subdomain}:`, credsErr);
          continue;
        }
      }

      if (dbUrl) {
        await dbContext.run({ url: dbUrl, token: dbToken }, () => fn(ws));
      }
    }
  } catch (err) {
    console.error('[cron] failed to iterate workspaces:', err);
  }
}

/**
 * Expiry scanner — finds products past expiry or expiring soon.
 * Runs daily at 6 AM local time via Cloudflare Cron Trigger.
 */
export async function expiryScanner(env: any): Promise<{ scanned: number; alerts: number }> {
  let totalScanned = 0;
  let totalAlerts = 0;

  await forEachWorkspaceDb(env, async (ws) => {
    try {
      const nowStr = new Date().toISOString();
      const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const result = await executeRead({
        table: 'matter',
        type: 'product',
        scope: ws.scope,
        active: 1
      } as any);

      const products = (result.rows || []).filter((p: any) => p.end && p.end <= nextWeekStr);

      for (const product of products) {
        const isExpired = new Date(product.end) < new Date();
        const data = typeof product.data === 'string' ? JSON.parse(product.data) : product.data || {};

        // Create expiry motion
        await executeCreate({
          table: 'motion',
          stream: product.id,
          action: 99993,
          data: {
            event: 'expiry_alert',
            productId: product.id,
            title: product.title,
            qty: product.qty,
            status: isExpired ? 'expired' : 'expiring_soon',
            expiryDate: product.end,
          }
        } as any);

        totalAlerts++;
      }

      totalScanned += (result.rows || []).length;
    } catch (wsErr) {
      console.error(`[cron] expiryScanner failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { scanned: totalScanned, alerts: totalAlerts };
}

/**
 * Motion archival — aggregates closed motions and archives them to S3, then prunes from Turso.
 * Runs daily at 3 AM UTC.
 */
export async function motionArchival(env: any): Promise<{ archived: number }> {
  let totalArchived = 0;

  await forEachWorkspaceDb(env, async (ws) => {
    try {
      // 1. Fetch motion rows older than 7 days
      const result = await executeRead({
        table: 'motion',
        scope: ws.scope
      } as any);

      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const rows = (result.rows || []).filter((row: any) => {
        const timeVal = row.time ? new Date(row.time).getTime() : 0;
        return timeVal && timeVal < cutoff;
      });

      if (rows.length > 0) {
        // 2. Upload to S3 as JSON archive
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `archive/motion_${dateStr}.json`;
        const content = JSON.stringify(rows, null, 2);
        await uploadWorkspaceFile(env, ws.scope, filename, content);

        // 3. Delete from Turso
        for (const row of rows) {
          await executeDelete({
            table: 'motion',
            stream: row.stream,
            seq: row.seq,
          } as any);
        }
        totalArchived += rows.length;
      }
    } catch (wsErr) {
      console.error(`[cron] motionArchival failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { archived: totalArchived };
}

/**
 * Stock Expiration — Periodically checks pending orders and releases locked inventory for expired ones.
 */
export async function stockExpirationScanner(env: any): Promise<{ expiredCount: number }> {
  let expiredCount = 0;
  const timeoutMs = 15 * 60 * 1000; // 15 minutes
  const expiryTime = new Date(Date.now() - timeoutMs).toISOString();

  await forEachWorkspaceDb(env, async (ws) => {
    try {
      const result = await executeRead({
        table: 'matter',
        type: 'order',
        scope: ws.scope,
        active: 1
      } as any);

      const pendingOrders = (result.rows || []).filter((o: any) => {
        const dataObj = typeof o.data === 'string' ? JSON.parse(o.data) : o.data || {};
        return dataObj.status === 'pending' && dataObj.createdAt && dataObj.createdAt < expiryTime;
      });

      for (const order of pendingOrders) {
        const dataObj = typeof order.data === 'string' ? JSON.parse(order.data) : order.data || {};
        
        dataObj.status = 'expired';
        await executeUpdate({
          table: 'matter',
          id: order.id,
          scope: ws.scope,
          patch: { data: dataObj }
        });

        const items = dataObj.items || [];
        for (const item of items) {
          const productId = item.id || item.productId;
          if (productId) {
            const pRes = await executeRead({
              table: 'matter',
              id: productId,
              scope: ws.scope
            } as any);
            const product = pRes.rows?.[0];
            if (product) {
              const currentQty = product.qty || 0;
              const orderQty = item.qty || 1;
              await executeUpdate({
                table: 'matter',
                id: productId,
                scope: ws.scope,
                patch: { qty: currentQty + orderQty }
              });
            }
          }
        }

        expiredCount++;
      }
    } catch (wsErr) {
      console.error(`[cron] stockExpirationScanner failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { expiredCount };
}

/**
 * Soft-delete cleanup — purges soft-deleted rows older than 30 days.
 */
export async function softDeleteCleanup(env: any): Promise<{ cleaned: number }> {
  let cleanedCount = 0;

  await forEachWorkspaceDb(env, async (ws) => {
    try {
      const tables = ['form', 'matter'];
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      for (const table of tables) {
        const result = await executeRead({
          table,
          scope: ws.scope
        } as any);

        const softDeleted = (result.rows || []).filter((r: any) => r.active === 0 && r.updated && r.updated < cutoff);

        for (const row of softDeleted) {
          await executeDelete({
            table,
            id: row.id,
            scope: ws.scope
          });
          cleanedCount++;
        }
      }
    } catch (wsErr) {
      console.error(`[cron] softDeleteCleanup failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { cleaned: cleanedCount };
}

