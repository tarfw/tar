/**
 * Helper functions for calling tools and actions directly.
 * Uses Turso HTTP API via db.ts — no React Native dependencies.
 */

import { dbGet, dbAll, dbRun } from './db';

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

// ============================================================
// createMatter — Insert into form or matter table
// ============================================================
export async function createMatter(input: {
  table: 'form' | 'matter'; scope: string; type: string; form?: string;
  title?: string; value?: number; qty?: number; mark?: number;
  data?: Record<string, any>; owner?: string; [key: string]: any;
}) {
  const id = input.table === 'form'
    ? (input.code ? `form_${input.code}` : `form_${Date.now()}`)
    : `matter_${Date.now()}`;
  const now = new Date().toISOString();

  if (input.table === 'form') {
    await dbRun(
      `INSERT INTO form (id, type, scope, title, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, input.type, input.scope, input.title || null, JSON.stringify(input.data || {}), now]
    );
  } else {
    await dbRun(
      `INSERT INTO matter (id, form, type, scope, title, value, qty, mark, data, owner, time, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, input.form || '', input.type, input.scope, input.title || null, input.value ?? null, input.qty ?? null, input.mark ?? 0, JSON.stringify(input.data || {}), input.owner || null, now]
    );
  }

  return { id, time: now, status: 'created' };
}

// ============================================================
// getMatter — Read one record
// ============================================================
export async function getMatter(input: { table: string; scope?: string; id: string }) {
  const row = await dbGet(`SELECT * FROM ${input.table} WHERE id = ?`, [input.id]);
  if (row?.data) row.data = parseJson(row.data);
  return { rows: row ? [row] : [], count: row ? 1 : 0 };
}

// ============================================================
// listMatters — Read filtered list
// ============================================================
export async function listMatters(input: {
  table: string; scope?: string; type?: string; id?: string;
  active?: boolean; limit?: number; offset?: number;
  filters?: Array<{ key: string; val: any }>;
}) {
  let sql = `SELECT * FROM ${input.table} WHERE 1=1`;
  const args: any[] = [];

  if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
  if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
  if (input.type) { sql += ' AND type = ?'; args.push(input.type); }
  if (input.active !== undefined) { sql += ' AND active = ?'; args.push(input.active ? 1 : 0); }

  if (input.filters) {
    for (const f of input.filters) {
      sql += ` AND json_extract(data, ?) = ?`;
      args.push(`$.${f.key}`, f.val);
    }
  }

  sql += ' ORDER BY time DESC';
  sql += ` LIMIT ? OFFSET ?`;
  args.push(input.limit ?? 50, input.offset ?? 0);

  const rows = await dbAll(sql, args);
  return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

// ============================================================
// updateMatter — Update a record
// ============================================================
export async function updateMatter(input: {
  table: string; id: string; scope: string;
  patch: Record<string, any>; phase?: number; reason?: string;
}) {
  const now = new Date().toISOString();
  const sets: string[] = ['updated = ?'];
  const args: any[] = [now];

  for (const [key, val] of Object.entries(input.patch)) {
    if (val !== undefined) {
      if (key === 'data') {
        sets.push('data = ?');
        args.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = ?`);
        args.push(val);
      }
    }
  }

  args.push(input.id);
  await dbRun(`UPDATE ${input.table} SET ${sets.join(', ')} WHERE id = ?`, args);

  // Log update to motion
  if (input.table === 'matter') {
    const seq = Date.now();
    await dbRun(
      `INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 1001, ?, ?, ?)`,
      [input.id, seq, input.phase ?? null, JSON.stringify({ reason: input.reason || '', changed: Object.keys(input.patch) }), new Date().toISOString()]
    );
  }

  return { success: true, id: input.id, time: now };
}

// ============================================================
// appendMotion — Log event to motion table
// ============================================================
export async function appendMotion(input: {
  stream: string; action: number; phase?: number; delta?: number;
  client_ref?: string; data?: Record<string, any>; scope?: string;
}) {
  const nextSeqRes = await dbGet('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', [input.stream]);
  const seq = Number(nextSeqRes?.next ?? 1);
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.stream, seq, input.action, input.phase ?? null, input.delta ?? null, input.client_ref || null, JSON.stringify(input.data || {}), now]
  );

  return { stream: input.stream, seq };
}

// ============================================================
// setAttr — Set hot field (upsert)
// ============================================================
export async function setAttr(input: {
  matterId: string; key: string; val?: string; num?: number; ref?: string; scope?: string;
}) {
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO attr (matter, key, val, num, ref, time) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(matter, key) DO UPDATE SET val=excluded.val, num=excluded.num, ref=excluded.ref, time=excluded.time`,
    [input.matterId, input.key, input.val ?? null, input.num ?? null, input.ref ?? null, now]
  );
  return { matter: input.matterId, key: input.key, status: 'set' };
}

// ============================================================
// linkGraph — Create relationship edge
// ============================================================
export async function linkGraph(input: {
  src: string; rel: string; tgt: string; scope?: string;
  weight?: number; bidirectional?: boolean;
}) {
  const now = new Date().toISOString();
  await dbRun(
    `INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active, time) VALUES (?, ?, ?, ?, 1, ?)`,
    [input.src, input.rel, input.tgt, input.weight ?? 1.0, now]
  );
  if (input.bidirectional) {
    await dbRun(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active, time) VALUES (?, ?, ?, ?, 1, ?)`,
      [input.tgt, input.rel, input.src, input.weight ?? 1.0, now]
    );
  }
  return { src: input.src, rel: input.rel, tgt: input.tgt, status: 'linked' };
}

// ============================================================
// readMotions — Read event history
// ============================================================
export async function readMotions(input: {
  scope?: string; stream: string; seq_from?: number; seq_to?: number; limit?: number;
}) {
  let sql = 'SELECT * FROM motion WHERE stream = ?';
  const args: any[] = [input.stream];

  if (input.seq_from !== undefined) { sql += ' AND seq >= ?'; args.push(input.seq_from); }
  if (input.seq_to !== undefined) { sql += ' AND seq <= ?'; args.push(input.seq_to); }

  sql += ' ORDER BY seq ASC LIMIT ?';
  args.push(input.limit ?? 50);

  const rows = await dbAll(sql, args);
  return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

// ============================================================
// traverseGraph — Find relationships
// ============================================================
export async function traverseGraph(input: {
  scope: string; src?: string; rel?: string; tgt?: string; depth?: number; limit?: number;
}) {
  let sql = 'SELECT * FROM graph WHERE 1=1';
  const args: any[] = [];

  if (input.src) { sql += ' AND src = ?'; args.push(input.src); }
  if (input.rel) { sql += ' AND rel = ?'; args.push(input.rel); }
  if (input.tgt) { sql += ' AND tgt = ?'; args.push(input.tgt); }

  sql += ' AND active = 1';
  sql += ' LIMIT ?';
  args.push(input.limit ?? 50);

  const rows = await dbAll(sql, args);
  return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

// ============================================================
// readForm — Read config from form table
// ============================================================
export async function readForm(input: {
  scope: string; id?: string; type?: string; active?: boolean; limit?: number;
}) {
  let sql = 'SELECT * FROM form WHERE 1=1';
  const args: any[] = [];

  if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
  if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
  if (input.type) { sql += ' AND type = ?'; args.push(input.type); }
  if (input.active !== undefined) { sql += ' AND active = ?'; args.push(input.active ? 1 : 0); }

  sql += ' ORDER BY time DESC LIMIT ?';
  args.push(input.limit ?? 50);

  const rows = await dbAll(sql, args);
  return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

// ============================================================
// searchMemory — Semantic search
// ============================================================
export async function searchMemory(input: {
  query: string; scope?: string; type?: string; limit?: number;
}) {
  const words = input.query.toLowerCase().split(/\s+/).filter(w => w.trim());
  if (words.length === 0) return [];

  let sql = 'SELECT m.id, m.text, m.meta FROM memory m';
  const args: any[] = [];

  const likeClauses = words.map(() => 'LOWER(m.text) LIKE ?');
  sql += ` WHERE (${likeClauses.join(' AND ')})`;
  words.forEach(w => args.push(`%${w}%`));

  if (input.scope) {
    sql += " AND json_extract(m.meta, '$.scope') = ?";
    args.push(input.scope);
  }

  sql += ' LIMIT ?';
  args.push(input.limit ?? 10);

  const rows = await dbAll(sql, args);
  return rows.map(r => ({
    id: r.id,
    text: r.text || '',
    meta: parseJson(r.meta),
    similarity: 0.8,
    source: 'fts',
  }));
}

// ============================================================
// storeMemory — Store embedding
// ============================================================
export async function storeMemory(input: {
  id: string; chunk?: number; matter?: string; text: string;
  embedding: string; meta?: Record<string, any>; scope?: string;
}) {
  const chunk = input.chunk ?? 0;
  await dbRun(
    `INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta) VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, chunk, input.matter ?? null, input.text, input.embedding, JSON.stringify(input.meta || {})]
  );
  return { id: input.id, chunk, status: 'stored' };
}
