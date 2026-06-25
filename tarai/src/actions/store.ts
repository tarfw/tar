import { getGlobalDb, getUserDb } from '@/lib/db';
import { vectorToText } from '@/lib/vectorStore';
import type { ActionDef, ActionType } from './definitions';
import { BUILT_IN_ACTIONS } from './seed';

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;
let seedPromise: Promise<void> | null = null;
let currentUserId: string | null = null;

export function setActionEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
}

export function setActionUserId(userId: string) {
  currentUserId = userId;
}

export interface ActionSearchResult {
  action: ActionDef;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Seed: embed built-in actions into local memory table
// ---------------------------------------------------------------------------

export async function seedActions(): Promise<void> {
  if (!embeddingFn) {
    console.warn('[ACTIONS] embedding fn not set, skipping seed');
    return;
  }
  if (seedPromise) return seedPromise;
  seedPromise = doSeedActions(embeddingFn);
  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

async function doSeedActions(embed: (text: string) => Promise<number[]>): Promise<void> {
  try {
    const globalDb = getGlobalDb();
    const rows = await globalDb.all(
      "SELECT id, name, description, keywords FROM action WHERE scope = 'g'"
    ).catch(() => []);

    let count = 0;
    for (const row of rows as any[]) {
      const keywords = JSON.parse(row.keywords || '[]');
      const textToEmbed = [
        String(row.name || ''),
        row.description || '',
        ...(keywords ?? []),
      ].join('. ');

      const vector = await embed(textToEmbed);
      const vecText = vectorToText(vector);

      await globalDb.run(
        'INSERT OR REPLACE INTO memory (form, chunk, vector, embedding) VALUES (?, 0, vector32(?), vector32(?))',
        [row.id, vecText, vecText]
      );
      count++;
    }

    console.log(`[ACTIONS] seeded ${count} built-in actions into memory`);
  } catch (e) {
    console.error('[ACTIONS] seed failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Create custom action → save to SQLite local DB
// ---------------------------------------------------------------------------

export async function createCustomAction(action: ActionDef): Promise<void> {
  const db = getUserDb();
  await db.run(
    'INSERT OR REPLACE INTO action (id, creator_id, parent_id, scope, type, name, description, vertical, icon, keywords, fields, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      action.id,
      currentUserId || 'guest',
      null,
      'team',
      action.type,
      action.name,
      action.description,
      action.vertical,
      action.icon,
      JSON.stringify(action.keywords || []),
      JSON.stringify(action.fields),
      JSON.stringify({ creates: action.creates }),
    ]
  );

  console.log(`[ACTIONS] custom action created locally: ${action.id}`);

  // Embed the custom action dynamically for search
  if (embeddingFn) {
    try {
      const textToEmbed = [action.name, action.description, ...(action.keywords || [])].join('. ');
      const vector = await embeddingFn(textToEmbed);
      const vecText = vectorToText(vector);
      await db.run(
        'INSERT OR REPLACE INTO memory (form, chunk, vector, embedding) VALUES (?, 0, vector32(?), vector32(?))',
        [action.id, vecText, vecText]
      );
      console.log(`[ACTIONS] embedded custom action: ${action.id}`);
    } catch (e) {
      console.warn('[ACTIONS] embedding custom action failed:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Load actions: built-in from global.db + custom from user private DB
// ---------------------------------------------------------------------------

function localRowToActionDef(row: any, isCustom: boolean): ActionDef | null {
  try {
    const data = JSON.parse(String(row.data || '{}'));
    const keywords = JSON.parse(String(row.keywords || '[]'));
    const fields = JSON.parse(String(row.fields || '[]'));

    return {
      id: String(row.id),
      name: String(row.name || 'Untitled Action'),
      description: String(row.description || ''),
      vertical: String(row.vertical || 'general'),
      icon: String(row.icon || (isCustom ? 'sparkles-outline' : 'document-outline')),
      keywords: Array.isArray(keywords) ? keywords : [],
      fields: Array.isArray(fields) ? fields : [],
      type: (row.type as ActionType) || 'tool',
      creates: data.creates || undefined,
      custom: isCustom,
      builtIn: !isCustom,
    };
  } catch {
    return null;
  }
}

export async function loadAllActions(): Promise<ActionDef[]> {
  try {
    // 1. Built-in actions from global.db
    const globalDb = getGlobalDb();
    const globalRows = await globalDb.all(
      "SELECT * FROM action WHERE scope = 'g'"
    ).catch(() => []);

    const actions: ActionDef[] = [];
    for (const row of globalRows as any[]) {
      const action = localRowToActionDef(row, false);
      if (action) actions.push(action);
    }

    // 2. Custom actions from user private DB
    const userDb = getUserDb();
    const userRows = await userDb.all(
      "SELECT * FROM action WHERE scope != 'g'"
    ).catch(() => []);

    for (const row of userRows as any[]) {
      const action = localRowToActionDef(row, true);
      if (action) actions.push(action);
    }

    // Sort: built-in first, then custom, alphabetically
    actions.sort((a, b) => {
      if (a.builtIn && !b.builtIn) return -1;
      if (!a.builtIn && b.builtIn) return 1;
      return a.name.localeCompare(b.name);
    });

    return actions;
  } catch {
    return [];
  }
}

export async function loadPublicActions(): Promise<ActionDef[]> {
  // For local-first prototype, public actions are loaded from userDb with public = 1
  try {
    const userDb = getUserDb();
    const rows = await userDb.all(
      "SELECT * FROM action WHERE scope = 'public'"
    ).catch(() => []);
    return rows.map((r) => localRowToActionDef(r, true)).filter((a): a is ActionDef => a !== null);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search: vector (local) + text (local)
// ---------------------------------------------------------------------------

function textSearchActions(allActions: ActionDef[], query: string, limit: number): ActionSearchResult[] {
  const q = query.toLowerCase();
  const scored = allActions
    .map((action) => {
      let score = 0;
      if (action.name.toLowerCase().includes(q)) score += 3;
      if (action.description.toLowerCase().includes(q)) score += 1;
      if (action.keywords?.some((kw) => kw.toLowerCase().includes(q))) score += 2;
      return { action, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ action, score }) => ({ action, similarity: score / 5 }));
}

export async function searchActions(query: string, limit = 5, minSimilarity = 0.2): Promise<ActionSearchResult[]> {
  if (!query.trim()) return [];

  // Load all actions
  const allActions = await loadAllActions();

  // Text fallback always runs
  const textResults = textSearchActions(allActions, query, limit);

  // Vector search only when model is ready
  if (embeddingFn) {
    try {
      const globalDb = getGlobalDb();
      const userDb = getUserDb();
      const queryVector = await embeddingFn(query);
      const vecText = vectorToText(queryVector);

      // Search built-in memory
      const globalVecRows = await globalDb.all(
        `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
           FROM memory m JOIN action a ON a.id = m.form
           GROUP BY m.form ORDER BY dist LIMIT ?`,
        [vecText, limit]
      ).catch(() => []);

      // Search custom memory
      const userVecRows = await userDb.all(
        `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
           FROM memory m JOIN action a ON a.id = m.form
           GROUP BY m.form ORDER BY dist LIMIT ?`,
        [vecText, limit]
      ).catch(() => []);

      const vecRows = [...globalVecRows, ...userVecRows] as { form: any; dist: any }[];
      vecRows.sort((a, b) => Number(a.dist ?? 1) - Number(b.dist ?? 1));

      const actionMap = new Map(allActions.map((a) => [a.id, a]));
      const vecResults: ActionSearchResult[] = [];

      for (const row of vecRows) {
        const action = actionMap.get(String(row.form));
        if (!action || row.dist == null) continue;
        const similarity = 1 - Number(row.dist);
        if (similarity >= minSimilarity) {
          // Avoid duplicate entries if found in both databases
          if (!vecResults.some((r) => r.action.id === action.id)) {
            vecResults.push({ action, similarity });
          }
        }
      }

      // Merge: vector first, then text-only
      const seen = new Set(vecResults.map((r) => r.action.id));
      const merged = [...vecResults];
      for (const t of textResults) {
        if (!seen.has(t.action.id)) merged.push(t);
      }
      return merged.slice(0, limit);
    } catch {
      // Fall through to text-only
    }
  }

  return textResults;
}

// ---------------------------------------------------------------------------
// Share / Import / Delete
// ---------------------------------------------------------------------------

export async function shareAction(actionId: string): Promise<void> {
  const db = getUserDb();
  await db.run("UPDATE action SET scope = 'public' WHERE id = ?", [actionId]);
}

export async function unshareAction(actionId: string): Promise<void> {
  const db = getUserDb();
  await db.run("UPDATE action SET scope = 'team' WHERE id = ?", [actionId]);
}

export async function importAction(action: ActionDef): Promise<void> {
  await createCustomAction({
    ...action,
    custom: true,
    builtIn: false,
  });
}

export async function deleteAction(actionId: string): Promise<void> {
  const db = getUserDb();
  await db.run('DELETE FROM action WHERE id = ?', [actionId]);
  await db.run('DELETE FROM memory WHERE form = ?', [actionId]);
}

