/**
 * SQLite database operations for Durable Objects.
 * Uses native Durable Object SQLite storage (this.ctx.storage.sql).
 */

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

export function executeDoCreate(sqlExecutor: any, input: {
  table: string; scope?: string; type?: string; form?: string;
  title?: string; value?: number; qty?: number; unit?: string;
  data?: Record<string, any>; owner?: string;
  src?: string; rel?: string; tgt?: string;
  text?: string; embedding?: string; meta?: Record<string, any>;
  stream?: string; action?: number; phase?: number; delta?: number;
  [key: string]: any;
}) {
  const now = new Date().toISOString();

  if (input.table === 'form') {
    const id = `form_${Date.now()}`;
    sqlExecutor.exec(
      `INSERT INTO form (id, type, scope, title, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      id, input.type || 'unknown', input.scope || '', input.title || null, JSON.stringify(input.data || {}), now
    );
    return { id, time: now, status: 'created' };
  }

  if (input.table === 'matter') {
    const id = `matter_${Date.now()}`;
    sqlExecutor.exec(
      `INSERT INTO matter (id, form, type, scope, title, value, qty, data, owner, time, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      id, input.form || '', input.type || 'unknown', input.scope || '', input.title || null, input.value ?? null, input.qty ?? null, JSON.stringify(input.data || {}), input.owner || null, now
    );
    return { id, time: now, status: 'created' };
  }

  if (input.table === 'motion') {
    const stream = input.stream || input.scope || 'default';
    const nextSeqRes = sqlExecutor.exec('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', stream).toArray()[0];
    const seq = Number(nextSeqRes?.next ?? 1);
    sqlExecutor.exec(
      `INSERT INTO motion (stream, seq, action, phase, delta, data, time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      stream, seq, input.action ?? 0, input.phase ?? null, input.delta ?? null, JSON.stringify(input.data || {}), now
    );
    return { stream, seq, status: 'created' };
  }

  if (input.table === 'graph') {
    if (!input.src || !input.rel || !input.tgt) return { error: 'src, rel, tgt required for graph' };
    sqlExecutor.exec(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, active, time) VALUES (?, ?, ?, 1, ?)`,
      input.src, input.rel, input.tgt, now
    );
    return { src: input.src, rel: input.rel, tgt: input.tgt, status: 'linked' };
  }

  if (input.table === 'memory') {
    const id = input.text ? `mem_${Date.now()}` : `mem_${Date.now()}`;
    sqlExecutor.exec(
      `INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta) VALUES (?, 0, ?, ?, ?, ?)`,
      id, null, input.text || '', input.embedding || '', JSON.stringify(input.meta || {})
    );
    return { id, status: 'stored' };
  }

  return { error: `Unknown table: ${input.table}` };
}

export function executeDoRead(sqlExecutor: any, input: {
  table: string; id?: string; scope?: string; type?: string;
  src?: string; rel?: string; tgt?: string;
  stream?: string; active?: boolean;
  limit?: number; offset?: number;
  filters?: Array<{ key: string; val: any }>;
  [key: string]: any;
}) {
  if (input.table === 'graph') {
    let sql = 'SELECT * FROM graph WHERE 1=1';
    const args: any[] = [];
    if (input.src) { sql += ' AND src = ?'; args.push(input.src); }
    if (input.rel) { sql += ' AND rel = ?'; args.push(input.rel); }
    if (input.tgt) { sql += ' AND tgt = ?'; args.push(input.tgt); }
    sql += ' AND active = 1';
    sql += ' LIMIT ?';
    args.push(input.limit ?? 50);
    const rows = sqlExecutor.exec(sql, ...args).toArray();
    return { rows, count: rows.length };
  }

  if (input.table === 'motion') {
    let sql = 'SELECT * FROM motion WHERE 1=1';
    const args: any[] = [];
    if (input.stream) { sql += ' AND stream = ?'; args.push(input.stream); }
    if (input.id) { sql += ' AND stream = ?'; args.push(input.id); }
    sql += ' ORDER BY seq DESC LIMIT ?';
    args.push(input.limit ?? 50);
    const rows = sqlExecutor.exec(sql, ...args).toArray();
    return { rows: rows.map((r: any) => ({ ...r, data: parseJson(r.data) })), count: rows.length };
  }

  if (input.table === 'memory') {
    let sql = 'SELECT * FROM memory WHERE 1=1';
    const args: any[] = [];
    if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
    if (input.scope) { sql += " AND json_extract(meta, '$.scope') = ?"; args.push(input.scope); }
    sql += ' LIMIT ?';
    args.push(input.limit ?? 50);
    const rows = sqlExecutor.exec(sql, ...args).toArray();
    return { rows: rows.map((r: any) => ({ ...r, meta: parseJson(r.meta) })), count: rows.length };
  }

  // form or matter
  let sql = `SELECT * FROM ${input.table} WHERE 1=1`;
  const args: any[] = [];

  if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
  if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
  if (input.type) { sql += ' AND type = ?'; args.push(input.type); }
  if (input.active !== undefined) { sql += ' AND active = ?'; args.push(input.active ? 1 : 0); }

  if (input.filters) {
    for (const f of input.filters) {
      sql += ` AND json_extract(data, ?) = ?`;
      args.push(`$.${f.key}`, f.val);
    }
  }

  sql += ' ORDER BY time DESC';
  sql += ' LIMIT ? OFFSET ?';
  args.push(input.limit ?? 50, input.offset ?? 0);

  const rows = sqlExecutor.exec(sql, ...args).toArray();
  return { rows: rows.map((r: any) => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

export function executeDoUpdate(sqlExecutor: any, input: {
  table: string; id?: string; scope?: string; type?: string;
  patch: Record<string, any>;
  [key: string]: any;
}) {
  const now = new Date().toISOString();
  const sets: string[] = ['updated = ?'];
  const args: any[] = [now];

  for (const [key, val] of Object.entries(input.patch)) {
    if (val !== undefined) {
      if (key === 'data') {
        const existing = input.id ? sqlExecutor.exec(`SELECT data FROM ${input.table} WHERE id = ?`, input.id).toArray()[0] : null;
        const merged = { ...parseJson(existing?.data), ...val };
        sets.push('data = ?');
        args.push(JSON.stringify(merged));
      } else {
        sets.push(`${key} = ?`);
        args.push(val);
      }
    }
  }

  let whereClause = 'WHERE 1=1';
  if (input.id) { whereClause += ' AND id = ?'; args.push(input.id); }
  if (input.scope) { whereClause += ' AND scope = ?'; args.push(input.scope); }
  if (input.type) { whereClause += ' AND type = ?'; args.push(input.type); }

  sqlExecutor.exec(`UPDATE ${input.table} SET ${sets.join(', ')} ${whereClause}`, ...args);

  // Log update to motion for matter table
  if (input.table === 'matter' && input.id) {
    const seq = Date.now();
    sqlExecutor.exec(
      `INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 1001, ?, ?, ?)`,
      input.id, seq, null, JSON.stringify({ changed: Object.keys(input.patch) }), now
    );
  }

  return { success: true, time: now };
}

export function executeDoDelete(sqlExecutor: any, input: {
  table: string; id?: string; scope?: string;
  src?: string; rel?: string; tgt?: string;
  [key: string]: any;
}) {
  const now = new Date().toISOString();

  if (input.table === 'graph') {
    if (input.src && input.rel && input.tgt) {
      sqlExecutor.exec(
        `UPDATE graph SET active = 0, time = ? WHERE src = ? AND rel = ? AND tgt = ?`,
        now, input.src, input.rel, input.tgt
      );
      return { success: true, status: 'deactivated' };
    }
    return { error: 'src, rel, tgt required for graph delete' };
  }

  let whereClause = 'WHERE 1=1';
  const args: any[] = [now];
  if (input.id) { whereClause += ' AND id = ?'; args.push(input.id); }
  if (input.scope) { whereClause += ' AND scope = ?'; args.push(input.scope); }

  sqlExecutor.exec(`UPDATE ${input.table} SET active = 0, updated = ? ${whereClause}`, ...args);
  return { success: true, status: 'soft_deleted' };
}

export function executeDoLink(sqlExecutor: any, input: {
  src: string; rel: string; tgt: string; active?: boolean;
}) {
  const now = new Date().toISOString();
  const active = input.active !== undefined ? (input.active ? 1 : 0) : 1;

  const existing = sqlExecutor.exec(
    'SELECT active FROM graph WHERE src = ? AND rel = ? AND tgt = ?',
    input.src, input.rel, input.tgt
  ).toArray()[0];

  if (existing) {
    sqlExecutor.exec(
      'UPDATE graph SET active = ?, time = ? WHERE src = ? AND rel = ? AND tgt = ?',
      active, now, input.src, input.rel, input.tgt
    );
    return { src: input.src, rel: input.rel, tgt: input.tgt, status: active ? 'activated' : 'deactivated' };
  }

  sqlExecutor.exec(
    'INSERT INTO graph (src, rel, tgt, active, time) VALUES (?, ?, ?, ?, ?)',
    input.src, input.rel, input.tgt, active, now
  );
  return { src: input.src, rel: input.rel, tgt: input.tgt, status: 'linked' };
}

export function executeDoSearch(sqlExecutor: any, input: {
  query: string; scope?: string; type?: string; limit?: number;
}) {
  const words = input.query.toLowerCase().split(/\s+/).filter(w => w.trim());
  if (words.length === 0) return { rows: [], count: 0 };

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

  const rows = sqlExecutor.exec(sql, ...args).toArray();
  return {
    rows: rows.map((r: any) => ({
      id: r.id,
      text: r.text || '',
      meta: parseJson(r.meta),
      similarity: 0.8,
      source: 'fts',
    })),
    count: rows.length,
  };
}
