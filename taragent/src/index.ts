// Entry point for Cloudflare Worker deployment
import app from './app';
import { Editor } from './cloudflare';

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any, ctx: any) {
    console.log(`[cron] scheduled trigger fired: ${event.cron}`);
    ctx.waitUntil((async () => {
      try {
        if (event.cron === '*/15 * * * *') {
          const { stockExpirationScanner } = await import('./cron');
          const res = await stockExpirationScanner(env);
          console.log(`[cron] stockExpirationScanner completed:`, res);
        } else {
          const { expiryScanner, motionArchival, softDeleteCleanup } = await import('./cron');
          const [exp, arch, del] = await Promise.all([
            expiryScanner(env),
            motionArchival(env),
            softDeleteCleanup(env)
          ]);
          console.log(`[cron] Daily scanner completed:`, { expiry: exp, archival: arch, cleanup: del });
        }
      } catch (err) {
        console.error(`[cron] failed:`, err);
      }
    })());
  }
};

export { Editor };
