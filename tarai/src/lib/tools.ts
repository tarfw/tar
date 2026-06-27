import { getUserDb, routeDbForEntity } from './db';
import { upsertFormVector, deleteFormVector, searchFormVectors } from './vectorStore';
import { getCallerId, requireOwner } from './acl';
import type { Database } from '@tursodatabase/sync-react-native';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;

  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function parseJson(value: any): any {
  if (!value) return {};
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

/**
 * Validate matter data against a blueprint schema.
 * Schema format: { field: 'string|required' | 'number' | 'array|required' | ... }
 */
function validateSchema(data: Record<string, any>, schema: Record<string, string>): void {
  for (const [key, rule] of Object.entries(schema)) {
    const parts = rule.split('|');
    const type = parts[0];
    const required = parts.includes('required');
    const value = data[key];

    if (required && (value === undefined || value === null || value === '')) {
      throw new Error(`Validation failed: ${key} is required`);
    }

    if (value !== undefined && value !== null) {
      if (type === 'string' && typeof value !== 'string') {
        throw new Error(`Validation failed: ${key} must be string`);
      }
      if (type === 'number' && typeof value !== 'number') {
        throw new Error(`Validation failed: ${key} must be number`);
      }
      if (type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(`Validation failed: ${key} must be boolean`);
      }
      if (type === 'array' && !Array.isArray(value)) {
        throw new Error(`Validation failed: ${key} must be array`);
      }
      if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        throw new Error(`Validation failed: ${key} must be object`);
      }
    }
  }
}

async function checkClientRefIdempotent(
  db: Database,
  stream: string,
  clientRef: string | undefined
): Promise<any | null> {
  if (!clientRef) return null;
  const motion = await db.get(
    'SELECT * FROM motion WHERE stream = ? AND client_ref = ? ORDER BY seq DESC LIMIT 1',
    [stream, clientRef]
  ).catch(() => null);
  if (!motion) return null;
  const record = await db.get(
    'SELECT * FROM form WHERE id = ? UNION ALL SELECT * FROM matter WHERE id = ?',
    [stream, stream]
  ).catch(() => null);
  return record || null;
}

/**
 * Tool 1: create
 * Inserts a form or matter record, inserts optional links, logs motion, and indexes vector.
 */
export async function create(opts: {
  table: 'form' | 'matter';
  scope: string;
  type: string;
  code?: string;
  form?: string;
  owner?: string;
  title?: string;
  public?: boolean;
  qty?: number;
  value?: number;
  variant?: number;
  mark?: number;
  geo?: string;
  start?: string;
  end?: string;
  data?: any;
  links?: { src: string; rel: string; tgt: string; weight?: number }[];
  motion?: { action: number; phase?: number; delta?: number };
  embed?: boolean;
  client_ref?: string;
}) {
  const db = routeDbForEntity(opts.table, opts.scope);
  const id = opts.table === 'form'
    ? (opts.code ? `form_${opts.code}` : generateId('form'))
    : generateId('matter');

  const nowStr = new Date().toISOString();
  const owner = opts.owner ?? getCallerId();

  // Idempotency check
  if (opts.client_ref) {
    const existing = await checkClientRefIdempotent(db, id, opts.client_ref);
    if (existing) {
      return { id: existing.id, time: existing.time, status: 'created' };
    }
  }

  // Validate form blueprint if provided
  if (opts.table === 'matter' && opts.form) {
    const blueprint = await db.get('SELECT data FROM form WHERE id = ?', [opts.form]).catch(() => null);
    if (blueprint?.data) {
      const bpData = parseJson(blueprint.data);
      if (bpData.schema) {
        try {
          validateSchema(opts.data || {}, bpData.schema);
        } catch (e: any) {
          throw new Error(`[TOOLS] Schema validation failed: ${e.message}`);
        }
      }
    }
  }

  // 1. Insert into database table
  if (opts.table === 'form') {
    await db.run(
      `INSERT INTO form (id, code, type, scope, owner, title, public, active, data, time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        opts.code || null,
        opts.type,
        opts.scope,
        owner,
        opts.title || null,
        opts.public ? 1 : 0,
        JSON.stringify(opts.data || {}),
        nowStr
      ]
    );
  } else {
    const mergedData = { ...(opts.data || {}) };
    if (opts.title && !mergedData.title) {
      mergedData.title = opts.title;
    }
    await db.run(
      `INSERT INTO matter (id, form, type, scope, qty, value, active, variant, mark, geo, start, end, data, owner, time)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        opts.form || '',
        opts.type,
        opts.scope,
        opts.qty ?? null,
        opts.value ?? null,
        opts.variant ?? null,
        opts.mark ?? 0,
        opts.geo || null,
        opts.start || null,
        opts.end || null,
        JSON.stringify(mergedData),
        owner,
        nowStr
      ]
    );
  }

  // 2. Insert links if provided
  if (opts.links && opts.links.length > 0) {
    for (const link of opts.links) {
      const src = link.src === '$id' ? id : link.src;
      const tgt = link.tgt === '$id' ? id : link.tgt;
      await db.run(
        `INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active, time)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [src, link.rel, tgt, link.weight ?? 1.0, nowStr]
      );
    }
  }

  // 3. Insert motion log
  const motionAction = opts.motion?.action ?? 1000;
  const motionPhase = opts.motion?.phase ?? null;
  const motionDelta = opts.motion?.delta ?? null;

  await db.run(
    `INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time)
     VALUES (?, COALESCE((SELECT MAX(seq) FROM motion WHERE stream = ?) + 1, 1), ?, ?, ?, ?, ?, ?)`,
    [
      id,
      id,
      motionAction,
      motionPhase,
      motionDelta,
      opts.client_ref || null,
      JSON.stringify({ event: 'created', table: opts.table, type: opts.type }),
      nowStr
    ]
  );

  // 4. Generate embeddings if embed !== false
  if (opts.embed !== false) {
    upsertFormVector(id, {
      title: opts.title || opts.type,
      type: opts.type,
      scope: opts.scope,
      code: opts.code || null,
      data: JSON.stringify(opts.data || {}),
      owner
    }).catch(e => console.warn('[TOOLS] upsertFormVector async failed:', e));
  }

  return { id, time: nowStr, status: 'created' };
}

/**
 * Tool 2: read
 * Queries database records with safety filters, joins, graph traversal, and projection.
 */
export async function read(opts: {
  table: 'form' | 'matter' | 'motion' | 'graph';
  scope: string;
  id?: string;
  type?: string;
  form?: string;
  active?: boolean;
  fields?: string[];
  filters?: { key: string; val: any }[];
  joins?: { table: 'graph'; on: string; as: string }[];
  graph_filter?: { src?: string; rel?: string; tgt?: string };
  depth?: number;
  stream?: string;
  seq_from?: number;
  seq_to?: number;
  order?: string;
  limit?: number;
  offset?: number;
}) {
  const db = routeDbForEntity(opts.table, opts.scope);

  // Build projection
  let selectClause = '*';
  if (opts.fields && opts.fields.length > 0 && opts.table !== 'graph' && opts.table !== 'motion') {
    selectClause = opts.fields.map(f => {
      const alias = f.replace(/\./g, '_');
      return `json_extract(data, '$.${f}') AS ${alias}`;
    }).join(', ');
  }

  let query = `SELECT ${selectClause} FROM ${opts.table}`;
  const params: any[] = [];

  // Joins
  if (opts.joins && opts.joins.length > 0) {
    for (const join of opts.joins) {
      const cleanOn = join.on.replace(/[^a-zA-Z0-9_=.\s]/g, '');
      query += ` LEFT JOIN ${join.table} AS ${join.as} ON ${cleanOn}`;
    }
  }

  query += ' WHERE 1=1';

  if (opts.table !== 'graph') {
    query += ' AND scope = ?';
    params.push(opts.scope);
  }

  if (opts.id) {
    query += ' AND id = ?';
    params.push(opts.id);
  }

  if (opts.type) {
    query += ' AND type = ?';
    params.push(opts.type);
  }

  if (opts.table === 'matter' && opts.form) {
    query += ' AND form = ?';
    params.push(opts.form);
  }

  if (opts.active !== undefined && (opts.table === 'form' || opts.table === 'matter' || opts.table === 'graph')) {
    query += ' AND active = ?';
    params.push(opts.active ? 1 : 0);
  }

  if (opts.table === 'motion') {
    if (opts.stream) {
      query += ' AND stream = ?';
      params.push(opts.stream);
    }
    if (opts.seq_from !== undefined) {
      query += ' AND seq >= ?';
      params.push(opts.seq_from);
    }
    if (opts.seq_to !== undefined) {
      query += ' AND seq <= ?';
      params.push(opts.seq_to);
    }
  }

  if (opts.filters && opts.filters.length > 0 && (opts.table === 'form' || opts.table === 'matter')) {
    for (const filter of opts.filters) {
      query += ' AND json_extract(data, ?) = ?';
      params.push(`$.${filter.key}`, filter.val);
    }
  }

  if (opts.graph_filter) {
    const gf = opts.graph_filter;
    query += ' AND (';
    const parts: string[] = [];
    if (gf.src) { parts.push('src = ?'); params.push(gf.src); }
    if (gf.rel) { parts.push('rel = ?'); params.push(gf.rel); }
    if (gf.tgt) { parts.push('tgt = ?'); params.push(gf.tgt); }
    query += parts.join(' AND ') + ')';
  }

  // Graph depth traversal
  if (opts.depth && opts.depth > 0 && (opts.graph_filter?.src || opts.graph_filter?.tgt)) {
    const maxDepth = Math.min(opts.depth, 3);
    const root = opts.graph_filter.src || opts.graph_filter.tgt;
    const direction = opts.graph_filter.src ? 'src' : 'tgt';
    const other = direction === 'src' ? 'tgt' : 'src';
    query = `
      WITH RECURSIVE traversal(${direction}, rel, ${other}, depth) AS (
        SELECT ${direction}, rel, ${other}, 1 FROM graph
        WHERE ${direction} = ? AND active = 1
        UNION ALL
        SELECT g.${direction}, g.rel, g.${other}, t.depth + 1
        FROM graph g
        JOIN traversal t ON g.${direction} = t.${other}
        WHERE t.depth < ? AND g.active = 1
      )
      SELECT ${selectClause} FROM ${opts.table}
      WHERE id IN (SELECT ${other} FROM traversal)
    `;
    params.unshift(root, maxDepth);
  }

  // Count query
  let countQuery = query.replace(/SELECT\s+.+?\s+FROM\s+/i, 'SELECT COUNT(*) AS c FROM ');
  countQuery = countQuery.replace(/\s+ORDER\s+BY\s+.+$/i, '');
  countQuery = countQuery.replace(/\s+LIMIT\s+\d+\s+OFFSET\s+\d+$/i, '');
  const countRes = await db.get(countQuery, params).catch(() => ({ c: 0 }));
  const count = Number(countRes?.c ?? 0);

  if (opts.order) {
    const cleanOrder = opts.order.replace(/[^a-zA-Z0-9_\s]/g, '');
    query += ` ORDER BY ${cleanOrder}`;
  } else if (opts.table === 'motion') {
    query += ' ORDER BY seq ASC';
  } else if (opts.table === 'form' || opts.table === 'matter') {
    query += ' ORDER BY time DESC';
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.all(query, params).catch(() => []);

  const parsedRows = rows.map((row: any) => {
    const copy = { ...row };
    if (copy.data) {
      try {
        copy.data = JSON.parse(copy.data);
      } catch {}
    }
    return copy;
  });

  const result: { rows: any[]; count: number; next_offset?: number } = {
    rows: parsedRows,
    count
  };
  if (offset + parsedRows.length < count) {
    result.next_offset = offset + parsedRows.length;
  }
  return result;
}

/**
 * Tool 3: update
 * Updates form or matter properties, validates state machine phase transitions, and deep-merges data.
 */
export async function update(opts: {
  table: 'form' | 'matter';
  id: string;
  scope: string;
  patch: {
    qty?: number;
    value?: number;
    active?: boolean;
    mark?: number;
    variant?: number;
    geo?: string;
    start?: string;
    end?: string;
    data?: any;
    title?: string;
    public?: boolean;
  };
  phase?: number;
  opcode?: number;
  delta?: number;
  reason?: string;
  client_ref?: string;
}) {
  const db = routeDbForEntity(opts.table, opts.scope);
  const nowStr = new Date().toISOString();

  const existing = await db.get(`SELECT * FROM ${opts.table} WHERE id = ? AND scope = ?`, [opts.id, opts.scope]).catch(() => null);
  if (!existing) {
    return { success: false, reason: 'record_not_found' };
  }

  requireOwner(opts.scope, existing.owner ? String(existing.owner) : null);

  // Idempotency check
  if (opts.client_ref) {
    const existingMotion = await db.get(
      'SELECT seq FROM motion WHERE stream = ? AND client_ref = ? ORDER BY seq DESC LIMIT 1',
      [opts.id, opts.client_ref]
    ).catch(() => null);
    if (existingMotion) {
      return { success: true, id: opts.id, time: nowStr, seq: Number(existingMotion.seq) };
    }
  }

  let finalOpcode = opts.opcode ?? 1001;
  let targetStateName = '';

  if (opts.phase !== undefined && opts.table === 'matter') {
    const blueprint = await db.get('SELECT data FROM form WHERE id = ?', [existing.form]).catch(() => null);
    if (blueprint?.data) {
      const bpData = parseJson(blueprint.data);
      const states = bpData.states || [];
      const transitions = bpData.transitions || [];
      const targetState = states[opts.phase];

      if (!targetState) {
        return { success: false, reason: 'invalid_phase_index' };
      }

      const currentData = parseJson(existing.data);
      const currentState = currentData.state || states[0] || 'pending';

      const transition = transitions.find((t: any) =>
        (t.from === currentState || t.from === '*') && t.to === targetState
      );

      if (!transition) {
        return { success: false, reason: 'invalid_transition' };
      }

      finalOpcode = transition.opcode ?? finalOpcode;
      targetStateName = targetState;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (opts.patch.qty !== undefined && opts.table === 'matter') {
    sets.push('qty = ?');
    params.push(opts.patch.qty);
  }
  if (opts.patch.value !== undefined && opts.table === 'matter') {
    sets.push('value = ?');
    params.push(opts.patch.value);
  }
  if (opts.patch.active !== undefined) {
    sets.push('active = ?');
    params.push(opts.patch.active ? 1 : 0);
  }
  if (opts.patch.mark !== undefined && opts.table === 'matter') {
    sets.push('mark = ?');
    params.push(opts.patch.mark);
  }
  if (opts.patch.variant !== undefined && opts.table === 'matter') {
    sets.push('variant = ?');
    params.push(opts.patch.variant);
  }
  if (opts.patch.geo !== undefined && opts.table === 'matter') {
    sets.push('geo = ?');
    params.push(opts.patch.geo);
  }
  if (opts.patch.start !== undefined && opts.table === 'matter') {
    sets.push('start = ?');
    params.push(opts.patch.start);
  }
  if (opts.patch.end !== undefined && opts.table === 'matter') {
    sets.push('end = ?');
    params.push(opts.patch.end);
  }
  if (opts.patch.title !== undefined) {
    sets.push('title = ?');
    params.push(opts.patch.title);
  }
  if (opts.patch.public !== undefined && opts.table === 'form') {
    sets.push('public = ?');
    params.push(opts.patch.public ? 1 : 0);
  }

  let mergedData = parseJson(existing.data);
  if (opts.patch.data !== undefined) {
    mergedData = deepMerge(mergedData, opts.patch.data);
  }
  if (opts.patch.title !== undefined && opts.table === 'matter') {
    mergedData.title = opts.patch.title;
  }
  if (targetStateName) {
    mergedData.state = targetStateName;
  }

  sets.push('data = ?');
  params.push(JSON.stringify(mergedData));

  params.push(opts.id, opts.scope);
  await db.run(
    `UPDATE ${opts.table} SET ${sets.join(', ')} WHERE id = ? AND scope = ?`,
    params
  );

  const nextSeqRes = await db.get('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', [opts.id]);
  const nextSeq = Number(nextSeqRes?.next ?? 1);

  await db.run(
    `INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.id,
      nextSeq,
      finalOpcode,
      opts.phase ?? null,
      opts.delta ?? null,
      opts.client_ref || null,
      JSON.stringify({ reason: opts.reason || '', changed: Object.keys(opts.patch) }),
      nowStr
    ]
  );

  const updatedRecord = await db.get(`SELECT * FROM ${opts.table} WHERE id = ?`, [opts.id]);
  if (updatedRecord) {
    upsertFormVector(opts.id, {
      title: String(updatedRecord.title || updatedRecord.type || ''),
      type: String(updatedRecord.type || ''),
      scope: String(updatedRecord.scope || ''),
      code: updatedRecord.code ? String(updatedRecord.code) : null,
      data: String(updatedRecord.data || '{}'),
      owner: updatedRecord.owner ? String(updatedRecord.owner) : null
    }).catch(() => {});
  }

  return { success: true, id: opts.id, time: nowStr, seq: nextSeq };
}

/**
 * Tool 4: delete (aliased to del)
 * Soft-deactivates records and cascades graph edge deactivations.
 * Restricts hard deletes to personal (p:) data owned by self.
 */
export async function del(opts: {
  table: 'form' | 'matter' | 'graph';
  id: string;
  scope: string;
  hard?: boolean;
  cascade?: boolean;
  client_ref?: string;
}) {
  const db = routeDbForEntity(opts.table, opts.scope);
  const nowStr = new Date().toISOString();

  const isPersonal = opts.scope === 'p' || opts.scope.startsWith('p:');
  const hardDelete = opts.hard && isPersonal;

  if (opts.table === 'graph') {
    if (hardDelete) {
      await db.run('DELETE FROM graph WHERE src = ? OR tgt = ?', [opts.id, opts.id]);
    } else {
      await db.run('UPDATE graph SET active = 0 WHERE src = ? OR tgt = ?', [opts.id, opts.id]);
    }
    return { id: opts.id, mode: hardDelete ? 'hard' : 'soft' };
  }

  const existing = await db.get(`SELECT * FROM ${opts.table} WHERE id = ? AND scope = ?`, [opts.id, opts.scope]).catch(() => null);
  if (existing) {
    requireOwner(opts.scope, existing.owner ? String(existing.owner) : null);
  }

  if (hardDelete) {
    await db.run(`DELETE FROM ${opts.table} WHERE id = ? AND scope = ?`, [opts.id, opts.scope]);
    deleteFormVector(opts.id).catch(() => {});
  } else {
    await db.run(`UPDATE ${opts.table} SET active = 0 WHERE id = ? AND scope = ?`, [opts.id, opts.scope]);
  }

  if (opts.cascade !== false) {
    await db.run('UPDATE graph SET active = 0 WHERE src = ? OR tgt = ?', [opts.id, opts.id]);
  }

  const nextSeqRes = await db.get('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', [opts.id]);
  const nextSeq = Number(nextSeqRes?.next ?? 1);

  await db.run(
    `INSERT INTO motion (stream, seq, action, client_ref, data, time)
     VALUES (?, ?, 1002, ?, ?, ?)`,
    [
      opts.id,
      nextSeq,
      opts.client_ref || null,
      JSON.stringify({ event: 'deleted', mode: hardDelete ? 'hard' : 'soft' }),
      nowStr
    ]
  );

  return { id: opts.id, mode: hardDelete ? 'hard' : 'soft', seq: nextSeq };
}

/**
 * Tool 5: link
 * Connects two entity nodes via weight-attributed graph edges.
 */
export async function link(opts: {
  src: string;
  rel: string;
  tgt: string;
  weight?: number;
  bidirectional?: boolean;
  active?: boolean;
  scope: string;
  scope_check?: string;
  client_ref?: string;
}) {
  const db = routeDbForEntity('graph', opts.scope);
  const nowStr = new Date().toISOString();
  const isActive = opts.active !== false ? 1 : 0;
  const weight = opts.weight ?? 1.0;

  if (opts.scope_check) {
    const srcExists = await db.get(
      'SELECT 1 FROM form WHERE id = ? AND scope = ? UNION ALL SELECT 1 FROM matter WHERE id = ? AND scope = ?',
      [opts.src, opts.scope_check, opts.src, opts.scope_check]
    ).catch(() => null);
    const tgtExists = await db.get(
      'SELECT 1 FROM form WHERE id = ? AND scope = ? UNION ALL SELECT 1 FROM matter WHERE id = ? AND scope = ?',
      [opts.tgt, opts.scope_check, opts.tgt, opts.scope_check]
    ).catch(() => null);
    if (!srcExists || !tgtExists) {
      throw new Error(`scope_check failed: src or tgt not found in scope ${opts.scope_check}`);
    }
  }

  await db.run(
    `INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active, time)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [opts.src, opts.rel, opts.tgt, weight, isActive, nowStr]
  );

  if (opts.bidirectional) {
    await db.run(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active, time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [opts.tgt, opts.rel, opts.src, weight, isActive, nowStr]
    );
  }

  const nextSeqRes = await db.get('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', [opts.src]);
  const nextSeq = Number(nextSeqRes?.next ?? 1);

  await db.run(
    `INSERT INTO motion (stream, seq, action, client_ref, data, time)
     VALUES (?, ?, 1001, ?, ?, ?)`,
    [
      opts.src,
      nextSeq,
      opts.client_ref || null,
      JSON.stringify({ rel: opts.rel, tgt: opts.tgt, weight, active: isActive }),
      nowStr
    ]
  );

  return { src: opts.src, rel: opts.rel, tgt: opts.tgt, status: isActive ? 'linked' : 'unlinked' };
}

// Search helpers -----------------------------------------------------------

async function searchFTS(
  db: Database,
  queryStr: string,
  limit: number,
  scope?: string,
  type?: string,
  table?: 'form' | 'matter'
): Promise<{ id: string; text: string; meta: any; similarity: number; source: string }[]> {
  const words = queryStr.toLowerCase().split(/\s+/).filter(w => w.trim().length > 0);
  if (words.length === 0) return [];

  let sql = 'SELECT id, text, meta FROM memory WHERE 1=1';
  const params: any[] = [];

  const likeClauses = words.map(() => 'LOWER(text) LIKE ?');
  if (likeClauses.length > 0) {
    sql += ` AND (${likeClauses.join(' AND ')})`;
    words.forEach(w => params.push(`%${w}%`));
  }

  if (scope) {
    sql += " AND json_extract(meta, '$.scope') = ?";
    params.push(scope);
  }
  if (type) {
    sql += " AND json_extract(meta, '$.type') = ?";
    params.push(type);
  }
  if (table) {
    sql += " AND json_extract(meta, '$.table') = ?";
    params.push(table);
  }

  sql += ' LIMIT ?';
  params.push(limit);

  const rows = await db.all(sql, params).catch(() => []);
  return rows.map((r: any) => {
    const parsedMeta = parseJson(r.meta);
    return {
      id: r.id,
      text: r.text,
      meta: parsedMeta,
      similarity: 1.0,
      source: 'fts'
    };
  });
}

function scoreFTS(query: string, text: string): number {
  const qWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tWords = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (qWords.length === 0 || tWords.length === 0) return 0;
  let matches = 0;
  for (const qw of qWords) {
    if (tWords.some(tw => tw.includes(qw))) matches++;
  }
  return matches / qWords.length;
}

async function searchStructured(
  db: Database,
  opts: any,
  limit: number
): Promise<{ id: string; text: string; meta: any; similarity: number; source: string }[]> {
  const table = opts.table || 'matter';
  if (table !== 'form' && table !== 'matter') return [];

  let sql = `SELECT id, type, scope, data FROM ${table} WHERE active = 1`;
  const params: any[] = [];

  if (opts.scope) {
    sql += ' AND scope = ?';
    params.push(opts.scope);
  }
  if (opts.type) {
    sql += ' AND type = ?';
    params.push(opts.type);
  }
  if (opts.filters && opts.filters.length > 0) {
    for (const filter of opts.filters) {
      sql += ' AND json_extract(data, ?) = ?';
      params.push(`$.${filter.key}`, filter.val);
    }
  }
  sql += ' ORDER BY time DESC LIMIT ?';
  params.push(limit);

  const rows = await db.all(sql, params).catch(() => []);
  return rows.map((r: any) => {
    const data = parseJson(r.data);
    return {
      id: r.id,
      text: String(data.title || data.description || data.body || r.type || ''),
      meta: { table, scope: r.scope, type: r.type, title: String(data.title || '') },
      similarity: 1.0,
      source: 'structured'
    };
  });
}

async function hasEmbeddings(db: Database, scope?: string, type?: string): Promise<boolean> {
  let sql = 'SELECT 1 FROM memory WHERE 1=1';
  const params: any[] = [];
  if (scope) {
    sql += " AND json_extract(meta, '$.scope') = ?";
    params.push(scope);
  }
  if (type) {
    sql += " AND json_extract(meta, '$.type') = ?";
    params.push(type);
  }
  sql += ' LIMIT 1';
  const row = await db.get(sql, params).catch(() => null);
  return !!row;
}

/**
 * Tool 6: search
 * Supports hybrid (default), vector, fts, and structured modes.
 */
export async function search(opts: {
  query: string;
  scope?: string;
  type?: string;
  table?: 'form' | 'matter';
  mode?: 'hybrid' | 'vector' | 'fts' | 'structured';
  filters?: { key: string; val: any }[];
  limit?: number;
  threshold?: number;
}) {
  const limit = opts.limit ?? 10;
  const threshold = opts.threshold ?? 0.3;
  const mode = opts.mode ?? 'hybrid';
  const db = getUserDb();

  if (mode === 'structured') {
    return searchStructured(db, opts, limit);
  }

  const embeddingsAvailable = await hasEmbeddings(db, opts.scope, opts.type);
  const effectiveMode = !embeddingsAvailable && mode === 'hybrid' ? 'fts' : mode;

  if (mode === 'fts' || effectiveMode === 'fts') {
    const ftsHits = await searchFTS(db, opts.query, limit, opts.scope, opts.type, opts.table);
    return ftsHits.map(h => ({ ...h, similarity: scoreFTS(opts.query, h.text) })).filter(h => h.similarity >= threshold);
  }

  if (mode === 'vector' || mode === 'hybrid') {
    try {
      const hits = await searchFormVectors(opts.query, limit * 2);
      const vecResults: { id: string; text: string; meta: any; similarity: number; source: string }[] = [];

      for (const hit of hits) {
        if (hit.similarity < threshold) continue;
        const memRow = await db.get('SELECT id, text, meta FROM memory WHERE id = ? LIMIT 1', [hit.formId]);
        if (memRow) {
          const parsedMeta = parseJson(memRow.meta);
          if (opts.scope && parsedMeta.scope !== opts.scope) continue;
          if (opts.type && parsedMeta.type !== opts.type) continue;
          if (opts.table && parsedMeta.table !== opts.table) continue;
          vecResults.push({
            id: hit.formId,
            text: String(memRow.text || ''),
            meta: parsedMeta,
            similarity: hit.similarity,
            source: 'vector'
          });
        }
      }

      if (mode === 'vector') {
        return vecResults.slice(0, limit);
      }

      // Hybrid: merge vector + FTS with 0.7/0.3 weights
      const ftsHits = await searchFTS(db, opts.query, limit * 2, opts.scope, opts.type, opts.table);
      const ftsMap = new Map<string, number>();
      for (const h of ftsHits) {
        const score = scoreFTS(opts.query, h.text);
        ftsMap.set(h.id, Math.max(ftsMap.get(h.id) || 0, score));
      }

      const merged = new Map<string, { id: string; text: string; meta: any; similarity: number; source: string }>();
      for (const v of vecResults) {
        const ftsScore = ftsMap.get(v.id) || 0;
        const score = 0.7 * v.similarity + 0.3 * ftsScore;
        if (score >= threshold) {
          merged.set(v.id, { ...v, similarity: score, source: 'hybrid' });
        }
      }
      for (const f of ftsHits) {
        if (merged.has(f.id)) continue;
        const ftsScore = scoreFTS(opts.query, f.text);
        if (ftsScore >= threshold) {
          merged.set(f.id, { ...f, similarity: 0.3 * ftsScore, source: 'hybrid' });
        }
      }

      return Array.from(merged.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (e) {
      console.error('[SEARCH] Vector search failed:', e);
      const ftsHits = await searchFTS(db, opts.query, limit, opts.scope, opts.type, opts.table);
      return ftsHits.map(h => ({ ...h, similarity: scoreFTS(opts.query, h.text) })).filter(h => h.similarity >= threshold);
    }
  }

  return [];
}
