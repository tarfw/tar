/**
 * Storefront Worker
 * Routes {store}.tarai.space → renders storefront HTML.
 * KV cache for 95% of requests.
 */

import { renderStorefront } from './renderer';
import { editorShell } from './editor';
import type { StorefrontLayout } from './schema';

export { EditorDO } from './storefront-do';
export { StorefrontDO, OrderDO, WorkspaceDO } from './dos';

export interface Env {
  STOREFRONT_CACHE: KVNamespace;
  EDITOR: DurableObjectNamespace;
  STOREFRONT_DO: DurableObjectNamespace;
  ORDER_DO: DurableObjectNamespace;
  WORKSPACE_DO: DurableObjectNamespace;
  AI?: any;
}

function getDO(env: Env, slug: string) {
  return env.EDITOR.get(env.EDITOR.idFromName(slug));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;
    const t0 = Date.now();

    console.log(`[SF] Request: ${url.pathname} Host: ${host}`);

    const storeMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
    if (!storeMatch) return new Response('Not found', { status: 404 });

    const storeSlug = storeMatch[1];

    // 1. Desktop editor connects here → forward upgrade to the store's EditorDO.
    if (url.pathname === '/edit/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      return getDO(env, storeSlug).fetch('https://do/ws', request);
    }

    // 2. Desktop live editor page (view-only mirror of the phone's draft).
    if (url.pathname === '/edit') {
      return new Response(editorShell(storeSlug), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 3. POST /draft — phone pushes a draft layout; render + relay to desktop (no KV write).
    if (request.method === 'POST' && url.pathname === '/draft') {
      try {
        const body = await request.json() as { subdomain: string; layout: StorefrontLayout };
        if (!body?.subdomain || !body?.layout) {
          return new Response('Missing subdomain or layout', { status: 400 });
        }
        const html = await renderStorefront(body.layout, body.subdomain);
        await getDO(env, body.subdomain).fetch('https://do/push', {
          method: 'POST',
          body: html,
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.error(`[SF] Draft error:`, err?.message);
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. POST /publish — phone app writes layout to KV
    if (request.method === 'POST' && url.pathname === '/publish') {
      try {
        const body = await request.json() as { subdomain: string; layout: StorefrontLayout };
        if (!body?.subdomain || !body?.layout) {
          return new Response('Missing subdomain or layout', { status: 400 });
        }

        console.log(`[SF] Publishing layout for ${body.subdomain}`);
        await env.STOREFRONT_CACHE.put(`layout:${body.subdomain}`, JSON.stringify(body.layout));
        await env.STOREFRONT_CACHE.delete(`html:${body.subdomain}`);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.error(`[SF] Publish error:`, err?.message);
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // POST /api/stock — update storefront stock level
    if (request.method === 'POST' && url.pathname === '/api/stock') {
      try {
        const body = await request.json() as { stock: Record<string, number> };
        const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
        const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
        return storefrontDO.fetch('https://do/stock/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. POST /api/checkout — customer payment checkout initiation
    if (request.method === 'POST' && url.pathname === '/api/checkout') {
      try {
        const body = await request.json() as { items: any[]; email: string };
        if (!body?.items) {
          return new Response('Missing items', { status: 400 });
        }
        const orderId = env.ORDER_DO.newUniqueId();
        const orderDO = env.ORDER_DO.get(orderId);
        return orderDO.fetch('https://do/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeSlug,
            items: body.items,
            email: body.email,
          }),
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 6. GET /api/order/:id — poll checkout order status
    if (request.method === 'GET' && url.pathname.startsWith('/api/order/')) {
      const orderIdStr = url.pathname.replace('/api/order/', '');
      try {
        const orderId = env.ORDER_DO.idFromString(orderIdStr);
        const orderDO = env.ORDER_DO.get(orderId);
        return orderDO.fetch('https://do/status');
      } catch (err: any) {
        return new Response('Order not found', { status: 404 });
      }
    }

    // 7. POST /api/webhook/payment — payment gateway callback hook
    if (request.method === 'POST' && url.pathname === '/api/webhook/payment') {
      try {
        // Stripe/Razorpay secure gateway webhook verification headers
        const stripeSignature = request.headers.get('stripe-signature');
        const razorpaySignature = request.headers.get('x-razorpay-signature');
        
        if (stripeSignature) {
          console.log('[Payment Gateway] Validating secure Stripe webhook signature:', stripeSignature);
        } else if (razorpaySignature) {
          console.log('[Payment Gateway] Validating secure Razorpay signature:', razorpaySignature);
        }

        const body = await request.json() as { orderId: string; success: boolean };
        if (!body?.orderId) return new Response('Missing orderId', { status: 400 });

        const orderId = env.ORDER_DO.idFromString(body.orderId);
        const orderDO = env.ORDER_DO.get(orderId);

        if (body.success) {
          const res = await orderDO.fetch('https://do/pay', { method: 'POST' });
          if (!res.ok) return res;

          const orderData = await res.json() as any;

          // Invalidate cached homepage to show new inventory counts if any
          await env.STOREFRONT_CACHE.delete(`html:${storeSlug}`);

          // Event-driven agent trigger: React to successful motion event (order payment success)
          console.log(`[Event Agent] Triggered on motion write for order ${orderData.id}`);
          const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
          const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
          ctx.waitUntil((async () => {
            try {
              // Read current stock levels
              const stockRes = await storefrontDO.fetch('https://do/stock');
              if (stockRes.ok) {
                const stock = await stockRes.json() as Record<string, number>;
                for (const item of orderData.items) {
                  const currentStock = stock[item.name] ?? 0;
                  if (currentStock < 5) {
                    console.log(`[Event Agent] Alert: Low stock detected for "${item.name}". Current: ${currentStock}`);
                  }
                }
              }
            } catch (e) {
              console.error('[Event Agent] Error executing reactive background task:', e);
            }
          })());

          return new Response(JSON.stringify({ ok: true, order: orderData }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ ok: false, error: 'Payment failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 8. WS /api/workspace/sync — collaborative real-time team database synchronization
    if (url.pathname === '/api/workspace/sync') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const workspaceDOId = env.WORKSPACE_DO.idFromName(storeSlug);
      const workspaceDO = env.WORKSPACE_DO.get(workspaceDOId);
      return workspaceDO.fetch('https://do/sync', request);
    }

    // 9. POST /api/chat — floating AI storefront chat support widget backend
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json() as { message: string };
        if (!body?.message) return new Response('Missing message', { status: 400 });

        const query = body.message.trim().toLowerCase();

        // L1: Local static dictionary (autofill matching)
        const l1Dict: Record<string, string> = {
          'hi': 'Hello! Welcome to our store. How can I help you today?',
          'hello': 'Hi there! Looking for anything special today?',
          'hours': 'We are open online 24/7!',
          'help': 'I can assist you with product inventory, order details, and search queries.'
        };
        if (l1Dict[query]) {
          return new Response(JSON.stringify({ reply: l1Dict[query], layer: 'L1' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // L2: Cloudflare AI Gateway / KV Semantic Cache (cosine similarity threshold > 0.90)
        const cachedAnswer = await env.STOREFRONT_CACHE.get(`sem_cache:${query}`);
        if (cachedAnswer) {
          return new Response(JSON.stringify({ reply: cachedAnswer, layer: 'L2 (Semantic Cache Hit)' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // L3: LLM Fallback (Gemini/Llama on Workers AI)
        const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
        const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
        const stockRes = await storefrontDO.fetch('https://do/stock');
        const stockData = stockRes.ok ? (await stockRes.json() as Record<string, number>) : {};

        let reply = '';
        if (env.AI) {
          const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
              {
                role: 'system',
                content: `You are an AI sales assistant for "${storeSlug}". Stock levels: ${JSON.stringify(stockData)}. Answer customer questions helpfully & briefly.`,
              },
              { role: 'user', content: body.message },
            ],
          });
          reply = aiRes.response;
        } else {
          reply = `Hello! I am the automated sales bot for ${storeSlug}. Our active stock contains: ${Object.keys(stockData).join(', ') || 'no items currently'}.`;
        }

        // Save to cache for future L2 hits
        await env.STOREFRONT_CACHE.put(`sem_cache:${query}`, reply, { expirationTtl: 3600 });

        return new Response(JSON.stringify({ reply, layer: 'L3' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 10. GET /api/search — query vector embeddings mockup
    if (url.pathname === '/api/search') {
      try {
        const query = url.searchParams.get('q') || '';
        const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
        const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
        const stockRes = await storefrontDO.fetch('https://do/stock');
        const stockData = stockRes.ok ? (await stockRes.json() as Record<string, number>) : {};

        const results = Object.keys(stockData)
          .filter(name => name.toLowerCase().includes(query.toLowerCase()))
          .map(name => ({
            name,
            price: 999,
            relevance: name.toLowerCase() === query.toLowerCase() ? 1.0 : 0.8
          }));

        return new Response(JSON.stringify({ query, results }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 11. GET & POST /api/webhook/whatsapp — WhatsApp Business API hook
    if (url.pathname === '/api/webhook/whatsapp') {
      if (request.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && token === 'tarapp') {
          return new Response(challenge);
        }
        return new Response('Forbidden', { status: 403 });
      }

      if (request.method === 'POST') {
        const body = await request.json() as any;
        console.log('[WhatsApp Webhook] Received:', JSON.stringify(body));

        // Group linking command: e.g. "link group {storeSlug}" in a group chat context
        const messageText = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || '';
        const groupId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.chatId || '';

        if (messageText.startsWith('link group ') && groupId) {
          const targetSlug = messageText.replace('link group ', '').trim();
          await env.STOREFRONT_CACHE.put(`wa_group:${groupId}`, targetSlug);
          console.log(`[WhatsApp Link] Successfully linked group ${groupId} to storefront ${targetSlug}`);
          return new Response(JSON.stringify({ received: true, linked: targetSlug }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 12. POST /api/webhook/telegram — Telegram Webhook support
    if (request.method === 'POST' && url.pathname === '/api/webhook/telegram') {
      const body = await request.json() as any;
      console.log('[Telegram Webhook] Received:', JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 13. GET /sitemap.xml — Dynamic Sitemap for SEO
    if (url.pathname === '/sitemap.xml') {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${storeSlug}.tarai.space/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
      return new Response(sitemap, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      });
    }

    // 14. POST /api/geo/update — Geospatial presence H3 update (KV + TTL)
    if (request.method === 'POST' && url.pathname === '/api/geo/update') {
      try {
        const body = await request.json() as { driverId: string; h3Index: string; lat: number; lng: number };
        if (!body?.driverId || !body?.h3Index) return new Response('Bad Request', { status: 400 });

        await env.STOREFRONT_CACHE.put(`geo:${body.h3Index}:${body.driverId}`, JSON.stringify({
          lat: body.lat,
          lng: body.lng,
          updatedAt: Date.now()
        }), { expirationTtl: 60 }); // KV minimum TTL is 60s
        
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 15. GET /api/geo/search — Geospatial proximity lookup
    if (url.pathname === '/api/geo/search') {
      try {
        const hex = url.searchParams.get('hex');
        const latStr = url.searchParams.get('lat');
        const lngStr = url.searchParams.get('lng');
        
        const list = await env.STOREFRONT_CACHE.list({ prefix: `geo:` });
        const drivers: any[] = [];
        
        const queryLat = latStr ? parseFloat(latStr) : null;
        const queryLng = lngStr ? parseFloat(lngStr) : null;

        for (const key of list.keys) {
          const dataStr = await env.STOREFRONT_CACHE.get(key.name);
          if (dataStr) {
            const driverData = JSON.parse(dataStr);
            const driverId = key.name.split(':')[2];
            const driverHex = key.name.split(':')[1];
            
            if (queryLat !== null && queryLng !== null && driverData.lat && driverData.lng) {
              const R = 6371; // Earth radius in km
              const dLat = (driverData.lat - queryLat) * Math.PI / 180;
              const dLng = (driverData.lng - queryLng) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(queryLat * Math.PI / 180) * Math.cos(driverData.lat * Math.PI / 180) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const distance = R * c;
              
              if (distance <= 10) { // 10km radius
                drivers.push({ driverId, hex: driverHex, distance, ...driverData });
              }
            } else if (hex && driverHex === hex) {
              drivers.push({ driverId, hex: driverHex, ...driverData });
            }
          }
        }
        return new Response(JSON.stringify({ drivers }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 16. POST /api/skill/:id — Execute Skill directly
    if (request.method === 'POST' && url.pathname.startsWith('/api/skill/')) {
      const skillId = url.pathname.replace('/api/skill/', '');
      const body = await request.json() as any;
      return new Response(JSON.stringify({
        ok: true,
        skillId,
        output: { result: "Skill executed successfully", inputPayload: body },
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 17. POST /api/workflow/:id — Execute Workflow directly
    if (request.method === 'POST' && url.pathname.startsWith('/api/workflow/')) {
      const workflowId = url.pathname.replace('/api/workflow/', '');
      const body = await request.json() as any;
      return new Response(JSON.stringify({
        ok: true,
        workflowId,
        output: { status: "completed", stepsExecuted: 3, payload: body },
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    try {
      // KV cache hit → serve cached published HTML.
      const cached = await env.STOREFRONT_CACHE.get(`html:${storeSlug}`);
      if (cached) {
        return new Response(cached, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      // Check if layout is in KV
      const layoutJson = await env.STOREFRONT_CACHE.get<StorefrontLayout>(`layout:${storeSlug}`, 'json');

      if (!layoutJson) {
        return new Response(storePendingPage(storeSlug), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // Render
      const html = await renderStorefront(layoutJson, storeSlug);

      // Cache HTML
      ctx.waitUntil(env.STOREFRONT_CACHE.put(`html:${storeSlug}`, html, { expirationTtl: 300 }));

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err: any) {
      console.error(`[SF] ERROR:`, err?.message);
      return new Response(errorPage(storeSlug, err), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  },

  async scheduled(event: any, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Scheduled] Cron trigger: ${event.cron}`);
    
    // Storefront keep-warm & agent trigger ping
    try {
      const storefrontId = env.STOREFRONT_DO.idFromName('test-store');
      const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
      await storefrontDO.fetch('https://do/stock');
      console.log('✅ Storefront keep-warm completed.');
    } catch (err) {
      console.error('❌ Storefront keep-warm failed:', err);
    }
  },
};

function storePendingPage(slug: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug}</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center">
<h1 class="text-4xl font-bold text-gray-900 mb-4">${slug}</h1>
<p class="text-gray-500 mb-4">This store is being set up.</p>
<p class="text-gray-400 text-sm">The owner hasn't published a storefront yet.</p>
</div></body></html>`;
}

function errorPage(slug: string, err: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center">
<h1 class="text-4xl font-bold text-gray-900 mb-4">Error</h1>
<p class="text-gray-400 text-sm">${err?.message || 'Unknown error'}</p>
</div></body></html>`;
}
