// Entry point for Cloudflare Worker deployment
import app from './app';
import { expiryScanner, stockExpirationScanner } from './cron';

export default {
  fetch: app.fetch,

  // Cron trigger handler — runs expired checkout scan every minute
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
    }
  },
};
