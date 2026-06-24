import { getGlobalDb } from '@/lib/db';
import { vectorToText } from '@/lib/vectorStore';
import type { SkillDef } from './definitions';
import * as api from './api';

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;
let seedPromise: Promise<void> | null = null;
let currentUserId: string | null = null;

export function setSkillEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
}

export function setSkillUserId(userId: string) {
  currentUserId = userId;
}

export interface SkillSearchResult {
  skill: SkillDef;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Seed: embed built-in skills into local memory table
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
    const globalDb = getGlobalDb();
    const rows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    let count = 0;
    for (const row of rows as any[]) {
      const data = JSON.parse(String(row.data || '{}'));
      const textToEmbed = [
        String(row.title || ''),
        data.description || '',
        ...(data.keywords ?? []),
      ].join('. ');

      const vector = await embed(textToEmbed);
      const vecText = vectorToText(vector);

      await globalDb.run(
        'INSERT OR REPLACE INTO memory (form, chunk, vector, embedding) VALUES (?, 0, vector32(?), vector32(?))',
        [row.id, vecText, vecText]
      );
      count++;
    }

    console.log(`[SKILLS] seeded ${count} built-in skills into memory`);
  } catch (e) {
    console.error('[SKILLS] seed failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Create custom skill → save to Turso cloud
// ---------------------------------------------------------------------------

export async function createCustomSkill(skill: SkillDef): Promise<void> {
  if (!currentUserId) throw new Error('User not authenticated');

  await api.createSkill(currentUserId, {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    vertical: skill.vertical,
    icon: skill.icon,
    keywords: skill.keywords || [],
    fields: skill.fields,
    data: {
      creates: skill.creates,
      execute: skill.execute,
    },
  });

  console.log(`[SKILLS] custom skill created in cloud: ${skill.id}`);
}

// ---------------------------------------------------------------------------
// Load skills: built-in from global.db + custom from Turso cloud
// ---------------------------------------------------------------------------

function apiRecordToSkillDef(record: api.SkillRecord): SkillDef {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    vertical: record.vertical,
    icon: record.icon,
    keywords: record.keywords,
    fields: record.fields,
    creates: record.data?.creates,
    execute: typeof record.data?.execute === 'function' ? record.data.execute : undefined,
    custom: true,
  };
}

function localRowToSkillDef(row: any): SkillDef | null {
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

export async function loadAllSkills(): Promise<SkillDef[]> {
  try {
    // Built-in from local global.db
    const globalDb = getGlobalDb();
    const globalRows = await globalDb.all(
      "SELECT id, title, data FROM form WHERE type = 'tool' AND active = 1"
    ).catch(() => []);

    const skills: SkillDef[] = [];
    for (const row of globalRows as any[]) {
      const skill = localRowToSkillDef(row);
      if (skill) skills.push(skill);
    }

    // Custom from Turso cloud
    if (currentUserId) {
      try {
        const cloudSkills = await api.getSkillsByUser(currentUserId);
        for (const record of cloudSkills) {
          skills.push(apiRecordToSkillDef(record));
        }
      } catch (e) {
        console.warn('[SKILLS] failed to load cloud skills:', e);
      }
    }

    // Sort: built-in first, then custom, alphabetically
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

export async function loadPublicSkills(): Promise<SkillDef[]> {
  try {
    const records = await api.getPublicSkills();
    return records.map(apiRecordToSkillDef);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search: vector (local) + text (local + cloud)
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

  // Load all skills (built-in + custom)
  const allSkills = await loadAllSkills();

  // Text fallback always runs
  const textResults = textSearchSkills(allSkills, query, limit);

  // Vector search only when model is ready (searches local memory table)
  if (embeddingFn) {
    try {
      const globalDb = getGlobalDb();
      const queryVector = await embeddingFn(query);
      const vecText = vectorToText(queryVector);

      const vecRows = await globalDb.all(
        `SELECT m.form AS form, MIN(vector_distance_cos(m.vector, vector32(?))) AS dist
           FROM memory m JOIN form f ON f.id = m.form AND f.type = 'tool'
           GROUP BY m.form ORDER BY dist LIMIT ?`,
        [vecText, limit]
      ).catch(() => []);

      const skillMap = new Map(allSkills.map((s) => [s.id, s]));
      const vecResults: SkillSearchResult[] = [];

      for (const row of vecRows as any[]) {
        const skill = skillMap.get(String(row.form));
        if (!skill || row.dist == null) continue;
        const similarity = 1 - Number(row.dist);
        if (similarity >= minSimilarity) vecResults.push({ skill, similarity });
      }

      // Merge: vector first, then text-only
      const seen = new Set(vecResults.map((r) => r.skill.id));
      const merged = [...vecResults];
      for (const t of textResults) {
        if (!seen.has(t.skill.id)) merged.push(t);
      }
      return merged.slice(0, limit);
    } catch {
      // Fall through to text-only
    }
  }

  return textResults;
}

// ---------------------------------------------------------------------------
// Share / Import
// ---------------------------------------------------------------------------

export async function shareSkill(skillId: string): Promise<void> {
  await api.shareSkill(skillId);
}

export async function unshareSkill(skillId: string): Promise<void> {
  await api.unshareSkill(skillId);
}

export async function importSkill(skillId: string): Promise<string> {
  if (!currentUserId) throw new Error('User not authenticated');
  return api.importSkill(skillId, currentUserId);
}

export async function deleteSkill(skillId: string): Promise<void> {
  await api.deleteSkill(skillId);
}
