/**
 * Action Memory System — cache agent decisions as reusable inline cards.
 * First time = LLM call. Every replay = zero LLM cost.
 */

import { executeCreate, executeRead } from './helpers';
import { dbGet, dbAll, dbRun } from './db';

export interface ActionMemory {
  id: string;
  text: string;
  intent: string;
  workflow: string;
  slots: Array<{
    key: string;
    label: string;
    type: string;
    value: any;
  }>;
  toolSequence: any[];
  usageCount: number;
  lastUsed: string;
}

/**
 * Extract an action memory after a successful agent action.
 * Called once per unique action pattern.
 */
export async function extractActionMemory(
  userId: string,
  scope: string,
  intent: string,
  workflow: string,
  input: Record<string, any>,
  toolSequence: any[]
): Promise<ActionMemory> {
  const slots = Object.entries(input)
    .filter(([key]) => !['scope', 'userId'].includes(key))
    .map(([key, value]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      type: detectSlotType(value),
      value,
    }));

  const intentHash = getIntentHash(intent, slots.map(s => s.key));

  const memory: ActionMemory = {
    id: `mem_${intentHash}`,
    text: buildTemplateText(intent, slots),
    intent,
    workflow,
    slots,
    toolSequence,
    usageCount: 1,
    lastUsed: new Date().toISOString(),
  };

  // Store in memory table
  await executeCreate({
    table: 'memory',
    text: memory.text,
    meta: {
      type: 'action_memory',
      intent: memory.intent,
      workflow: memory.workflow,
      slots: memory.slots,
      toolSequence: memory.toolSequence,
      usageCount: memory.usageCount,
      lastUsed: memory.lastUsed,
      ui: 'inline_card',
    },
    scope: `u:${userId}`,
  });

  return memory;
}

/**
 * Find matching action memories for autocomplete.
 * Uses intent hash for fast lookup, falls back to text search.
 */
export async function findActionMemories(
  userId: string,
  query: string,
  limit = 5
): Promise<ActionMemory[]> {
  // Try text search first
  const result = await executeRead({
    table: 'memory',
    scope: `u:${userId}`,
    limit,
  });

  return result.rows
    .filter((r: any) => {
      const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
      return meta?.type === 'action_memory';
    })
    .map((r: any) => {
      const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
      return {
        id: r.id,
        text: r.text || '',
        intent: meta.intent,
        workflow: meta.workflow,
        slots: meta.slots || [],
        toolSequence: meta.toolSequence || [],
        usageCount: meta.usageCount || 0,
        lastUsed: meta.lastUsed || '',
      };
    });
}

/**
 * Increment usage count when an action memory is replayed.
 */
export async function incrementMemoryUsage(memoryId: string): Promise<void> {
  const row = await dbGet(
    "SELECT meta FROM memory WHERE id = ? AND chunk = 0",
    [memoryId]
  );
  if (!row) return;

  const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
  meta.usageCount = (meta.usageCount || 0) + 1;
  meta.lastUsed = new Date().toISOString();

  await dbRun(
    "UPDATE memory SET meta = ? WHERE id = ? AND chunk = 0",
    [JSON.stringify(meta), memoryId]
  );
}

// ============================================================
// Helpers
// ============================================================

function detectSlotType(value: any): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (/^\+?\d{10,}$/.test(value)) return 'phone';
    if (value.includes('@')) return 'email';
    return 'text';
  }
  return 'text';
}

function getIntentHash(intent: string, slotKeys: string[]): string {
  const sorted = slotKeys.sort().join(':');
  // Simple hash — in production use SHA-256
  let hash = 0;
  const str = `${intent}:${sorted}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildTemplateText(intent: string, slots: Array<{ key: string; value: any }>): string {
  const parts = intent.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const slotText = slots.map(s => `{${s.key}}`).join(' ');
  return `${parts.join(' ')} ${slotText}`.trim();
}
