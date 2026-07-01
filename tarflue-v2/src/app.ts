import { Hono } from 'hono';
import { flue } from '@flue/runtime/routing';
import { renderStorefront } from './storefront/renderer';
import { editorShell } from './storefront/editor';
import { initClient } from './lib/db';

function getDO(env: any, slug: string) {
  return env.EDITOR.get(env.EDITOR.idFromName(slug));
}

function storePendingPage(slug: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center"><h1 class="text-4xl font-bold text-gray-900 mb-4">${slug}</h1><p class="text-gray-500 mb-4">This store is being set up.</p></div></body></html>`;
}

const app = new Hono();

app.use('*', async (c, next) => {
  const url = c.env.TURSO_DATABASE_URL;
  const token = c.env.TURSO_AUTH_TOKEN;
  if (url) initClient(url, token);
  await next();
});

// Mount Flue routes FIRST (agents, workflows, channels)
app.route('/', flue());

// Storefront domain-based routes (only for *.tarai.space)
app.notFound(async (c) => {
  const url = new URL(c.req.url);
  const host = url.hostname;
  const storeMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
  if (!storeMatch) return c.text('Not found', 404);
  const storeSlug = storeMatch[1];

  // GET routes
  if (c.req.method === 'GET') {
    if (url.pathname === '/edit/ws') {
      if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket', 426);
      return getDO(c.env, storeSlug).fetch('https://do/ws', c.req.raw);
    }
    if (url.pathname === '/edit') return c.html(editorShell(storeSlug));
    if (url.pathname === '/sitemap.xml') {
      return c.text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${storeSlug}.tarai.space/</loc></url></urlset>`, 200, { 'Content-Type': 'application/xml' });
    }

    const cached = await c.env.STOREFRONT_CACHE.get(`html:${storeSlug}`);
    if (cached) return c.html(cached);

    const layoutJson = await c.env.STOREFRONT_CACHE.get(`layout:${storeSlug}`, 'json');
    if (!layoutJson) return c.html(storePendingPage(storeSlug));

    const html = await renderStorefront(layoutJson, storeSlug);
    if (c.env.STOREFRONT_CACHE) {
      c.env.STOREFRONT_CACHE.put(`html:${storeSlug}`, html, { expirationTtl: 300 });
    }
    return c.html(html);
  }

  // POST routes
  if (c.req.method === 'POST') {
    if (url.pathname === '/draft') {
      const body = await c.req.json();
      if (!body?.subdomain || !body?.layout) return c.text('Missing subdomain or layout', 400);
      const html = await renderStorefront(body.layout, body.subdomain);
      await getDO(c.env, body.subdomain).fetch('https://do/push', { method: 'POST', body: html });
      return c.json({ ok: true });
    }
    if (url.pathname === '/publish') {
      const body = await c.req.json();
      if (!body?.subdomain || !body?.layout) return c.text('Missing subdomain or layout', 400);
      await c.env.STOREFRONT_CACHE.put(`layout:${body.subdomain}`, JSON.stringify(body.layout));
      await c.env.STOREFRONT_CACHE.delete(`html:${body.subdomain}`);
      return c.json({ ok: true });
    }
    if (url.pathname === '/api/checkout') {
      const body = await c.req.json();
      if (!body?.items) return c.text('Missing items', 400);
      const orderId = c.env.ORDER_DO.newUniqueId();
      const orderDO = c.env.ORDER_DO.get(orderId);
      return orderDO.fetch('https://do/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeSlug, items: body.items, email: body.email }) });
    }
    if (url.pathname === '/api/chat') {
      const body = await c.req.json();
      if (!body?.message) return c.text('Missing message', 400);
      const query = body.message.trim().toLowerCase();
      const l1Dict: Record<string, string> = { 'hi': 'Hello!', 'hello': 'Hi there!', 'hours': 'Open 24/7!' };
      if (l1Dict[query]) return c.json({ reply: l1Dict[query], layer: 'L1' });
      const cachedAnswer = await c.env.STOREFRONT_CACHE.get(`sem_cache:${query}`);
      if (cachedAnswer) return c.json({ reply: cachedAnswer, layer: 'L2' });
      return c.json({ reply: `Hello! How can I help you at ${storeSlug}?`, layer: 'L3' });
    }
  }

  return c.text('Not found', 404);
});

export default app;
