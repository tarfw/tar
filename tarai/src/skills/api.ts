/**
 * Turso HTTP API client for custom skills.
 *
 * Built-in skills live in local global.db (no API calls).
 * Custom skills live in Turso cloud (CRUD via HTTP).
 *
 * Cost: ~$0.0001 per operation (serverless pricing).
 */

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL || '';
const TURSO_TOKEN = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN || '';

interface TursoRow {
  [key: string]: any;
}

interface TursoResponse {
  results: {
    cols: { name: string; decltype?: string }[];
    rows: TursoRow[];
    rows_affected?: number;
  }[];
}

async function execute(sql: string, args: any[] = []): Promise<TursoRow[]> {
  if (!TURSO_URL || !TURSO_TOKEN) {
    throw new Error('Turso credentials not configured');
  }

  const res = await fetch(`${TURSO_URL}/v1/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      args: args.map((a) => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Turso API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data: TursoResponse = await res.json();
  return data.results?.[0]?.rows || [];
}

async function executeNoReturn(sql: string, args: any[] = []): Promise<void> {
  if (!TURSO_URL || !TURSO_TOKEN) {
    throw new Error('Turso credentials not configured');
  }

  const res = await fetch(`${TURSO_URL}/v1/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      args: args.map((a) => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Turso API error ${res.status}: ${body.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Schema: ensure skills table exists in Turso cloud
// ---------------------------------------------------------------------------

export async function ensureSkillsTable(): Promise<void> {
  try {
    await executeNoReturn(`
      CREATE TABLE IF NOT EXISTS skill (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        vertical TEXT DEFAULT 'general',
        icon TEXT DEFAULT 'document-outline',
        keywords TEXT DEFAULT '[]',
        fields TEXT DEFAULT '[]',
        data TEXT DEFAULT '{}',
        public INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await executeNoReturn('CREATE INDEX IF NOT EXISTS idx_skill_user ON skill(user_id)');
    await executeNoReturn('CREATE INDEX IF NOT EXISTS idx_skill_public ON skill(public)');
    console.log('[SKILLS API] skills table ready');
  } catch (e) {
    console.warn('[SKILLS API] ensureSkillsTable failed:', e);
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface SkillRecord {
  id: string;
  user_id: string;
  name: string;
  description: string;
  vertical: string;
  icon: string;
  keywords: string[];
  fields: any[];
  data: Record<string, any>;
  public: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export async function createSkill(
  userId: string,
  skill: {
    id: string;
    name: string;
    description: string;
    vertical: string;
    icon: string;
    keywords: string[];
    fields: any[];
    data: Record<string, any>;
  }
): Promise<void> {
  await executeNoReturn(
    `INSERT INTO skill (id, user_id, name, description, vertical, icon, keywords, fields, data, public, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      skill.id,
      userId,
      skill.name,
      skill.description,
      skill.vertical,
      skill.icon,
      JSON.stringify(skill.keywords),
      JSON.stringify(skill.fields),
      JSON.stringify(skill.data),
    ]
  );
}

export async function getSkillsByUser(userId: string): Promise<SkillRecord[]> {
  const rows = await execute(
    'SELECT * FROM skill WHERE user_id = ? AND active = 1 ORDER BY name',
    [userId]
  );
  return rows.map(parseSkillRow);
}

export async function getPublicSkills(limit = 50): Promise<SkillRecord[]> {
  const rows = await execute(
    'SELECT * FROM skill WHERE public = 1 AND active = 1 ORDER BY name LIMIT ?',
    [limit]
  );
  return rows.map(parseSkillRow);
}

export async function getSkillById(skillId: string): Promise<SkillRecord | null> {
  const rows = await execute(
    'SELECT * FROM skill WHERE id = ? AND active = 1',
    [skillId]
  );
  return rows.length > 0 ? parseSkillRow(rows[0]) : null;
}

export async function updateSkill(
  skillId: string,
  updates: Partial<{
    name: string;
    description: string;
    vertical: string;
    icon: string;
    keywords: string[];
    fields: any[];
    data: Record<string, any>;
    public: number;
  }>
): Promise<void> {
  const sets: string[] = [];
  const args: any[] = [];

  if (updates.name !== undefined) { sets.push('name = ?'); args.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); args.push(updates.description); }
  if (updates.vertical !== undefined) { sets.push('vertical = ?'); args.push(updates.vertical); }
  if (updates.icon !== undefined) { sets.push('icon = ?'); args.push(updates.icon); }
  if (updates.keywords !== undefined) { sets.push('keywords = ?'); args.push(JSON.stringify(updates.keywords)); }
  if (updates.fields !== undefined) { sets.push('fields = ?'); args.push(JSON.stringify(updates.fields)); }
  if (updates.data !== undefined) { sets.push('data = ?'); args.push(JSON.stringify(updates.data)); }
  if (updates.public !== undefined) { sets.push('public = ?'); args.push(updates.public); }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  args.push(skillId);

  await executeNoReturn(
    `UPDATE skill SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
}

export async function deleteSkill(skillId: string): Promise<void> {
  await executeNoReturn(
    'UPDATE skill SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [skillId]
  );
}

export async function shareSkill(skillId: string): Promise<void> {
  await executeNoReturn(
    'UPDATE skill SET public = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [skillId]
  );
}

export async function unshareSkill(skillId: string): Promise<void> {
  await executeNoReturn(
    'UPDATE skill SET public = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [skillId]
  );
}

/**
 * Import a public skill: copy to user's collection with new ID.
 */
export async function importSkill(
  sourceSkillId: string,
  targetUserId: string
): Promise<string> {
  const source = await getSkillById(sourceSkillId);
  if (!source) throw new Error('Skill not found');

  const newId = `tool_${source.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;

  await createSkill(targetUserId, {
    id: newId,
    name: source.name,
    description: source.description,
    vertical: source.vertical,
    icon: source.icon,
    keywords: source.keywords,
    fields: source.fields,
    data: source.data,
  });

  return newId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSkillRow(row: TursoRow): SkillRecord {
  return {
    id: String(row.id || ''),
    user_id: String(row.user_id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    vertical: String(row.vertical || 'general'),
    icon: String(row.icon || 'document-outline'),
    keywords: safeJsonParse(row.keywords, []),
    fields: safeJsonParse(row.fields, []),
    data: safeJsonParse(row.data, {}),
    public: Number(row.public || 0),
    active: Number(row.active || 1),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function safeJsonParse(value: any, fallback: any): any {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value ?? fallback;
}
