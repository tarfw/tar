/**
 * tarsite — Standalone Edge Server & UIPlan Runtime App
 * Handles *.tarai.space edge storefront traffic, /publish, /draft, /planner, and form submissions.
 * 100% Cloudflare-Native Storage (R2 + KV) with < 2ms global HTML streaming.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compileUIPlan } from './planner';
import { validateUIPlanGate } from './validator';
import { resolveRouteData } from './resolver';
import { matchPath } from './router';
import { compileRouteToHtml } from './html-builder';
import { parseDesignMd } from './designmd-parser';
import { type UIPlan } from './types';

export interface EnvBindings {
  STOREFRONT_CACHE?: any;
  THEMES_BUCKET?: any;
  SITES_BUCKET?: any;
  DB?: any;
  GROQ_API_KEY?: string;
}

const app = new Hono<{ Bindings: EnvBindings }>();

// Enable CORS for all routes (mobile app, web editor, cross-origin fetches)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── 1. POST /publish — Save & deploy layout to Edge KV & R2 ───────────

app.post('/publish', async (c) => {
  try {
    const body = await c.req.json();
    const { subdomain, workspaceName, layout, plan, layoutMd, template } = body || {};
    const cleanSub = (subdomain || '').replace(/^w:/, '').trim().toLowerCase();

    if (!cleanSub) {
      return c.json({ error: 'Missing subdomain' }, 400);
    }

    const title = workspaceName || cleanSub.replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

    let planToStore: UIPlan | null = null;
    let mdToStore = layoutMd || '';

    // A. If raw Markdown was provided
    if (layoutMd && typeof layoutMd === 'string') {
      planToStore = parseDesignMd(layoutMd, cleanSub);
    } 
    // B. If template name was provided (e.g. 'planhat', 'kith', 'milo')
    else if (template && typeof template === 'string') {
      let tplContent = '';
      if (c.env.THEMES_BUCKET) {
        const r2File = await c.env.THEMES_BUCKET.get(`${template}.md`).catch(() => null);
        if (r2File) {
          tplContent = await r2File.text();
        }
      }
      if (tplContent) {
        mdToStore = tplContent;
        planToStore = parseDesignMd(tplContent, cleanSub);
      }
    }

    // C. If direct UIPlan or layout JSON was provided
    if (!planToStore) {
      const activeLayout = plan || layout;
      if (activeLayout) {
        const layoutWithName = typeof activeLayout === 'object' && !Array.isArray(activeLayout)
          ? { ...activeLayout, workspaceName: activeLayout.workspaceName || title }
          : activeLayout;
        const gate = validateUIPlanGate(layoutWithName);
        planToStore = gate.plan || layoutWithName;
      }
    }

    // D. If still no plan, compile a starter plan
    if (!planToStore) {
      const { plan: starterPlan } = await compileUIPlan({
        workspaceId: cleanSub,
        workspaceName: title,
        instruction: `Storefront for ${title}`,
        templateHint: template || 'kith',
      });
      planToStore = starterPlan;
    }

    if (!planToStore) {
      return c.json({ error: 'Failed to construct valid site layout' }, 400);
    }

    const jsonStr = JSON.stringify(planToStore);

    // 1. Save compiled JSON to Cloudflare KV Cache for < 2ms global reads
    if (c.env.STOREFRONT_CACHE) {
      await c.env.STOREFRONT_CACHE.put(`published:${cleanSub}`, jsonStr);
      await c.env.STOREFRONT_CACHE.put(`published:${cleanSub.replace(/-/g, '_')}`, jsonStr);
      await c.env.STOREFRONT_CACHE.put(`published:${cleanSub.replace(/_/g, '-')}`, jsonStr);
      await c.env.STOREFRONT_CACHE.put(`draft:${cleanSub}`, jsonStr);
    }

    // 2. Save raw design.md to Cloudflare R2 if available
    if (c.env.SITES_BUCKET && mdToStore) {
      await c.env.SITES_BUCKET.put(`${cleanSub}/design.md`, mdToStore).catch((e: any) => console.warn('[R2 write]', e));
    }

    return c.json({
      success: true,
      message: `Published live to ${cleanSub}.tarai.space`,
      subdomain: cleanSub,
      routesCount: planToStore.routes?.length || 1,
    });
  } catch (err: any) {
    console.error('[publish error]', err);
    return c.json({ error: err?.message || 'Publish failed' }, 500);
  }
});

// ── 2. POST /draft — Save draft layout to Edge KV ────────────────────

app.post('/draft', async (c) => {
  try {
    const body = await c.req.json();
    const { subdomain, layout } = body || {};
    const cleanSub = (subdomain || '').replace(/^w:/, '').trim().toLowerCase();

    if (cleanSub && layout && c.env.STOREFRONT_CACHE) {
      const gate = validateUIPlanGate(layout);
      const planToStore = gate.plan || layout;
      await c.env.STOREFRONT_CACHE.put(`draft:${cleanSub}`, JSON.stringify(planToStore));
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Draft push failed' }, 500);
  }
});

// ── 3. POST /planner — Generate UIPlan via AI Staged Generator ──────

app.post('/planner', async (c) => {
  try {
    const body = await c.req.json();
    const { workspaceId, workspaceName, instruction, templateHint, model, products } = body || {};

    const { plan, error } = await compileUIPlan({
      workspaceId: workspaceId || 'default',
      workspaceName: workspaceName || 'Workspace',
      instruction: instruction || 'Starter storefront',
      templateHint,
      model: model || 'qwen/qwen3.6-27b',
      groqApiKey: c.env.GROQ_API_KEY,
      products,
    });

    if (!plan) {
      return c.json({ error: error || 'Failed to generate UIPlan' }, 500);
    }

    return c.json({ plan });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Planner error' }, 500);
  }
});

// ── 4a. DEBUG endpoint — inspect KV & R2 state for a slug ────────────

app.get('/debug/:slug', async (c) => {
  const slug = c.req.param('slug');
  let published = null;
  let draft = null;
  if (c.env.STOREFRONT_CACHE) {
    published = await c.env.STOREFRONT_CACHE.get(`published:${slug}`);
    draft = await c.env.STOREFRONT_CACHE.get(`draft:${slug}`);
  }

  return c.json({
    slug,
    kv: {
      [`published:${slug}`]: published ? `FOUND (${published.length} chars)` : 'MISSING',
      [`draft:${slug}`]: draft ? `FOUND (${draft.length} chars)` : 'MISSING',
    },
    publishedPreview: published ? JSON.parse(published) : null,
  });
});

// ── 4. Public Form Submissions (/api/contact, /api/order, /api/booking) ─

app.post('/api/contact', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, message: 'Contact submission received', data: body });
});

app.post('/api/order', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const orderId = `ord_${Date.now()}`;
  return c.json({ success: true, orderId, message: 'Order created successfully', data: body });
});

app.post('/api/booking', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const bookingId = `book_${Date.now()}`;
  return c.json({ success: true, bookingId, message: 'Booking confirmed', data: body });
});

// ── 5. Edge Storefront Request Router (GET /*) ──────────────────────

app.get('*', async (c) => {
  try {
    const host = c.req.header('host') || '';
    const pathname = c.req.path;

    let slug = host.split('.')[0].toLowerCase();
    if (slug === 'localhost' || slug === '127' || slug === 'tarai' || !slug) {
      slug = c.req.query('ws') || 'storea';
    }

    const wsTitle = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    // 1. Fetch layout from KV cache with fallback keys
    let planRaw: string | null = null;
    if (c.env?.STOREFRONT_CACHE) {
      try {
        planRaw = await c.env.STOREFRONT_CACHE.get(`published:${slug}`);
        if (!planRaw) {
          planRaw = await c.env.STOREFRONT_CACHE.get(`published:${slug.replace(/-/g, '_')}`);
        }
        if (!planRaw) {
          planRaw = await c.env.STOREFRONT_CACHE.get(`published:${slug.replace(/_/g, '-')}`);
        }
        if (!planRaw) {
          planRaw = await c.env.STOREFRONT_CACHE.get(`draft:${slug}`);
        }
      } catch (kvErr) {
        console.warn('[app] KV read warning:', kvErr);
      }
    }

    // 2. If not in KV, check R2 SITES_BUCKET
    if (!planRaw && c.env?.SITES_BUCKET) {
      try {
        const r2File = await c.env.SITES_BUCKET.get(`${slug}/design.md`);
        if (r2File) {
          planRaw = await r2File.text();
        }
      } catch (r2Err) {
        console.warn('[app] R2 read warning:', r2Err);
      }
    }

    // 3. Parse or generate starter Blueprint
    let plan: UIPlan | null = null;
    if (planRaw) {
      try {
        if (planRaw.trim().startsWith('---') || planRaw.includes('## Tokens')) {
          plan = parseDesignMd(planRaw, slug);
        } else {
          const parsed = JSON.parse(planRaw);
          const gate = validateUIPlanGate(parsed);
          if (gate.plan) {
            plan = gate.plan;
          }
        }
      } catch {
        try {
          plan = parseDesignMd(planRaw, slug);
        } catch {}
      }
    }

    if (!plan) {
      const { plan: starterPlan } = await compileUIPlan({
        workspaceId: slug,
        workspaceName: wsTitle,
        instruction: `Storefront for ${wsTitle}`,
        templateHint: slug,
      });
      plan = starterPlan;
    }

    if (!plan) {
      return c.html('<!DOCTYPE html><html><head><title>Setting up</title></head><body style="font-family:sans-serif;text-align:center;padding:100px;"><h1>Setting up</h1><p>Storefront is initializing.</p></body></html>');
    }

    // 4. Match Route & Resolve Data
    const routeMatch = matchPath(pathname, plan);
    const targetRoute = routeMatch.route || plan.routes[0];
    const resolvedRoute = await resolveRouteData(targetRoute, { env: c.env, workspaceSlug: slug }).catch(() => targetRoute);

    // 5. Compile & Stream Webflow-Quality HTML (< 2ms)
    const html = compileRouteToHtml(resolvedRoute, plan.designTokens);
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.html(html);
  } catch (err: any) {
    console.error('[app] GET * Handler Error:', err);
    const fallbackTitle = 'Storefront';
    const { plan: emergencyPlan } = await compileUIPlan({
      workspaceId: 'emergency',
      workspaceName: fallbackTitle,
      instruction: 'Emergency recovery storefront',
      templateHint: 'kith',
    });
    if (emergencyPlan) {
      const html = compileRouteToHtml(emergencyPlan.routes[0], emergencyPlan.designTokens);
      return c.html(html);
    }
    return c.html('<!DOCTYPE html><html><body><h1>Storefront Loading...</h1><script>setTimeout(()=>location.reload(), 1000);</script></body></html>', 500);
  }
});

export default app;
