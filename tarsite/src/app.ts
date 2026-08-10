/**
 * tarsite — Standalone Edge Server & UIPlan Runtime App (Phase 10)
 * Handles *.tarai.space edge storefront traffic, /publish, /draft, /planner, and form submissions.
 * Includes full CORS support for mobile app / web cross-origin publishing.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compileUIPlan } from './planner';
import { validateUIPlanGate } from './validator';
import { resolveRouteData } from './resolver';
import { matchPath } from './router';
import { compileRouteToHtml } from './renderer';
import { type UIPlan } from './types';

const app = new Hono<{ Bindings: { STOREFRONT_CACHE?: any; DB?: any; GROQ_API_KEY?: string } }>();

// Enable CORS for all routes (mobile app, web editor, cross-origin fetches)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── 1. POST /publish — Save & deploy layout to Edge KV ────────────────

app.post('/publish', async (c) => {
  try {
    const body = await c.req.json();
    const { subdomain, workspaceName, layout, plan } = body || {};
    const activeLayout = plan || layout;
    const cleanSub = (subdomain || '').replace(/^w:/, '').trim().toLowerCase();

    if (!cleanSub) {
      return c.json({ error: 'Missing subdomain' }, 400);
    }

    if (activeLayout) {
      // Inject workspaceName from request body into the layout before normalizing
      // so the site title renders correctly (e.g. "Velvet Brew" not "Storefront")
      const layoutWithName = typeof activeLayout === 'object' && !Array.isArray(activeLayout)
        ? {
            ...activeLayout,
            workspaceName: activeLayout.workspaceName || workspaceName ||
              cleanSub.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          }
        : activeLayout;

      const gate = validateUIPlanGate(layoutWithName);
      const planToStore = gate.plan || layoutWithName;
      const jsonStr = JSON.stringify(planToStore);

      if (c.env.STOREFRONT_CACHE) {
        await c.env.STOREFRONT_CACHE.put(`published:${cleanSub}`, jsonStr);
        // Also save variant slug for hyphen/underscore instant lookup
        if (cleanSub.includes('-')) {
          await c.env.STOREFRONT_CACHE.put(`published:${cleanSub.replace(/-/g, '_')}`, jsonStr);
        }
      }
    }

    return c.json({ success: true, message: `Published live to ${cleanSub}.tarai.space` });
  } catch (err: any) {
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

// ── 4. Public Form Submissions (/api/contact, /api/order, /api/booking) ─

app.post('/api/contact', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, message: 'Contact submission received', data: body });
});

app.post('/api/order', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, orderId: `ord_${Date.now()}`, data: body });
});

app.post('/api/booking', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ success: true, bookingId: `book_${Date.now()}`, data: body });
});

// ── 5. Edge Storefront Request Router (GET /*) ──────────────────────

app.get('*', async (c) => {
  const host = c.req.header('host') || '';
  const pathname = c.req.path;

  let slug = host.split('.')[0].toLowerCase();
  if (slug === 'localhost' || slug === '127' || slug.includes('tarai') || !slug) {
    slug = c.req.query('ws') || 'storea';
  }

  // 1. Fetch layout from KV cache with slug variant fallbacks
  let planRaw: string | null = null;
  if (c.env.STOREFRONT_CACHE) {
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
  }

  // 2. Fallback: Generate starter UIPlan on the fly if not yet published
  let plan: UIPlan | null = null;
  if (planRaw) {
    try {
      const parsed = JSON.parse(planRaw);
      const gate = validateUIPlanGate(parsed);
      if (gate.plan) {
        plan = gate.plan;
      }
    } catch {}
  }

  if (!plan) {
    const { plan: starterPlan } = await compileUIPlan({
      workspaceId: slug,
      workspaceName: slug.toUpperCase(),
      instruction: `Starter storefront for ${slug}`,
    });
    plan = starterPlan;
  }

  if (!plan) {
    return c.html('<!DOCTYPE html><html><head><title>Setting up</title></head><body style="font-family:sans-serif;text-align:center;padding:100px;"><h1>Setting up</h1><p>Storefront is initializing.</p></body></html>');
  }

  // 3. Match Route & Resolve Data
  const routeMatch = matchPath(pathname, plan);
  const targetRoute = routeMatch.route || plan.routes[0];

  const resolvedRoute = await resolveRouteData(targetRoute, { env: c.env, workspaceSlug: slug });

  // 4. Compile & Stream Webflow-Quality HTML in < 5ms
  const html = compileRouteToHtml(resolvedRoute, plan.designTokens);
  return c.html(html);
});

export default app;
