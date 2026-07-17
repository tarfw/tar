/**
 * Cron jobs — scheduled tasks for maintenance and automation.
 * Runs in a multi-tenant fashion across all workspace databases.
 */

import { dbContext, dbRun } from '../lib/db';
import { executeRead, executeUpdate, executeCreate } from '../lib/helpers';
import { getOrCreateWorkspaceDb } from '../lib/workspace-db';

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
      const nowUnix = Math.floor(Date.now() / 1000);
      const nextWeekUnix = nowUnix + 7 * 24 * 60 * 60;

      const result = await executeRead({
        table: 'matter',
        type: 'product',
        scope: ws.scope,
        status: 'active'
      } as any);

      for (const product of (result.rows || [])) {
        const dataObj = typeof product.data === 'string' ? JSON.parse(product.data) : product.data || {};
        const expiryStr = dataObj.end || dataObj.expiryDate;
        if (!expiryStr) continue;

        const expiryUnix = typeof expiryStr === 'number' 
          ? expiryStr 
          : Math.floor(new Date(expiryStr).getTime() / 1000);

        if (expiryUnix && expiryUnix <= nextWeekUnix) {
          const isExpired = expiryUnix < nowUnix;

          // Create expiry motion alert
          await executeCreate({
            table: 'motion',
            type: 'expiry_alert',
            ref: product.id,
            scope: ws.scope,
            data: {
              productId: product.id,
              title: product.title,
              qty: product.value || 0, // value holds product stock quantity
              status: isExpired ? 'expired' : 'expiring_soon',
              expiryDate: expiryStr,
            }
          } as any);

          totalAlerts++;
        }
      }

      totalScanned += (result.rows || []).length;
    } catch (wsErr) {
      console.error(`[cron] expiryScanner failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { scanned: totalScanned, alerts: totalAlerts };
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
        status: 'active'
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
          patch: { data: dataObj, status: 'voided' }
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
              const currentQty = product.value || 0; // value stores quantity in matter
              const orderQty = item.qty || 1;
              await executeUpdate({
                table: 'matter',
                id: productId,
                scope: ws.scope,
                patch: { value: currentQty + orderQty }
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
 * Maintenance Pruner — Purges old data as defined in dbrules.md:
 * - inbox records older than 30 days
 * - motion records older than 90 days
 * - voided matter records older than 30 days
 */
export async function maintenancePruner(env: any): Promise<{ prunedInbox: number; prunedMotion: number; prunedMatter: number }> {
  let prunedInbox = 0;
  let prunedMotion = 0;
  let prunedMatter = 0;

  const nowUnix = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = nowUnix - 30 * 24 * 60 * 60;
  const ninetyDaysAgo = nowUnix - 90 * 24 * 60 * 60;

  await forEachWorkspaceDb(env, async (ws) => {
    try {
      // Prune inbox
      const inboxRes = await dbRun('DELETE FROM inbox WHERE at < ?', [thirtyDaysAgo]);
      prunedInbox += inboxRes.rowsAffected || 0;

      // Prune motion
      const motionRes = await dbRun('DELETE FROM motion WHERE at < ?', [ninetyDaysAgo]);
      prunedMotion += motionRes.rowsAffected || 0;

      // Prune voided matter
      const matterRes = await dbRun("DELETE FROM matter WHERE status = 'voided' AND updated < ?", [thirtyDaysAgo]);
      prunedMatter += matterRes.rowsAffected || 0;
    } catch (wsErr) {
      console.error(`[cron] maintenancePruner failed for workspace ${ws.subdomain}:`, wsErr);
    }
  });

  return { prunedInbox, prunedMotion, prunedMatter };
}
