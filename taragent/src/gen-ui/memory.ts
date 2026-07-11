/**
 * UIMemory — compact per-user+workspace preferences.
 * Memory influences component selection and ordering only.
 * Memory never overrides authorization.
 */

import { UIMemorySchema, type UIMemory, type PlannerContext } from './types';

// ── Default memory ──────────────────────────────────────────────────

const DEFAULT_MEMORY: UIMemory = {
  userId: '',
  workspaceId: '',
  role: 'customer',
  density: 'comfortable',
  preferredModules: [],
  accessibility: {
    reducedMotion: false,
    largeText: false,
  },
  excludedVariants: [],
  approvedDesignRevision: '',
};

// ── Get memory ──────────────────────────────────────────────────────

export async function getMemory(
  userId: string,
  workspaceId: string,
  env: any
): Promise<UIMemory> {
  try {
    const row = await env.DB.prepare(
      `SELECT data FROM ui_memory WHERE user_id = ? AND workspace_id = ?`
    )
      .bind(userId, workspaceId)
      .first();

    if (row?.data) {
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      const result = UIMemorySchema.safeParse(parsed);
      if (result.success) return result.data;
    }
  } catch {
    // Fall through to default
  }

  return { ...DEFAULT_MEMORY, userId, workspaceId };
}

// ── Save memory ─────────────────────────────────────────────────────

export async function saveMemory(
  memory: UIMemory,
  env: any
): Promise<void> {
  const result = UIMemorySchema.safeParse(memory);
  if (!result.success) {
    throw new Error(`Invalid memory: ${result.error.message}`);
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM ui_memory WHERE user_id = ? AND workspace_id = ?`
  )
    .bind(memory.userId, memory.workspaceId)
    .first();

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE ui_memory SET data = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(JSON.stringify(memory), existing.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO ui_memory (user_id, workspace_id, data, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(memory.userId, memory.workspaceId, JSON.stringify(memory))
      .run();
  }
}

// ── Update memory fields ────────────────────────────────────────────

export async function updateMemory(
  userId: string,
  workspaceId: string,
  updates: Partial<UIMemory>,
  env: any
): Promise<UIMemory> {
  const current = await getMemory(userId, workspaceId, env);
  const merged = { ...current, ...updates, userId, workspaceId };
  await saveMemory(merged, env);
  return merged;
}

// ── Build planner context with memory ───────────────────────────────

export async function buildPlannerContext(
  base: Omit<PlannerContext, 'memory'>,
  userId: string,
  env: any
): Promise<PlannerContext> {
  const memory = await getMemory(userId, base.workspaceId, env);
  return { ...base, memory };
}

// ── Memory priority (top wins) ──────────────────────────────────────
// 1. Authorization (role)
// 2. Accessibility (reducedMotion, largeText)
// 3. Workspace policy (excludedVariants)
// 4. Explicit user preference (density, preferredModules)
// 5. Aesthetic default

export function applyMemoryPriority(
  memory: UIMemory,
  componentTypes: string[]
): string[] {
  let filtered = [...componentTypes];

  // 1. Authorization — role-based filtering
  if (memory.role === 'customer') {
    // Customers don't see internal admin components
    filtered = filtered.filter(
      (t) => !t.includes('admin') && !t.includes('internal')
    );
  }

  // 2. Accessibility — reduced motion
  if (memory.accessibility.reducedMotion) {
    filtered = filtered.filter(
      (t) => !t.includes('carousel') && !t.includes('animation')
    );
  }

  // 3. Workspace policy — excluded variants
  if (memory.excludedVariants.length > 0) {
    filtered = filtered.filter(
      (t) => !memory.excludedVariants.includes(t)
    );
  }

  // 4. User preference — preferred modules
  if (memory.preferredModules.length > 0) {
    // Boost preferred modules to front
    const preferred = filtered.filter((t) =>
      memory.preferredModules.some((m) => t.includes(m))
    );
    const others = filtered.filter(
      (t) => !memory.preferredModules.some((m) => t.includes(m))
    );
    filtered = [...preferred, ...others];
  }

  return filtered;
}
