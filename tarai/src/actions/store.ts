import { getUserDb } from '@/lib/db';
import { vectorToText } from '@/lib/vectorStore';
import type { ActionDef, ActionType } from './definitions';

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
    const db = getUserDb();
    const rows = await db.all(
      "SELECT id, title, data FROM form WHERE type = 'action' AND scope = 'g'"
    ).catch(() => []);

    let count = 0;
    for (const row of rows as any[]) {
      let description = '';
      let keywords: string[] = [];
      try {
        const parsedData = JSON.parse(row.data || '{}');
        description = parsedData.description || '';
        keywords = parsedData.keywords || [];
      } catch (_) {}

      const textToEmbed = [
        String(row.title || ''),
        description,
        ...keywords,
      ].join('. ');

      const vector = await embed(textToEmbed);
      const vecText = vectorToText(vector);

      const meta = JSON.stringify({
        table: 'form',
        scope: 'g',
        type: 'action',
        title: row.title || '',
        owner: null
      });

      await db.run(
        'INSERT OR REPLACE INTO memory (id, chunk, text, embedding, meta) VALUES (?, 0, ?, vector32(?), ?)',
        [row.id, textToEmbed, vecText, meta]
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
  const nowStr = new Date().toISOString();
  const creator = currentUserId || 'guest';

  await db.run(
    'INSERT OR REPLACE INTO form (id, code, type, scope, owner, title, public, active, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [
      action.id,
      action.id,
      'action',
      'team',
      creator,
      action.name,
      0,
      JSON.stringify({
        type: action.type,
        description: action.description,
        vertical: action.vertical,
        icon: action.icon,
        keywords: action.keywords || [],
        fields: action.fields,
        creates: action.creates,
      }),
      nowStr,
    ]
  );

  console.log(`[ACTIONS] custom action created locally: ${action.id}`);

  // Embed the custom action dynamically for search
  if (embeddingFn) {
    try {
      const textToEmbed = [action.name, action.description, ...(action.keywords || [])].join('. ');
      const vector = await embeddingFn(textToEmbed);
      const vecText = vectorToText(vector);
      
      const meta = JSON.stringify({
        table: 'form',
        scope: 'team',
        type: 'action',
        title: action.name,
        owner: creator
      });

      await db.run(
        'INSERT OR REPLACE INTO memory (id, chunk, text, embedding, meta) VALUES (?, 0, ?, vector32(?), ?)',
        [action.id, textToEmbed, vecText, meta]
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
    return {
      id: String(row.id),
      name: String(row.title || 'Untitled Action'),
      description: String(data.description || ''),
      vertical: String(data.vertical || 'general'),
      icon: String(data.icon || (isCustom ? 'sparkles-outline' : 'document-outline')),
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      fields: Array.isArray(data.fields) ? data.fields : [],
      type: (data.type as ActionType) || 'tool',
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
    const userDb = getUserDb();

    // 1. Built-in actions (type = 'action', scope = 'g')
    const globalRows = await userDb.all(
      "SELECT * FROM form WHERE type = 'action' AND scope = 'g'"
    ).catch(() => []);

    const actions: ActionDef[] = [];
    for (const row of globalRows as any[]) {
      const action = localRowToActionDef(row, false);
      if (action) actions.push(action);
    }

    // 2. Custom actions (type = 'action', scope != 'g')
    const userRows = await userDb.all(
      "SELECT * FROM form WHERE type = 'action' AND scope != 'g'"
    ).catch(() => []);

    for (const row of userRows as any[]) {
      const action = localRowToActionDef(row, true);
      if (action) actions.push(action);
    }

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

  const allActions = await loadAllActions();
  const textResults = textSearchActions(allActions, query, limit);

  if (embeddingFn) {
    try {
      const userDb = getUserDb();
      const queryVector = await embeddingFn(query);
      const vecText = vectorToText(queryVector);

      const userVecRows = await userDb.all(
        `SELECT m.id AS id, MIN(vector_distance_cos(m.embedding, vector32(?))) AS dist
           FROM memory m JOIN form f ON f.id = m.id
           WHERE f.type = 'action'
           GROUP BY m.id ORDER BY dist LIMIT ?`,
        [vecText, limit]
      ).catch(() => []);

      const vecRows = userVecRows as { id: any; dist: any }[];
      vecRows.sort((a, b) => Number(a.dist ?? 1) - Number(b.dist ?? 1));

      const actionMap = new Map(allActions.map((a) => [a.id, a]));
      const vecResults: ActionSearchResult[] = [];

      for (const row of vecRows) {
        const action = actionMap.get(String(row.id));
        if (!action || row.dist == null) continue;
        const similarity = 1 - Number(row.dist);
        if (similarity >= minSimilarity) {
          if (!vecResults.some((r) => r.action.id === action.id)) {
            vecResults.push({ action, similarity });
          }
        }
      }

      const seen = new Set(vecResults.map((r) => r.action.id));
      const merged = [...vecResults];
      for (const t of textResults) {
        if (!seen.has(t.action.id)) merged.push(t);
      }
      return merged.slice(0, limit);
    } catch {
      // Fall through to textResults
    }
  }

  return textResults;
}

// ---------------------------------------------------------------------------
// Share / Import / Delete
// ---------------------------------------------------------------------------

export async function shareAction(actionId: string): Promise<void> {
  const db = getUserDb();
  await db.run("UPDATE form SET scope = 'public' WHERE id = ? AND type = 'action'", [actionId]);
}

export async function unshareAction(actionId: string): Promise<void> {
  const db = getUserDb();
  await db.run("UPDATE form SET scope = 'team' WHERE id = ? AND type = 'action'", [actionId]);
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
  await db.run("DELETE FROM form WHERE id = ? AND type = 'action'", [actionId]);
  await db.run('DELETE FROM memory WHERE id = ?', [actionId]);
}

export async function loadPublicActions(): Promise<ActionDef[]> {
  try {
    const userDb = getUserDb();
    const rows = await userDb.all(
      "SELECT * FROM form WHERE type = 'action' AND scope = 'public'"
    ).catch(() => []);

    const actions: ActionDef[] = [];
    for (const row of rows as any[]) {
      const action = localRowToActionDef(row, true);
      if (action) actions.push(action);
    }
    return actions;
  } catch {
    return [];
  }
}
