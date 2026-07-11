/**
 * Gen UI API routes — planner, validate, store, publish.
 */

import { Hono } from 'hono';
import { generatePlan } from './planner';
import { validatePlan, storeRevision, getActiveRevision } from './validator';
import { createPreview, approveRevision, promoteRevision, rejectRevision } from './publisher';
import { getMemory, updateMemory, buildPlannerContext } from './memory';
import { getCatalogTypes } from './catalog';
import { getResourceIds } from './resources';
import { getActionIds } from './actions';
import { validateUIPlan, type UIPlan, type PlannerContext } from './types';

const genUi = new Hono();

// ── GET /gen-ui/catalog — list available components, resources, actions ──

genUi.get('/catalog', (c) => {
  return c.json({
    components: getCatalogTypes(),
    resources: getResourceIds(),
    actions: getActionIds(),
  });
});

// ── POST /gen-ui/validate — validate a plan ─────────────────────────

genUi.post('/validate', async (c) => {
  const body = await c.req.json();
  const plan = validateUIPlan(body);
  if (!plan) {
    return c.json({ valid: false, errors: ['Invalid plan schema'] }, 400);
  }

  const { validatePlan: validate } = await import('./validator');
  const result = validate(plan);
  return c.json(result);
});

// ── POST /gen-ui/planner — generate a plan via AI ───────────────────

genUi.post('/planner', async (c) => {
  const body = await c.req.json();
  const { workspaceId, target, vertical, instruction, userId } = body;

  if (!workspaceId || !target || !vertical) {
    return c.json({ error: 'Missing workspaceId, target, or vertical' }, 400);
  }

  // Get workspace context
  let designTokens = {};
  let currentPlan: UIPlan | undefined;
  let availableModules: string[] = [];

  try {
    const ws = await c.env.DB.prepare(
      'SELECT vertical FROM workspaces WHERE scope = ?'
    )
      .bind(`w:${workspaceId}`)
      .first();

    if (ws?.vertical) {
      // Load design tokens from R2
      const { readWorkspaceFile, listWorkspaceModules } = await import('./lib/okf');
      const designContent = await readWorkspaceFile(c.env, `w:${workspaceId}`, 'DESIGN.md');
      if (designContent) {
        const { parseDesignMD } = await import('./lib/design-md-parser');
        designTokens = parseDesignMD(designContent);
      }

      availableModules = await listWorkspaceModules(c.env, `w:${workspaceId}`);
    }
  } catch (err) {
    console.warn('[gen-ui] Failed to load workspace context:', err);
  }

  // Build planner context with memory
  const ctx: Omit<PlannerContext, 'memory'> = {
    workspaceId,
    target,
    vertical,
    designTokens,
    availableModules,
    currentPlan,
    instruction,
  };

  const fullCtx = userId
    ? await buildPlannerContext(ctx, userId, c.env)
    : { ...ctx };

  // Generate plan
  const { plan, error } = await generatePlan(fullCtx, c.env);

  if (!plan) {
    return c.json({ error: error || 'Failed to generate plan' }, 500);
  }

  return c.json({ plan });
});

// ── POST /gen-ui/store — store a validated plan ─────────────────────

genUi.post('/store', async (c) => {
  try {
    const body = await c.req.json();
    const plan = validateUIPlan(body);
    if (!plan) {
      return c.json({ error: 'Invalid plan schema' }, 400);
    }

    const result = await storeRevision(plan, c.env);
    return c.json(result);
  } catch (err: any) {
    console.error('[gen-ui/store] Error:', err);
    return c.json({ error: err.message || 'Store failed' }, 500);
  }
});

// ── GET /gen-ui/active/:workspaceId — get active revision ───────────

genUi.get('/active/:workspaceId', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const target = (c.req.query('target') || 'native') as 'native' | 'web';

  const plan = await getActiveRevision(workspaceId, target, c.env);
  if (!plan) {
    return c.json({ error: 'No active revision' }, 404);
  }

  return c.json({ plan });
});

// ── POST /gen-ui/preview — create a preview ─────────────────────────

genUi.post('/preview', async (c) => {
  const body = await c.req.json();
  const plan = validateUIPlan(body);
  if (!plan) {
    return c.json({ error: 'Invalid plan schema' }, 400);
  }

  const result = await createPreview(plan, c.env);
  return c.json(result);
});

// ── POST /gen-ui/approve — approve a revision ───────────────────────

genUi.post('/approve', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const { revisionId } = await c.req.json();

  if (!revisionId) {
    return c.json({ error: 'Missing revisionId' }, 400);
  }

  const result = await approveRevision(revisionId, userId, c.env);
  return c.json(result);
});

// ── POST /gen-ui/promote — promote to live ──────────────────────────

genUi.post('/promote', async (c) => {
  const { revisionId } = await c.req.json();

  if (!revisionId) {
    return c.json({ error: 'Missing revisionId' }, 400);
  }

  const result = await promoteRevision(revisionId, c.env);
  return c.json(result);
});

// ── POST /gen-ui/reject — reject/discard a revision ─────────────────

genUi.post('/reject', async (c) => {
  const { revisionId } = await c.req.json();

  if (!revisionId) {
    return c.json({ error: 'Missing revisionId' }, 400);
  }

  const result = await rejectRevision(revisionId, c.env);
  return c.json(result);
});

// ── GET /gen-ui/memory/:userId/:workspaceId — get user memory ───────

genUi.get('/memory/:userId/:workspaceId', async (c) => {
  const userId = c.req.param('userId');
  const workspaceId = c.req.param('workspaceId');

  const memory = await getMemory(userId, workspaceId, c.env);
  return c.json({ memory });
});

// ── PUT /gen-ui/memory — update user memory ─────────────────────────

genUi.put('/memory', async (c) => {
  const body = await c.req.json();
  const { userId, workspaceId, updates } = body;

  if (!userId || !workspaceId) {
    return c.json({ error: 'Missing userId or workspaceId' }, 400);
  }

  const memory = await updateMemory(userId, workspaceId, updates, c.env);
  return c.json({ memory });
});

export default genUi;
