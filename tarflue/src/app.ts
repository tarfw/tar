import { renderStorefront } from './storefront/renderer';
import { editorShell } from './storefront/editor';
import type { StorefrontLayout, StorefrontProduct } from './storefront/schema';

export interface Env {
  STOREFRONT_CACHE: KVNamespace;
  EDITOR: DurableObjectNamespace;
  STOREFRONT_DO: DurableObjectNamespace;
  ORDER_DO: DurableObjectNamespace;
  AI?: any;
}

function getDO(env: Env, slug: string) {
  return env.EDITOR.get(env.EDITOR.idFromName(slug));
}

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;

    const storeMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
    if (!storeMatch) return new Response('Not found', { status: 404 });

    const storeSlug = storeMatch[1];

    if (url.pathname === '/edit/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      return getDO(env, storeSlug).fetch('https://do/ws', request);
    }

    if (url.pathname === '/edit') {
      return new Response(editorShell(storeSlug), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

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
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/publish') {
      try {
        const body = await request.json() as { subdomain: string; layout: StorefrontLayout };
        if (!body?.subdomain || !body?.layout) {
          return new Response('Missing subdomain or layout', { status: 400 });
        }
        await env.STOREFRONT_CACHE.put(`layout:${body.subdomain}`, JSON.stringify(body.layout));
        await env.STOREFRONT_CACHE.delete(`html:${body.subdomain}`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

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

    if (request.method === 'POST' && url.pathname === '/api/webhook/payment') {
      try {
        const stripeSignature = request.headers.get('stripe-signature');
        const razorpaySignature = request.headers.get('x-razorpay-signature');

        const body = await request.json() as { orderId: string; success: boolean };
        if (!body?.orderId) return new Response('Missing orderId', { status: 400 });

        const orderId = env.ORDER_DO.idFromString(body.orderId);
        const orderDO = env.ORDER_DO.get(orderId);

        if (body.success) {
          const res = await orderDO.fetch('https://do/pay', { method: 'POST' });
          if (!res.ok) return res;

          const orderData = await res.json() as any;
          await env.STOREFRONT_CACHE.delete(`html:${storeSlug}`);

          ctx.waitUntil((async () => {
            try {
              const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
              const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
              const stockRes = await storefrontDO.fetch('https://do/stock');
              if (stockRes.ok) {
                const stock = await stockRes.json() as Record<string, number>;
                for (const item of orderData.items) {
                  const currentStock = stock[item.name] ?? 0;
                  if (currentStock < 5) {
                    console.log(`[Low Stock] Alert: "${item.name}" has ${currentStock} units remaining`);
                  }
                }
              }
            } catch (e) {
              console.error('[Stock Check] Error:', e);
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

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json() as { message: string };
        if (!body?.message) return new Response('Missing message', { status: 400 });

        const query = body.message.trim().toLowerCase();

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

        const cachedAnswer = await env.STOREFRONT_CACHE.get(`sem_cache:${query}`);
        if (cachedAnswer) {
          return new Response(JSON.stringify({ reply: cachedAnswer, layer: 'L2 (Semantic Cache Hit)' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const storefrontId = env.STOREFRONT_DO.idFromName(storeSlug);
        const storefrontDO = env.STOREFRONT_DO.get(storefrontId);
        const stockRes = await storefrontDO.fetch('https://do/stock');
        const stockData = stockRes.ok ? (await stockRes.json() as Record<string, number>) : {};

        let reply = '';
        const groqKey = env.GROQ_API_KEY || '';
        if (groqKey) {
          try {
            const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${groqKey}`,
              },
              body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                  {
                    role: 'system',
                    content: `You are an AI sales assistant for "${storeSlug}". Stock levels: ${JSON.stringify(stockData)}. Answer customer questions helpfully & briefly.`,
                  },
                  { role: 'user', content: body.message },
                ],
                max_completion_tokens: 1024,
              }),
            });
            const aiJson = await aiRes.json() as any;
            reply = aiJson?.choices?.[0]?.message?.content || '';
          } catch {}
        }
        if (!reply) {
          reply = `Hello! I am the automated sales bot for ${storeSlug}. Our active stock contains: ${Object.keys(stockData).join(', ') || 'no items currently'}.`;
        }

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
        const messageText = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || '';
        const groupId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.chatId || '';

        if (messageText.startsWith('link group ') && groupId) {
          const targetSlug = messageText.replace('link group ', '').trim();
          await env.STOREFRONT_CACHE.put(`wa_group:${groupId}`, targetSlug);
          return new Response(JSON.stringify({ received: true, linked: targetSlug }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/webhook/telegram') {
      const body = await request.json() as any;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    if (request.method === 'POST' && url.pathname === '/api/geo/update') {
      try {
        const body = await request.json() as { driverId: string; h3Index: string; lat: number; lng: number };
        if (!body?.driverId || !body?.h3Index) return new Response('Bad Request', { status: 400 });

        await env.STOREFRONT_CACHE.put(`geo:${body.h3Index}:${body.driverId}`, JSON.stringify({
          lat: body.lat,
          lng: body.lng,
          updatedAt: Date.now()
        }), { expirationTtl: 60 });

        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

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
              const R = 6371;
              const dLat = (driverData.lat - queryLat) * Math.PI / 180;
              const dLng = (driverData.lng - queryLng) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(queryLat * Math.PI / 180) * Math.cos(driverData.lat * Math.PI / 180) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const distance = R * c;

              if (distance <= 10) {
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

    try {
      const cached = await env.STOREFRONT_CACHE.get(`html:${storeSlug}`);
      if (cached) {
        return new Response(cached, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      const layoutJson = await env.STOREFRONT_CACHE.get<StorefrontLayout>(`layout:${storeSlug}`, 'json');

      if (!layoutJson) {
        return new Response(storePendingPage(storeSlug), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const html = await renderStorefront(layoutJson, storeSlug);
      ctx.waitUntil(env.STOREFRONT_CACHE.put(`html:${storeSlug}`, html, { expirationTtl: 300 }));

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err: any) {
      return new Response(errorPage(storeSlug, err), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  },
};
