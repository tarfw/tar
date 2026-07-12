/**
 * Validate + Store — lean validation, no repair loops.
 * Invalid plan = discard + keep previous live revision.
 */

import { isValidType, getCatalogEntry } from './catalog';
import { isValidResource } from './resources';
import { isValidAction } from './actions';
import { flattenNodes, type SiteLayout, type UIRevision } from './types';

// ── Validation ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePlan(plan: SiteLayout): ValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set<string>();

  for (const route of plan.routes) {
    for (const node of flattenNodes({ ...plan, routes: [route] })) {
      // Check unique IDs
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);

      // Check type exists in catalog
      if (!isValidType(node.type)) {
        errors.push(`Unknown component type: ${node.type} (node ${node.id})`);
      }

      // Validate props against schema
      const catalogEntry = getCatalogEntry(node.type);
      if (catalogEntry) {
        const propsResult = catalogEntry.propsSchema.safeParse(node.props);
        if (!propsResult.success) {
          errors.push(`Invalid props for ${node.type}: ${propsResult.error.message}`);
        }
      }

      // Check resource bindings
      if (node.bindings) {
        for (const [key, binding] of Object.entries(node.bindings)) {
          if (!isValidResource(binding.resource)) {
            errors.push(`Unknown resource: ${binding.resource} (node ${node.id}, binding ${key})`);
          }
        }
      }

      // Check action bindings
      if (node.actions) {
        for (const [key, actionBinding] of Object.entries(node.actions)) {
          if (!isValidAction(actionBinding.action)) {
            errors.push(`Unknown action: ${actionBinding.action} (node ${node.id}, action ${key})`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Storage ─────────────────────────────────────────────────────────

export interface StorageResult {
  success: boolean;
  revisionId?: string;
  error?: string;
}

/**
 * Store an immutable revision in R2 and update active pointer in D1.
 * If plan is invalid, discards and keeps previous revision.
 */
export async function storeRevision(
  plan: SiteLayout,
  env: any
): Promise<StorageResult> {
  // Validate first
  const validation = validatePlan(plan);
  if (!validation.valid) {
    console.warn('[validator] Plan invalid, discarding:', validation.errors);
    return {
      success: false,
      error: `Invalid plan: ${validation.errors.join('; ')}`,
    };
  }

  const revisionId = `rev_${plan.revision}_${Date.now()}`;

  try {
    // Store immutable revision in R2
    const r2Key = `ui-revisions/${plan.workspaceId}/${revisionId}.json`;
    await env.BUCKET.put(r2Key, JSON.stringify(plan), {
      httpMetadata: { contentType: 'application/json' },
    });

    // Update active pointer in D1
    const existing = await env.DB.prepare(
      `SELECT id FROM ui_revisions WHERE workspace_id = ? AND target = ? AND status = 'active'`
    )
      .bind(plan.workspaceId, plan.target)
      .first();

    if (existing?.id) {
      // Archive previous active revision
      await env.DB.prepare(
        `UPDATE ui_revisions SET status = 'archived' WHERE id = ?`
      )
        .bind(existing.id)
        .run();
    }

    // Insert new active revision
    await env.DB.prepare(
      `INSERT INTO ui_revisions (id, workspace_id, target, revision_id, r2_key, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`
    )
      .bind(revisionId, plan.workspaceId, plan.target, plan.revision, r2Key)
      .run();

    return { success: true, revisionId };
  } catch (err: any) {
    console.error('[validator] Storage failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get the active revision for a workspace + target.
 */
export async function getActiveRevision(
  workspaceId: string,
  target: 'native' | 'web',
  env: any
): Promise<SiteLayout | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT r2_key FROM ui_revisions 
       WHERE workspace_id = ? AND target = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(workspaceId, target)
      .first();

    if (!row?.r2_key) return null;

    const obj = await env.BUCKET.get(row.r2_key);
    if (!obj) return null;

    const text = await obj.text();
    return JSON.parse(text) as SiteLayout;
  } catch {
    return null;
  }
}
