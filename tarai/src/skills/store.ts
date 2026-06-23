import { getUserDb, getGlobalDb } from '@/lib/db';
import { vectorToText } from '@/lib/vectorStore';
import type { SkillDef } from './definitions';

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;
let seedPromise: Promise<void> | null = null;

export function setSkillEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
}

export interface SkillSearchResult {
  skill: SkillDef;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Seed: embed all skills into memory table (both global + user)
// ---------------------------------------------------------------------------

export async function seedSkills(): Promise<void> {
  if (!embeddingFn) {
    console.warn('[SKILLS] embedding fn not set, skipping seed');
    return;
  }
  if (seedPromise) return seedPromise;
  seedPromise = doSeedSkills(embeddingFn);
  try {
    await seedPromise;
  } finally {
    seedPromise = null;
  }
}

async function doSeedSkills(embed: (text: string) => Promise<number[]>): Promise<void> {
  try {
    // Seed built-in skills from global.db
    const globalDb = getGlobalDb();
    const globalRows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    // Seed user's custom skills
    const userDb = getUserDb();
    const userRows = await userDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const allRows = [...(globalRows as any[]), ...(userRows as any[])];

    let count = 0;
    for (const row of allRows) {
      const data = JSON.parse(String(row.data || '{}'));
      const textToEmbed = [
        String(row.title || ''),
        data.description || '',
        ...(data.keywords ?? []),
      ].join('. ');

      const vector = await embed(textToEmbed);
      const vecText = vectorToText(vector);

      // Embed into the appropriate DB's memory table
      const db = row.id.startsWith('tool_') && !row.id.includes('_custom_')
        ? globalDb
        : userDb;

      await db.run(
        'INSERT OR REPLACE INTO memory (form, chunk, vector, embedding) VALUES (?, 0, vector32(?), vector32(?))',
        [row.id, vecText, vecText]
      );
      count++;
    }

    console.log(`[SKILLS] seeded ${count} skills into memory`);
  } catch (e) {
    console.error('[SKILLS] seed failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Persist + embed a single skill (used by AI generation)
// ---------------------------------------------------------------------------

export async function persistAndEmbedSkill(
  embed: (text: string) => Promise<number[]>,
  skill: SkillDef
): Promise<void> {
  const db = getUserDb();
  const data = JSON.stringify({
    description: skill.description,
    vertical: skill.vertical,
    fields: skill.fields,
    keywords: skill.keywords,
    creates: skill.creates,
    execute: skill.execute,
    custom: skill.custom,
    builtIn: skill.builtIn,
  });

  await db.run(
    'INSERT OR REPLACE INTO form (id, type, title, scope, public, data, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [skill.id, 'tool', skill.name, 'p', 0, data]
  );

  const textToEmbed = [skill.name, skill.description, ...(skill.keywords ?? [])].join('. ');
  const vector = await embed(textToEmbed);
  const vecText = vectorToText(vector);
  await db.run(
    'INSERT OR REPLACE INTO memory (form, chunk, vector, embedding) VALUES (?, 0, vector32(?), vector32(?))',
    [skill.id, vecText, vecText]
  );
}

/**
 * Create a custom (AI-generated) skill: persist + embed + make available
 * via searchSkills. Saved to user's private DB.
 */
export async function createCustomSkill(skill: SkillDef): Promise<void> {
  if (!embeddingFn) throw new Error('Embedding model not loaded');
  await persistAndEmbedSkill(embeddingFn, { ...skill, custom: true });
  console.log(`[SKILLS] custom skill created: ${skill.id} — "${skill.name}"`);
}

// ---------------------------------------------------------------------------
// Load skills from both DBs
// ---------------------------------------------------------------------------

function reconstructSkillFromRow(row: any): SkillDef | null {
  try {
    const data = JSON.parse(String(row.data || '{}'));
    return {
      id: String(row.id),
      name: String(row.title || 'Untitled Skill'),
      description: data.description || '',
      vertical: data.vertical || 'general',
      icon: data.custom ? 'sparkles-outline' : 'document-outline',
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      fields: Array.isArray(data.fields) ? data.fields : [],
      execute: typeof data.execute === 'function' ? data.execute : undefined,
      creates: data.creates || undefined,
      custom: Boolean(data.custom),
      builtIn: Boolean(data.builtIn),
    };
  } catch {
    return null;
  }
}

/**
 * Load all skills: built-in from global.db + custom from user DB.
 */
export async function loadAllSkills(): Promise<SkillDef[]> {
  try {
    const globalDb = getGlobalDb();
    const userDb = getUserDb();

    const globalRows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const userRows = await userDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const skills: SkillDef[] = [];
    for (const row of [...(globalRows as any[]), ...(userRows as any[])]) {
      const skill = reconstructSkillFromRow(row);
      if (skill) skills.push(skill);
    }

    // Sort: built-in first, then custom, alphabetically within each group
    skills.sort((a, b) => {
      if (a.builtIn && !b.builtIn) return -1;
      if (!a.builtIn && b.builtIn) return 1;
      return a.name.localeCompare(b.name);
    });

    return skills;
  } catch {
    return [];
  }
}

/**
 * Load only public skills (for marketplace / import).
 */
export async function loadPublicSkills(): Promise<SkillDef[]> {
  try {
    const globalDb = getGlobalDb();
    const rows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND public = 1 AND active = 1"
    ).catch(() => []);

    const skills: SkillDef[] = [];
    for (const row of rows as any[]) {
      const skill = reconstructSkillFromRow(row);
      if (skill) skills.push(skill);
    }
    return skills;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search: vector + text fallback across both DBs
// ---------------------------------------------------------------------------

function textSearchSkills(allSkills: SkillDef[], query: string, limit: number): SkillSearchResult[] {
  const q = query.toLowerCase();
  const scored = allSkills
    .map((skill) => {
      let score = 0;
      if (skill.name.toLowerCase().includes(q)) score += 3;
      if (skill.description.toLowerCase().includes(q)) score += 1;
      if (skill.keywords?.some((kw) => kw.toLowerCase().includes(q))) score += 2;
      return { skill, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ skill, score }) => ({ skill, similarity: score / 5 }));
}

export async function searchSkills(query: string, limit = 5, minSimilarity = 0.2): Promise<SkillSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const globalDb = getGlobalDb();
    const userDb = getUserDb();

    // Load all skills from both DBs into a map
    const globalRows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const userRows = await userDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const skillMap = new Map<string, SkillDef>();
    for (const row of [...(globalRows as any[]), ...(userRows as any[])]) {
      const s = reconstructSkillFromRow(row);
      if (s) skillMap.set(s.id, s);
    }

    const allSkills = Array.from(skillMap.values());

    // Text fallback always runs
    const textResults = textSearchSkills(allSkills, query, limit);

    // Vector search only when model is ready
    if (embeddingFn) {
      try {
        const queryVector = await embeddingFn(query);
        const vecText = vectorToText(queryVector);

        // Search memory in both DBs
        const globalVecRows = await globalDb.all(
          `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
             FROM memory m JOIN form f ON f.id = m.form AND f.type = 'tool'
             GROUP BY m.form ORDER BY dist LIMIT ?`,
          [vecText, limit]
        ).catch(() => []);

        const userVecRows = await userDb.all(
          `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
             FROM memory m JOIN form f ON f.id = m.form AND f.type = 'tool'
             GROUP BY m.form ORDER BY dist LIMIT ?`,
          [vecText, limit]
        ).catch(() => []);

        const vecResults: SkillSearchResult[] = [];
        for (const row of [...(globalVecRows as any[]), ...(userVecRows as any[])]) {
          const skill = skillMap.get(String(row.form));
          if (!skill || row.dist == null) continue;
          const similarity = 1 - Number(row.dist);
          if (similarity >= minSimilarity) vecResults.push({ skill, similarity });
        }

        // Merge: vector results first, then text-only hits
        const seen = new Set(vecResults.map((r) => r.skill.id));
        const merged = [...vecResults];
        for (const t of textResults) {
          if (!seen.has(t.skill.id)) merged.push(t);
        }
        return merged.slice(0, limit);
      } catch {
        // Vector search failed, fall through to text-only
      }
    }

    return textResults;
  } catch (e) {
    console.error('[SKILLS] search failed:', e);
    return [];
  }
}
