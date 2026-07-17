// Entry point for Cloudflare Worker deployment
import app from './app';
import { expiryScanner, stockExpirationScanner, maintenancePruner } from './cron';

export default {
  fetch: app.fetch,

  // Cron trigger handler
  async scheduled(event: any, env: any) {
    const cron = event.cron;
    console.log(`[cron] Running: ${cron}`);

    if (cron === '* * * * *') {
      // Every minute — expire pending orders older than 15 min
      const result = await stockExpirationScanner(env);
      console.log(`[cron] stockExpirationScanner: ${result.expiredCount} expired`);
    } else if (cron === '0 6 * * *') {
      // Daily 6 AM — scan for expiring products
      const result = await expiryScanner(env);
      console.log(`[cron] expiryScanner: ${result.scanned} scanned, ${result.alerts} alerts`);
    } else if (cron === '0 3 * * *') {
      // Daily 3 AM — prune inbox, motion and voided matter
      const result = await maintenancePruner(env);
      console.log(`[cron] maintenancePruner: inbox pruned=${result.prunedInbox}, motion pruned=${result.prunedMotion}, matter pruned=${result.prunedMatter}`);
    }
  },
};
