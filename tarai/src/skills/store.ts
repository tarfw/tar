import * as SecureStore from 'expo-secure-store';
import { getUserDb } from '@/lib/db';
import { vectorToText } from '@/lib/vectorStore';
import { SKILLS, type SkillDef } from './definitions';

// v4: chunked embeddings — one vector per skill embedding text. Bumping forces
// a one-time re-seed with the chunked memory schema.
const SKILL_SYNC_KEY = 'tar_skills_synced_v4_chunked';

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;

let seedPromise: Promise<void> | null = null;

export function setSkillEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
}

export interface SkillSearchResult {
  skill: SkillDef;
  similarity: number;
}

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

/** Persist a skill to form table + embed into memory (chunk=0). */
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
    custom: skill.custom,
  });

  await db.run(
    'INSERT OR REPLACE INTO form (id, type, title, scope, data, active) VALUES (?, ?, ?, ?, ?, 1)',
    [skill.id, 'tool', skill.name, 'p', data]
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
 * via searchSkills. Uses the module's live embedding function.
 */
export async function createCustomSkill(skill: SkillDef): Promise<void> {
  if (!embeddingFn) throw new Error('Embedding model not loaded');
  await persistAndEmbedSkill(embeddingFn, { ...skill, custom: true });
  console.log(`[SKILLS] custom skill created: ${skill.id} — "${skill.name}"`);
}

/**
 * Load all skills (static built-ins + custom from DB) for the screen's
 * default list. Custom skills are reconstructed from the form.data JSON.
 */
export async function loadAllSkills(): Promise<SkillDef[]> {
  const builtInIds = new Set(SKILLS.map((s) => s.id));
  try {
    const db = getUserDb();
    const rows = await db.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);
    const custom: SkillDef[] = [];
    for (const row of rows as any[]) {
      if (builtInIds.has(String(row.id))) continue;
      const skill = reconstructSkillFromRow(row);
      if (skill) custom.push(skill);
    }
    return [...SKILLS, ...custom];
  } catch {
    return [...SKILLS];
  }
}

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
      creates: data.creates || undefined,
      custom: true,
    };
  } catch {
    return null;
  }
}

async function doSeedSkills(embed: (text: string) => Promise<number[]>): Promise<void> {
  try {
    const synced = await SecureStore.getItemAsync(SKILL_SYNC_KEY);
    if (synced) return;

    console.log(`[SKILLS] seeding ${SKILLS.length} built-in skills…`);
    const db = getUserDb();
    let verified = false;

    for (const skill of SKILLS) {
      await persistAndEmbedSkill(embed, skill);

      if (!verified) {
        const vecText = vectorToText(await embed([skill.name, skill.description, ...(skill.keywords ?? [])].join('. ')));
        const row = await db.get('SELECT vector_distance_cos(vector, vector32(?)) AS dist FROM memory WHERE form = ?', [vecText, skill.id]);
        const sim = row?.dist != null ? 1 - Number(row.dist) : NaN;
        console.log(`[SKILLS]   round-trip check: similarity=${sim.toFixed(4)} (expect ~1.0)`);
        verified = true;
      }

      console.log(`[SKILLS]   ✓ ${skill.name}`);
    }

    await SecureStore.setItemAsync(SKILL_SYNC_KEY, 'true');
    console.log(`[SKILLS] seed complete — ${SKILLS.length} skills indexed`);
  } catch (e) {
    console.error('[SKILLS] seed failed:', e);
  }
}

export async function searchSkills(query: string, limit = 5, minSimilarity = 0.2): Promise<SkillSearchResult[]> {
  if (!embeddingFn || !query.trim()) return [];

  try {
    const queryVector = await embeddingFn(query);
    const db = getUserDb();
    const skillMap = new Map(SKILLS.map((t) => [t.id, t]));

    // Also load custom skills into the map so they can appear in results
    const customRows = await db.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);
    for (const row of customRows as any[]) {
      if (!skillMap.has(String(row.id))) {
        const s = reconstructSkillFromRow(row);
        if (s) skillMap.set(s.id, s);
      }
    }

    const rows = await db.all(
      `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
         FROM memory m JOIN form f ON f.id = m.form AND f.type = 'tool'
         GROUP BY m.form ORDER BY dist LIMIT ?`,
      [vectorToText(queryVector), limit]
    ).catch((err) => {
      console.warn('[SKILLS] native distance query failed:', err);
      return [];
    });

    const results: SkillSearchResult[] = [];
    for (const row of rows as any[]) {
      const skill = skillMap.get(String(row.form));
      if (!skill || row.dist == null) continue;
      const similarity = 1 - Number(row.dist);
      if (similarity >= minSimilarity) results.push({ skill, similarity });
    }
    return results;
  } catch (e) {
    console.error('[SKILLS] search failed:', e);
    return [];
  }
}
