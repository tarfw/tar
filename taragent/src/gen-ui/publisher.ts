/**
 * Publishing — preview + approval + revision promotion.
 * Structural site changes require owner approval before going live.
 */

import type { UIPlan, UIRevision } from './types';
import { validatePlan } from './validator';

// ── Preview ─────────────────────────────────────────────────────────

export interface PreviewResult {
  previewUrl: string;
  revisionId: string;
}

/**
 * Generate a preview URL for a plan (draft state).
 * Does NOT make the plan live.
 */
export async function createPreview(
  plan: UIPlan,
  env: any
): Promise<PreviewResult> {
  const validation = validatePlan(plan);
  if (!validation.valid) {
    throw new Error(`Cannot preview invalid plan: ${validation.errors.join('; ')}`);
  }

  const revisionId = `preview_${plan.revision}_${Date.now()}`;

  // Store as draft
  const r2Key = `ui-revisions/${plan.workspaceId}/${revisionId}.json`;
  await env.BUCKET.put(r2Key, JSON.stringify(plan), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Record in D1
  await env.DB.prepare(
    `INSERT INTO ui_revisions (id, workspace_id, target, revision_id, r2_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'draft', datetime('now'))`
  )
    .bind(revisionId, plan.workspaceId, plan.target, plan.revision, r2Key)
    .run();

  // Preview URL
  const previewUrl = `https://${plan.workspaceId}.tarai.space/preview/${revisionId}`;

  return { previewUrl, revisionId };
}

// ── Approval ────────────────────────────────────────────────────────

export interface ApprovalResult {
  success: boolean;
  error?: string;
}

/**
 * Owner approves a draft revision.
 * Only owner role can approve.
 */
export async function approveRevision(
  revisionId: string,
  ownerId: string,
  env: any
): Promise<ApprovalResult> {
  try {
    // Verify owner
    const revision = await env.DB.prepare(
      `SELECT r.*, w.user_id FROM ui_revisions r
       JOIN workspaces w ON w.scope = r.workspace_id
       WHERE r.id = ?`
    )
      .bind(revisionId)
      .first();

    if (!revision) {
      return { success: false, error: 'Revision not found' };
    }

    if (revision.user_id !== ownerId) {
      return { success: false, error: 'Only workspace owner can approve' };
    }

    if (revision.status !== 'draft') {
      return { success: false, error: `Cannot approve revision in status: ${revision.status}` };
    }

    // Update status to approved
    await env.DB.prepare(
      `UPDATE ui_revisions SET status = 'approved' WHERE id = ?`
    )
      .bind(revisionId)
      .run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Promotion (make live) ──────────────────────────────────────────

export interface PromotionResult {
  success: boolean;
  liveUrl?: string;
  error?: string;
}

/**
 * Promote an approved revision to live.
 * Archives the previous live revision.
 */
export async function promoteRevision(
  revisionId: string,
  env: any
): Promise<PromotionResult> {
  try {
    const revision = await env.DB.prepare(
      `SELECT * FROM ui_revisions WHERE id = ?`
    )
      .bind(revisionId)
      .first();

    if (!revision) {
      return { success: false, error: 'Revision not found' };
    }

    if (revision.status !== 'approved') {
      return { success: false, error: `Cannot promote revision in status: ${revision.status}` };
    }

    // Archive previous active revision
    const previous = await env.DB.prepare(
      `SELECT id FROM ui_revisions 
       WHERE workspace_id = ? AND target = ? AND status = 'active'`
    )
      .bind(revision.workspace_id, revision.target)
      .first();

    if (previous?.id) {
      await env.DB.prepare(
        `UPDATE ui_revisions SET status = 'archived' WHERE id = ?`
      )
        .bind(previous.id)
        .run();
    }

    // Promote to active
    await env.DB.prepare(
      `UPDATE ui_revisions SET status = 'active' WHERE id = ?`
    )
      .bind(revisionId)
      .run();

    // Clear KV cache
    if (env.STOREFRONT_CACHE) {
      const cacheKey = `ui_plan:${revision.workspace_id}:${revision.target}`;
      await env.STOREFRONT_CACHE.delete(cacheKey).catch(() => {});
    }

    const liveUrl = `https://${revision.workspace_id}.tarai.space`;

    return { success: true, liveUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Reject ──────────────────────────────────────────────────────────

export async function rejectRevision(
  revisionId: string,
  env: any
): Promise<ApprovalResult> {
  try {
    await env.DB.prepare(
      `UPDATE ui_revisions SET status = 'archived' WHERE id = ? AND status IN ('draft', 'approved')`
    )
      .bind(revisionId)
      .run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
